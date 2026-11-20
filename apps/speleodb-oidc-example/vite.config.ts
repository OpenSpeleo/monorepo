import type { ServerResponse } from 'node:http';
import * as oidc from 'openid-client';
import { defineConfig, loadEnv } from 'vite';

const host = '127.0.0.1';
const port = 8300;
const origin = `http://${host}:${port}`;
const callback = new URL('/callback', origin);
const requestedScope = 'openid email data:read';
const { OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET } = loadEnv('development', import.meta.dirname, 'OIDC_');
const issuer = new URL(OIDC_ISSUER ?? 'http://localhost:8000');

type Session =
    | { state: string; nonce: string; verifier: string }
    | { email?: string; accessToken: string; canReadProjects: boolean };

const sessions = new Map<string, Session>();
const cookieName = 'speleodb_example';

function saveSession(res: ServerResponse, session: Session, seconds: number) {
    const id = crypto.randomUUID();
    sessions.set(id, session);
    setTimeout(() => sessions.delete(id), seconds * 1000).unref();
    res.setHeader('Set-Cookie', `${cookieName}=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${seconds}`);
}

function redirect(res: ServerResponse, location: string) {
    res.writeHead(303, { Location: location }).end();
}

async function discover() {
    if (!OIDC_CLIENT_ID || !OIDC_CLIENT_SECRET) {
        throw new Error('Set OIDC_CLIENT_ID and OIDC_CLIENT_SECRET in .env.');
    }
    const execute = [oidc.enableNonRepudiationChecks];
    if (issuer.protocol === 'http:' && issuer.hostname === 'localhost') {
        execute.push(oidc.allowInsecureRequests);
    }
    return oidc.discovery(issuer, OIDC_CLIENT_ID, undefined, oidc.ClientSecretBasic(OIDC_CLIENT_SECRET), { execute });
}

export default defineConfig({
    server: { host, port, strictPort: true, cors: false },
    plugins: [{
        name: 'speleodb-oidc-example',
        configureServer(server) {
            let config: oidc.Configuration | undefined;
            server.middlewares.use(async (req, res, next) => {
                const url = new URL(req.url ?? '/', origin);
                if (req.headers.host === `localhost:${port}`) {
                    redirect(res, `${origin}${url.pathname}${url.search}`);
                    return;
                }
                if (!['/login', '/callback', '/api/session'].includes(url.pathname)) return next();
                res.setHeader('Cache-Control', 'no-store');
                res.setHeader('Referrer-Policy', 'no-referrer');
                if (req.method !== 'GET') {
                    res.writeHead(405, { Allow: 'GET' }).end();
                    return;
                }

                const cookie = req.headers.cookie?.split('; ').find(value => value.startsWith(`${cookieName}=`));
                const id = cookie?.slice(cookieName.length + 1) ?? '';
                const session = sessions.get(id);
                try {
                    if (url.pathname === '/api/session') {
                        res.setHeader('Content-Type', 'application/json');
                        if (!session || !('accessToken' in session)) {
                            res.end(JSON.stringify({ signedIn: false }));
                            return;
                        }
                        const identity = { signedIn: true, email: session.email };
                        if (!session.canReadProjects) {
                            res.end(JSON.stringify(identity));
                            return;
                        }
                        const projects = await fetch(new URL('/api/v2/projects/', issuer), {
                            headers: { Authorization: `Bearer ${session.accessToken}`, Accept: 'application/json' },
                            redirect: 'error',
                        });
                        if ([401, 403].includes(projects.status)) {
                            sessions.delete(id);
                            res.end(JSON.stringify({ signedIn: false, message: 'Project access ended. Sign in again.' }));
                            return;
                        }
                        if (!projects.ok) throw new Error(`Projects API returned HTTP ${projects.status}`);
                        const data: unknown = await projects.json();
                        if (!Array.isArray(data)) throw new Error('Expected a list of projects.');
                        res.end(JSON.stringify({ ...identity, projectCount: data.length }));
                        return;
                    }

                    if (url.pathname === '/login') {
                        config ??= await discover();
                        const state = oidc.randomState();
                        const nonce = oidc.randomNonce();
                        const verifier = oidc.randomPKCECodeVerifier();
                        const authorizationUrl = oidc.buildAuthorizationUrl(config, {
                            response_type: 'code',
                            redirect_uri: callback.href,
                            scope: requestedScope,
                            code_challenge_method: 'S256',
                            code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
                            state, nonce,
                        });
                        saveSession(res, { state, nonce, verifier }, 600);
                        redirect(res, authorizationUrl.href);
                        return;
                    }

                    if (!session || !('verifier' in session) || !config) {
                        redirect(res, '/?error=signin');
                        return;
                    }
                    const tokens = await oidc.authorizationCodeGrant(config, url, {
                        expectedState: session.state,
                        expectedNonce: session.nonce,
                        pkceCodeVerifier: session.verifier,
                    });
                    sessions.delete(id);
                    const claims = tokens.claims();
                    if (!claims) throw new Error('An ID token is required.');
                    const email = claims.email_verified === true && typeof claims.email === 'string' ? claims.email : undefined;
                    const canReadProjects = (tokens.scope ?? requestedScope).split(' ').includes('data:read');
                    saveSession(res, { email, accessToken: tokens.access_token, canReadProjects }, tokens.expires_in ?? 3600);
                    redirect(res, '/');
                } catch (error) {
                    if (error instanceof oidc.AuthorizationResponseError && error.error === 'access_denied') {
                        sessions.delete(id);
                        redirect(res, '/?error=denied');
                    } else if (url.pathname === '/api/session') {
                        res.writeHead(502).end(JSON.stringify({ message: 'Could not load projects from SpeleoDB.' }));
                    } else {
                        const reason = error instanceof Error ? error.name : 'unknown error';
                        server.config.logger.error(`SpeleoDB sign-in failed (${reason}). Check the issuer and credentials in .env.`);
                        redirect(res, '/?error=signin');
                    }
                }
            });
        },
    }],
});

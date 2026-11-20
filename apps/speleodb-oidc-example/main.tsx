import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

type Session =
    | { signedIn: false; message?: string }
    | { signedIn: true; email?: string; projectCount?: number };

function Example() {
    const [session, setSession] = useState<Session>();
    useEffect(() => {
        async function load() {
            const response = await fetch('/api/session');
            if (!response.ok) throw new Error();
            setSession(await response.json());
        }
        load().catch(() => setSession({ signedIn: false, message: 'Could not load projects from SpeleoDB.' }));
    }, []);

    if (!session) return <p>Loading…</p>;
    if (session.signedIn) {
        return <>
            <p>{session.email ? <>Signed in as <strong>{session.email}</strong></> : 'Signed in with SpeleoDB'}</p>
            <p>{session.projectCount === undefined
                ? 'Project access was not granted.'
                : <>Projects you can read: <strong>{session.projectCount}</strong></>}</p>
        </>;
    }
    const error = new URLSearchParams(window.location.search).get('error');
    const message = error === 'denied' ? 'You declined access.' :
        error === 'signin' ? 'Sign-in failed. Check the app configuration and try again.' : session.message;
    return <>
        {message && <p role="status">{message}</p>}
        <a href="/login">Sign in with SpeleoDB</a>
    </>;
}

createRoot(document.getElementById('root')!).render(<Example />);

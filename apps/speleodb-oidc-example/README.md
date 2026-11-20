# Sign in with SpeleoDB

This local example runs a React page and an OpenID Connect client in one
Bun/Vite process. Click **Sign in with SpeleoDB** to sign in. If you share your
verified email, the page displays it. If you grant project access, it also
displays the number of projects returned by `GET /api/v2/projects/`.

## Run locally

1. Start SpeleoDB at `http://localhost:8000` with its 4096-bit RSA signing key
   configured on the Django web server. See the
   [provider setup guide](../web/docs/sign-in-with-speleodb.md#configure-the-provider-signing-key).
2. In Django admin, register a confidential client with the exact callback URL
   `http://127.0.0.1:8300/callback`. SpeleoDB configures the code grant and the
   `openid`, `email`, and `data:read` scopes for the website.
3. Copy `.env.example` to `.env` in this directory. Set `OIDC_CLIENT_ID` and
   `OIDC_CLIENT_SECRET` using the values from admin.
4. From the monorepo root, install the locked workspace dependencies with
   `bun ci`. Start the example from its directory.

   ```sh
   cd apps/speleodb-oidc-example
   bun run dev
   ```

5. Open `http://127.0.0.1:8300`, sign in, and approve the app. A count of zero
   is valid. To try revocation, grant project access, open **Connected Apps →
   Manage Apps** in SpeleoDB Account Settings, then choose **Revoke Access** for
   the example and reload it.

The browser holds an HTTP-only session cookie. The server exchanges the code
using PKCE and verifies the signed ID token. It keeps the access token in memory
until it expires or the example process exits. When you grant project access,
reloading fetches the list again and detects revocation. A sign-in without
project access stays local until its session expires. Opening
`http://localhost:8300` redirects to `http://127.0.0.1:8300` so the sign-in and
callback use the same cookie and SpeleoDB's cookies stay on its own hostname.

`bun run build` type-checks the server and browser code and builds the React
assets. Use `bun run dev` for the interactive example, which needs Vite's local
server middleware for the callback.

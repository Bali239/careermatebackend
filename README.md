# AI Career Assistant API

The Express API is a separate project from the Next.js client. It provides versioned health and authentication endpoints backed by MongoDB.

## Prerequisites

- Node.js 20 or newer
- npm
- MongoDB running locally or an accessible MongoDB connection string

## Setup

```bash
npm install
cp .env.example .env
```

Update `.env` before starting the server:

- Set `JWT_ACCESS_SECRET` to a unique random value of at least 32 characters (`openssl rand -hex 32` is one way to generate it).
- Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` for Google sign-in. For new setups, use and register `http://localhost:5000/api/v1/auth/google/callback` as an authorized redirect URI. The server also accepts the legacy `http://localhost:5000/api/auth/google/callback` path so existing OAuth clients keep working; the exact URI used in Google Cloud Console must match `GOOGLE_REDIRECT_URI`.
- Enable the Gmail API and configure `GMAIL_SENDER_EMAIL` and `GMAIL_REFRESH_TOKEN` for the app-owned sender account. The refresh token must have the `https://www.googleapis.com/auth/gmail.send` scope. Keep all these values server-side.
- Set `MONGODB_URI` if your MongoDB connection differs from the local default.

Do not commit `.env` or put secrets in source control. Google sign-in and Gmail sending can be configured independently. In development, when Gmail credentials are not configured, verification and password reset links are printed in the server terminal for local testing. In production, configure Gmail API credentials; the server never logs links there.

## MongoDB locally

With MongoDB Community Server installed and running as a service, the default connection is:

```text
mongodb://127.0.0.1:27017/ai_career_assistant
```

On systems where you run MongoDB manually, start the daemon with `mongod --dbpath <path-to-your-data-directory>` after creating that directory. On Windows, start the MongoDB service from Services or run `net start MongoDB` in an elevated terminal.

## Run

```bash
npm run dev
```

For production mode:

```bash
npm start
```

The server connects to MongoDB before listening. If the database is unavailable or the port is already occupied, startup reports the error and exits. Set `PORT` in `.env` to use another available port.

## Health endpoint

`GET http://localhost:5000/api/v1/health` returns a JSON status, service name, environment, and timestamp when the API is ready.

## Authentication

The API supports `POST /api/v1/auth/signup`, `/login`, `/refresh`, `/logout`, `/verify-email`, `/verify-email/resend`, `/forgot-password`, `/reset-password`, and `/google/exchange`; `GET /api/v1/auth/me`, `/google`, and `/google/callback` complete the flow. Protected requests use `Authorization: Bearer <access-token>`. No cookies or SMTP are used.

Access tokens expire after 15 minutes. Refresh tokens are random, rotated on refresh, stored hashed in MongoDB, and expire after 30 days. Verification and reset links are single-use and expire after 24 hours and 1 hour respectively. Password reset responses do not reveal whether an email address has an account.

For Gmail API authorization, consent the dedicated sender Gmail account with the `gmail.send` scope and store its refresh token in `GMAIL_REFRESH_TOKEN`. Google documents the send endpoint and required scopes in [Gmail API messages.send](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send) and the server-side OAuth flow in [Gmail API server-side authorization](https://developers.google.com/workspace/gmail/api/auth/web-server). Google sign-in uses the backend OAuth callback and requests only `openid email profile`.

## Environment variables

`NODE_ENV`, `PORT`, `CLIENT_URL`, `MONGODB_URI`, and `JWT_ACCESS_SECRET` are configured in `.env.example`. Google OAuth and Gmail API credentials are needed for the corresponding authentication and email flows. `GEMINI_API_KEY` remains optional for future AI features.

## Troubleshooting

- **MongoDB connection fails:** Check that MongoDB is running and that `MONGODB_URI` is correct and reachable.
- **Port is in use:** Stop the other process or set a free port in `.env`; keep the client API URL in sync.
- **Browser reports a CORS error:** Set `CLIENT_URL` to the exact client origin, such as `http://localhost:3000`.
- **Environment validation fails:** Check `NODE_ENV`, `PORT`, `CLIENT_URL`, `MONGODB_URI`, and that `JWT_ACCESS_SECRET` has at least 32 characters.
- **Verification/reset email does not arrive:** Check that the Gmail API is enabled, the sender refresh token includes `gmail.send`, the token has not been revoked, and Gmail API credentials are set in the server environment. For local development without Gmail, copy the printed link from the API terminal.
- **Local email testing:** With `NODE_ENV=development` and no Gmail settings, submit signup or forgot-password and copy the link printed in the API terminal.
- **Google redirects to an error:** Confirm the exact callback URL in Google Cloud Console matches `GOOGLE_REDIRECT_URI` and the URL registered on the OAuth client.

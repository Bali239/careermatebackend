# AI Career Assistant API

The Express API is a separate project from the Next.js client. It currently provides a versioned health endpoint and the foundation for future features.

## Prerequisites

- Node.js 20 or newer
- npm
- MongoDB running locally or an accessible MongoDB connection string

## Setup

```bash
npm install
cp .env.example .env
```

Update `MONGODB_URI` in `.env` if your MongoDB connection differs. Do not commit `.env` or put secrets in source control.

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

## Environment variables

`NODE_ENV`, `PORT`, `CLIENT_URL`, and `MONGODB_URI` are configured in `.env.example`. Google and Gemini variables are optional placeholders for later features. `GOOGLE_APPLICATION_CREDENTIALS` is a server-side credential file path; keep that file private. No Google credentials are required to run the current API.

## Troubleshooting

- **MongoDB connection fails:** Check that MongoDB is running and that `MONGODB_URI` is correct and reachable.
- **Port is in use:** Stop the other process or set a free port in `.env`; keep the client API URL in sync.
- **Browser reports a CORS error:** Set `CLIENT_URL` to the exact client origin, such as `http://localhost:3000`.
- **Environment validation fails:** Check `NODE_ENV`, `PORT`, `CLIENT_URL`, and `MONGODB_URI` for valid values.

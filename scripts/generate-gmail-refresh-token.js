import 'dotenv/config';
import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { URL } from 'node:url';

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;
const redirectUri = process.env.GMAIL_OAUTH_REDIRECT_URI || 'http://localhost:5173/oauth2callback';
const scope = 'https://www.googleapis.com/auth/gmail.send';

if (!clientId || !clientSecret) {
  console.error('Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET in server/.env');
  process.exit(1);
}

const callbackUrl = new URL(redirectUri);
const expectedState = randomBytes(24).toString('hex');
const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authorizationUrl.search = new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirectUri,
  response_type: 'code',
  access_type: 'offline',
  prompt: 'consent',
  scope,
  state: expectedState,
}).toString();

function openBrowser(url) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  execFile(command, args, (error) => {
    if (error) console.log(`Open this URL manually:\n${url}`);
  });
}

async function exchangeCode(code) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`${payload.error || response.status}: ${payload.error_description || 'Google token exchange failed'}`);
  }
  return payload;
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, redirectUri);

  if (requestUrl.pathname !== callbackUrl.pathname) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  if (requestUrl.searchParams.get('state') !== expectedState) {
    response.writeHead(400);
    response.end('Invalid OAuth state');
    server.close();
    process.exitCode = 1;
    return;
  }

  const error = requestUrl.searchParams.get('error');
  if (error) {
    response.writeHead(400);
    response.end(`Google authorization failed: ${error}`);
    console.error(`Google authorization failed: ${error}`);
    server.close();
    process.exitCode = 1;
    return;
  }

  try {
    const tokens = await exchangeCode(requestUrl.searchParams.get('code'));
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end('<h2>Authorization complete.</h2><p>You can close this window and return to the terminal.</p>');
    console.log('\nGMAIL_REFRESH_TOKEN=');
    console.log(tokens.refresh_token || 'No refresh token returned. Revoke the previous grant and run again.');
    console.log('\nCopy that value into server/.env, then restart the API.');
    server.close();
  } catch (exchangeError) {
    response.writeHead(500);
    response.end('Token exchange failed. Check the terminal.');
    console.error(`Token exchange failed: ${exchangeError.message}`);
    server.close();
    process.exitCode = 1;
  }
});

server.listen(Number(callbackUrl.port || 80), callbackUrl.hostname, () => {
  console.log(`Authorize Gmail using this URL:\n${authorizationUrl}\n`);
  openBrowser(authorizationUrl.toString());
});

import { env } from "../config/env.js";
import { httpError } from "../utils/http-error.js";

export async function sendAuthEmail({ to, subject, heading, message, button, url, expires }) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GMAIL_SENDER_EMAIL || !env.GMAIL_REFRESH_TOKEN) {
    if (env.NODE_ENV === "development") {
      console.info(`[auth email preview] To: ${to}\nSubject: ${subject}\nLink: ${url}`);
      return;
    }
    throw httpError(503, "Email delivery is not configured. Contact the administrator.");
  }
  let tokenResponse;
  try {
    tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: env.GMAIL_REFRESH_TOKEN, grant_type: "refresh_token" }),
    });
  } catch (error) {
    console.error("Gmail API access token refresh failed:", error?.message ?? "network error");
    throw httpError(503, "Email delivery is temporarily unavailable. Try again later.");
  }
  if (!tokenResponse.ok) {
    console.error("Gmail API access token refresh failed with status", tokenResponse.status);
    throw httpError(503, "Email delivery is temporarily unavailable. Try again later.");
  }
  const { access_token: accessToken } = await tokenResponse.json();
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:32px auto;color:#1e2440"><h1>${heading}</h1><p>${message}</p><p><a href="${url}" style="display:inline-block;background:#6958d6;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">${button}</a></p><p>This link expires in ${expires}.</p><p>If the button does not work, copy this URL:<br>${url}</p></div>`;
  const rawMessage = [
    `From: CareerMate <${env.GMAIL_SENDER_EMAIL}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    html,
  ].join("\r\n");
  try {
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: Buffer.from(rawMessage).toString("base64url") }),
    });
    if (!response.ok) throw new Error(`Gmail API responded with status ${response.status}`);
  } catch (error) {
    console.error("Gmail API send failed:", error?.message ?? "unknown error");
    throw httpError(503, "Email delivery is temporarily unavailable. Try again later.");
  }
}

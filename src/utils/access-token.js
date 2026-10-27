import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { httpError } from './http-error.js';

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const signature = (input) => createHmac('sha256', env.JWT_ACCESS_SECRET).update(input).digest();

export function signAccessToken({ sub, sid }, lifetimeSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const input = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub, sid, iat: now, exp: now + lifetimeSeconds })}`;
  return `${input}.${signature(input).toString('base64url')}`;
}

export function verifyAccessToken(token) {
  try {
    const [headerPart, payloadPart, signaturePart, extra] = token.split('.');
    if (!headerPart || !payloadPart || !signaturePart || extra) throw new Error('Malformed token');
    const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'));
    const claims = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    const expected = signature(`${headerPart}.${payloadPart}`);
    const actual = Buffer.from(signaturePart, 'base64url');
    if (
      header.alg !== 'HS256' ||
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    )
      throw new Error('Invalid signature');
    if (
      typeof claims.sub !== 'string' ||
      typeof claims.sid !== 'string' ||
      !Number.isInteger(claims.exp) ||
      claims.exp <= Date.now() / 1000
    )
      throw new Error('Expired token');
    return claims;
  } catch {
    throw httpError(401, 'Access token is invalid or expired');
  }
}

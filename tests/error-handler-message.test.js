import test from 'node:test';
import assert from 'node:assert/strict';
import { errorHandler } from '../src/middleware/error.middleware.js';
import { httpError } from '../src/utils/http-error.js';

test('preserves specific service error messages for failed analysis requests', () => {
  let statusCode = 0;
  let payload = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(value) {
      payload = value;
      return this;
    },
  };

  errorHandler(
    httpError(503, 'Gemini is unavailable because GEMINI_API_KEY is not configured.'),
    {},
    res,
    () => {}
  );

  assert.equal(statusCode, 503);
  assert.equal(payload.message, 'Gemini is unavailable because GEMINI_API_KEY is not configured.');
});

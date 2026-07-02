import { createRequire } from 'module';
import { expect, test } from 'vitest';

const require = createRequire(import.meta.url);
const { getAuthTokenFromRequest } = require('../src/middleware/auth');

test('authorization header takes precedence over cookie token', () => {
  const req = {
    headers: {
      authorization: 'Bearer admin-token',
      cookie: 'token=user-token',
    },
    cookies: {
      token: 'user-token',
    },
  };

  expect(getAuthTokenFromRequest(req)).toBe('admin-token');
});

test('cookie token is used when authorization header is absent', () => {
  const req = {
    headers: {
      cookie: 'token=user-token',
    },
    cookies: {
      token: 'user-token',
    },
  };

  expect(getAuthTokenFromRequest(req)).toBe('user-token');
});

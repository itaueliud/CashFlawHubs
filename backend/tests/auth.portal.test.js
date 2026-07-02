const { test, expect } = require('vitest');
const fetch = require('node-fetch');

// These are integration-style checks that run against a locally running backend at http://localhost:5000
// They are skipped by default unless RUN_INTEGRATION_TESTS=true to avoid CI failures when backend isn't running.
const BASE = process.env.API_BASE_URL || 'http://localhost:5000';
const RUN = process.env.RUN_INTEGRATION_TESTS === 'true';
const testFn = RUN ? test : test.skip;

testFn('admin login to admin portal succeeds', async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@example.com', password: 'AdminPassword123!', portal: 'admin' }),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
  expect(body.user).toBeDefined();
});

test('admin login to user portal is rejected (403)', async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin@example.com', password: 'AdminPassword123!' }),
  });
  expect(res.status).toBe(403);
  const body = await res.json();
  expect(body.success).toBe(false);
});

test('ledger login to ledger portal succeeds', async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'ledger@example.com', password: 'LedgerPassword123!', portal: 'ledger' }),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(true);
});

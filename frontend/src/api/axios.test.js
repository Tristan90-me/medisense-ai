import { describe, it, expect, beforeEach } from 'vitest';
import api from './axios';

// Calls the response interceptor's rejection handler directly with a fake
// axios error — no real network call needed to exercise this logic.
const rejectedHandler = api.interceptors.response.handlers[0].rejected;

describe('axios response interceptor', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'some-token');
    delete window.location;
    window.location = { href: 'http://localhost/some-page' };
  });

  it('clears the token and redirects to /login on a plain 401 (invalid/expired session)', async () => {
    const err = { response: { status: 401 }, config: {} };
    await expect(rejectedHandler(err)).rejects.toBe(err);

    expect(localStorage.getItem('token')).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  // Regression test: a wrong password typed into an already-authenticated
  // confirmation flow (change password / delete account / delete health
  // history) also comes back as 401, but that's a user-input mistake, not
  // an invalid session — it must not force a logout+redirect, or the error
  // toast the caller shows never has a chance to render.
  it('does not redirect on a 401 marked skipAuthRedirect (wrong-password confirmation)', async () => {
    const err = { response: { status: 401 }, config: { skipAuthRedirect: true } };
    await expect(rejectedHandler(err)).rejects.toBe(err);

    expect(localStorage.getItem('token')).toBe('some-token');
    expect(window.location.href).toBe('http://localhost/some-page');
  });

  it('does not redirect on a non-401 error', async () => {
    const err = { response: { status: 500 }, config: {} };
    await expect(rejectedHandler(err)).rejects.toBe(err);

    expect(localStorage.getItem('token')).toBe('some-token');
    expect(window.location.href).toBe('http://localhost/some-page');
  });
});

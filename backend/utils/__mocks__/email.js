// Manual mock for utils/email.js — activated per-test-file with
// jest.mock('../utils/email'). Keeps the real template functions (they're
// pure string builders, harmless to run) but replaces sendEmail with a
// resolved no-op so nothing ever hits the real Mailtrap sandbox.
const actual = jest.requireActual('../email');

module.exports = {
  ...actual,
  sendEmail: jest.fn().mockResolvedValue(undefined),
};

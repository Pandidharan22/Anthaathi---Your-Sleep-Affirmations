import { describeAuthError, looksLikeEmail } from './authErrors';

describe('describeAuthError', () => {
  it('puts wrong credentials under the password without saying which part was wrong', () => {
    expect(describeAuthError('invalid_credentials', 'Invalid login credentials')).toEqual({
      field: 'password',
      message: "Email or password doesn't match our records.",
    });
  });

  it('puts an existing account under the email', () => {
    expect(describeAuthError('user_already_exists', 'User already registered').field).toBe('email');
  });

  it('treats a codeless network failure as a connection problem', () => {
    expect(describeAuthError(undefined, 'TypeError: Network request failed').message).toMatch(
      /connection/,
    );
  });

  it('falls back to the generic message for anything unknown', () => {
    expect(describeAuthError('hook_timeout', 'Hook timed out')).toEqual({
      field: 'form',
      message: 'Something went wrong. Please try again.',
    });
  });
});

describe('looksLikeEmail', () => {
  it.each([
    ['maya@example.com', true],
    ['  maya@example.com  ', true],
    ['maya@example', false],
    ['maya example.com', false],
    ['', false],
  ])('%s → %s', (email, expected) => {
    expect(looksLikeEmail(email)).toBe(expected);
  });
});

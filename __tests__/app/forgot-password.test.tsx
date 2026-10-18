import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import ForgotPasswordScreen from '@/app/forgot-password';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default,
);

const mockPush = jest.fn();
let mockParams: { email?: string } = {};
jest.mock('expo-router', () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  },
  useLocalSearchParams: () => mockParams,
}));

const mockRequest = jest.fn();
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ requestPasswordReset: mockRequest }),
}));

beforeEach(() => {
  mockPush.mockReset();
  mockRequest.mockReset();
  mockParams = {};
});

describe('ForgotPasswordScreen', () => {
  it('starts with the email typed on Sign In', async () => {
    mockParams = { email: 'maya@example.com' };
    await render(<ForgotPasswordScreen />);

    expect(screen.getByLabelText('Email').props.value).toBe('maya@example.com');
  });

  it('sends a code, then opens the code screen for that email', async () => {
    mockRequest.mockResolvedValue({ error: null });
    await render(<ForgotPasswordScreen />);

    await fireEvent.changeText(screen.getByLabelText('Email'), ' maya@example.com ');
    await fireEvent.press(screen.getByRole('button', { name: 'Send Code' }));

    await waitFor(() => expect(mockRequest).toHaveBeenCalledWith('maya@example.com'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/reset-password',
      params: { email: 'maya@example.com' },
    });
  });

  it('checks the email before sending anything', async () => {
    await render(<ForgotPasswordScreen />);

    await fireEvent.changeText(screen.getByLabelText('Email'), 'not-an-email');
    await fireEvent.press(screen.getByRole('button', { name: 'Send Code' }));

    expect(mockRequest).not.toHaveBeenCalled();
    expect(screen.getByText("That email address doesn't look right.")).toBeTruthy();
  });

  it('stays put and explains a rate limit', async () => {
    mockRequest.mockResolvedValue({
      error: 'email rate limit exceeded',
      errorCode: 'over_email_send_rate_limit',
    });
    await render(<ForgotPasswordScreen />);

    await fireEvent.changeText(screen.getByLabelText('Email'), 'maya@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Send Code' }));

    expect(await screen.findByText(/Too many tries for now/)).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

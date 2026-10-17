import { fireEvent, render, screen } from '@testing-library/react-native';

import WelcomeScreen from '@/app/welcome';

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default,
);

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));

beforeEach(() => {
  mockPush.mockReset();
});

describe('WelcomeScreen', () => {
  it('reads the headline as one heading', async () => {
    await render(<WelcomeScreen />);

    expect(screen.getByRole('header', { name: 'Fall asleep to your own voice' })).toBeTruthy();
  });

  it('Get started opens sign-up', async () => {
    await render(<WelcomeScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/auth', params: { mode: 'sign-up' } });
  });

  it('I already have an account opens sign-in', async () => {
    await render(<WelcomeScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'I already have an account' }));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/auth', params: { mode: 'sign-in' } });
  });
});

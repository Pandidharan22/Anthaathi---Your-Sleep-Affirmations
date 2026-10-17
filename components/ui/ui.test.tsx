import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from './Button';
import { Chip } from './Chip';
import { TextField } from './TextField';

describe('Button', () => {
  it.each(['primary', 'secondary', 'ghost'] as const)(
    '%s calls onPress and is named by its label',
    async (variant) => {
      const onPress = jest.fn();
      await render(<Button label="Save recording" variant={variant} onPress={onPress} />);

      await fireEvent.press(screen.getByRole('button', { name: 'Save recording' }));

      expect(onPress).toHaveBeenCalledTimes(1);
    },
  );

  it('blocks presses and reports disabled when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Continue" disabled onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Continue' });
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('shows a spinner instead of the label while loading, and blocks presses', async () => {
    const onPress = jest.fn();
    await render(<Button label="Saving" loading onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Saving' });
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(screen.queryByText('Saving')).toBeNull();
  });
});

describe('Chip', () => {
  it('reports its selected state and calls onPress', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(<Chip label="30 min" onPress={onPress} />);

    const chip = screen.getByRole('button', { name: '30 min' });
    expect(chip.props.accessibilityState).toMatchObject({ selected: false });
    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);

    await rerender(<Chip label="30 min" selected onPress={onPress} />);
    expect(screen.getByRole('button', { name: '30 min' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
  });
});

describe('TextField', () => {
  it('is named by its label and passes typing through', async () => {
    const onChangeText = jest.fn();
    await render(<TextField label="Email" value="" onChangeText={onChangeText} />);

    await fireEvent.changeText(screen.getByLabelText('Email'), 'maya@example.com');

    expect(onChangeText).toHaveBeenCalledWith('maya@example.com');
  });

  it('shows the error in place of the helper and announces it', async () => {
    await render(
      <TextField
        label="Password"
        helper="At least 8 characters"
        error="Password doesn't match our records."
      />,
    );

    expect(screen.queryByText('At least 8 characters')).toBeNull();
    const error = screen.getByText("Password doesn't match our records.");
    expect(error.props.accessibilityLiveRegion).toBe('polite');
    expect(screen.getByLabelText('Password').props.accessibilityHint).toBe(
      "Password doesn't match our records.",
    );
  });
});

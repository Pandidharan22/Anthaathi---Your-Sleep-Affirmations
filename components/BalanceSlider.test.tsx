import { fireEvent, render, screen } from '@testing-library/react-native';

import { BalanceSlider } from './BalanceSlider';

// The real mixGains is used; bedPrefs' storage just needs to load.
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));

/** Lays the track out 326 wide: a 26 pt thumb leaves 300 pt of travel, starting 13 pt in. */
async function layOut() {
  await fireEvent(screen.getByTestId('balance-track'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 326, height: 44 } },
  });
}
const at = (mix: number) => ({ nativeEvent: { pageX: 13 + mix * 300 } });

describe('BalanceSlider', () => {
  it('names both ends and says how loud each one plays', async () => {
    await render(<BalanceSlider mix={0.75} enabled onChange={jest.fn()} onCommit={jest.fn()} />);
    // Visible labels, kept from screen readers: the control speaks its value itself.
    expect(screen.getByText('Ambience', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Voice', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText('Voice and ambience balance').props.accessibilityValue).toEqual({
      text: 'Voice 100 percent, ambience 50 percent',
    });
  });

  it('follows a drag, snapping to steps, and saves when let go', async () => {
    const onChange = jest.fn();
    const onCommit = jest.fn();
    await render(<BalanceSlider mix={0.5} enabled onChange={onChange} onCommit={onCommit} />);
    await layOut();
    const track = screen.getByTestId('balance-track');

    await fireEvent(track, 'responderGrant', at(0.2));
    await fireEvent(track, 'responderMove', at(0.311));
    expect(onChange).toHaveBeenLastCalledWith(0.3);
    expect(onCommit).not.toHaveBeenCalled();

    await fireEvent(track, 'responderRelease', at(0.311));
    expect(onCommit).toHaveBeenCalledWith(0.3);
  });

  it('stays within the ends', async () => {
    const onChange = jest.fn();
    await render(<BalanceSlider mix={0.5} enabled onChange={onChange} onCommit={jest.fn()} />);
    await layOut();
    const track = screen.getByTestId('balance-track');

    await fireEvent(track, 'responderGrant', { nativeEvent: { pageX: -50 } });
    expect(onChange).toHaveBeenLastCalledWith(0);
    await fireEvent(track, 'responderMove', { nativeEvent: { pageX: 900 } });
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('moves by screen-reader swipes and saves each one', async () => {
    const onChange = jest.fn();
    const onCommit = jest.fn();
    await render(<BalanceSlider mix={0.5} enabled onChange={onChange} onCommit={onCommit} />);

    await fireEvent(screen.getByLabelText('Voice and ambience balance'), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(onChange).toHaveBeenCalledWith(0.55);
    expect(onCommit).toHaveBeenCalledWith(0.55);
  });

  it('without an ambience it is dimmed, ignores touches, and says how to add one', async () => {
    const onChange = jest.fn();
    await render(
      <BalanceSlider mix={0.5} enabled={false} onChange={onChange} onCommit={jest.fn()} />,
    );
    const track = screen.getByLabelText('Voice and ambience balance');
    expect(track.props.accessibilityState).toMatchObject({ disabled: true });
    expect(track.props.onStartShouldSetResponder()).toBe(false);
    expect(screen.getByText(/Add an ambience sound/)).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });
});

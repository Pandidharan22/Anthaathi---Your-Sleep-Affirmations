import { fireEvent, render, screen } from '@testing-library/react-native';
import type { BottomTabBarProps } from 'expo-router/tabs';

import { TabBar } from './TabBar';

const ROUTES = [
  { key: 'index-1', name: 'index', title: 'Library' },
  { key: 'player-1', name: 'player', title: 'Player' },
  { key: 'goals-1', name: 'goals', title: 'Goals' },
];

async function renderTabBar(activeIndex: number, defaultPrevented = false) {
  const navigation = {
    emit: jest.fn(() => ({ defaultPrevented })),
    navigate: jest.fn(),
  };
  const props = {
    state: {
      index: activeIndex,
      routes: ROUTES.map(({ key, name }) => ({ key, name, params: undefined })),
    },
    descriptors: Object.fromEntries(ROUTES.map(({ key, title }) => [key, { options: { title } }])),
    navigation,
    insets: { top: 0, bottom: 24, left: 0, right: 0 },
  } as unknown as BottomTabBarProps;

  await render(<TabBar {...props} />);
  return navigation;
}

describe('TabBar', () => {
  it('marks only the active tab as selected', async () => {
    await renderTabBar(1);

    expect(screen.getByRole('tab', { name: 'Player' }).props.accessibilityState).toEqual({
      selected: true,
    });
    expect(screen.getByRole('tab', { name: 'Library' }).props.accessibilityState).toEqual({
      selected: false,
    });
  });

  it('navigates to an inactive tab after emitting tabPress', async () => {
    const navigation = await renderTabBar(0);

    await fireEvent.press(screen.getByRole('tab', { name: 'Goals' }));

    expect(navigation.emit).toHaveBeenCalledWith({
      type: 'tabPress',
      target: 'goals-1',
      canPreventDefault: true,
    });
    expect(navigation.navigate).toHaveBeenCalledWith('goals', undefined);
  });

  it('does not navigate when pressing the active tab', async () => {
    const navigation = await renderTabBar(0);

    await fireEvent.press(screen.getByRole('tab', { name: 'Library' }));

    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it('respects a listener that prevents the default tab press', async () => {
    const navigation = await renderTabBar(0, true);

    await fireEvent.press(screen.getByRole('tab', { name: 'Player' }));

    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});

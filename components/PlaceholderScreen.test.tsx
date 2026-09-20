import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import { PlaceholderScreen } from './PlaceholderScreen';

describe('PlaceholderScreen', () => {
  it('renders the title, description, and any children', async () => {
    const { getByText } = await render(
      <PlaceholderScreen title="Library" description="Recordings live here.">
        <Text>Extra content</Text>
      </PlaceholderScreen>,
    );

    expect(getByText('Library')).toBeTruthy();
    expect(getByText('Recordings live here.')).toBeTruthy();
    expect(getByText('Extra content')).toBeTruthy();
  });
});

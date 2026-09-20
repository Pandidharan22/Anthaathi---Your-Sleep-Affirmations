import { render } from '@testing-library/react-native';

import Index from './index';

describe('Index screen', () => {
  it('renders the placeholder routing-shell text', async () => {
    const { getByText } = await render(<Index />);

    expect(getByText('Anthaathi — routing shell is live.')).toBeTruthy();
  });
});

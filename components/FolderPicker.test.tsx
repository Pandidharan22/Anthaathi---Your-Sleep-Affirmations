import { fireEvent, render } from '@testing-library/react-native';

import { FolderPicker } from './FolderPicker';
import type { LocalFolder } from '@/lib/folders.local';

const folders: LocalFolder[] = [
  { id: 'f1', user_id: 'u1', name: 'Sleep', created_at: '', updated_at: '', synced_at: null },
  { id: 'f2', user_id: 'u1', name: 'Focus', created_at: '', updated_at: '', synced_at: null },
];

describe('FolderPicker', () => {
  it('renders a "No folder" chip plus one per folder, marking the selected one', async () => {
    const { getByText } = await render(
      <FolderPicker folders={folders} selectedFolderId="f1" onSelect={jest.fn()} />,
    );

    expect(getByText('No folder')).toBeTruthy();
    expect(getByText('Sleep')).toBeTruthy();
    expect(getByText('Focus')).toBeTruthy();
    expect(getByText('Sleep').parent?.props.accessibilityState?.selected).toBe(true);
    expect(getByText('Focus').parent?.props.accessibilityState?.selected).toBe(false);
  });

  it('calls onSelect with the folder id, or null for "No folder"', async () => {
    const onSelect = jest.fn();
    const { getByText } = await render(
      <FolderPicker folders={folders} selectedFolderId={null} onSelect={onSelect} />,
    );

    await fireEvent.press(getByText('Focus'));
    expect(onSelect).toHaveBeenCalledWith('f2');

    await fireEvent.press(getByText('No folder'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});

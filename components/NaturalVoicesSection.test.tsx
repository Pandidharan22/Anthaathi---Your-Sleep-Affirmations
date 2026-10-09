import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { NaturalVoicesSection } from '@/components/NaturalVoicesSection';
import type { NeuralVoiceStatus } from '@/lib/neuralVoice';

// describeInstallBlocker is used for real (it's the shared message source); these keep the rest
// of lib/neuralVoice importable under Jest.
jest.mock('@/modules/anthaathi-neural-tts', () => ({ __esModule: true, default: {} }));
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn() },
  NetInfoStateType: {},
}));

const mockCheckInstall = jest.fn();
const mockStartInstall = jest.fn();
const mockDeleteModel = jest.fn();
const mockSizeBytes = jest.fn();
jest.mock('@/lib/neuralVoice', () => ({
  describeInstallBlocker: jest.requireActual('@/lib/neuralVoice').describeInstallBlocker,
  checkInstall: () => mockCheckInstall(),
  startInstall: () => mockStartInstall(),
  deleteModel: () => mockDeleteModel(),
  getInstalledSizeBytes: () => mockSizeBytes(),
}));

let mockStatus: NeuralVoiceStatus = { state: 'not_installed' };
jest.mock('@/hooks/useNeuralVoiceStatus', () => ({
  useNeuralVoiceStatus: () => mockStatus,
}));

type AlertButton = { text: string; onPress?: () => void };
const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
function alertButton(text: string): AlertButton {
  const buttons = mockAlert.mock.calls.at(-1)?.[2] as AlertButton[];
  return buttons.find((b) => b.text === text)!;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = { state: 'not_installed' };
  mockStartInstall.mockResolvedValue(undefined);
  mockDeleteModel.mockResolvedValue(undefined);
  mockSizeBytes.mockReturnValue(371_000_000);
});

describe('NaturalVoicesSection', () => {
  it('downloads straight away on Wi-Fi', async () => {
    mockCheckInstall.mockResolvedValue({ ok: true, network: 'wifi' });
    const { getByText } = await render(<NaturalVoicesSection />);

    await fireEvent.press(getByText('Download (about 350 MB)'));

    await waitFor(() => expect(mockStartInstall).toHaveBeenCalledTimes(1));
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('asks before using mobile data, and only downloads if confirmed', async () => {
    mockCheckInstall.mockResolvedValue({ ok: true, network: 'cellular' });
    const { getByText } = await render(<NaturalVoicesSection />);

    await fireEvent.press(getByText('Download (about 350 MB)'));
    await waitFor(() => expect(mockAlert).toHaveBeenCalled());
    expect(mockAlert.mock.calls[0][0]).toBe('Use mobile data?');
    expect(mockStartInstall).not.toHaveBeenCalled();

    alertButton('Download now').onPress?.();
    expect(mockStartInstall).toHaveBeenCalledTimes(1);
  });

  it('explains being offline instead of starting', async () => {
    mockCheckInstall.mockResolvedValue({ ok: false, reason: 'offline' });
    const { getByText, findByText } = await render(<NaturalVoicesSection />);

    await fireEvent.press(getByText('Download (about 350 MB)'));

    expect(await findByText(/You're offline/)).toBeTruthy();
    expect(mockStartInstall).not.toHaveBeenCalled();
  });

  it('explains a lack of space with real numbers', async () => {
    mockCheckInstall.mockResolvedValue({
      ok: false,
      reason: 'insufficient_space',
      availableBytes: 420_000_000,
      requiredBytes: 800_000_000,
    });
    const { getByText, findByText } = await render(<NaturalVoicesSection />);

    await fireEvent.press(getByText('Download (about 350 MB)'));

    expect(await findByText(/about 800 MB while installing, and you have 420 MB/)).toBeTruthy();
  });

  it('shows live progress while installing', async () => {
    mockStatus = {
      state: 'installing',
      progress: { stage: 'downloading', bytesWritten: 175_000_000, totalBytes: 350_000_000 },
    };
    const { getByText } = await render(<NaturalVoicesSection />);
    expect(getByText('Downloading… 50% (175 of 350 MB)')).toBeTruthy();
    expect(getByText('Keep Anthaathi open until it finishes.')).toBeTruthy();
  });

  it('shows the installed size and removes only after confirmation', async () => {
    mockStatus = { state: 'installed' };
    const { getByText } = await render(<NaturalVoicesSection />);
    expect(getByText('Installed · 371 MB on this phone')).toBeTruthy();

    await fireEvent.press(getByText('Remove voices'));
    expect(mockDeleteModel).not.toHaveBeenCalled();
    expect(mockAlert.mock.calls[0][0]).toBe('Remove natural voices?');

    await act(async () => {
      await alertButton('Remove voices').onPress?.();
    });
    expect(mockDeleteModel).toHaveBeenCalledTimes(1);
  });

  it('shows why an install failed and offers to try again', async () => {
    mockStatus = { state: 'failed', message: 'The download was damaged or incomplete.' };
    mockCheckInstall.mockResolvedValue({ ok: true, network: 'wifi' });
    const { getByText } = await render(<NaturalVoicesSection />);

    expect(getByText('The download was damaged or incomplete.')).toBeTruthy();
    await fireEvent.press(getByText('Try again'));
    await waitFor(() => expect(mockStartInstall).toHaveBeenCalledTimes(1));
  });
});

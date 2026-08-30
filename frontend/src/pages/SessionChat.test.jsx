import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SessionChat from './SessionChat';
import api from '../api/axios';
import { streamSessionMessage } from '../api/stream';

// This is a pragmatic first pass: it exercises session-start + the initial
// greeting render, and that sending a message calls the (mocked) streaming
// client with the right payload. It does NOT exercise the real SSE/fetch
// streaming pipeline, voice input/output, or the diagnosis/suggestions UI
// that only appears after a stream completes — those are deferred as noted
// in the test-suite report.

vi.mock('../api/axios', () => ({
  default: { post: vi.fn() },
}));

vi.mock('../api/stream', () => ({
  streamSessionMessage: vi.fn(),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Jane Doe' } }),
}));

const mockSetActiveSession = vi.fn();
vi.mock('../context/SessionContext', () => ({
  useSession: () => ({ setActiveSession: mockSetActiveSession }),
}));

// Web Speech API isn't available in jsdom, so useVoice is mocked wholesale.
vi.mock('../hooks/useVoice', () => ({
  default: () => ({
    isListening: false,
    transcript: '',
    isSpeaking: false,
    voiceEnabled: false,
    supported: false,
    volume: 0,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    clearTranscript: vi.fn(),
    speak: vi.fn(),
    stopSpeaking: vi.fn(),
    toggleVoice: vi.fn(),
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    useNavigate: () => mockNavigate,
  };
});

describe('SessionChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.post.mockResolvedValue({ data: { session: { _id: 'sess1' }, resumed: false } });
    streamSessionMessage.mockResolvedValue(undefined);
  });

  it('shows a loading state, then starts the session and renders the greeting', async () => {
    render(<SessionChat />);

    expect(screen.getByText(/starting your session/i)).toBeInTheDocument();

    expect(await screen.findByText(/tell me what symptoms you're experiencing/i)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/ai/session/start', { mode: 'quick' });
    expect(mockSetActiveSession).toHaveBeenCalledWith({ _id: 'sess1' });
  });

  it('sends the typed message to the streaming API on Enter', async () => {
    const user = userEvent.setup();
    render(<SessionChat />);
    await screen.findByText(/tell me what symptoms you're experiencing/i);

    const input = screen.getByPlaceholderText(/describe your symptoms/i);
    await user.type(input, 'I have a headache{Enter}');

    expect(await screen.findByText('I have a headache')).toBeInTheDocument();
    expect(streamSessionMessage).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'sess1', message: 'I have a headache' })
    );
    // Input clears after sending.
    expect(input).toHaveValue('');
  });

  it('sends the typed message to the streaming API when the send button is clicked', async () => {
    const user = userEvent.setup();
    render(<SessionChat />);
    await screen.findByText(/tell me what symptoms you're experiencing/i);

    const input = screen.getByPlaceholderText(/describe your symptoms/i);
    await user.type(input, 'chest pain');

    // Voice is mocked with supported: false, so the mic button isn't
    // rendered — the send button is the only button next to the input.
    const sendButton = input.parentElement.querySelector('button');
    expect(sendButton).toBeTruthy();
    await user.click(sendButton);

    expect(streamSessionMessage).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'sess1', message: 'chest pain' })
    );
  });

  it('does not call the streaming API for a blank message', async () => {
    const user = userEvent.setup();
    render(<SessionChat />);
    await screen.findByText(/tell me what symptoms you're experiencing/i);

    const input = screen.getByPlaceholderText(/describe your symptoms/i);
    await user.type(input, '   {Enter}');

    expect(streamSessionMessage).not.toHaveBeenCalled();
  });
});

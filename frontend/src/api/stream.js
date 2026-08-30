const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Streams POST /ai/session/message/stream via fetch + ReadableStream instead
// of native EventSource, since EventSource can't send the Authorization
// header axios.js relies on for every other request.
export const streamSessionMessage = async ({ sessionId, message, onChunk, onDone, onError }) => {
  const token = localStorage.getItem('token');

  try {
    const res = await fetch(`${API_URL}/ai/session/message/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ sessionId, message }),
    });

    if (!res.ok || !res.body) {
      onError?.(new Error(`Stream request failed: ${res.status}`));
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        const line = frame.trim();
        if (!line.startsWith('data:')) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;

        let event;
        try {
          event = JSON.parse(jsonStr);
        } catch {
          continue;
        }

        if (event.type === 'chunk') onChunk?.(event.text);
        else if (event.type === 'done') onDone?.(event);
        else if (event.type === 'error') onError?.(new Error(event.message || 'Stream error'));
      }
    }
  } catch (err) {
    onError?.(err);
  }
};

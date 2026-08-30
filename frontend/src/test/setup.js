import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom doesn't implement matchMedia. useTheme() calls
// window.matchMedia('(prefers-color-scheme: dark)') unconditionally on every
// render, so anything that mounts app chrome needs this stubbed or it throws.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated API, some libs still call it
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// jsdom doesn't implement scrollIntoView (used in SessionChat to scroll the
// message list) — stub it so it's a no-op instead of throwing.
if (!window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

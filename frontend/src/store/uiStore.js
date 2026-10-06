import { create } from 'zustand';

// Shared open/closed state for transient bottom-of-screen UI that other
// controls need to react to (the phone "More" sheet hides the floating menu).
export const useUiStore = create((set) => ({
  isMoreOpen: false,
  setMoreOpen: (isMoreOpen) => set({ isMoreOpen }),
}));

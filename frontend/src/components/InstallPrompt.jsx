import { useState, useEffect, useRef } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';

const LAST_SHOWN_KEY = 'medisense-install-last-shown';
// How long to wait before showing the prompt again after it was last shown
// (dismissed, timed out, or the tab was simply closed) — this is what makes
// it "come back" for a user who left the site and returned later, without
// nagging on every single visit in between.
const REPROMPT_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days
const AUTO_DISMISS_MS = 8000;

export default function InstallPrompt() {
  const [prompt, setPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const dismissTimerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);

      const lastShown = Number(localStorage.getItem(LAST_SHOWN_KEY) || 0);
      const dueForReprompt = Date.now() - lastShown > REPROMPT_COOLDOWN_MS;
      if (dueForReprompt) {
        setShow(true);
        localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Auto-dismiss after a few seconds if the user doesn't act on it.
  useEffect(() => {
    if (!show) return;
    dismissTimerRef.current = setTimeout(() => setShow(false), AUTO_DISMISS_MS);
    return () => clearTimeout(dismissTimerRef.current);
  }, [show]);

  const handleInstall = async () => {
    if (!prompt) return;
    clearTimeout(dismissTimerRef.current);
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setShow(false);
  };

  const handleDismiss = () => {
    clearTimeout(dismissTimerRef.current);
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="fixed right-4 top-20 z-[998] flex w-[min(360px,calc(100vw-2rem))] items-center gap-3 rounded-2xl bg-ink p-3.5 shadow-lg"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary">
            <Download size={18} className="text-primary-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-ink-foreground">Install MediSense AI</p>
            <p className="text-[11px] text-ink-foreground/60">Add to home screen for quick access</p>
          </div>
          <Button size="sm" onClick={handleInstall} className="shrink-0 rounded-full">
            Install
          </Button>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="flex shrink-0 p-1 text-ink-foreground/50 hover:text-ink-foreground/80"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

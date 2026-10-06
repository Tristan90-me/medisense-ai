import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, MessageCircle, Sun, Moon, Monitor } from 'lucide-react';
import useTheme from '../hooks/useTheme';
import { useAI } from '../context/AIContext';
import { useAuth } from '../context/AuthContext';
import { useUiStore } from '../store/uiStore';

const THEME_ORDER = ['light', 'dark', 'system'];
const THEME_ICON = { light: Sun, dark: Moon, system: Monitor };
const THEME_LABEL = { light: 'Light mode', dark: 'Dark mode', system: 'Use system theme' };

// Routes with their own true-bottom, full-width control (a chat input bar)
// that this FAB would otherwise sit directly on top of. Opening a second,
// separate assistant chat from inside an active triage session is also just
// confusing, so this one hides outright rather than merely relocating.
const HIDDEN_ON_ROUTES = ['/session'];

// Routes with a bottom-right CTA of their own (not full-width, so relocating
// clears it without needing to hide the whole menu) — raised above it.
const RAISED_ON_ROUTES = ['/body-map'];

// Single floating cluster (bottom-right) that expands into the theme control
// and the AI chat toggle — replaces what used to be two separate fixed
// buttons (a top-left theme toggle, a bottom-right chat FAB), which collided
// with page headers on some pages. Built to take more items later without
// another restructure — just add another entry to the stack below.
export default function FloatingMenu() {
  const [expanded, setExpanded] = useState(false);
  const { preference, cycleTheme } = useTheme();
  const { isOpen: chatOpen, toggleChat, emergency } = useAI();
  const { isAuthenticated } = useAuth();
  const isMoreOpen = useUiStore((s) => s.isMoreOpen);
  const location = useLocation();
  const rootRef = useRef(null);

  // Tapping anywhere outside the cluster, or pressing Escape, collapses it.
  // pointerdown (not click) so the tap still reaches whatever was underneath.
  useEffect(() => {
    if (!expanded) return undefined;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setExpanded(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setExpanded(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [expanded]);

  if (HIDDEN_ON_ROUTES.includes(location.pathname)) return null;
  const isRaised = RAISED_ON_ROUTES.includes(location.pathname);

  const ThemeIcon = THEME_ICON[preference];

  const handleChatClick = () => {
    toggleChat();
    setExpanded(false);
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12, scale: 0.85 },
    show: { opacity: 1, y: 0, scale: 1 },
  };

  // Signed-in phones: the button sits in the middle of the bottom bar (the
  // bar leaves a gap for it), so it never covers page content. Signed-out
  // visitors have no bar, so the button stays bottom-right on every screen.
  const positionClasses = isAuthenticated
    ? `left-1/2 w-14 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] lg:left-auto lg:right-5 lg:w-auto lg:translate-x-0 ${isRaised ? 'lg:bottom-20' : 'lg:bottom-5'}`
    : `right-5 ${isRaised ? 'bottom-20' : 'bottom-5'}`;

  // On phones the open assistant covers this corner (its Send button sits
  // there), so the button steps aside until the chat closes.
  return (
    <div ref={rootRef} className={`pointer-events-auto fixed z-[1002] flex-col items-end gap-3 ${chatOpen || isMoreOpen ? 'hidden lg:flex' : 'flex'} ${positionClasses}`}>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial="hidden"
            animate="show"
            exit="hidden"
            variants={{ show: { transition: { staggerChildren: 0.05, staggerDirection: -1 } } }}
            className="flex flex-col items-end gap-3"
          >
            {/* Theme control */}
            <motion.div variants={itemVariants} transition={{ duration: 0.18 }} className="flex items-center gap-2.5">
              <span className="whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-ink-foreground shadow-md">
                {THEME_LABEL[preference]}
              </span>
              <button
                onClick={cycleTheme}
                aria-label={`Theme: ${THEME_LABEL[preference]}. Click to change.`}
                title={THEME_LABEL[preference]}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-colors hover:bg-muted"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={preference}
                    initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center justify-center"
                  >
                    <ThemeIcon size={18} />
                  </motion.span>
                </AnimatePresence>
              </button>
            </motion.div>

            {/* Chat control */}
            <motion.div variants={itemVariants} transition={{ duration: 0.18 }} className="flex items-center gap-2.5">
              <span className="whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-ink-foreground shadow-md">
                {chatOpen ? 'Close chat' : 'Health assistant'}
              </span>
              <button
                onClick={handleChatClick}
                aria-label={chatOpen ? 'Close health assistant' : 'Open health assistant'}
                title="Health assistant"
                className={`relative flex h-11 w-11 items-center justify-center rounded-full text-primary-foreground shadow-lg transition-colors ${
                  emergency ? 'bg-severity-high' : 'bg-primary hover:bg-primary-hover'
                }`}
              >
                <MessageCircle size={18} />
                {emergency && (
                  <span className="absolute right-0.5 top-0.5 h-2 w-2 animate-pulse rounded-full bg-white ring-2 ring-severity-high" />
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main toggle */}
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setExpanded((p) => !p)}
        aria-label={expanded ? 'Close quick actions' : 'Open quick actions'}
        aria-expanded={expanded}
        className={`relative flex h-14 w-14 items-center justify-center rounded-full text-primary-foreground shadow-lg transition-colors ${
          emergency && !expanded ? 'bg-severity-high' : 'bg-primary'
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={expanded ? 'close' : 'open'}
            initial={{ rotate: -45, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 45, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {expanded ? <X size={22} /> : <Plus size={22} />}
          </motion.span>
        </AnimatePresence>
        {emergency && !expanded && (
          <span className="absolute right-1 top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-white ring-2 ring-severity-high" />
        )}
      </motion.button>
    </div>
  );
}

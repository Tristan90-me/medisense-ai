import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, MessageCircle, Sun, Moon, Monitor } from 'lucide-react';
import useTheme from '../hooks/useTheme';
import { useAI } from '../context/AIContext';

const THEME_ORDER = ['light', 'dark', 'system'];
const THEME_ICON = { light: Sun, dark: Moon, system: Monitor };
const THEME_LABEL = { light: 'Light mode', dark: 'Dark mode', system: 'Use system theme' };

// Single floating cluster (bottom-right) that expands into the theme control
// and the AI chat toggle — replaces what used to be two separate fixed
// buttons (a top-left theme toggle, a bottom-right chat FAB), which collided
// with page headers on some pages. Built to take more items later without
// another restructure — just add another entry to the stack below.
export default function FloatingMenu() {
  const [expanded, setExpanded] = useState(false);
  const { preference, cycleTheme } = useTheme();
  const { isOpen: chatOpen, toggleChat, emergency } = useAI();

  const ThemeIcon = THEME_ICON[preference];

  const handleChatClick = () => {
    toggleChat();
    setExpanded(false);
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12, scale: 0.85 },
    show: { opacity: 1, y: 0, scale: 1 },
  };

  return (
    <div className="fixed bottom-5 right-5 z-[999] flex flex-col items-end gap-3">
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
              <span className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-ink-foreground shadow-md">
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
              <span className="rounded-full bg-ink px-3 py-1.5 text-xs font-medium text-ink-foreground shadow-md">
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

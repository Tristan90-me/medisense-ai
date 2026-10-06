import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '../context/AuthContext';
import { PRIMARY_NAV, SECONDARY_NAV } from './appNav';

// Full-screen flows that own the bottom of the viewport (the chat input bar)
// or are mid-onboarding — a persistent nav there would fight their controls.
const HIDDEN_ON_ROUTES = ['/session', '/onboarding'];

// Desktop (lg+) keeps the sidebar, so this bar is mobile/tablet only.
export default function MobileNav() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!moreOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMoreOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  if (!isAuthenticated || HIDDEN_ON_ROUTES.includes(location.pathname)) return null;

  const isActive = (to) => location.pathname === to || location.pathname.startsWith(`${to}/`);
  const moreActive = SECONDARY_NAV.some((item) => isActive(item.to));

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-[998] flex h-16 items-stretch border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon size={20} />
              <span className="truncate">{item.shortLabel}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={cn(
            'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
            moreActive ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <MoreHorizontal size={20} />
          <span className="truncate">More</span>
        </button>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <div className="fixed inset-0 z-[1000] lg:hidden" role="presentation">
            <motion.button
              type="button"
              aria-label="Close menu"
              onClick={() => setMoreOpen(false)}
              className="absolute inset-0 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="More pages"
              className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-card p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">More</p>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  aria-label="Close menu"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {SECONDARY_NAV.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl border border-border/70 px-3 py-3 text-sm font-medium transition-colors',
                        active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted',
                      )}
                    >
                      <Icon size={18} className="shrink-0" />
                      <span className="min-w-0 leading-snug">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, LayoutDashboard, Users, Activity, Settings, LogOut,
  FileBarChart, SlidersHorizontal, ShieldAlert, ScrollText, Megaphone, Menu, X,
} from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
  { label: 'Users', to: '/admin/users', icon: Users },
  { label: 'Sessions', to: '/admin/sessions', icon: Activity },
  { label: 'Flagged', to: '/admin/flagged', icon: ShieldAlert },
  { label: 'Reports', to: '/admin/reports', icon: FileBarChart },
  { label: 'Announcements', to: '/admin/announcements', icon: Megaphone },
  { label: 'System Settings', to: '/admin/system-settings', icon: SlidersHorizontal },
  { label: 'Audit Log', to: '/admin/audit-log', icon: ScrollText },
  { label: 'Settings', to: '/admin/settings', icon: Settings },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAdminAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const isActive = (item) => {
    if (item.end) return location.pathname === item.to;
    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const navList = (onNavigate) => (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-ink-foreground/70 hover:bg-ink-foreground/10 hover:text-ink-foreground'
            )}
          >
            <Icon size={17} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="mt-auto border-t border-ink-foreground/10 pt-3">
      {user?.name && (
        <p className="mb-2 truncate px-3 text-[12px] text-ink-foreground/50">{user.name}</p>
      )}
      <button
        onClick={handleLogout}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-foreground/70 transition-colors hover:bg-ink-foreground/10 hover:text-ink-foreground"
      >
        <LogOut size={17} />
        Log out
      </button>
    </div>
  );

  const brand = (
    <div className="flex items-center gap-2.5 px-2">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-ink-foreground/15 text-ink-foreground">
        <Shield size={16} />
      </div>
      <div>
        <p className="text-sm font-semibold leading-tight text-ink-foreground">MediSense</p>
        <p className="text-[11px] leading-tight text-ink-foreground/50">Admin</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-background">
      {/* Desktop sidebar (lg+) */}
      <aside className="hidden w-60 flex-shrink-0 flex-col bg-ink px-3 py-5 lg:flex">
        <div className="mb-8">{brand}</div>
        {navList()}
        {footer}
      </aside>

      {/* Phone/tablet top bar (below lg) */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-ink px-3 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open admin menu"
          aria-expanded={drawerOpen}
          className="rounded-lg p-2 text-ink-foreground hover:bg-ink-foreground/10"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0 flex-1">{brand}</div>
      </div>

      {/* Phone/tablet navigation drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <div className="fixed inset-0 z-[1000] lg:hidden">
            <motion.button
              type="button"
              aria-label="Close admin menu"
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Admin navigation"
              className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-ink px-3 py-5"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="mb-6 flex items-start justify-between gap-2">
                {brand}
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close admin menu"
                  className="rounded-lg p-1.5 text-ink-foreground/70 hover:bg-ink-foreground/10"
                >
                  <X size={18} />
                </button>
              </div>
              {navList(() => setDrawerOpen(false))}
              {footer}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main content — pushed below the phone top bar, full width on phones */}
      <main className="min-w-0 flex-1 bg-background pt-14 lg:pt-0">
        <Outlet />
      </main>
    </div>
  );
}

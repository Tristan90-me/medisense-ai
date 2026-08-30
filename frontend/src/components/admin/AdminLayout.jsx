import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { Shield, LayoutDashboard, Users, Activity, Settings, LogOut } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
  { label: 'Users', to: '/admin/users', icon: Users },
  { label: 'Sessions', to: '/admin/sessions', icon: Activity },
  { label: 'Settings', to: '/admin/settings', icon: Settings },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAdminAuth();

  const isActive = (item) => {
    if (item.end) return location.pathname === item.to;
    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-60 flex-shrink-0 flex-col bg-ink px-3 py-5">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-ink-foreground/15 text-ink-foreground">
            <Shield size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-ink-foreground">MediSense</p>
            <p className="text-[11px] leading-tight text-ink-foreground/50">Admin</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
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
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1 bg-background">
        <Outlet />
      </main>
    </div>
  );
}

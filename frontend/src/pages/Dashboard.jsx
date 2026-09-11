import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { listAnnouncements } from '../api/announcements.api';
import { getHealthScore } from '../api/healthScore.api';
import { listDependents } from '../api/dependents.api';
import { listMedications } from '../api/medications.api';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  Activity, Map, Zap, ClipboardList,
  LogOut, History, TrendingUp,
  ClipboardCheck, UserPlus, ChevronRight, AlertTriangle, Users, Users2, PhoneCall, Settings, Pill, Trophy, Camera, MapPin, Bell, Megaphone,
  LayoutDashboard,
} from 'lucide-react';

// localStorage key tracking the newest announcement (by sentAt) the user has
// viewed — deliberately a lightweight MVP simplification (no push/read-receipt
// backend infrastructure for this phase) rather than an oversight; see
// Phase 8 plan for "in-app only" announcements.
const LAST_SEEN_ANNOUNCEMENT_KEY = 'medisense-last-seen-announcement';

const formatAnnouncementDate = (dateStr) => new Date(dateStr).toLocaleString('en-GB', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

const colorClasses = {
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary/10 text-secondary',
  accent: 'bg-accent/10 text-accent',
  moderate: 'bg-severity-moderate-bg text-severity-moderate-fg',
  critical: 'bg-severity-critical-bg text-severity-critical-fg',
  muted: 'bg-muted text-foreground',
};

// severityLevel comes back as "Low" | "Moderate" | "High" | "Critical" (backend/models/Session.js).
// Tailwind can't interpolate arbitrary class-name strings built at runtime, so map to constants.
const severityBadgeClasses = {
  Low: 'bg-severity-low-bg text-severity-low-fg',
  Moderate: 'bg-severity-moderate-bg text-severity-moderate-fg',
  High: 'bg-severity-high-bg text-severity-high-fg',
  Critical: 'bg-severity-critical-bg text-severity-critical-fg',
};

// Desktop-only sidebar (lg:+) — the mobile/tablet view below that breakpoint
// keeps today's header pattern unchanged. A curated core set of
// destinations, not every page: the rest stay reachable via the secondary
// nav grid in the main content, matching the reviewed design preview.
const SIDEBAR_NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'Sessions', icon: History, to: '/history' },
  { label: 'Health Stats', icon: TrendingUp, to: '/health-stats' },
  { label: 'Medications', icon: Pill, to: '/medications' },
  { label: 'Care Finder', icon: MapPin, to: '/care-finder' },
];

// Lightweight, display-only banding for the health-score KPI pill — not an
// authoritative scale (HealthScoreAchievements.jsx doesn't define one
// either), just a glanceable hint reusing the app's existing severity tokens
// rather than inventing new colors.
const scoreTier = (score) => {
  if (score >= 75) return { label: 'Good', classes: severityBadgeClasses.Low };
  if (score >= 50) return { label: 'Fair', classes: severityBadgeClasses.Moderate };
  return { label: 'Needs attention', classes: severityBadgeClasses.High };
};

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

const capitalize = (str) => (str ? str.charAt(0).toUpperCase() + str.slice(1) : str);

const formatRelativeDate = (dateStr) => {
  const date = new Date(dateStr);
  const diffDays = Math.floor((Date.now() - date) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [sessionsError, setSessionsError] = useState(false);
  const [profile, setProfile] = useState(null);
  const [snapshotLoading, setSnapshotLoading] = useState(true);

  const [announcements, setAnnouncements] = useState([]);
  const [hasUnreadAnnouncement, setHasUnreadAnnouncement] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // KPI strip data — fetched independently of the sessions/profile snapshot
  // above (Promise.allSettled, same resilience pattern) so one slow/failing
  // source never blocks the others; a tile shows "—" if its own fetch failed.
  const [healthScore, setHealthScore] = useState(null);
  const [dependentsCount, setDependentsCount] = useState(null);
  const [activeMedsCount, setActiveMedsCount] = useState(null);
  const [kpiLoading, setKpiLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [sessionsRes, profileRes] = await Promise.allSettled([
        api.get('/ai/sessions'),
        api.get('/profile'),
      ]);
      if (ignore) return;
      if (sessionsRes.status === 'fulfilled') {
        setSessions(sessionsRes.value.data.sessions || []);
      } else {
        setSessionsError(true);
      }
      if (profileRes.status === 'fulfilled') {
        setProfile(profileRes.value.data.profile || null);
      }
      setSnapshotLoading(false);
    })();
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const [scoreRes, depsRes, medsRes] = await Promise.allSettled([
        getHealthScore(),
        listDependents(),
        listMedications(),
      ]);
      if (ignore) return;
      if (scoreRes.status === 'fulfilled') setHealthScore(scoreRes.value.currentScore);
      if (depsRes.status === 'fulfilled') setDependentsCount(depsRes.value.length);
      if (medsRes.status === 'fulfilled') {
        setActiveMedsCount(medsRes.value.filter((m) => m.active).length);
      }
      setKpiLoading(false);
    })();
    return () => { ignore = true; };
  }, []);

  // Single fetch on mount — no polling. "In-app only" per the Phase 8 plan
  // means a fresh fetch on each dashboard load is sufficient; no push/
  // real-time updates are needed.
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const data = await listAnnouncements();
        if (ignore) return;
        setAnnouncements(data);
        const lastSeen = localStorage.getItem(LAST_SEEN_ANNOUNCEMENT_KEY);
        const newest = data[0]?.sentAt;
        setHasUnreadAnnouncement(!!newest && newest !== lastSeen);
      } catch {
        // Non-critical — the bell just won't show a badge/list this load.
      }
    })();
    return () => { ignore = true; };
  }, []);

  const openNotifications = () => {
    setNotificationsOpen(true);
    setHasUnreadAnnouncement(false);
    if (announcements[0]?.sentAt) {
      localStorage.setItem(LAST_SEEN_ANNOUNCEMENT_KEY, announcements[0].sentAt);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // ── Snapshot derivations ─────────────────────────────────────────────
  const latestSession = sessions[0] ?? null;
  const showSnapshotCard = !snapshotLoading && !sessionsError && !!latestSession;
  const showSnapshotEmpty = !snapshotLoading && !sessionsError && sessions.length === 0;
  const showNudge = !snapshotLoading && profile?.onboardingComplete === false;
  const hasSnapshotContent = snapshotLoading || showSnapshotCard || showSnapshotEmpty || showNudge;

  const sessionsThisWeek = sessions.filter((s) => {
    const diffDays = (Date.now() - new Date(s.createdAt)) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  }).length;

  const kpiTiles = [
    {
      label: 'Health score',
      value: healthScore,
      to: '/health-score',
      tier: healthScore != null ? scoreTier(healthScore) : null,
    },
    { label: 'Sessions this week', value: sessionsThisWeek, to: '/history' },
    { label: 'Active medications', value: activeMedsCount, to: '/medications' },
    { label: 'Dependents', value: dependentsCount, to: '/dependents' },
  ];

  const primaryActions = [
    {
      icon: Zap,
      color: 'primary',
      title: 'Quick Check',
      desc: '3–5 questions · Fast symptom assessment',
      onClick: () => navigate('/session?mode=quick'),
    },
    {
      icon: ClipboardList,
      color: 'secondary',
      title: 'Full Assessment',
      desc: '10–15 questions · Detailed health report',
      onClick: () => navigate('/session?mode=full'),
    },
    {
      icon: Map,
      color: 'accent',
      title: 'Body Map',
      desc: 'Tap where it hurts to select symptoms',
      onClick: () => navigate('/body-map'),
    },
  ];

  // The remaining destinations not already promoted to the sidebar/KPI
  // strip — Health Score and Medications/Sessions/Care Finder are reachable
  // there, so they're intentionally not duplicated here.
  const secondaryActions = [
    {
      icon: Users,
      color: 'accent',
      title: 'Family & Dependents',
      desc: 'Manage profiles for family members',
      onClick: () => navigate('/dependents'),
    },
    {
      icon: PhoneCall,
      color: 'critical',
      title: 'Emergency Contacts',
      desc: 'Who to reach in an emergency',
      onClick: () => navigate('/emergency-contacts'),
    },
    {
      icon: Camera,
      color: 'secondary',
      title: 'Photo Log',
      desc: 'Track symptom photos over time',
      onClick: () => navigate('/photo-log'),
    },
    {
      icon: Users2,
      color: 'primary',
      title: 'Community Insights',
      desc: 'Anonymized symptom & severity trends',
      onClick: () => navigate('/community'),
    },
  ];

  const firstName = user?.name?.split(' ')[0];
  const initial = user?.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar — hidden below lg:, mobile/tablet keeps the header below unchanged */}
      <aside className="hidden w-56 flex-shrink-0 flex-col border-r border-border bg-ink px-3 py-5 lg:flex">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[9px] bg-primary text-primary-foreground">
            <Activity size={16} />
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-tight text-ink-foreground">MediSense AI</p>
            <p className="text-[11px] leading-tight text-ink-foreground/50">Health Dashboard</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {SIDEBAR_NAV.map((item) => {
            const active = item.to === '/dashboard';
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
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-ink-foreground/10 pt-3">
          <Link
            to="/account-settings"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-foreground/70 transition-colors hover:bg-ink-foreground/10 hover:text-ink-foreground"
          >
            <Settings size={16} />
            Settings
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Header — full brand block on mobile/tablet (no sidebar); just
            notifications + avatar on desktop, since the sidebar already
            carries the brand. */}
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
              <Activity size={18} />
            </div>
            <div>
              <p className="font-heading text-[15px] font-bold text-foreground">MediSense AI</p>
              <p className="text-[11px] text-muted-foreground">Health Dashboard</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3.5">
            <button
              onClick={openNotifications}
              className="relative flex text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell size={17} />
              {hasUnreadAnnouncement && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-severity-high-fg" />
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-heading text-[12.5px] font-bold text-primary-foreground transition-opacity hover:opacity-90"
                  aria-label="Account menu"
                >
                  {initial}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="truncate">{user?.name || 'Account'}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/account-settings')}>
                  <Settings size={14} /> Account Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut size={14} /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="mx-auto max-w-[640px] px-4 py-6 lg:max-w-[1040px] lg:px-8">
          {/* Hero */}
          <div className="mb-5 rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/[0.07] to-secondary/[0.06] px-5 py-4">
            <h1 className="font-heading text-[22px] font-bold text-foreground">
              Hello, {firstName} 👋
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              How are you feeling today?
            </p>
          </div>

          {/* Snapshot */}
          {hasSnapshotContent && (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="mb-5 flex flex-col gap-2.5"
            >
              {snapshotLoading ? (
                <motion.div variants={itemVariants}>
                  <Skeleton className="h-[76px] rounded-2xl" />
                </motion.div>
              ) : (
                <>
                  {showSnapshotCard && (
                    <motion.div variants={itemVariants}>
                      <Card className="rounded-2xl border-border/70 py-0 shadow-sm">
                        <CardContent className="flex items-center justify-between gap-3 px-[18px] py-4">
                          <div className="flex min-w-0 items-center gap-3.5">
                            <div
                              className={cn(
                                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                                latestSession.severityLevel
                                  ? severityBadgeClasses[latestSession.severityLevel]
                                  : colorClasses.muted
                              )}
                            >
                              <ClipboardCheck size={20} />
                            </div>
                            <div className="min-w-0">
                              <p className="mb-0.5 truncate text-sm font-semibold text-foreground">
                                Last check-in: {formatRelativeDate(latestSession.createdAt)}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {capitalize(latestSession.status)}
                                {latestSession.severityLevel
                                  ? ` · ${latestSession.severityLevel} severity`
                                  : ' · Not yet scored'}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-lg font-extrabold leading-none text-foreground">
                              {sessions.length}
                            </p>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              session{sessions.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {latestSession?.emergencyDetected && (
                    <motion.div variants={itemVariants}>
                      <div className="flex items-start gap-2 rounded-xl border border-severity-high/30 bg-severity-high-bg px-3.5 py-2.5 text-[12px] leading-relaxed text-severity-high-fg">
                        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                        <p>
                          Your most recent session flagged emergency symptoms. If you haven't
                          already, please seek appropriate medical care.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {showSnapshotEmpty && (
                    <motion.div variants={itemVariants}>
                      <Card className="rounded-2xl border-dashed border-border/70 py-0 shadow-sm">
                        <CardContent className="flex items-center gap-3.5 px-[18px] py-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                            <ClipboardCheck size={20} />
                          </div>
                          <div>
                            <p className="mb-0.5 text-sm font-semibold text-foreground">No check-ins yet</p>
                            <p className="text-xs text-muted-foreground">
                              Start a Quick Check below to build your health snapshot
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {showNudge && (
                    <motion.div variants={itemVariants}>
                      <Card
                        onClick={() => navigate('/onboarding')}
                        className="cursor-pointer rounded-2xl border-primary/25 bg-primary/5 py-0 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <CardContent className="flex items-center gap-3.5 px-[18px] py-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                            <UserPlus size={20} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="mb-0.5 text-sm font-semibold text-foreground">
                              Complete your health profile
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Add your details for more accurate AI assessments
                            </p>
                          </div>
                          <ChevronRight size={18} className="shrink-0 text-primary" />
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* Primary actions */}
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Get started
          </p>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="mb-6 grid grid-cols-1 gap-2.5 lg:grid-cols-3"
          >
            {primaryActions.map((a, i) => (
              <motion.div
                key={i}
                variants={itemVariants}
                whileHover={{ scale: 1.015, y: -2 }}
                whileTap={{ scale: 0.99 }}
              >
                <Card
                  onClick={a.onClick}
                  className="h-full cursor-pointer rounded-2xl border-border/70 py-0 shadow-sm transition-shadow hover:shadow-md"
                >
                  <CardContent className="flex items-center gap-3.5 px-[18px] py-4 lg:flex-col lg:items-start lg:gap-3">
                    <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', colorClasses[a.color])}>
                      <a.icon size={20} />
                    </div>
                    <div>
                      <p className="mb-0.5 text-sm font-semibold text-foreground">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Divider */}
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Your Health Data
          </p>

          {/* KPI strip */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="mb-2.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4"
          >
            {kpiLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[76px] rounded-2xl" />
              ))
            ) : (
              kpiTiles.map((k, i) => (
                <motion.div key={i} variants={itemVariants} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
                  <Card
                    onClick={() => navigate(k.to)}
                    className="h-full cursor-pointer rounded-2xl border-border/70 py-0 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <CardContent className="flex flex-col gap-1.5 px-4 py-3.5">
                      <p className="text-[11px] font-medium text-muted-foreground">{k.label}</p>
                      <p className="font-heading text-2xl font-extrabold tabular-nums text-foreground">
                        {k.value ?? '—'}
                      </p>
                      {k.tier && (
                        <span className={cn('w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold', k.tier.classes)}>
                          {k.tier.label}
                        </span>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </motion.div>

          {/* Secondary actions */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="mb-8 mt-2.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4"
          >
            {secondaryActions.map((a, i) => (
              <motion.div
                key={i}
                variants={itemVariants}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <Card
                  onClick={a.onClick}
                  className="h-full cursor-pointer rounded-2xl border-border/70 py-0 shadow-sm transition-shadow hover:shadow-md"
                >
                  <CardContent className="flex flex-col gap-2.5 p-3.5">
                    <div className={cn('flex h-[38px] w-[38px] items-center justify-center rounded-[10px]', colorClasses[a.color])}>
                      <a.icon size={18} />
                    </div>
                    <div>
                      <p className="mb-0.5 text-[13px] font-semibold text-foreground">{a.title}</p>
                      <p className="text-[11px] text-muted-foreground">{a.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            MediSense AI is not a substitute for professional medical advice.
            Always consult a qualified healthcare provider.
          </p>
        </div>
      </div>

      {/* Notification center */}
      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone size={16} className="text-primary" /> Announcements
            </DialogTitle>
          </DialogHeader>
          {announcements.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No announcements yet.</p>
          ) : (
            <ScrollArea className="max-h-[360px] pr-3">
              <div className="flex flex-col gap-3">
                {announcements.map((a) => (
                  <div key={a._id} className="rounded-xl border border-border/70 p-3.5">
                    <p className="text-sm font-semibold text-foreground">{a.title}</p>
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                      {a.body}
                    </p>
                    <p className="mt-2 text-[10px] text-muted-foreground">{formatAnnouncementDate(a.sentAt)}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

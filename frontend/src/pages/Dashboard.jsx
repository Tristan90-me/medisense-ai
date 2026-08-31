import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Activity, Map, Zap, ClipboardList,
  LogOut, History, TrendingUp,
  ClipboardCheck, UserPlus, ChevronRight, AlertTriangle, Users, PhoneCall, Settings, Pill, Trophy,
} from 'lucide-react';

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

  // ── Snapshot derivations ─────────────────────────────────────────────
  const latestSession = sessions[0] ?? null;
  const showSnapshotCard = !snapshotLoading && !sessionsError && !!latestSession;
  const showSnapshotEmpty = !snapshotLoading && !sessionsError && sessions.length === 0;
  const showNudge = !snapshotLoading && profile?.onboardingComplete === false;
  const hasSnapshotContent = snapshotLoading || showSnapshotCard || showSnapshotEmpty || showNudge;

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

  const secondaryActions = [
    {
      icon: History,
      color: 'moderate',
      title: 'Session History',
      desc: 'View all past sessions',
      onClick: () => navigate('/history'),
    },
    {
      icon: TrendingUp,
      color: 'critical',
      title: 'Health Stats',
      desc: 'Severity trends & symptom insights',
      onClick: () => navigate('/health-stats'),
    },
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
      icon: Pill,
      color: 'primary',
      title: 'Medications',
      desc: 'Track dosage, frequency & reminders',
      onClick: () => navigate('/medications'),
    },
    {
      icon: Settings,
      color: 'muted',
      title: 'Account Settings',
      desc: 'Profile, password & trusted devices',
      onClick: () => navigate('/account-settings'),
    },
    {
      icon: Trophy,
      color: 'secondary',
      title: 'Health Score',
      desc: 'Your wellness score & achievements',
      onClick: () => navigate('/health-score'),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
            <Activity size={18} />
          </div>
          <div>
            <p className="font-heading text-[15px] font-bold text-foreground">MediSense AI</p>
            <p className="text-[11px] text-muted-foreground">Health Dashboard</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut size={15} /> Logout
        </button>
      </header>

      <div className="mx-auto max-w-[600px] px-4 py-6">
        {/* Welcome */}
        <div className="mb-5">
          <h1 className="font-heading text-[22px] font-bold text-foreground">
            Hello, {user?.name?.split(' ')[0]} 👋
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
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="mb-5 flex flex-col gap-2.5"
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
                className="cursor-pointer rounded-2xl border-border/70 py-0 shadow-sm transition-shadow hover:shadow-md"
              >
                <CardContent className="flex items-center gap-3.5 px-[18px] py-4">
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

        {/* Secondary actions */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="mb-8 grid grid-cols-2 gap-2.5"
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
                className="cursor-pointer rounded-2xl border-border/70 py-0 shadow-sm transition-shadow hover:shadow-md"
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

        <p className="text-center text-[11px] leading-relaxed text-muted-foreground/70">
          MediSense AI is not a substitute for professional medical advice.
          Always consult a qualified healthcare provider.
        </p>
      </div>
    </div>
  );
}

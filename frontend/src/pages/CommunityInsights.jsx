import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Users2, ShieldCheck, Activity } from 'lucide-react';
import { getCommunityTrends } from '../api/community.api';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Same severity color tokens used elsewhere (SessionChat.jsx, AdminSessions.jsx)
// so a "High" badge here reads consistently with the rest of the app.
const SEVERITY_CLASSES = {
  Low: 'bg-severity-low-bg text-severity-low-fg',
  Moderate: 'bg-severity-moderate-bg text-severity-moderate-fg',
  High: 'bg-severity-high-bg text-severity-high-fg',
  Critical: 'bg-severity-critical-bg text-severity-critical-fg',
};

const WINDOW_OPTIONS = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
];

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

const capitalize = (str) => (str ? str.charAt(0).toUpperCase() + str.slice(1) : str);

export default function CommunityInsights() {
  const navigate = useNavigate();
  const [days, setDays] = useState(7);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (windowDays) => {
    setLoading(true);
    setError(false);
    try {
      const data = await getCommunityTrends(windowDays);
      setTrends(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  const maxSymptomCount = trends?.topSymptoms?.[0]?.userCount || 1;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button
          className="flex rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted"
          onClick={() => navigate('/dashboard')}
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent-foreground">
            <Users2 size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Community Insights</p>
            <p className="text-[11px] text-muted-foreground">Anonymized trends across all MediSense AI users</p>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-5">
        {/* Window toggle */}
        <div className="flex gap-1.5">
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                days === opt.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:bg-accent'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loading ? (
          <>
            <Skeleton className="h-[220px] rounded-[14px]" />
            <Skeleton className="h-[140px] rounded-[14px]" />
          </>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <Activity size={22} className="text-severity-high-fg" />
            <p className="text-sm font-medium text-foreground">Unable to load community trends right now.</p>
          </div>
        ) : trends?.insufficientData ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <Card className="rounded-[14px] border-dashed border-border/70 shadow-none">
              <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-foreground">
                  <Users2 size={22} />
                </div>
                <p className="text-sm font-semibold text-foreground">Not enough community activity yet</p>
                <p className="max-w-[320px] text-xs leading-relaxed text-muted-foreground">
                  Not enough community activity yet to show trends — check back once more people have used
                  MediSense AI.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="flex flex-col gap-4">
            {/* Top symptoms */}
            <motion.div variants={itemVariants}>
              <Card className="rounded-[14px] py-4 shadow-sm">
                <CardContent className="px-4">
                  <p className="text-sm font-bold text-foreground">Most Reported Symptoms</p>
                  <p className="text-[11px] text-muted-foreground">
                    Last {trends.windowDays} days · {trends.totalDistinctUsers} people checked in
                  </p>
                  {trends.topSymptoms.length === 0 ? (
                    <p className="mt-4 text-xs text-muted-foreground">
                      No symptom has been shared by enough people yet in this window.
                    </p>
                  ) : (
                    <div className="mt-3.5 flex flex-col gap-2.5">
                      {trends.topSymptoms.map((s, i) => (
                        <div key={s.symptom} className="flex items-center gap-2.5">
                          <span className="w-[110px] shrink-0 truncate text-xs capitalize text-foreground/80">
                            {s.symptom}
                          </span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                              initial={{ width: 0 }}
                              animate={{ width: `${(s.userCount / maxSymptomCount) * 100}%` }}
                              transition={{ duration: 0.6, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                            />
                          </div>
                          <span className="w-12 shrink-0 text-right text-[11px] font-medium text-muted-foreground">
                            {s.percentage}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Severity breakdown */}
            <motion.div variants={itemVariants}>
              <Card className="rounded-[14px] py-4 shadow-sm">
                <CardContent className="px-4">
                  <p className="text-sm font-bold text-foreground">Severity Breakdown</p>
                  <p className="text-[11px] text-muted-foreground">Share of people by highest reported severity</p>
                  {trends.severityBreakdown.length === 0 ? (
                    <p className="mt-4 text-xs text-muted-foreground">
                      No severity level has been shared by enough people yet in this window.
                    </p>
                  ) : (
                    <div className="mt-3.5 flex flex-wrap gap-2">
                      {trends.severityBreakdown.map((s) => (
                        <span
                          key={s.severityLevel}
                          className={cn(
                            'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold',
                            SEVERITY_CLASSES[s.severityLevel] || 'bg-muted text-foreground'
                          )}
                        >
                          {capitalize(s.severityLevel)} · {s.percentage}%
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Privacy note */}
            <motion.div variants={itemVariants} className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-muted-foreground">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" />
              <p>
                Trends are anonymized and only shown when at least 10 people share a pattern —
                individual sessions are never identifiable.
              </p>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

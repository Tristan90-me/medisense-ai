import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Lock, Info, ArrowUpRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { getHealthScore } from '../api/healthScore.api';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// Mirrors backend/config/achievements.js's id/title/description/icon fields.
// The `check` predicates stay server-side (that's the source of truth for
// whether something is actually unlocked) — the client just needs to know
// which achievements exist at all, so it can render the locked ones too.
// Hiding locked-achievement existence would undermine the gamification hook.
const ACHIEVEMENT_CATALOG = [
  { id: 'first_checkin', title: 'First Check-in', description: 'Completed your first symptom check-in session.', icon: '🩺' },
  { id: 'profile_complete', title: 'Profile Complete', description: 'Filled out your full health profile.', icon: '📋' },
  { id: 'consistent_tracker', title: 'Consistent Tracker', description: 'Logged 3+ sessions in the last 30 days.', icon: '📈' },
  { id: 'medication_manager', title: 'Medication Manager', description: 'Tracking at least one active medication.', icon: '💊' },
  { id: 'clean_bill', title: 'Clean Bill of Health', description: 'No critical or emergency flags in the last 30 days.', icon: '✅' },
  { id: 'health_champion', title: 'Health Champion', description: 'Reached a health score of 80 or higher.', icon: '🏆' },
];

const BREAKDOWN_ITEMS = [
  { key: 'profileCompletenessScore', label: 'Profile completeness', max: 30 },
  { key: 'sessionFrequencyScore', label: 'Session frequency', max: 30 },
  { key: 'followThroughScore', label: 'Follow-through', max: 20 },
  { key: 'medicationTrackingScore', label: 'Medication tracking', max: 10 },
  { key: 'noCriticalFlagScore', label: 'No critical flags', max: 10 },
];

// Concrete actions for the breakdown items a user can actually act on.
// noCriticalFlagScore is deliberately excluded — "no critical/emergency
// flags in the last 30 days" isn't something to prompt someone to go do.
const IMPROVEMENT_ACTIONS = {
  profileCompletenessScore: { label: 'Complete your health profile', to: '/onboarding' },
  sessionFrequencyScore: { label: 'Log a symptom check-in', to: '/session?mode=quick' },
  followThroughScore: { label: 'Finish an assessment you started', to: '/history' },
  medicationTrackingScore: { label: 'Add a medication you’re tracking', to: '/medications' },
};

export default function HealthScoreAchievements() {
  const navigate = useNavigate();
  const [healthScore, setHealthScore] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getHealthScore();
      setHealthScore(data);
    } catch {
      toast.error('Failed to load health score');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const score = healthScore?.currentScore ?? 0;
  const breakdown = healthScore?.breakdown || {};
  const unlockedIds = new Set((healthScore?.unlockedAchievements || []).map((a) => a.id));

  // The two lowest-scoring actionable factors (as a fraction of their max),
  // excluding anything already maxed out and anything with no real action.
  const improvements = BREAKDOWN_ITEMS
    .filter((item) => IMPROVEMENT_ACTIONS[item.key])
    .map((item) => ({ ...item, value: breakdown[item.key] ?? 0 }))
    .filter((item) => item.value < item.max)
    .sort((a, b) => (a.value / a.max) - (b.value / b.max))
    .slice(0, 2);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent"
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Trophy size={16} />
          </div>
          <div>
            <p className="font-heading text-sm font-semibold text-foreground">Health Score & Achievements</p>
            <p className="text-[11px] text-muted-foreground">
              {loading ? 'Loading…' : `${unlockedIds.size} of ${ACHIEVEMENT_CATALOG.length} achievements unlocked`}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-5 px-4 py-4">
        {loading && (
          <div className="flex flex-col gap-5">
            <Skeleton className="h-[104px] rounded-2xl" />
            <Skeleton className="h-[180px] rounded-2xl" />
            <Skeleton className="h-[220px] rounded-2xl" />
          </div>
        )}

        {!loading && (
          <>
            {/* Overall score */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-end justify-between">
                <p className="text-sm font-semibold text-foreground">Your wellness snapshot</p>
                <p className="text-3xl font-bold text-primary">
                  {score}
                  <span className="text-base font-medium text-muted-foreground">/100</span>
                </p>
              </div>
              <Progress value={score} aria-label={`Overall wellness score: ${score} out of 100`} />
              <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <Info size={12} className="mt-0.5 shrink-0" />
                Not a medical measurement — reflects how complete your profile is and how engaged
                you've been with MediSense, not your actual health.
              </p>
            </div>

            {/* Improve your score */}
            {improvements.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <p className="mb-3 text-sm font-semibold text-foreground">Improve your score</p>
                <div className="flex flex-col gap-2">
                  {improvements.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => navigate(IMPROVEMENT_ACTIONS[item.key].to)}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3.5 py-3 text-left transition-colors hover:bg-accent"
                    >
                      <div>
                        <p className="text-[13px] font-medium text-foreground">{IMPROVEMENT_ACTIONS[item.key].label}</p>
                        <p className="text-[11px] text-muted-foreground">{item.label}: {item.value}/{item.max}</p>
                      </div>
                      <ArrowUpRight size={15} className="shrink-0 text-primary" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Breakdown */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-foreground">Score breakdown</p>
              <div className="flex flex-col gap-3">
                {BREAKDOWN_ITEMS.map((item) => {
                  const value = breakdown[item.key] ?? 0;
                  return (
                    <div key={item.key} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-medium text-foreground">{value}/{item.max}</span>
                      </div>
                      <Progress
                        value={(value / item.max) * 100}
                        className="h-1.5"
                        aria-label={`${item.label}: ${value} out of ${item.max}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Achievements */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-foreground">Achievements</p>
              <div className="grid grid-cols-2 gap-3">
                {ACHIEVEMENT_CATALOG.map((a) => {
                  const unlocked = unlockedIds.has(a.id);
                  return (
                    <div
                      key={a.id}
                      className={cn(
                        'relative flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left',
                        unlocked ? 'border-border bg-background' : 'border-border/60 bg-muted/40'
                      )}
                    >
                      {!unlocked && (
                        <Lock size={13} className="absolute right-2.5 top-2.5 text-muted-foreground" />
                      )}
                      <span className={cn('text-2xl', !unlocked && 'opacity-50')}>{a.icon}</span>
                      <Badge variant={unlocked ? 'default' : 'outline'} className="text-[10px]">
                        {a.title}
                      </Badge>
                      <p className="text-[11px] leading-snug text-muted-foreground">{a.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, TrendingUp, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import api from '../api/axios';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Chart colors pulled straight from assets/design-tokens.json (primitive palette) —
// recharts renders raw SVG attributes, so it needs literal color values, not Tailwind classes.
const CHART_COLORS = {
  primary: '#3B82F6', // primitive.color.blue.500
  grid: '#F1F5F9', // primitive.color.slate.100
  axis: '#94A3B8', // primitive.color.slate.400
  tooltipBorder: '#E2E8F0', // primitive.color.slate.200
  tooltipBg: '#FFFFFF', // primitive.color.white
  tooltipTitle: '#0F172A', // primitive.color.slate.950 (semantic.color.foreground)
  referenceLine: '#EF4444', // primitive.color.red.500
  severity: {
    Low: '#22C55E', // primitive.color.green.500
    Moderate: '#F59E0B', // primitive.color.amber.500
    High: '#EF4444', // primitive.color.red.500
    Critical: '#8B5CF6', // primitive.color.violet.500 (semantic.color.severity-critical)
  },
};

// Fixed Tailwind class strings per stat — Tailwind can't interpolate arbitrary
// class-name strings built at runtime, so map to constants instead of template-stringing.
const STAT_CARD_CLASSES = {
  total: { border: 'border-t-primary', value: 'text-primary' },
  completed: { border: 'border-t-severity-low', value: 'text-severity-low-fg' },
  avg: { border: 'border-t-severity-moderate', value: 'text-severity-moderate-fg' },
  emergencies: { border: 'border-t-severity-high', value: 'text-severity-high-fg' },
};

export default function HealthStats() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get('/ai/sessions');
        setSessions(res.data.sessions);
      } catch {}
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  // ── Derived stats ────────────────────────────────────────────────────
  const completed = sessions.filter(s => s.status === 'completed');
  const withSeverity = sessions.filter(s => s.severityScore);
  const avgSeverity = withSeverity.length
    ? (withSeverity.reduce((a, s) => a + s.severityScore, 0) / withSeverity.length).toFixed(1)
    : 'N/A';

  const emergencyCount = sessions.filter(s => s.emergencyDetected).length;

  // Symptom frequency
  const symptomMap = {};
  sessions.forEach(s => {
    s.symptoms?.forEach(sym => {
      symptomMap[sym.name] = (symptomMap[sym.name] || 0) + 1;
    });
  });
  const topSymptoms = Object.entries(symptomMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  // Timeline data for chart (last 10 sessions with severity)
  const chartData = withSeverity
    .slice()
    .reverse()
    .slice(-10)
    .map((s) => ({
      name: new Date(s.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      severity: s.severityScore,
      level: s.severityLevel,
    }));

  const severityDotColor = (level) => CHART_COLORS.severity[level] || CHART_COLORS.primary;

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    return <circle cx={cx} cy={cy} r={5} fill={severityDotColor(payload.level)} stroke="#fff" strokeWidth={2} />;
  };

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div
        className="rounded-[10px] px-3 py-2 text-xs"
        style={{ background: CHART_COLORS.tooltipBg, border: `0.5px solid ${CHART_COLORS.tooltipBorder}` }}
      >
        <p className="font-semibold" style={{ color: CHART_COLORS.tooltipTitle }}>{d.name}</p>
        <p style={{ color: severityDotColor(d.level) }}>{d.level} — {d.severity}/10</p>
      </div>
    );
  };

  const statCards = [
    { key: 'total', label: 'Total Sessions', value: sessions.length },
    { key: 'completed', label: 'Completed', value: completed.length },
    { key: 'avg', label: 'Avg Severity', value: avgSeverity },
    { key: 'emergencies', label: 'Emergencies', value: emergencyCount },
  ];

  const statsGrid = (
    <div className="grid grid-cols-2 gap-3">
      {statCards.map((s, i) => (
        <motion.div
          key={s.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
        >
          <Card className={`gap-0 rounded-[14px] border-t-[3px] py-4 shadow-sm ${STAT_CARD_CLASSES[s.key].border}`}>
            <CardContent className="px-4">
              <p className={`text-[28px] font-extrabold leading-none ${STAT_CARD_CLASSES[s.key].value}`}>{s.value}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );

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
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <TrendingUp size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Health Stats</p>
            <p className="text-[11px] text-muted-foreground">Your health overview</p>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-5">
        {loading ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[84px] rounded-[14px]" />
              ))}
            </div>
            <Skeleton className="h-[260px] rounded-[14px]" />
            <Skeleton className="h-[200px] rounded-[14px]" />
          </>
        ) : (
          <>
            {/* Stat cards */}
            {statsGrid}

            {/* Severity timeline */}
            {chartData.length > 1 ? (
              <Card className="rounded-[14px] py-4 shadow-sm">
                <CardContent className="px-4">
                  <p className="text-sm font-bold text-foreground">Severity Over Time</p>
                  <p className="text-[11px] text-muted-foreground">
                    Last {chartData.length} sessions with severity scores
                  </p>
                  <div className="mt-4 h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: CHART_COLORS.axis }} />
                        <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: CHART_COLORS.axis }} />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine
                          y={7}
                          stroke={CHART_COLORS.referenceLine}
                          strokeDasharray="4 4"
                          strokeOpacity={0.5}
                          label={{ value: 'High', fill: CHART_COLORS.referenceLine, fontSize: 10 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="severity"
                          stroke={CHART_COLORS.primary}
                          strokeWidth={2}
                          dot={<CustomDot />}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="rounded-[14px] py-4 shadow-sm">
                <CardContent className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center text-[13px] text-muted-foreground">
                  <Activity size={28} className="text-muted-foreground/40" />
                  <p>Not enough data yet for a chart.</p>
                  <p className="text-xs text-muted-foreground">Complete at least 2 sessions with severity scores.</p>
                </CardContent>
              </Card>
            )}

            {/* Top symptoms */}
            {topSymptoms.length > 0 && (
              <Card className="rounded-[14px] py-4 shadow-sm">
                <CardContent className="px-4">
                  <p className="text-sm font-bold text-foreground">Most Common Symptoms</p>
                  <p className="text-[11px] text-muted-foreground">Across all your sessions</p>
                  <div className="mt-3.5 flex flex-col gap-2.5">
                    {topSymptoms.map(([name, count], i) => {
                      const max = topSymptoms[0][1];
                      return (
                        <div key={name} className="flex items-center gap-2.5">
                          <span className="w-[120px] shrink-0 text-xs text-foreground/80">{name}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <motion.div
                              className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                              initial={{ width: 0 }}
                              animate={{ width: `${(count / max) * 100}%` }}
                              transition={{ duration: 0.6, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                            />
                          </div>
                          <span className="w-6 shrink-0 text-right text-[11px] text-muted-foreground">{count}x</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Emergency notice */}
            {emergencyCount > 0 && (
              <div className="flex items-start gap-2.5 rounded-xl border border-severity-high/30 bg-severity-high-bg px-3.5 py-3 text-[13px] leading-relaxed text-severity-high-fg">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <p>
                  {emergencyCount} session{emergencyCount > 1 ? 's' : ''} flagged emergency symptoms.
                  Please ensure you sought appropriate medical care.
                </p>
              </div>
            )}

            <p className="pb-5 text-center text-[11px] leading-relaxed text-muted-foreground">
              MediSense AI is not a substitute for professional medical advice.
              Always consult a qualified healthcare provider.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

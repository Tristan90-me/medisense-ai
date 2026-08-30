import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Activity, AlertTriangle, Calendar,
} from 'lucide-react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { motion } from 'framer-motion';
import adminApi from '../../api/adminApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// Real palette values from assets/design-tokens.json (primitive.color.*) —
// recharts sets these directly as SVG attributes, so Tailwind classes won't work here.
const SEVERITY_COLORS = {
  Low: '#22C55E',      // primitive.color.green.500
  Moderate: '#F59E0B', // primitive.color.amber.500
  High: '#EF4444',     // primitive.color.red.500
  Critical: '#8B5CF6', // primitive.color.violet.500
};
const CHART_GRID = '#F1F5F9';   // primitive.color.slate.100
const CHART_TICK = '#94A3B8';   // primitive.color.slate.400
const CHART_TICK_STRONG = '#64748B'; // primitive.color.slate.500
const CHART_BAR = '#3B82F6';    // primitive.color.blue.500

const statVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const statItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await adminApi.get('/admin/stats');
        setStats(res.data);
      } catch {
        navigate('/admin/login');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const severityMap = {};
  stats?.severityBreakdown?.forEach(s => { severityMap[s._id] = s.count; });

  const severityData = ['Low', 'Moderate', 'High', 'Critical'].map(level => ({
    name: level,
    count: severityMap[level] || 0,
  }));

  const statCards = stats ? [
    { label: 'Total Users', value: stats.totalUsers, icon: <Users size={18} />, iconBg: 'bg-primary/10', iconFg: 'text-primary' },
    { label: 'Total Sessions', value: stats.totalSessions, icon: <Activity size={18} />, iconBg: 'bg-secondary/10', iconFg: 'text-secondary' },
    { label: "Today's Sessions", value: stats.todaySessions, icon: <Calendar size={18} />, iconBg: 'bg-severity-low-bg', iconFg: 'text-severity-low-fg' },
    { label: 'Emergencies', value: stats.emergencySessions, icon: <AlertTriangle size={18} />, iconBg: 'bg-severity-high-bg', iconFg: 'text-severity-high-fg' },
  ] : [];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[960px] flex-col gap-4 px-4 py-5">
        {loading ? (
          <>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[76px] rounded-[14px]" />
              ))}
            </div>
            <Skeleton className="h-[232px] rounded-[14px]" />
            <Skeleton className="h-[212px] rounded-[14px]" />
          </>
        ) : !stats ? null : (
          <>
            {/* Stat cards */}
            <motion.div
              variants={statVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 gap-2.5 sm:grid-cols-4"
            >
              {statCards.map((s, i) => (
                <motion.div key={i} variants={statItem}>
                  <Card className="gap-0 rounded-[14px] border-border/70 py-0 shadow-none">
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] ${s.iconBg} ${s.iconFg}`}>
                        {s.icon}
                      </div>
                      <div>
                        <p className={`text-2xl font-extrabold leading-none ${s.iconFg}`}>{s.value}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">{s.label}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>

            {/* Sessions by day chart */}
            {stats.sessionsByDay?.length > 0 && (
              <Card className="rounded-[14px] border-border/70 shadow-none">
                <CardContent>
                  <p className="text-sm font-bold text-foreground">Sessions — Last 7 Days</p>
                  <div className="mt-4 h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.sessionsByDay}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                        <XAxis
                          dataKey="_id"
                          tick={{ fontSize: 10, fill: CHART_TICK }}
                          tickFormatter={(v) => {
                            const d = new Date(v);
                            return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
                          }}
                        />
                        <YAxis tick={{ fontSize: 10, fill: CHART_TICK }} allowDecimals={false} />
                        <Tooltip
                          formatter={(v) => [v, 'Sessions']}
                          labelFormatter={(l) => new Date(l).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        />
                        <Bar dataKey="count" fill={CHART_BAR} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Severity breakdown */}
            <Card className="rounded-[14px] border-border/70 shadow-none">
              <CardContent>
                <p className="text-sm font-bold text-foreground">Severity Breakdown</p>
                <div className="mt-4 h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={severityData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART_TICK_STRONG }} />
                      <YAxis tick={{ fontSize: 10, fill: CHART_TICK }} allowDecimals={false} />
                      <Tooltip formatter={(v) => [v, 'Sessions']} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {severityData.map((entry) => (
                          <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Quick links */}
            <div className="flex flex-wrap gap-2.5">
              <Button variant="outline" className="rounded-full" onClick={() => navigate('/admin/users')}>
                <Users size={16} /> Manage Users
              </Button>
              <Button variant="outline" className="rounded-full" onClick={() => navigate('/admin/sessions')}>
                <Activity size={16} /> Monitor Sessions
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

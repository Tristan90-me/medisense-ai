import { useState, useEffect } from 'react';
import { Cpu, Calendar, Database, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import adminApi from '../../api/adminApi';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const statVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const statItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

const formatDate = (d) => d && new Date(d).toLocaleString('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export default function ModelEvaluation() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await adminApi.get('/admin/model-evaluation');
        setData(res.data);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const statCards = data ? [
    { label: 'Conditions', value: data.conditionCount },
    { label: 'Symptoms', value: data.symptomCount },
    { label: 'Training samples', value: data.trainSize },
    { label: 'Test samples', value: data.testSize },
  ] : [];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[760px] flex-col gap-4 px-4 py-5">
        <div>
          <p className="font-heading text-lg font-bold text-foreground">Model Evaluation</p>
          <p className="text-sm text-muted-foreground">MediSense Symptom Classifier</p>
        </div>

        {loading ? (
          <>
            <Skeleton className="h-[90px] rounded-[14px]" />
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[76px] rounded-[14px]" />
              ))}
            </div>
          </>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Failed to load model evaluation data.</p>
        ) : (
          <>
            <Card className="rounded-[14px] border-border/70 shadow-none">
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-center gap-2">
                  <Cpu size={16} className="text-primary" />
                  <p className="text-sm font-bold text-foreground">{data.algorithm}</p>
                </div>
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Database size={13} className="mt-0.5 shrink-0" /> {data.trainingData}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar size={13} className="shrink-0" /> Last trained {formatDate(data.trainedAt)} (version {data.version})
                </p>
              </CardContent>
            </Card>

            <motion.div
              variants={statVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 gap-2.5 sm:grid-cols-4"
            >
              {statCards.map((s, i) => (
                <motion.div key={i} variants={statItem}>
                  <Card className="gap-0 rounded-[14px] border-border/70 py-0 shadow-none">
                    <CardContent className="p-4">
                      <p className="text-2xl font-extrabold leading-none text-foreground">{s.value}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{s.label}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>

            <Card className="rounded-[14px] border-t-[3px] border-t-primary border-border/70 shadow-none">
              <CardContent className="p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Held-out test accuracy
                </p>
                <p className="mt-1 font-heading text-4xl font-extrabold text-primary">
                  {data.accuracy != null ? `${Math.round(data.accuracy * 100)}%` : '—'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.testSize} held-out samples, never used during training.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-[14px] border-border/70 bg-muted/40 shadow-none">
              <CardContent className="flex items-start gap-2.5 p-4">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  This evaluation reflects performance on synthetic data matching the training
                  distribution — it does not represent clinical diagnostic accuracy. The classifier
                  is one of three independent signals (alongside the AI assessment and rule-based
                  triage) and is never used on its own to produce a diagnosis.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

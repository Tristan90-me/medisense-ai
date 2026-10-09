import { useState } from 'react';
import { Cpu, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Hardcoded rather than sourced from backend/ml's MODEL_META (which only
// exports a numeric `version`, not a name/accuracy string) — these are
// stable facts about the model, not something that needs to be data-driven.
// HELD_OUT_ACCURACY matches backend/ml/model.json's actual computed
// evaluation.accuracy (0.873), also shown in docs/defense-deck.html — not
// an invented figure.
const MODEL_NAME = 'Bernoulli Naive Bayes';
const HELD_OUT_ACCURACY = '87.3%';

// Shared by SessionChat.jsx (live session) and SessionDetail.jsx (completed
// session view) — consumer-facing summary by default, with the technical
// detail (model name, accuracy, and the synthetic-data caveat that belongs
// next to any accuracy figure) behind an explicit toggle rather than shown
// by default to every user.
export default function MLClassifierCard({ mlClassification, compact = false }) {
  const [expanded, setExpanded] = useState(false);
  if (!mlClassification?.condition) return null;

  const top = mlClassification.topPredictions?.[0];

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Cpu size={compact ? 13 : 14} className="text-secondary" />
        <p className={cn(compact ? 'text-[11px] font-bold uppercase tracking-wide text-primary' : 'text-sm font-bold text-foreground')}>
          Additional symptom analysis
        </p>
      </div>

      {top && (
        <p className="mb-2.5 text-[12px] leading-relaxed text-foreground/80">
          Possible pattern: <span className="font-medium text-foreground">{top.condition}</span>-related symptoms
        </p>
      )}

      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        aria-expanded={expanded}
        className="flex items-center gap-1 text-[11px] font-medium text-primary"
      >
        {expanded ? 'Hide' : 'View'} technical analysis
        <ChevronDown size={12} className={cn('transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
          <div className="grid grid-cols-2 gap-y-1.5 text-[11px]">
            <span className="text-muted-foreground">Model</span>
            <span className="text-right font-medium text-foreground">{MODEL_NAME}</span>
            <span className="text-muted-foreground">Held-out accuracy</span>
            <span className="text-right font-medium text-foreground">{HELD_OUT_ACCURACY}</span>
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Evaluated on a synthetic held-out dataset generated from this project's own curated
            symptom profiles — not real patient data. A supplementary pattern signal, not a
            clinical accuracy measure.
          </p>
          <div className="flex flex-col gap-2.5">
            {mlClassification.topPredictions?.slice(0, 3).map((p, i) => (
              <div key={i}>
                <div className="mb-1 flex justify-between text-[13px] font-medium text-foreground">
                  <span>{p.condition}</span>
                  <span>{Math.round(p.probability * 100)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-secondary" style={{ width: `${p.probability * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

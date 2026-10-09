import { useState } from 'react';
import { Check, ChevronDown, AlertTriangle, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

// seekCareUrgency levels that warrant an in-person-care nudge — self-care
// and monitor don't need it. Also gates the "seek urgent care if" footer
// below, since that list isn't relevant to a self-care result.
const CARE_FINDER_URGENCIES = ['see-doctor', 'urgent-care', 'emergency'];

const URGENCY_META = {
  'self-care': {
    label: 'Low Concern', emoji: '🟢', classes: 'bg-severity-low-bg text-severity-low-fg',
    blurb: "Your symptoms generally don't need urgent attention — self-care is a reasonable first step.",
  },
  monitor: {
    label: 'Monitor', emoji: '🔵', classes: 'bg-primary/10 text-primary',
    blurb: 'Keep an eye on how this develops over the next day or two.',
  },
  'see-doctor': {
    label: 'Moderate Concern', emoji: '🟡', classes: 'bg-severity-moderate-bg text-severity-moderate-fg',
    blurb: 'Your symptoms may benefit from professional medical evaluation.',
  },
  'urgent-care': {
    label: 'High Concern', emoji: '🟠', classes: 'bg-severity-high-bg text-severity-high-fg',
    blurb: 'Consider seeking care soon rather than waiting it out.',
  },
  emergency: {
    label: 'Urgent Concern', emoji: '🔴', classes: 'bg-severity-critical-bg text-severity-critical-fg',
    blurb: 'This may need immediate medical attention.',
  },
};

// A short, fixed subset of this app's own rule-based triage red flags (see
// backend/utils/triage.js's TRIAGE_RULES) — reused here rather than invented
// copy, so this list matches what the system actually watches for.
// Deliberately excludes the headache-specific and mental-health-crisis rules:
// "thunderclap headache" overlaps confusingly with a headache-related
// assessment itself, and a crisis-specific concern deserves its own
// dedicated path, not a bullet in an unrelated symptom's footer.
const RED_FLAGS = [
  'Chest pain with arm/jaw pain or shortness of breath',
  'Difficulty breathing or choking',
  'Signs of stroke (face drooping, arm weakness, speech difficulty)',
  'Uncontrolled bleeding',
  'Loss of consciousness or fainting',
  'Severe allergic reaction (throat swelling, hives + breathing issues)',
];

// Shared by SessionChat.jsx (live session), SessionDetail.jsx (completed
// session view), and SessionSummary.jsx (modal) — previously each had its
// own slightly different diagnosis layout and label ("Assessment Results" /
// "Assessment" / "Possible Conditions"). `ruleBasedTriage` and
// `mlClassification` are optional: the "Why am I seeing this?" section
// renders whatever signals are actually passed rather than requiring all of
// them, so a caller with less context (should that ever happen) degrades
// gracefully instead of breaking.
export default function AssessmentResults({
  diagnosis, symptoms = [], ruleBasedTriage, mlClassification, onFindCare, className,
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  if (!diagnosis) return null;

  const urgency = URGENCY_META[diagnosis.seekCareUrgency] || null;
  const showCareFinder = CARE_FINDER_URGENCIES.includes(diagnosis.seekCareUrgency);
  const hasWhyContent = symptoms.length > 0 || ruleBasedTriage || mlClassification?.condition;

  return (
    <div className={cn('rounded-2xl border border-border bg-card p-4', className)}>
      <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-primary">Your Assessment</p>

      {urgency && (
        <div className={cn('mb-3 rounded-xl px-3.5 py-3', urgency.classes)}>
          <p className="text-sm font-bold">{urgency.emoji} {urgency.label}</p>
          <p className="mt-0.5 text-xs opacity-90">{urgency.blurb}</p>
        </div>
      )}

      {diagnosis.conditions?.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Possible explanations
          </p>
          <div className="space-y-2.5">
            {diagnosis.conditions.slice(0, 3).map((c, i) => (
              <div key={i}>
                <div className="mb-1 flex justify-between text-[13px] font-medium text-foreground">
                  <span>{c.name}</span>
                  <span>{c.probability}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                    style={{ width: `${c.probability}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[10.5px] text-muted-foreground">These are possibilities, not confirmed diagnoses.</p>
        </div>
      )}

      {hasWhyContent && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setWhyOpen((p) => !p)}
            aria-expanded={whyOpen}
            className="flex items-center gap-1 text-[11px] font-medium text-primary"
          >
            Why am I seeing this?
            <ChevronDown size={12} className={cn('transition-transform', whyOpen && 'rotate-180')} />
          </button>
          {whyOpen && (
            <div className="mt-2 flex flex-col gap-2.5 rounded-xl bg-muted/40 p-3">
              {symptoms.length > 0 && (
                <div>
                  <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Based on what you reported
                  </p>
                  <div className="flex flex-col gap-1">
                    {symptoms.map((s, i) => (
                      <span key={i} className="flex items-center gap-1.5 text-[12.5px] text-foreground">
                        <Check size={12} className="shrink-0 text-severity-low" /> {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {ruleBasedTriage && (
                <p className="text-[12px] text-foreground">
                  <span className="font-medium">Clinical safety check:</span>{' '}
                  {ruleBasedTriage.matchedRules?.length > 0
                    ? `${ruleBasedTriage.matchedRules.length} red-flag pattern${ruleBasedTriage.matchedRules.length > 1 ? 's' : ''} detected`
                    : 'No emergency red flags detected'}
                </p>
              )}
              {mlClassification?.condition && (
                <p className="text-[12px] text-foreground">
                  <span className="font-medium">ML symptom pattern:</span> {mlClassification.condition}-related pattern
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {diagnosis.recommendations?.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            What to do next
          </p>
          <ol className="flex flex-col gap-1">
            {diagnosis.recommendations.map((r, i) => (
              <li key={i} className="flex gap-1.5 text-xs text-muted-foreground">
                <span className="shrink-0 font-medium text-foreground">{i + 1}.</span> {r}
              </li>
            ))}
          </ol>
        </div>
      )}

      {showCareFinder && onFindCare && (
        <button
          onClick={onFindCare}
          className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <MapPin size={13} /> Find nearby care
        </button>
      )}

      {showCareFinder && (
        <div className="rounded-xl border border-severity-high/30 bg-severity-high-bg/40 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-severity-high-fg">
            <AlertTriangle size={12} /> Seek urgent care if
          </p>
          <ul className="flex flex-col gap-1">
            {RED_FLAGS.map((f, i) => (
              <li key={i} className="text-[11.5px] leading-relaxed text-foreground/85">• {f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

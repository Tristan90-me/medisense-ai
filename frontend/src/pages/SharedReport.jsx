import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, AlertTriangle, Loader2 } from 'lucide-react';
import { getSharedReport } from '../api/share.api';
import AssessmentResults from '../components/AssessmentResults';

const SEVERITY_CLASSES = {
  Low: { bg: 'bg-severity-low-bg', fg: 'text-severity-low-fg' },
  Moderate: { bg: 'bg-severity-moderate-bg', fg: 'text-severity-moderate-fg' },
  High: { bg: 'bg-severity-high-bg', fg: 'text-severity-high-fg' },
  Critical: { bg: 'bg-severity-critical-bg', fg: 'text-severity-critical-fg' },
};

const modeLabel = { quick: 'Quick Check', full: 'Full Assessment' };

// Public, unauthenticated — the landing spot for a "Share with a healthcare
// professional" link (see ShareDialog.jsx). Deliberately renders only what
// GET /api/share/:token returns: severity, symptoms, and diagnosis. There is
// no raw conversation to show here even if someone wanted it — the backend
// never sends it to this page.
export default function SharedReport() {
  const { token } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getSharedReport(token)
      .then(setReport)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  const sev = report?.severityLevel ? SEVERITY_CLASSES[report.severityLevel] : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="mx-auto flex max-w-[640px] items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Activity size={16} />
          </div>
          <div>
            <p className="font-heading text-sm font-semibold text-foreground">MediSense AI</p>
            <p className="text-[11px] text-muted-foreground">Shared health assessment</p>
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-5">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
            <Loader2 size={24} className="animate-spin text-primary" />
            <p className="text-sm">Loading report...</p>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-24 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-severity-high-bg text-severity-high-fg">
              <AlertTriangle size={22} />
            </div>
            <p className="text-base font-semibold text-foreground">This link is invalid or has expired</p>
            <p className="max-w-[320px] text-sm leading-relaxed text-muted-foreground">
              Share links expire 7 days after they're created, or may have been revoked by the person who shared them.
            </p>
          </div>
        )}

        {!loading && !error && report && (
          <>
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{report.patientName || 'Patient'}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(report.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' · '}{modeLabel[report.mode] || report.mode}
                  </p>
                </div>
                {report.severityLevel && (
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${sev.bg} ${sev.fg}`}>
                    {report.severityLevel} — {report.severityScore}/10
                  </span>
                )}
              </div>
            </div>

            <AssessmentResults diagnosis={report.diagnosis} symptoms={report.symptoms} />

            <p className="rounded-xl bg-muted/50 px-3.5 py-3 text-[11px] leading-relaxed text-muted-foreground">
              This is an AI-generated assessment shared from MediSense AI — not a diagnosis, and not a substitute
              for clinical judgment. It does not include the original conversation it was generated from.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

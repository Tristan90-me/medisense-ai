import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Shared persistent error state for a page whose primary data failed to
// load — replaces the old pattern of a toast.error() that disappears and
// leaves a blank page behind (confirmed across AccountSettings,
// HealthScoreAchievements, PrivacyCenter, Medications, PhotoLog, Dependents,
// EmergencyContacts). Modeled on CareFinder.jsx's existing geo-error state,
// which already did this well.
export default function ErrorState({
  title = "We couldn't load this page",
  message = 'Your information is safe.',
  onRetry,
  showDashboardLink = true,
}) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-severity-high-bg text-severity-high-fg">
        <AlertTriangle size={22} />
      </div>
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="max-w-[300px] text-sm leading-relaxed text-muted-foreground">{message}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        {onRetry && <Button onClick={onRetry}>Try again</Button>}
        {showDashboardLink && (
          <Button variant="outline" onClick={() => navigate('/dashboard')}>Return to dashboard</Button>
        )}
      </div>
    </div>
  );
}

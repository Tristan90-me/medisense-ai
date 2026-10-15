import { Activity } from 'lucide-react';

// Full-page branded loading state — replaces the old bare "Loading..." text
// (App.jsx's route-chunk/auth-check fallback) and SessionChat's bespoke
// spinner, so every full-page wait looks like the same product rather than
// three different implementations. The bouncing-dot motif mirrors the
// typing indicator already used in Landing.jsx's conversation demo.
export default function BrandedLoader({ message = 'Preparing your health experience...' }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <Activity size={28} />
      </div>
      <div className="text-center">
        <p className="font-heading text-base font-bold text-foreground">MediSense AI</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

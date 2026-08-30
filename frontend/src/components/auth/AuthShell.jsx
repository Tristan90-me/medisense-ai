import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, CheckCircle } from 'lucide-react';

// Shared split-screen layout for the auth pages — a branded side panel with
// context-specific copy, and the form on the other side. Replaces the old
// bare centered card (which had no supporting content and read as generic).
export default function AuthShell({ sideTitle, sideSubtitle, sidePoints = [], children }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Form side */}
      <div className="flex items-center justify-center bg-background px-4 py-12 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[420px]"
        >
          <Link to="/" className="mb-10 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
              <Activity size={20} />
            </div>
            <span className="font-heading text-lg font-bold text-foreground">MediSense AI</span>
          </Link>
          {children}
        </motion.div>
      </div>

      {/* Branded side panel */}
      <div className="relative hidden overflow-hidden bg-ink lg:flex lg:flex-col lg:justify-center lg:px-16 lg:py-16">
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-secondary/15 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative max-w-[440px]"
        >
          <h2 className="mb-4 font-heading text-3xl font-extrabold leading-tight tracking-tight text-ink-foreground">
            {sideTitle}
          </h2>
          <p className="mb-8 text-[15px] leading-relaxed text-ink-foreground/65">
            {sideSubtitle}
          </p>
          <div className="space-y-4">
            {sidePoints.map((point, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
                className="flex items-start gap-3"
              >
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20">
                  <CheckCircle size={14} className="text-primary" />
                </div>
                <span className="text-sm leading-relaxed text-ink-foreground/85">{point}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

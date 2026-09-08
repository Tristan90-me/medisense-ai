import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BodyMap from '../components/BodyMap/BodyMap';
import SymptomPanel from '../components/BodyMap/SymptomPanel';
import api from '../api/axios';

const MAX_RECENT_SYMPTOMS = 8;

export default function BodyMapPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [side, setSide] = useState('front');
  const [recentSymptoms, setRecentSymptoms] = useState([]);

  const handleSelect = (region) => {
    setSelected(region === selected ? null : region);
  };

  const handleSideToggle = (s) => {
    setSide(s);
    setSelected(null);
  };

  // "Recently reported" is supplementary context pulled from session history —
  // if the fetch fails, fail silently and keep the core body-map interaction working.
  useEffect(() => {
    let cancelled = false;

    const fetchRecentSymptoms = async () => {
      try {
        const res = await api.get('/ai/sessions');
        const sessions = res.data?.sessions || [];
        const seen = new Set();
        const names = [];

        for (const session of sessions) {
          for (const symptom of session.symptoms || []) {
            const trimmed = symptom?.name?.trim();
            const key = trimmed?.toLowerCase();
            if (trimmed && !seen.has(key)) {
              seen.add(key);
              names.push(trimmed);
            }
          }
          if (names.length >= MAX_RECENT_SYMPTOMS) break;
        }

        if (!cancelled) setRecentSymptoms(names.slice(0, MAX_RECENT_SYMPTOMS));
      } catch {
        if (!cancelled) setRecentSymptoms([]);
      }
    };

    fetchRecentSymptoms();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRecentSymptomClick = (name) => {
    const symptomText = `I have been experiencing: ${name}.`;
    navigate(`/session?mode=quick&symptoms=${encodeURIComponent(symptomText)}`);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
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
            <Activity size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Body Map</p>
            <p className="text-[11px] text-muted-foreground">Tap where it hurts</p>
          </div>
        </div>
      </div>

      {/* Intro strip */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-start gap-2.5 border-b border-border bg-muted/40 px-4 py-2.5 sm:px-6"
      >
        <Info size={14} className="mt-0.5 shrink-0 text-primary" />
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          Tap a body region on the diagram to see related symptoms, or browse the list on the right to start a guided check.
        </p>
      </motion.div>

      {/* Recently reported strip */}
      <AnimatePresence>
        {recentSymptoms.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-b border-border bg-card"
          >
            <div className="flex items-center gap-2 overflow-x-auto px-4 py-2.5 sm:px-6">
              <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                You've recently reported:
              </span>
              <div className="flex shrink-0 gap-1.5">
                {recentSymptoms.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleRecentSymptomClick(name)}
                    className="shrink-0 rounded-full border border-border bg-background px-3 py-1 text-[11.5px] font-medium text-foreground/80 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex flex-1 flex-col overflow-hidden sm:flex-row">
        {/* Left — body map */}
        <div className="flex shrink-0 items-start justify-center overflow-y-auto border-b border-border bg-card p-4 sm:w-60 sm:border-b-0 sm:border-r sm:p-6">
          <BodyMap
            selected={selected}
            onSelect={handleSelect}
            side={side}
            onSideToggle={handleSideToggle}
          />
        </div>

        {/* Right — symptom panel */}
        <div className="min-h-[300px] flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {selected ? (
              <motion.div
                key={selected}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="h-full"
              >
                <SymptomPanel region={selected} onClose={() => setSelected(null)} />
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-[13px] text-muted-foreground"
              >
                <div className="text-4xl opacity-50">👆</div>
                <p>Select a body region to see related symptoms</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

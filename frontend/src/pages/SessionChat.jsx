import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import useVoice from '../hooks/useVoice';
import api from '../api/axios';
import { streamSessionMessage } from '../api/stream';
import { listEmergencyContacts } from '../api/emergencyContacts.api';
import { linkPhotoSession } from '../api/photoLog.api';
import SessionSummary from '../components/SessionSummary';
import MLClassifierCard from '../components/MLClassifierCard';
import AssessmentResults from '../components/AssessmentResults';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Mic, MicOff, Volume2, VolumeX, Send, AlertTriangle,
  Phone, Mail, ArrowLeft, Activity, Loader2, ShieldAlert, Check,
} from 'lucide-react';

const SEVERITY_CLASSES = {
  Low: 'bg-severity-low-bg text-severity-low-fg',
  Moderate: 'bg-severity-moderate-bg text-severity-moderate-fg',
  High: 'bg-severity-high-bg text-severity-high-fg',
  Critical: 'bg-severity-critical-bg text-severity-critical-fg',
};

// Ordered phase lists the backend's [PROGRESS:{"phase":...}] tag reports
// against — the LLM only names a phase; the step number/fraction shown to
// the user is always derived here, never trusted from the model directly.
const PHASES = {
  quick: ['symptoms', 'severity', 'assessment'],
  full: ['symptoms', 'severity', 'history', 'risk', 'assessment'],
};
const PHASE_LABELS = {
  symptoms: 'Symptoms',
  severity: 'Severity',
  history: 'Medical History',
  risk: 'Risk Factors',
  assessment: 'Assessment',
};

export default function SessionChat() {
  const { user } = useAuth();
  const { setActiveSession } = useSession();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = searchParams.get('mode') || 'quick';
  const preloadedSymptoms = searchParams.get('symptoms');
  const dependentId = searchParams.get('dependent');
  const photoId = searchParams.get('photoId');
  const currentPhases = PHASES[mode] || PHASES.quick;

  const [session, setSession] = useState(null);
  const [sessionSymptoms, setSessionSymptoms] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [severity, setSeverity] = useState(null);
  const [ruleBasedTriage, setRuleBasedTriage] = useState(null);
  const [severityMismatch, setSeverityMismatch] = useState(false);
  const [mlClassification, setMlClassification] = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [phaseIndex, setPhaseIndex] = useState(-1);
  const [activeWidget, setActiveWidget] = useState(null);
  const [emergency, setEmergency] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const streamingIndexRef = useRef(null);
  const contactsFetchedRef = useRef(false);
  const initRanRef = useRef(false);

  const voice = useVoice();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (voice.transcript) setInput(voice.transcript);
  }, [voice.transcript]);

  // Lazy-fetch emergency contacts only the first time `emergency` flips to
  // true — guarded by a ref so it never refetches on subsequent renders or
  // re-triggers of the same session, and never fetches unconditionally on
  // page load for sessions that never flag an emergency.
  useEffect(() => {
    if (emergency && !contactsFetchedRef.current) {
      contactsFetchedRef.current = true;
      listEmergencyContacts()
        .then((data) => setEmergencyContacts(data))
        .catch(() => setEmergencyContacts([]))
        .finally(() => setContactsLoaded(true));
    }
  }, [emergency]);

  useEffect(() => {
    // Guards against React StrictMode's intentional dev-only double-invoke
    // of effects — without this, local development double-fires the
    // session-start POST (and, worse, the preloaded-symptom auto-send),
    // since this effect has real side effects and nothing to meaningfully
    // cancel/clean up on the simulated unmount between the two invocations.
    if (initRanRef.current) return;
    initRanRef.current = true;

    const init = async () => {
      try {
        const res = await api.post('/ai/session/start', { mode, dependentId: dependentId || undefined });
        const s = res.data.session;
        setSession(s);
        setActiveSession(s);

        // Best-effort — a failure here shouldn't block the chat itself.
        if (photoId) linkPhotoSession(photoId, s._id).catch(() => {});

        if (res.data.resumed && s.messages?.length) {
          setMessages(s.messages);
          if (s.severityScore) setSeverity({ score: s.severityScore, level: s.severityLevel });
          if (s.ruleBasedTriage?.level) setRuleBasedTriage(s.ruleBasedTriage);
          if (s.severityMismatch) setSeverityMismatch(true);
          if (s.mlClassification?.condition) setMlClassification(s.mlClassification);
          if (s.diagnosis?.conditions?.length) setDiagnosis(s.diagnosis);
          if (s.symptoms?.length) setSessionSymptoms(s.symptoms);
          if (s.emergencyDetected) setEmergency(true);
          if (s.lastProgressPhase) {
            const idx = currentPhases.indexOf(s.lastProgressPhase);
            if (idx !== -1) setPhaseIndex(idx);
          }
        } else {
          const greeting = {
            role: 'assistant',
            content: mode === 'full'
              ? `Hello ${user?.name?.split(' ')[0] || 'there'}! I'm going to do a thorough health assessment with you today. I'll ask you about 10–15 questions to understand your symptoms fully. What's been bothering you?`
              : `Hi ${user?.name?.split(' ')[0] || 'there'}! Tell me what symptoms you're experiencing and I'll help you understand what might be going on.`,
          };
          setMessages([greeting]);
          if (voice.voiceEnabled) voice.speak(greeting.content);

          if (preloadedSymptoms && s) {
            setTimeout(() => {
              sendMessage(preloadedSymptoms, s);
            }, 800);
          }
        }
      } catch (err) {
        console.error('Session init failed', err);
      } finally {
        setInitializing(false);
      }
    };
    init();
  }, []);

  // sessionOverride exists for the auto-send-on-mount path below: the
  // setTimeout there fires from the initial-render closure of this function,
  // whose `session` state was still null at that point (state updates from
  // the same effect don't retroactively change an already-captured closure).
  // Passing the freshly-fetched session directly sidesteps that stale value
  // instead of relying on the (stale) component state.
  const sendMessage = async (text, sessionOverride) => {
    const activeSession = sessionOverride || session;
    const content = (text || input).trim();
    if (!content || loading || !activeSession) return;

    setInput('');
    voice.clearTranscript();
    setSuggestions([]);
    setActiveWidget(null);

    const userMsg = { role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    let firstChunk = true;

    await streamSessionMessage({
      sessionId: activeSession._id,
      message: content,
      onChunk: (delta) => {
        if (firstChunk) {
          firstChunk = false;
          setLoading(false);
          setMessages((prev) => {
            streamingIndexRef.current = prev.length;
            return [...prev, { role: 'assistant', content: delta }];
          });
        } else {
          setMessages((prev) => {
            const next = [...prev];
            const i = streamingIndexRef.current;
            if (next[i]) next[i] = { ...next[i], content: next[i].content + delta };
            return next;
          });
        }
      },
      onDone: (event) => {
        setLoading(false);
        // The streamed chunks are the raw, un-stripped AI text — bracket
        // tags like [SYMPTOMS:...]/[SUGGESTIONS:...] can't be removed
        // mid-stream since they may split across chunk boundaries. Replace
        // the bubble's content with the server's fully parsed, tag-free
        // version now that the stream has finished, instead of leaving the
        // raw accumulated text on screen.
        setMessages((prev) => {
          const next = [...prev];
          const i = streamingIndexRef.current;
          if (next[i]) next[i] = { ...next[i], content: event.message };
          return next;
        });
        if (event.emergency) setEmergency(true);
        if (event.severity) setSeverity(event.severity);
        if (event.ruleBasedTriage?.level) setRuleBasedTriage(event.ruleBasedTriage);
        if (event.severityMismatch) setSeverityMismatch(true);
        if (event.mlClassification?.condition) setMlClassification(event.mlClassification);
        if (event.diagnosis) setDiagnosis(event.diagnosis);
        if (event.sessionSymptoms?.length) setSessionSymptoms(event.sessionSymptoms);
        if (event.suggestions?.length) setSuggestions(event.suggestions);
        if (event.progress?.phase) {
          const idx = currentPhases.indexOf(event.progress.phase);
          // Never let a noisy/earlier phase classification move the bar
          // backward — holding position is far less confusing than a
          // progress bar that visibly rewinds.
          if (idx !== -1) setPhaseIndex((prev) => Math.max(prev, idx));
        }
        if (event.widget) setActiveWidget(event.widget);
        if (event.sessionStatus === 'completed') {
          setSession((s) => ({ ...s, status: 'completed' }));
        }
        if (voice.voiceEnabled) voice.speak(event.message);
        inputRef.current?.focus();
      },
      onError: () => {
        setLoading(false);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
        ]);
        inputRef.current?.focus();
      },
    });
  };

  const primaryContacts = emergencyContacts.filter((c) => c.isPrimary);
  const contactsToShow = primaryContacts.length > 0 ? primaryContacts : emergencyContacts.slice(0, 2);

  const handleSuggestion = (s) => sendMessage(s);

  const handleMic = () => {
    if (voice.isListening) voice.stopListening();
    else voice.startListening();
  };

  if (initializing) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 size={28} className="animate-spin text-primary" />
        <p className="text-sm">Starting your session...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Emergency Banner */}
      <AnimatePresence>
        {emergency && (
          <motion.div
            key="emergency-banner"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-col gap-2 overflow-hidden bg-destructive px-4 py-2.5 text-sm text-destructive-foreground"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className="shrink-0 animate-pulse" />
              <span className="flex-1">⚠️ Emergency symptoms detected. Please seek immediate medical attention.</span>
              <a href="tel:112" className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
                <Phone size={14} /> Call 112
              </a>
            </div>
            <button
              onClick={() => setEmergency(false)}
              className="self-start rounded-full border border-white/40 px-3 py-1 text-xs font-medium text-destructive-foreground/90 transition-colors hover:bg-white/10"
            >
              I understand this warning — Continue assessment
            </button>
          </motion.div>
        )}

        {emergency && contactsLoaded && (
          <motion.div
            key="emergency-contacts"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-destructive/30 bg-card px-4 py-2.5"
          >
            {contactsToShow.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Your emergency contact{contactsToShow.length !== 1 ? 's' : ''}
                </p>
                {contactsToShow.map((c) => (
                  <div key={c._id} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.relationship || 'Emergency contact'}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <a
                        href={`tel:${c.phone}`}
                        className="flex items-center gap-1 rounded-full bg-severity-high-bg px-3 py-1 text-xs font-semibold text-severity-high-fg"
                      >
                        <Phone size={13} /> Call
                      </a>
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground"
                        >
                          <Mail size={13} /> Email
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <button
                onClick={() => navigate('/emergency-contacts')}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="text-sm text-foreground">You haven't added an emergency contact yet.</span>
                <span className="shrink-0 text-xs font-semibold text-primary">Add one →</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} aria-label="Go back">
          <ArrowLeft size={18} />
        </Button>
        <div className="flex flex-1 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Activity size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">MediSense AI</p>
            <p className="text-xs text-muted-foreground">
              {mode === 'full' ? 'Full Assessment' : 'Quick Check'}
              {session?.status === 'completed' && ' · Completed'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {severity && (
            <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', SEVERITY_CLASSES[severity.level])}>
              {severity.level}
            </span>
          )}
          {ruleBasedTriage?.level === 'Critical' && (
            <span
              title={
                severityMismatch
                  ? 'Our independent clinical triage check flagged this as critical, separate from the AI\'s own severity score above.'
                  : 'Independent clinical triage check — also flagged critical.'
              }
              className={cn(
                'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold',
                severityMismatch
                  ? 'animate-pulse border-severity-critical bg-severity-critical-bg text-severity-critical-fg'
                  : 'border-severity-critical/40 bg-severity-critical-bg/60 text-severity-critical-fg'
              )}
            >
              <ShieldAlert size={13} /> Clinical triage
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={voice.toggleVoice}
            title={voice.voiceEnabled ? 'Mute AI voice' : 'Enable AI voice'}
            aria-label={voice.voiceEnabled ? 'Mute AI voice' : 'Enable AI voice'}
          >
            {voice.voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </Button>
        </div>
      </div>

      {/* Assessment progress — only once the AI has actually started
          asking (no bar during the opening greeting), and hidden again
          once the diagnosis has landed rather than sitting at 100%. */}
      {phaseIndex >= 0 && session?.status !== 'completed' && (
        <div className="border-b border-border bg-card px-4 py-2.5">
          <Progress value={((phaseIndex + 1) / currentPhases.length) * 100} className="h-1.5" />
          <div className="mt-1.5 flex items-center justify-between gap-1">
            {currentPhases.map((p, i) => (
              <span
                key={p}
                className={cn(
                  'flex items-center gap-1 text-[10px] font-medium',
                  i < phaseIndex ? 'text-primary' : i === phaseIndex ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {i < phaseIndex && <Check size={10} />}
                {PHASE_LABELS[p]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className={cn('flex items-end gap-2', msg.role === 'user' ? 'flex-row-reverse' : '')}
          >
            {msg.role === 'assistant' && (
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Activity size={12} />
              </div>
            )}
            <div
              className={cn(
                'group relative max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'rounded-br-sm bg-primary text-primary-foreground'
                  : 'rounded-bl-sm border border-border bg-card text-foreground'
              )}
            >
              {msg.content}
              {msg.role === 'assistant' && voice.voiceEnabled && msg.content && (
                <button
                  onClick={() => voice.speak(msg.content)}
                  title="Replay"
                  className="ml-2 inline-flex align-middle text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Volume2 size={12} />
                </button>
              )}
            </div>
          </motion.div>
        ))}

        {loading && (
          <div className="flex items-end gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Activity size={12} />
            </div>
            <Skeleton className="h-9 w-40 rounded-2xl rounded-bl-sm" />
          </div>
        )}

        {!loading && suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSuggestion(s)}
                className="rounded-full border border-primary/30 bg-primary/5 px-3.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {!loading && activeWidget?.type === 'pain_scale' && (
          <div className="flex flex-col gap-2 pt-1">
            <div className="grid grid-cols-5 gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => { setActiveWidget(null); sendMessage(`My pain level is ${n}/10.`); }}
                  className="rounded-lg border border-primary/30 bg-primary/5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>1 = Very mild</span>
              <span>10 = Worst pain imaginable</span>
            </div>
          </div>
        )}

        {mlClassification?.condition && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <MLClassifierCard mlClassification={mlClassification} />
          </motion.div>
        )}

        {diagnosis && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <AssessmentResults
              diagnosis={diagnosis}
              symptoms={sessionSymptoms}
              ruleBasedTriage={ruleBasedTriage}
              mlClassification={mlClassification}
              onFindCare={() => navigate(diagnosis.seekCareUrgency === 'emergency' ? '/care-finder?urgency=emergency' : '/care-finder')}
            />
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Summary button */}
      {messages.length >= 4 && (
        <div className="border-t border-border px-4 py-2">
          <Button variant="outline" size="sm" className="w-full rounded-full" onClick={() => setShowSummary(true)}>
            View Session Summary
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border bg-card p-3">
        {voice.isListening && (
          <div className="mb-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-end gap-0.5">
              {[...Array(5)].map((_, i) => (
                <motion.span
                  key={i}
                  className="w-1 rounded-full bg-primary"
                  animate={{ height: [4, 14, 4] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                />
              ))}
            </div>
            Listening... tap mic to stop
          </div>
        )}
        {voice.isSpeaking && (
          <div className="mb-2 flex justify-center">
            <button onClick={voice.stopSpeaking} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <VolumeX size={13} /> Stop speaking
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          {voice.supported && (
            <Button
              variant={voice.isListening ? 'destructive' : 'outline'}
              size="icon"
              onClick={handleMic}
              disabled={voice.isSpeaking}
              title={voice.isListening ? 'Stop recording' : 'Start voice input'}
              aria-label={voice.isListening ? 'Stop recording' : 'Start voice input'}
            >
              {voice.isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </Button>
          )}
          <input
            ref={inputRef}
            className="h-10 flex-1 rounded-full border border-input bg-background px-4 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            placeholder={voice.isListening ? 'Speak now...' : 'Describe your symptoms...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={loading}
          />
          <Button size="icon" onClick={() => sendMessage()} disabled={!input.trim() || loading} className="rounded-full" aria-label="Send message">
            <Send size={16} />
          </Button>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          MediSense AI is not a substitute for professional medical advice.
        </p>
      </div>

      {showSummary && session && (
        <SessionSummary
          session={session}
          messages={messages}
          severity={severity}
          diagnosis={diagnosis}
          symptoms={sessionSymptoms}
          ruleBasedTriage={ruleBasedTriage}
          mlClassification={mlClassification}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
}

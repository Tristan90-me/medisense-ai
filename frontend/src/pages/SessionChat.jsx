import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import useVoice from '../hooks/useVoice';
import api from '../api/axios';
import { streamSessionMessage } from '../api/stream';
import { listEmergencyContacts } from '../api/emergencyContacts.api';
import SessionSummary from '../components/SessionSummary';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Mic, MicOff, Volume2, VolumeX, Send, AlertTriangle,
  Phone, Mail, ArrowLeft, Activity, Loader2, ShieldAlert,
} from 'lucide-react';

const SEVERITY_CLASSES = {
  Low: 'bg-severity-low-bg text-severity-low-fg',
  Moderate: 'bg-severity-moderate-bg text-severity-moderate-fg',
  High: 'bg-severity-high-bg text-severity-high-fg',
  Critical: 'bg-severity-critical-bg text-severity-critical-fg',
};

export default function SessionChat() {
  const { user } = useAuth();
  const { setActiveSession } = useSession();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = searchParams.get('mode') || 'quick';
  const preloadedSymptoms = searchParams.get('symptoms');
  const dependentId = searchParams.get('dependent');

  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [severity, setSeverity] = useState(null);
  const [ruleBasedTriage, setRuleBasedTriage] = useState(null);
  const [severityMismatch, setSeverityMismatch] = useState(false);
  const [diagnosis, setDiagnosis] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [emergency, setEmergency] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const streamingIndexRef = useRef(null);
  const contactsFetchedRef = useRef(false);

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
    const init = async () => {
      try {
        const res = await api.post('/ai/session/start', { mode, dependentId: dependentId || undefined });
        const s = res.data.session;
        setSession(s);
        setActiveSession(s);

        if (res.data.resumed && s.messages?.length) {
          setMessages(s.messages);
          if (s.severityScore) setSeverity({ score: s.severityScore, level: s.severityLevel });
          if (s.ruleBasedTriage?.level) setRuleBasedTriage(s.ruleBasedTriage);
          if (s.severityMismatch) setSeverityMismatch(true);
          if (s.diagnosis?.conditions?.length) setDiagnosis(s.diagnosis);
          if (s.emergencyDetected) setEmergency(true);
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
              sendMessage(preloadedSymptoms);
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

  const sendMessage = async (text) => {
    const content = (text || input).trim();
    if (!content || loading || !session) return;

    setInput('');
    voice.clearTranscript();
    setSuggestions([]);

    const userMsg = { role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    let firstChunk = true;

    await streamSessionMessage({
      sessionId: session._id,
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
        if (event.emergency) setEmergency(true);
        if (event.severity) setSeverity(event.severity);
        if (event.ruleBasedTriage?.level) setRuleBasedTriage(event.ruleBasedTriage);
        if (event.severityMismatch) setSeverityMismatch(true);
        if (event.diagnosis) setDiagnosis(event.diagnosis);
        if (event.suggestions?.length) setSuggestions(event.suggestions);
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
            className="flex items-center gap-3 overflow-hidden bg-destructive px-4 py-2.5 text-sm text-destructive-foreground"
          >
            <AlertTriangle size={18} className="shrink-0 animate-pulse" />
            <span className="flex-1">⚠️ Emergency symptoms detected. Please seek immediate medical attention.</span>
            <a href="tel:112" className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
              <Phone size={14} /> Call 112
            </a>
            <button onClick={() => setEmergency(false)} className="shrink-0 text-lg leading-none">✕</button>
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
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
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
          >
            {voice.voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </Button>
        </div>
      </div>

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

        {diagnosis && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border bg-card p-4"
          >
            <p className="mb-2 text-sm font-bold text-foreground">Assessment Results</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Care needed: <strong className="capitalize text-foreground">{diagnosis.seekCareUrgency?.replace('-', ' ')}</strong>
            </p>
            <div className="space-y-3">
              {diagnosis.conditions?.slice(0, 3).map((c, i) => (
                <div key={i}>
                  <div className="mb-1 flex justify-between text-[13px] font-medium text-foreground">
                    <span>{c.name}</span>
                    <span>{c.probability}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${c.probability}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
                    />
                  </div>
                </div>
              ))}
            </div>
            {diagnosis.recommendations?.length > 0 && (
              <ul className="mt-3 space-y-1">
                {diagnosis.recommendations.map((r, i) => (
                  <li key={i} className="text-xs text-muted-foreground">- {r}</li>
                ))}
              </ul>
            )}
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
          <Button size="icon" onClick={() => sendMessage()} disabled={!input.trim() || loading} className="rounded-full">
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
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
}

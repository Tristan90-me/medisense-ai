import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSession } from '../context/SessionContext';
import useVoice from '../hooks/useVoice';
import api from '../api/axios';
import SessionSummary from '../components/SessionSummary';
import {
  Mic, MicOff, Volume2, VolumeX, Send, AlertTriangle,
  Phone, ArrowLeft, Activity, Loader,
} from 'lucide-react';
import './SessionChat.css';

export default function SessionChat() {
  const { user } = useAuth();
  const { activeSession, setActiveSession } = useSession();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = searchParams.get('mode') || 'quick';

  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [severity, setSeverity] = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [emergency, setEmergency] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const voice = useVoice();

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fill input from voice transcript
  useEffect(() => {
    if (voice.transcript) setInput(voice.transcript);
  }, [voice.transcript]);

  // Init session
  useEffect(() => {
    const init = async () => {
      try {
        const res = await api.post('/ai/session/start', { mode });
        const s = res.data.session;
        setSession(s);
        setActiveSession(s);

        if (res.data.resumed && s.messages?.length) {
          setMessages(s.messages);
          // Restore state
          if (s.severityScore) setSeverity({ score: s.severityScore, level: s.severityLevel });
          if (s.diagnosis?.conditions?.length) setDiagnosis(s.diagnosis);
          if (s.emergencyDetected) setEmergency(true);
        } else {
          // Opening greeting
          const greeting = {
            role: 'assistant',
            content: mode === 'full'
              ? `Hello ${user?.name?.split(' ')[0] || 'there'}! I'm going to do a thorough health assessment with you today. I'll ask you about 10–15 questions to understand your symptoms fully. What's been bothering you?`
              : `Hi ${user?.name?.split(' ')[0] || 'there'}! Tell me what symptoms you're experiencing and I'll help you understand what might be going on.`,
          };
          setMessages([greeting]);
          if (voice.voiceEnabled) voice.speak(greeting.content);
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

    try {
      const res = await api.post('/ai/session/message', {
        sessionId: session._id,
        message: content,
      });

      const aiMsg = { role: 'assistant', content: res.data.message };
      setMessages((prev) => [...prev, aiMsg]);

      if (res.data.emergency) setEmergency(true);
      if (res.data.severity) setSeverity(res.data.severity);
      if (res.data.diagnosis) setDiagnosis(res.data.diagnosis);
      if (res.data.suggestions?.length) setSuggestions(res.data.suggestions);

      // Update session ref
      if (res.data.sessionStatus === 'completed') {
        setSession((s) => ({ ...s, status: 'completed' }));
      }

      // Speak AI response
      if (voice.voiceEnabled) voice.speak(res.data.message);

    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSuggestion = (s) => sendMessage(s);

  const handleMic = () => {
    if (voice.isListening) voice.stopListening();
    else voice.startListening();
  };

  const severityColor = {
    Low: '#22c55e',
    Moderate: '#f59e0b',
    High: '#ef4444',
    Critical: '#7c3aed',
  };

  if (initializing) {
    return (
      <div className="sc-loading">
        <Loader size={28} className="sc-spinner" />
        <p>Starting your session...</p>
      </div>
    );
  }

  return (
    <div className="sc-root">
      {/* Emergency Banner */}
      {emergency && (
        <div className="sc-emergency-banner">
          <AlertTriangle size={18} />
          <span>⚠️ Emergency symptoms detected. Please seek immediate medical attention.</span>
          <a href="tel:112" className="sc-call-btn">
            <Phone size={14} /> Call 112
          </a>
          <button className="sc-dismiss" onClick={() => setEmergency(false)}>✕</button>
        </div>
      )}

      {/* Header */}
      <div className="sc-header">
        <button className="sc-back" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={18} />
        </button>
        <div className="sc-header-center">
          <div className="sc-header-icon"><Activity size={16} /></div>
          <div>
            <p className="sc-header-title">MediSense AI</p>
            <p className="sc-header-sub">
              {mode === 'full' ? 'Full Assessment' : 'Quick Check'}
              {session?.status === 'completed' && ' · Completed'}
            </p>
          </div>
        </div>
        <div className="sc-header-right">
          {severity && (
            <span
              className="sc-severity-badge"
              style={{ background: severityColor[severity.level] + '20', color: severityColor[severity.level] }}
            >
              {severity.level}
            </span>
          )}
          <button
            className="sc-voice-toggle"
            onClick={voice.toggleVoice}
            title={voice.voiceEnabled ? 'Mute AI voice' : 'Enable AI voice'}
          >
            {voice.voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="sc-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`sc-msg ${msg.role === 'user' ? 'sc-msg-user' : 'sc-msg-ai'}`}>
            {msg.role === 'assistant' && (
              <div className="sc-avatar"><Activity size={12} /></div>
            )}
            <div className="sc-bubble">{msg.content}</div>
            {msg.role === 'assistant' && voice.voiceEnabled && (
              <button
                className="sc-replay"
                onClick={() => voice.speak(msg.content)}
                title="Replay"
              >
                <Volume2 size={12} />
              </button>
            )}
          </div>
        ))}

        {loading && (
          <div className="sc-msg sc-msg-ai">
            <div className="sc-avatar"><Activity size={12} /></div>
            <div className="sc-bubble sc-typing">
              <span /><span /><span />
            </div>
          </div>
        )}

        {/* Suggestion chips */}
        {!loading && suggestions.length > 0 && (
          <div className="sc-suggestions">
            {suggestions.map((s, i) => (
              <button key={i} className="sc-chip" onClick={() => handleSuggestion(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Diagnosis card */}
        {diagnosis && (
          <div className="sc-diagnosis-card">
            <p className="sc-diagnosis-title">Assessment Results</p>
            <p className="sc-urgency" data-urgency={diagnosis.seekCareUrgency}>
              Care needed: <strong>{diagnosis.seekCareUrgency?.replace('-', ' ')}</strong>
            </p>
            <div className="sc-conditions">
              {diagnosis.conditions?.slice(0, 3).map((c, i) => (
                <div key={i} className="sc-condition">
                  <div className="sc-condition-header">
                    <span>{c.name}</span>
                    <span>{c.probability}%</span>
                  </div>
                  <div className="sc-condition-bar">
                    <div
                      className="sc-condition-fill"
                      style={{ width: `${c.probability}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {diagnosis.recommendations?.length > 0 && (
              <ul className="sc-recommendations">
                {diagnosis.recommendations.map((r, i) => (
                  <li key={i}>- {r}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Summary button */}
      {messages.length >= 4 && (
        <div className="sc-summary-bar">
          <button className="sc-summary-btn" onClick={() => setShowSummary(true)}>
            View Session Summary
          </button>
        </div>
      )}

      {/* Input */}
      <div className="sc-input-area">
        {voice.isListening && (
          <div className="sc-listening-indicator">
            <span className="sc-pulse" />
            Listening... tap mic to stop
          </div>
        )}
        {voice.isSpeaking && (
          <div className="sc-speaking-indicator">
            <button onClick={voice.stopSpeaking}>
              <VolumeX size={13} /> Stop speaking
            </button>
          </div>
        )}
        <div className="sc-input-row">
          {voice.supported && (
            <button
              className={`sc-mic-btn ${voice.isListening ? 'active' : ''}`}
              onClick={handleMic}
              disabled={voice.isSpeaking}
              title={voice.isListening ? 'Stop recording' : 'Start voice input'}
            >
              {voice.isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}
          <input
            ref={inputRef}
            className="sc-input"
            placeholder={voice.isListening ? 'Speak now...' : 'Describe your symptoms...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={loading}
          />
          <button
            className="sc-send-btn"
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            <Send size={16} />
          </button>
        </div>
        <p className="sc-disclaimer">
          MediSense AI is not a substitute for professional medical advice.
        </p>
      </div>

      {/* Summary modal */}
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
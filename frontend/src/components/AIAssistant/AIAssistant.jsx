import { useState, useRef, useEffect } from 'react';
import { useAI } from '../../context/AIContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import useVoice from '../../hooks/useVoice';
import {
  MessageCircle, X, Send, Mic, MicOff, Bot,
  Zap, ClipboardList, Trash2,
} from 'lucide-react';
import './AIAssistant.css';

export default function AIAssistant() {
  const { isOpen, messages, loading, emergency, suggestions, toggleChat, closeChat, sendMessage, clearMessages } = useAI();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const voice = useVoice();

  const [input, setInput] = useState('');
  const [showModeSelect, setShowModeSelect] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fill input from voice transcript
  useEffect(() => {
    if (voice.transcript) setInput(voice.transcript);
  }, [voice.transcript]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    voice.clearTranscript();
    await sendMessage(text, user);
  };

  const handleMic = () => {
    if (voice.isListening) voice.stopListening();
    else voice.startListening();
  };

  const handleStartSession = (mode) => {
    setShowModeSelect(false);
    closeChat();
    navigate(`/session?mode=${mode}`);
  };

  return (
    <>
      {/* FAB */}
      <button
        className={`ai-fab ${emergency ? 'ai-fab-emergency' : ''}`}
        onClick={toggleChat}
        aria-label="Open health assistant"
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
        {emergency && <span className="ai-fab-badge" />}
      </button>

      {isOpen && (
        <div className="ai-panel">
          {/* Header */}
          <div className="ai-header">
            <div className="ai-header-left">
              <div className="ai-avatar"><Bot size={14} /></div>
              <div>
                <p className="ai-name">MediSense Assistant</p>
                <p className="ai-status">● Health AI</p>
              </div>
            </div>
            <div className="ai-header-actions">
              <button className="ai-header-btn" onClick={() => setShowModeSelect((p) => !p)} title="Start a session">
                <Zap size={15} />
              </button>
              <button className="ai-header-btn" onClick={clearMessages} title="Clear chat">
                <Trash2 size={15} />
              </button>
              <button className="ai-header-btn" onClick={closeChat}>
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Mode select dropdown */}
          {showModeSelect && isAuthenticated && (
            <div className="ai-mode-select">
              <p className="ai-mode-label">Start a full session</p>
              <button className="ai-mode-btn" onClick={() => handleStartSession('quick')}>
                <Zap size={14} />
                <div>
                  <p>Quick Check</p>
                  <span>3–5 questions · Fast assessment</span>
                </div>
              </button>
              <button className="ai-mode-btn" onClick={() => handleStartSession('full')}>
                <ClipboardList size={14} />
                <div>
                  <p>Full Assessment</p>
                  <span>10–15 questions · Detailed report</span>
                </div>
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="ai-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`ai-msg ${msg.role === 'user' ? 'ai-msg-user' : 'ai-msg-ai'}`}>
                <div className="ai-bubble">{msg.content}</div>
              </div>
            ))}
            {loading && (
              <div className="ai-msg ai-msg-ai">
                <div className="ai-bubble ai-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}

            {/* Suggestion chips */}
            {!loading && suggestions.length > 0 && (
              <div className="ai-suggestions">
                {suggestions.map((s, i) => (
                  <button key={i} className="ai-suggestion-chip" onClick={() => sendMessage(s, user)}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="ai-input-row">
            {voice.supported && (
              <button
                className={`ai-mic ${voice.isListening ? 'listening' : ''}`}
                onClick={handleMic}
                aria-label="Voice input"
              >
                {voice.isListening ? <MicOff size={15} /> : <Mic size={15} />}
              </button>
            )}
            <input
              className="ai-input"
              placeholder={voice.isListening ? 'Listening...' : 'Describe a symptom...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button className="ai-send" onClick={handleSend} aria-label="Send">
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
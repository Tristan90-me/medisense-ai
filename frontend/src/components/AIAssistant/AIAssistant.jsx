import { useState, useRef, useEffect } from 'react';
import { useAI } from '../../context/AIContext';
import { useAuth } from '../../context/AuthContext';
import { MessageCircle, X, Send, Mic, Bot } from 'lucide-react';
import api from '../../api/axios';
import './AIAssistant.css';

export default function AIAssistant() {
  const { isOpen, messages, toggleChat, closeChat, addMessage, currentPage } = useAI();
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const content = text || input.trim();
    if (!content) return;
    setInput('');
    addMessage('user', content);
    setLoading(true);
    try {
      const res = await api.post('/ai/chat', {
        message: content,
        history: messages,
        context: { page: currentPage, userName: user?.name },
      });
      addMessage('assistant', res.data.reply);
    } catch {
      addMessage('assistant', 'Sorry, I had trouble connecting. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVoice = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice input not supported in this browser.');
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        setListening(false);
        sendMessage(transcript);
      };
      recognitionRef.current.onend = () => setListening(false);
    }
    setListening(true);
    recognitionRef.current.start();
  };

  return (
    <>
      <button className="ai-fab" onClick={toggleChat} aria-label="Open health assistant">
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {isOpen && (
        <div className="ai-panel">
          <div className="ai-header">
            <div className="ai-header-left">
              <div className="ai-avatar"><Bot size={14} /></div>
              <div>
                <p className="ai-name">MediSense Assistant</p>
                <p className="ai-status">● Health AI</p>
              </div>
            </div>
            <button className="ai-close" onClick={closeChat}><X size={16} /></button>
          </div>

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
            <div ref={messagesEndRef} />
          </div>

          <div className="ai-input-row">
            <button className={`ai-mic ${listening ? 'listening' : ''}`} onClick={handleVoice} aria-label="Voice input">
              <Mic size={15} />
            </button>
            <input
              className="ai-input"
              placeholder="Describe a symptom..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button className="ai-send" onClick={() => sendMessage()} aria-label="Send">
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
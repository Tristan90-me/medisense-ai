import { useState, useRef, useEffect } from 'react';
import { useAI } from '../../context/AIContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import useVoice from '../../hooks/useVoice';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  X, Send, Mic, MicOff, Bot,
  Zap, ClipboardList, Trash2, LogIn, UserPlus,
} from 'lucide-react';

// The open/close trigger for this panel lives in FloatingMenu now (the
// combined theme+chat floating cluster). The panel is a modal Dialog, so it
// gets the same dark backdrop, tap-outside-to-close and Escape behaviour as
// announcements. The backdrop sits below the FloatingMenu (z-1002) so that
// button stays tappable and can close the chat too.
export default function AIAssistant() {
  const { isOpen, messages, loading, suggestions, closeChat, sendMessage, clearMessages } = useAI();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const voice = useVoice();

  const [input, setInput] = useState('');
  const [showModeSelect, setShowModeSelect] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const handleAuthNavigate = (path) => {
    closeChat();
    navigate(path);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) closeChat(); }}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[1000]"
        className="fixed bottom-24 right-5 top-auto left-auto z-[1001] flex h-[min(600px,calc(100dvh-140px))] w-[min(380px,calc(100vw-40px))] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card p-0 shadow-lg sm:max-w-none"
      >
        <DialogTitle className="sr-only">MediSense Assistant</DialogTitle>
        <DialogDescription className="sr-only">Chat with the MediSense health assistant</DialogDescription>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot size={14} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-foreground">MediSense Assistant</p>
              <p className="text-[11px] text-severity-low">● Health AI</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isAuthenticated && (
              <>
                <Button variant="ghost" size="icon-sm" onClick={() => setShowModeSelect((p) => !p)} title="Start a session">
                  <Zap size={15} />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={clearMessages} title="Clear chat">
                  <Trash2 size={15} />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon-sm" onClick={closeChat} aria-label="Close assistant">
              <X size={15} />
            </Button>
          </div>
        </div>

        {!isAuthenticated ? (
          /* Guest gate — stops here rather than letting a signed-out
             visitor type into a chat that will only fail once they hit
             send; POST /api/ai/chat already requires auth server-side,
             this just avoids wasting their effort finding that out. */
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot size={20} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-foreground">Sign in to chat</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                Create a free account or sign in to talk with your health assistant.
              </p>
            </div>
            <div className="mt-1 flex flex-col items-center gap-2">
              <Button
                onClick={() => handleAuthNavigate('/login')}
                className="rounded-full px-5 py-2 text-[13px]"
              >
                <LogIn size={14} /> Sign In
              </Button>
              <Button
                variant="outline"
                onClick={() => handleAuthNavigate('/register')}
                className="rounded-full px-5 py-2 text-[13px]"
              >
                <UserPlus size={14} /> Sign Up
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Mode select dropdown */}
            <AnimatePresence>
              {showModeSelect && isAuthenticated && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden border-b border-border bg-muted/40 px-4"
                >
                  <div className="py-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Start a full session
                    </p>
                    <button
                      onClick={() => handleStartSession('quick')}
                      className="mb-1.5 flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-accent/10"
                    >
                      <Zap size={14} className="text-primary" />
                      <div>
                        <p className="text-[13px] font-medium text-foreground">Quick Check</p>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">3–5 questions · Fast assessment</span>
                      </div>
                    </button>
                    <button
                      onClick={() => handleStartSession('full')}
                      className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-accent/10"
                    >
                      <ClipboardList size={14} className="text-secondary" />
                      <div>
                        <p className="text-[13px] font-medium text-foreground">Full Assessment</p>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">10–15 questions · Detailed report</span>
                      </div>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border bg-muted/40 text-foreground'
                    }`}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl border border-border bg-muted/40 px-3.5 py-2.5">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {!loading && suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(s, user)}
                      className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 border-t border-border p-3">
              {voice.supported && (
                <Button
                  variant={voice.isListening ? 'destructive' : 'outline'}
                  size="icon"
                  onClick={handleMic}
                  aria-label="Voice input"
                >
                  {voice.isListening ? <MicOff size={15} /> : <Mic size={15} />}
                </Button>
              )}
              <input
                className="h-9 flex-1 rounded-full border border-input bg-background px-3.5 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                placeholder={voice.isListening ? 'Listening...' : 'Describe a symptom...'}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <Button size="icon" onClick={handleSend} aria-label="Send" className="rounded-full">
                <Send size={14} />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

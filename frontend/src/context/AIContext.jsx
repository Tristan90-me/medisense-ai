import { createContext, useContext, useState, useCallback } from 'react';
import api from '../api/axios';

const AIContext = createContext();

const INITIAL_MESSAGE = {
  role: 'assistant',
  content: "Hi! I'm your MediSense health assistant. How are you feeling today?",
};

export const AIProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [severity, setSeverity] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [currentPage, setCurrentPage] = useState('');

  const toggleChat = () => setIsOpen((p) => !p);
  const closeChat = () => setIsOpen(false);

  const addMessage = useCallback((role, content) => {
    setMessages((prev) => [...prev, { role, content }]);
  }, []);

  const sendMessage = useCallback(async (text, user) => {
    if (!text.trim()) return;

    addMessage('user', text);
    setLoading(true);
    setSuggestions([]);

    try {
      const res = await api.post('/ai/chat', {
        message: text,
        history: messages,
        context: { page: currentPage, userName: user?.name },
      });

      addMessage('assistant', res.data.message);

      if (res.data.emergency) setEmergency(true);
      if (res.data.severity) setSeverity(res.data.severity);
      if (res.data.suggestions?.length) setSuggestions(res.data.suggestions);

      return res.data.message;
    } catch {
      const errMsg = 'Sorry, I had trouble connecting. Please try again.';
      addMessage('assistant', errMsg);
      return errMsg;
    } finally {
      setLoading(false);
    }
  }, [messages, currentPage, addMessage]);

  const clearMessages = useCallback(() => {
    setMessages([INITIAL_MESSAGE]);
    setEmergency(false);
    setSeverity(null);
    setSuggestions([]);
  }, []);

  const dismissEmergency = () => setEmergency(false);

  return (
    <AIContext.Provider value={{
      isOpen, messages, loading, emergency, severity, suggestions,
      currentPage, toggleChat, closeChat, addMessage, sendMessage,
      clearMessages, dismissEmergency, setCurrentPage,
    }}>
      {children}
    </AIContext.Provider>
  );
};

export const useAI = () => useContext(AIContext);
import { createContext, useContext, useState } from 'react';

const AIContext = createContext();

export const AIProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm your MediSense health assistant. How are you feeling today?" }
  ]);
  const [currentPage, setCurrentPage] = useState('');

  const toggleChat = () => setIsOpen((prev) => !prev);
  const closeChat = () => setIsOpen(false);

  const addMessage = (role, content) => {
    setMessages((prev) => [...prev, { role, content }]);
  };

  const clearMessages = () => {
    setMessages([
      { role: 'assistant', content: "Hi! I'm your MediSense health assistant. How are you feeling today?" }
    ]);
  };

  return (
    <AIContext.Provider value={{ isOpen, messages, currentPage, toggleChat, closeChat, addMessage, clearMessages, setCurrentPage }}>
      {children}
    </AIContext.Provider>
  );
};

export const useAI = () => useContext(AIContext);
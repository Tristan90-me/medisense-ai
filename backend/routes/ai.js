const express = require('express');
const router = express.Router();
const {
  startSession, sendMessage, getSummary,
  getSessions, getSession, assistantChat,
} = require('../controllers/aiController');
const { protect } = require('../middleware/auth');

router.post('/session/start', protect, startSession);
router.post('/session/message', protect, sendMessage);
router.get('/session/:id/summary', protect, getSummary);
router.get('/sessions', protect, getSessions);
router.get('/session/:id', protect, getSession);
router.post('/chat', protect, assistantChat);

module.exports = router;
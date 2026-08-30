const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const {
  getStats,
  getUsers,
  getUserDetail,
  toggleUserStatus,
  getAllSessions,
  inviteAdmin,
  getPendingInvites,
  revokeInvite,
} = require('../controllers/adminController');

// All admin routes require auth + admin role
router.use(protect, adminOnly);

router.get('/stats', getStats);
router.get('/users', getUsers);
router.get('/users/:id', getUserDetail);
router.patch('/users/:id/toggle', toggleUserStatus);
router.get('/sessions', getAllSessions);

router.post('/invites', inviteAdmin);
router.get('/invites', getPendingInvites);
router.delete('/invites/:id', revokeInvite);

module.exports = router;
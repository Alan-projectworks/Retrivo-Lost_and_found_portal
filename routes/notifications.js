const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// GET /api/notifications - Get current user's notifications
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const notifications = await all(
      `SELECT * FROM notifications 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [userId]
    );

    const unreadRow = await get(
      `SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = 0`,
      [userId]
    );

    return res.json({
      success: true,
      notifications,
      unreadCount: unreadRow ? unreadRow.unread : 0
    });
  } catch (err) {
    console.error('[GET NOTIFICATIONS ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve notifications.' });
  }
});

// GET /api/notifications/unread-count - Fast counter
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const row = await get(
      `SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = 0`,
      [userId]
    );
    return res.json({ success: true, count: row ? row.unread : 0 });
  } catch (err) {
    return res.json({ success: true, count: 0 });
  }
});

// PUT /api/notifications/:id/read - Mark single notification as read
router.put('/:id/read', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;
    await run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);
    return res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    console.error('[MARK READ ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to update notification.' });
  }
});

// PUT /api/notifications/mark-all-read - Mark all as read
router.put('/mark-all-read', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    await run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('[MARK ALL READ ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to update notifications.' });
  }
});

module.exports = router;

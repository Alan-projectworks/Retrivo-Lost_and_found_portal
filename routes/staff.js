const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db/database');
const { requireRole } = require('../middleware/auth');

// Allow both staff and admin
router.use(requireRole(['staff', 'admin']));

// GET /api/staff/overview - Operational queue stats
router.get('/overview', async (req, res) => {
  try {
    const pendingClaims = await get('SELECT COUNT(*) as count FROM claims WHERE status IN ("pending", "under_review")');
    const readyCollection = await get('SELECT COUNT(*) as count FROM items WHERE status = "ready_for_collection"');
    const returnedItems = await get('SELECT COUNT(*) as count FROM items WHERE status = "returned"');
    const activeFound = await get('SELECT COUNT(*) as count FROM items WHERE type = "found" AND status = "active"');

    // Custody items assigned to collection desks
    const custodySummary = await all(`
      SELECT cp.id, cp.name, cp.building, COUNT(i.id) as item_count
      FROM collection_points cp
      LEFT JOIN items i ON cp.id = i.collection_point_id AND i.status != 'returned'
      WHERE cp.is_active = 1
      GROUP BY cp.id
    `);

    return res.json({
      success: true,
      pendingClaims: pendingClaims.count,
      readyCollection: readyCollection.count,
      returnedItems: returnedItems.count,
      activeFound: activeFound.count,
      custodySummary
    });
  } catch (err) {
    console.error('[STAFF OVERVIEW ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve staff overview.' });
  }
});

// GET /api/staff/items - Found items inventory for staff
router.get('/items', async (req, res) => {
  try {
    const { status, collection_point_id, search } = req.query;
    let conditions = ["i.type = 'found'"];
    let params = [];

    if (status && status !== 'All') {
      conditions.push('i.status = ?');
      params.push(status);
    }

    if (collection_point_id && collection_point_id !== 'All') {
      conditions.push('i.collection_point_id = ?');
      params.push(collection_point_id);
    }

    if (search && search.trim()) {
      conditions.push('(i.title LIKE ? OR i.reference_no LIKE ? OR i.location LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const items = await all(
      `SELECT i.*, 
              cp.name as collection_point_name,
              cp.building as collection_point_building,
              u.full_name as finder_name,
              u.reg_number as finder_reg,
              u.phone as finder_phone,
              (SELECT COUNT(*) FROM claims c WHERE c.item_id = i.id) as claim_count
       FROM items i
       LEFT JOIN collection_points cp ON i.collection_point_id = cp.id
       JOIN users u ON i.reporter_id = u.id
       ${whereClause}
       ORDER BY i.created_at DESC`,
      params
    );

    return res.json({ success: true, items });
  } catch (err) {
    console.error('[STAFF ITEMS ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve staff items inventory.' });
  }
});

// PUT /api/staff/items/:id/custody - Update collection point custody of an item
router.put('/items/:id/custody', async (req, res) => {
  try {
    const { id } = req.params;
    const { collection_point_id } = req.body;
    const staffId = req.session.user.id;

    const cp = await get('SELECT name, building FROM collection_points WHERE id = ?', [collection_point_id]);
    if (!cp) {
      return res.status(400).json({ success: false, error: 'Invalid collection point selected.' });
    }

    await run('UPDATE items SET collection_point_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [collection_point_id, id]);

    // Log Activity
    await run(
      `INSERT INTO activity_logs (user_id, action, target_type, target_id, details)
       VALUES (?, 'CUSTODY_TRANSFERRED', 'item', ?, ?)`,
      [staffId, id, `Item custody transferred to: ${cp.name} (${cp.building}) by ${req.session.user.full_name}`]
    );

    return res.json({ success: true, message: `Item moved to ${cp.name} custody.` });
  } catch (err) {
    console.error('[STAFF CUSTODY ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to update custody location.' });
  }
});

module.exports = router;

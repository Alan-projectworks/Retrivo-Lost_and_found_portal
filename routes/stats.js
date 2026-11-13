const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db/database');

// GET /api/stats/public - Live statistics calculated directly from the database
router.get('/public', async (req, res) => {
  try {
    // 1. Total items reported
    const totalReportedRow = await get(`SELECT COUNT(*) as total FROM items`);
    const totalReported = totalReportedRow ? totalReportedRow.total : 0;

    // 2. Items successfully returned
    const returnedRow = await get(`SELECT COUNT(*) as returned FROM items WHERE status = 'returned'`);
    const returnedCount = returnedRow ? returnedRow.returned : 0;

    // 3. Items waiting to be claimed (active found items)
    const waitingRow = await get(`SELECT COUNT(*) as waiting FROM items WHERE type = 'found' AND status IN ('active', 'under_review')`);
    const waitingCount = waitingRow ? waitingRow.waiting : 0;

    // 4. Active reports (unresolved lost + found items)
    const activeRow = await get(`SELECT COUNT(*) as active FROM items WHERE status IN ('active', 'under_review', 'ready_for_collection')`);
    const activeCount = activeRow ? activeRow.active : 0;

    // 5. Total claims submitted
    const claimsRow = await get(`SELECT COUNT(*) as claims FROM claims`);
    const totalClaims = claimsRow ? claimsRow.claims : 0;

    // 6. Registered users count
    const usersRow = await get(`SELECT COUNT(*) as users FROM users`);
    const totalUsers = usersRow ? usersRow.users : 0;

    // 7. Recent found items for landing page exhibition
    const recentFound = await all(`
      SELECT i.id, i.reference_no, i.title, i.category, i.description, 
             i.location, i.specific_spot, i.date_occurred, i.photo_url, 
             i.status, i.is_sensitive, i.created_at,
             cp.name as collection_point_name,
             cp.building as collection_point_building
      FROM items i
      LEFT JOIN collection_points cp ON i.collection_point_id = cp.id
      WHERE i.type = 'found'
      ORDER BY i.created_at DESC
      LIMIT 6
    `);

    // Mask sensitive details on recent found items
    const sanitizedRecentFound = recentFound.map((item) => {
      const copy = { ...item };
      if (copy.is_sensitive) {
        copy.secret_identifiers = undefined;
      }
      return copy;
    });

    // 8. Breakdown by category
    const categoryStats = await all(`
      SELECT category, COUNT(*) as count 
      FROM items 
      GROUP BY category 
      ORDER BY count DESC 
      LIMIT 8
    `);

    // 9. Breakdown by zone/location
    const locationStats = await all(`
      SELECT location, COUNT(*) as count 
      FROM items 
      GROUP BY location 
      ORDER BY count DESC 
      LIMIT 6
    `);

    return res.json({
      success: true,
      stats: {
        totalReported,
        returnedCount,
        waitingCount,
        activeCount,
        totalClaims,
        totalUsers,
        recoveryRate: totalReported > 0 ? Math.round((returnedCount / totalReported) * 100) : 0
      },
      recentFound: sanitizedRecentFound,
      categoryStats,
      locationStats
    });
  } catch (err) {
    console.error('[GET STATS ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to calculate database statistics.' });
  }
});

module.exports = router;

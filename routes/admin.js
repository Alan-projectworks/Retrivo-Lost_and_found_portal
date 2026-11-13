const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db/database');
const { requireRole } = require('../middleware/auth');

// All endpoints in this router require admin role
router.use(requireRole('admin'));

// GET /api/admin/overview - System overview metrics
router.get('/overview', async (req, res) => {
  try {
    const totalUsers = await get('SELECT COUNT(*) as count FROM users');
    const studentCount = await get('SELECT COUNT(*) as count FROM users WHERE role = "student"');
    const staffCount = await get('SELECT COUNT(*) as count FROM users WHERE role = "staff"');
    const adminCount = await get('SELECT COUNT(*) as count FROM users WHERE role = "admin"');

    const totalLost = await get('SELECT COUNT(*) as count FROM items WHERE type = "lost"');
    const totalFound = await get('SELECT COUNT(*) as count FROM items WHERE type = "found"');
    const totalReturned = await get('SELECT COUNT(*) as count FROM items WHERE status = "returned"');

    const totalClaims = await get('SELECT COUNT(*) as count FROM claims');
    const pendingClaims = await get('SELECT COUNT(*) as count FROM claims WHERE status = "pending"');
    const approvedClaims = await get('SELECT COUNT(*) as count FROM claims WHERE status = "approved"');

    // Recent 10 activity logs
    const recentLogs = await all(`
      SELECT al.*, u.full_name as user_name, u.role as user_role, u.reg_number as user_reg
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 15
    `);

    return res.json({
      success: true,
      users: {
        total: totalUsers.count,
        students: studentCount.count,
        staff: staffCount.count,
        admins: adminCount.count
      },
      items: {
        total: totalLost.count + totalFound.count,
        lost: totalLost.count,
        found: totalFound.count,
        returned: totalReturned.count,
        recoveryRate: (totalLost.count + totalFound.count) > 0 
          ? Math.round((totalReturned.count / (totalLost.count + totalFound.count)) * 100) 
          : 0
      },
      claims: {
        total: totalClaims.count,
        pending: pendingClaims.count,
        approved: approvedClaims.count
      },
      recentLogs
    });
  } catch (err) {
    console.error('[ADMIN OVERVIEW ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve admin analytics.' });
  }
});

// GET /api/admin/users - List users with filters
router.get('/users', async (req, res) => {
  try {
    const { role, search } = req.query;
    let conditions = [];
    let params = [];

    if (role && role !== 'All') {
      conditions.push('role = ?');
      params.push(role);
    }

    if (search && search.trim()) {
      conditions.push('(full_name LIKE ? OR email LIKE ? OR reg_number LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const users = await all(
      `SELECT id, full_name, email, reg_number, phone, role, department, hostel_block, created_at,
              (SELECT COUNT(*) FROM items WHERE reporter_id = users.id) as report_count,
              (SELECT COUNT(*) FROM claims WHERE claimant_id = users.id) as claim_count
       FROM users
       ${whereClause}
       ORDER BY created_at DESC`,
      params
    );

    return res.json({ success: true, users });
  } catch (err) {
    console.error('[ADMIN USERS ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve users.' });
  }
});

// PUT /api/admin/users/:id/role - Update a user's role
router.put('/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const adminId = req.session.user.id;

    if (!['student', 'staff', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid user role.' });
    }

    const targetUser = await get('SELECT id, full_name, email, role FROM users WHERE id = ?', [id]);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    if (targetUser.id === adminId && role !== 'admin') {
      return res.status(400).json({ success: false, error: 'You cannot revoke your own administrator role.' });
    }

    await run('UPDATE users SET role = ? WHERE id = ?', [role, id]);

    // Log Activity
    await run(
      `INSERT INTO activity_logs (user_id, action, target_type, target_id, details)
       VALUES (?, 'USER_ROLE_CHANGED', 'user', ?, ?)`,
      [adminId, id, `Changed role of ${targetUser.full_name} (${targetUser.email}) from ${targetUser.role} to ${role}`]
    );

    return res.json({ success: true, message: `User role updated to ${role}.` });
  } catch (err) {
    console.error('[ADMIN ROLE UPDATE ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to update user role.' });
  }
});

// GET /api/admin/logs - Activity audit logs
router.get('/logs', async (req, res) => {
  try {
    const { limit = 50, action } = req.query;
    let conditions = [];
    let params = [];

    if (action && action !== 'All') {
      conditions.push('al.action = ?');
      params.push(action);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const logs = await all(
      `SELECT al.*, u.full_name as user_name, u.role as user_role, u.reg_number as user_reg
       FROM activity_logs al
       LEFT JOIN users u ON al.user_id = u.id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT ?`,
      [...params, parseInt(limit)]
    );

    return res.json({ success: true, logs });
  } catch (err) {
    console.error('[ADMIN LOGS ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve audit logs.' });
  }
});

// POST /api/admin/collection-points - Add new collection point
router.post('/collection-points', async (req, res) => {
  try {
    const { name, zone, building, desk_incharge, contact_number, operating_hours } = req.body;

    if (!name || !zone || !building) {
      return res.status(400).json({ success: false, error: 'Name, campus zone, and building are required.' });
    }

    const result = await run(
      `INSERT INTO collection_points (name, zone, building, desk_incharge, contact_number, operating_hours)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), zone.trim(), building.trim(), desk_incharge || '', contact_number || '', operating_hours || '']
    );

    // Log Activity
    await run(
      `INSERT INTO activity_logs (user_id, action, target_type, target_id, details)
       VALUES (?, 'COLLECTION_POINT_ADDED', 'collection_point', ?, ?)`,
      [req.session.user.id, result.id, `Created new collection point: "${name}" at ${building}`]
    );

    return res.status(201).json({
      success: true,
      message: 'Collection point added successfully.',
      id: result.id
    });
  } catch (err) {
    console.error('[ADMIN ADD CP ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to create collection point.' });
  }
});

// PUT /api/admin/collection-points/:id - Edit collection point
router.put('/collection-points/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, zone, building, desk_incharge, contact_number, operating_hours, is_active } = req.body;

    await run(
      `UPDATE collection_points
       SET name = COALESCE(?, name),
           zone = COALESCE(?, zone),
           building = COALESCE(?, building),
           desk_incharge = COALESCE(?, desk_incharge),
           contact_number = COALESCE(?, contact_number),
           operating_hours = COALESCE(?, operating_hours),
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name, zone, building, desk_incharge, contact_number, operating_hours, is_active, id]
    );

    return res.json({ success: true, message: 'Collection point updated successfully.' });
  } catch (err) {
    console.error('[ADMIN UPDATE CP ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to update collection point.' });
  }
});

module.exports = router;

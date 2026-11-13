const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db/database');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Helper to generate reference numbers
const generateRefNo = async (type) => {
  const prefix = type === 'lost' ? 'LST' : 'FND';
  const year = new Date().getFullYear().toString().slice(-2);
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const ref = `${prefix}-${year}-${randomNum}`;
  // Ensure uniqueness
  const exists = await get('SELECT id FROM items WHERE reference_no = ?', [ref]);
  if (exists) {
    return generateRefNo(type);
  }
  return ref;
};

// Fallback image picker based on category with realistic photos
const getFallbackImage = (category) => {
  switch (category) {
    case 'ID Card': return '/uploads/lpu-id-card.svg';
    case 'Water Bottle': return '/uploads/realistic-bottle.jpg';
    case 'Electronics':
    case 'Laptop':
    case 'Mobile Phone': return '/uploads/realistic-charger.jpg';
    case 'Wallet': return '/uploads/realistic-wallet.jpg';
    case 'Bags': return '/uploads/realistic-backpack.jpg';
    case 'Keys': return '/uploads/realistic-keys.jpg';
    case 'Other': return '/uploads/realistic-calculator.jpg';
    default: return '/uploads/realistic-bottle.jpg';
  }
};

// Smart matching logic between a target item and candidate items
const calculateMatchScore = (itemA, itemB) => {
  let score = 0;

  // 1. Category match (35%)
  if (itemA.category.toLowerCase() === itemB.category.toLowerCase()) {
    score += 35;
  }

  // 2. Location match (25%)
  if (itemA.location.toLowerCase() === itemB.location.toLowerCase()) {
    score += 25;
  } else if (itemA.location.includes(itemB.location) || itemB.location.includes(itemA.location)) {
    score += 15;
  }

  // 3. Date proximity (20%)
  const dateA = new Date(itemA.date_occurred).getTime();
  const dateB = new Date(itemB.date_occurred).getTime();
  const diffDays = Math.abs(dateA - dateB) / (1000 * 3600 * 24);

  if (diffDays <= 2) {
    score += 20;
  } else if (diffDays <= 5) {
    score += 14;
  } else if (diffDays <= 10) {
    score += 7;
  }

  // 4. Title and Description keyword overlap (20%)
  const getTokens = (str) => {
    return (str || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !['with', 'this', 'that', 'near', 'from', 'have', 'lost', 'found', 'campus', 'table'].includes(w));
  };

  const tokensA = new Set([...getTokens(itemA.title), ...getTokens(itemA.description)]);
  const tokensB = new Set([...getTokens(itemB.title), ...getTokens(itemB.description)]);

  let commonTokens = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) commonTokens++;
  });

  if (commonTokens >= 3) {
    score += 20;
  } else if (commonTokens >= 2) {
    score += 14;
  } else if (commonTokens >= 1) {
    score += 8;
  }

  return Math.min(100, score);
};

// Sanitize sensitive item representation for public listing
const sanitizeItem = (item, viewerUser = null) => {
  const isPrivileged = viewerUser && (viewerUser.role === 'admin' || viewerUser.role === 'staff' || viewerUser.id === item.reporter_id);
  const copy = { ...item };

  if (item.type === 'found' && item.is_sensitive && !isPrivileged) {
    copy.secret_identifiers = '[HIDDEN FOR PRIVACY & VERIFICATION]';
    // Mask sensitive reporter contact details
    copy.reporter_name = 'Campus Good Samaritan (Masked)';
    copy.reporter_email = 'privacy-protected@retrivo.lpu.in';
    copy.reporter_phone = 'Contact via Platform';
    copy.reporter_reg_number = 'PROTECTED';
  }

  // If public, never reveal secret_identifiers to unprivileged users even for non-sensitive items
  if (!isPrivileged) {
    copy.secret_identifiers = undefined;
  }

  return copy;
};

// GET /api/items - Browse & search with multifaceted filters & pagination
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      type,
      category,
      location,
      status,
      search,
      sort = 'newest',
      page = 1,
      limit = 12
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    let conditions = [];
    let params = [];

    if (type && ['lost', 'found'].includes(type.toLowerCase())) {
      conditions.push('i.type = ?');
      params.push(type.toLowerCase());
    }

    if (category && category !== 'All') {
      conditions.push('i.category = ?');
      params.push(category);
    }

    if (location && location !== 'All') {
      conditions.push('i.location = ?');
      params.push(location);
    }

    if (status && status !== 'All') {
      conditions.push('i.status = ?');
      params.push(status);
    }

    if (search && search.trim()) {
      conditions.push('(i.title LIKE ? OR i.description LIKE ? OR i.specific_spot LIKE ? OR i.reference_no LIKE ?)');
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sortOrder = sort === 'oldest' ? 'ASC' : 'DESC';

    // Count query
    const countSql = `SELECT COUNT(*) as total FROM items i ${whereClause}`;
    const totalRow = await get(countSql, params);
    const total = totalRow ? totalRow.total : 0;

    // Items query with joins
    const sql = `
      SELECT i.*, 
             u.full_name as reporter_name,
             u.email as reporter_email,
             u.phone as reporter_phone,
             u.reg_number as reporter_reg_number,
             cp.name as collection_point_name,
             cp.building as collection_point_building
      FROM items i
      LEFT JOIN users u ON i.reporter_id = u.id
      LEFT JOIN collection_points cp ON i.collection_point_id = cp.id
      ${whereClause}
      ORDER BY i.date_occurred ${sortOrder}, i.id ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const items = await all(sql, [...params, parseInt(limit), offset]);

    const sanitizedItems = items.map((item) => sanitizeItem(item, req.user));

    return res.json({
      success: true,
      items: sanitizedItems,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit))
    });
  } catch (err) {
    console.error('[GET ITEMS ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve items.' });
  }
});

// GET /api/items/my-reports - Logged in student's reports
router.get('/my-reports', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const items = await all(
      `SELECT i.*, 
              cp.name as collection_point_name,
              cp.building as collection_point_building,
              (SELECT COUNT(*) FROM claims c WHERE c.item_id = i.id) as claim_count
       FROM items i
       LEFT JOIN collection_points cp ON i.collection_point_id = cp.id
       WHERE i.reporter_id = ?
       ORDER BY i.created_at DESC`,
      [userId]
    );

    return res.json({
      success: true,
      items
    });
  } catch (err) {
    console.error('[GET MY REPORTS ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve your reports.' });
  }
});

// GET /api/items/:id - Single item details
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const item = await get(
      `SELECT i.*, 
              u.full_name as reporter_name,
              u.email as reporter_email,
              u.phone as reporter_phone,
              u.reg_number as reporter_reg_number,
              u.department as reporter_dept,
              cp.name as collection_point_name,
              cp.building as collection_point_building,
              cp.desk_incharge as collection_desk_incharge,
              cp.contact_number as collection_desk_contact,
              cp.operating_hours as collection_operating_hours
       FROM items i
       LEFT JOIN users u ON i.reporter_id = u.id
       LEFT JOIN collection_points cp ON i.collection_point_id = cp.id
       WHERE i.id = ? OR i.reference_no = ?`,
      [id, id]
    );

    if (!item) {
      return res.status(404).json({ success: false, error: 'Item record not found.' });
    }

    const sanitized = sanitizeItem(item, req.user);

    // If viewer is reporter or staff/admin, also attach claims
    let claims = [];
    if (req.user && (req.user.id === item.reporter_id || ['admin', 'staff'].includes(req.user.role))) {
      claims = await all(
        `SELECT c.*, u.full_name as claimant_name, u.reg_number as claimant_reg_number, u.phone as claimant_phone, u.email as claimant_email
         FROM claims c
         JOIN users u ON c.claimant_id = u.id
         WHERE c.item_id = ?
         ORDER BY c.created_at DESC`,
        [item.id]
      );
    }

    return res.json({
      success: true,
      item: sanitized,
      claims
    });
  } catch (err) {
    console.error('[GET ITEM DETAIL ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve item details.' });
  }
});

// GET /api/items/:id/matches - Find potential matches
router.get('/:id/matches', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const target = await get('SELECT * FROM items WHERE id = ? OR reference_no = ?', [id, id]);

    if (!target) {
      return res.status(404).json({ success: false, error: 'Item not found.' });
    }

    const oppositeType = target.type === 'lost' ? 'found' : 'lost';

    // Fetch active candidates of opposite type
    const candidates = await all(
      `SELECT i.*, cp.name as collection_point_name
       FROM items i
       LEFT JOIN collection_points cp ON i.collection_point_id = cp.id
       WHERE i.type = ? AND i.status IN ('active', 'under_review', 'ready_for_collection')
       ORDER BY i.created_at DESC LIMIT 30`,
      [oppositeType]
    );

    // Compute matching scores
    const matches = candidates
      .map((cand) => {
        const score = calculateMatchScore(target, cand);
        return {
          item: sanitizeItem(cand, req.user),
          matchScore: score
        };
      })
      .filter((m) => m.matchScore >= 40)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 6);

    return res.json({
      success: true,
      targetId: target.id,
      targetRef: target.reference_no,
      matches
    });
  } catch (err) {
    console.error('[GET MATCHES ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to calculate matches.' });
  }
});

// POST /api/items - Report Lost or Found Item
router.post('/', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    const {
      type,
      title,
      category,
      description,
      secret_identifiers,
      location,
      specific_spot,
      date_occurred,
      collection_point_id,
      contact_preference = 'platform'
    } = req.body;

    const reporter_id = req.session.user.id;

    // Validation
    if (!type || !['lost', 'found'].includes(type.toLowerCase())) {
      return res.status(400).json({ success: false, error: 'Valid report type (lost or found) is required.' });
    }

    if (!title || !category || !description || !location || !date_occurred) {
      return res.status(400).json({ success: false, error: 'Title, category, description, campus location, and date are required.' });
    }

    // Determine photo URL
    let photo_url = '';
    if (req.file) {
      photo_url = `/uploads/${req.file.filename}`;
    } else {
      photo_url = getFallbackImage(category);
    }

    // Generate unique reference number
    const reference_no = await generateRefNo(type.toLowerCase());

    // Auto-detect sensitive items (ID Card, Wallet, Documents)
    const sensitiveCategories = ['ID Card', 'Wallet', 'Documents'];
    const is_sensitive = sensitiveCategories.includes(category) ? 1 : 0;

    const result = await run(
      `INSERT INTO items (
        reference_no, type, title, category, description, secret_identifiers,
        location, specific_spot, date_occurred, photo_url, status,
        contact_preference, is_sensitive, reporter_id, collection_point_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
      [
        reference_no,
        type.toLowerCase(),
        title.trim(),
        category,
        description.trim(),
        secret_identifiers ? secret_identifiers.trim() : null,
        location,
        specific_spot ? specific_spot.trim() : null,
        date_occurred,
        photo_url,
        contact_preference,
        is_sensitive,
        reporter_id,
        collection_point_id ? parseInt(collection_point_id) : null
      ]
    );

    const newItem = await get('SELECT * FROM items WHERE id = ?', [result.id]);

    // Log Activity
    await run(
      `INSERT INTO activity_logs (user_id, action, target_type, target_id, details)
       VALUES (?, 'REPORT_CREATED', 'item', ?, ?)`,
      [
        reporter_id,
        newItem.id,
        `Created ${type.toUpperCase()} report: "${newItem.title}" (${newItem.reference_no}) at ${newItem.location}`
      ]
    );

    // Smart Match Check against existing items
    const oppositeType = type.toLowerCase() === 'lost' ? 'found' : 'lost';
    const candidates = await all(
      `SELECT * FROM items WHERE type = ? AND status IN ('active', 'under_review') LIMIT 40`,
      [oppositeType]
    );

    const matches = candidates
      .map((c) => ({ item: c, score: calculateMatchScore(newItem, c) }))
      .filter((m) => m.score >= 55)
      .sort((a, b) => b.score - a.score);

    // If strong match found, queue notifications
    if (matches.length > 0) {
      const topMatch = matches[0];
      // Notify the current reporter
      await run(
        `INSERT INTO notifications (user_id, title, message, link, type)
         VALUES (?, 'Smart Match Detected!', ?, ?, 'info')`,
        [
          reporter_id,
          `We found a potential match (${topMatch.score}% similarity) for your report "${newItem.title}". Click to verify.`,
          `/item-detail.html?id=${topMatch.item.id}`
        ]
      );

      // If the top match owner is another user, notify them too
      if (topMatch.item.reporter_id !== reporter_id) {
        await run(
          `INSERT INTO notifications (user_id, title, message, link, type)
           VALUES (?, 'Potential Match for Your Item', ?, ?, 'info')`,
          [
            topMatch.item.reporter_id,
            `A newly reported item may match your listing "${topMatch.item.title}". Check Retrivo to inspect.`,
            `/item-detail.html?id=${newItem.id}`
          ]
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: `${type.toUpperCase()} report filed successfully. Reference ID: ${newItem.reference_no}`,
      item: newItem,
      matchesCount: matches.length
    });
  } catch (err) {
    console.error('[POST ITEM ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to submit report.' });
  }
});

// PUT /api/items/:id/status - Update item status
router.put('/:id/status', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const user = req.session.user;

    const validStatuses = ['active', 'matched', 'under_review', 'ready_for_collection', 'returned', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid item status.' });
    }

    const item = await get('SELECT * FROM items WHERE id = ?', [id]);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found.' });
    }

    // Role check: Only reporter or staff/admin can change status
    const isOwner = item.reporter_id === user.id;
    const isPrivileged = ['admin', 'staff'].includes(user.role);

    if (!isOwner && !isPrivileged) {
      return res.status(403).json({ success: false, error: 'You are not authorized to update this item.' });
    }

    // Regular users can only cancel their own reports or reactivate them
    if (!isPrivileged && !['active', 'cancelled'].includes(status)) {
      return res.status(403).json({ success: false, error: 'Only staff can update verification & collection status.' });
    }

    await run('UPDATE items SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);

    // Log Activity
    await run(
      `INSERT INTO activity_logs (user_id, action, target_type, target_id, details)
       VALUES (?, 'ITEM_STATUS_UPDATED', 'item', ?, ?)`,
      [user.id, id, `Status updated to ${status.toUpperCase()} for item ${item.reference_no}`]
    );

    return res.json({
      success: true,
      message: `Item status updated to ${status}.`
    });
  } catch (err) {
    console.error('[UPDATE ITEM STATUS ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to update item status.' });
  }
});

module.exports = router;

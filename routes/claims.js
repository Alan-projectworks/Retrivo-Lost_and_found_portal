const express = require('express');
const router = express.Router();
const { run, get, all } = require('../db/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Generate unique claim reference number
const generateClaimRef = async () => {
  const year = new Date().getFullYear().toString().slice(-2);
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const ref = `CLM-${year}-${randomNum}`;
  const exists = await get('SELECT id FROM claims WHERE reference_no = ?', [ref]);
  if (exists) {
    return generateClaimRef();
  }
  return ref;
};

// POST /api/claims - Submit an ownership claim for a found item
router.post('/', requireAuth, upload.single('proof_file'), async (req, res) => {
  try {
    const { item_id, proof_description, secret_answers } = req.body;
    const claimant_id = req.session.user.id;

    if (!item_id || !proof_description || !secret_answers) {
      return res.status(400).json({
        success: false,
        error: 'Item ID, proof description, and identifying secret answers are required to verify ownership.'
      });
    }

    const item = await get('SELECT * FROM items WHERE id = ?', [item_id]);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item record not found.' });
    }

    if (item.type !== 'found') {
      return res.status(400).json({ success: false, error: 'Claims can only be filed against Found items.' });
    }

    if (item.reporter_id === claimant_id) {
      return res.status(400).json({ success: false, error: 'You cannot file an ownership claim on an item you reported.' });
    }

    // Check if user already submitted a pending claim for this item
    const existingClaim = await get(
      'SELECT id, status FROM claims WHERE item_id = ? AND claimant_id = ? AND status IN ("pending", "under_review", "approved")',
      [item_id, claimant_id]
    );

    if (existingClaim) {
      return res.status(400).json({
        success: false,
        error: `You already have an active claim (${existingClaim.status.toUpperCase()}) for this item.`
      });
    }

    const reference_no = await generateClaimRef();
    let proof_file_url = null;
    if (req.file) {
      proof_file_url = `/uploads/${req.file.filename}`;
    }

    const claimResult = await run(
      `INSERT INTO claims (
        reference_no, item_id, claimant_id, proof_description, secret_answers, proof_file_url, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [reference_no, item_id, claimant_id, proof_description.trim(), secret_answers.trim(), proof_file_url]
    );

    // Update item status to under_review
    await run('UPDATE items SET status = "under_review", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [item_id]);

    // Log Activity
    await run(
      `INSERT INTO activity_logs (user_id, action, target_type, target_id, details)
       VALUES (?, 'CLAIM_SUBMITTED', 'claim', ?, ?)`,
      [claimant_id, claimResult.id, `Submitted claim ${reference_no} for item: "${item.title}" (${item.reference_no})`]
    );

    // Send confirmation notification to claimant
    await run(
      `INSERT INTO notifications (user_id, title, message, link, type)
       VALUES (?, 'Ownership Claim Submitted', ?, ?, 'info')`,
      [
        claimant_id,
        `Your claim ${reference_no} for "${item.title}" has been submitted for human review by Campus Safety & Security.`,
        `/my-claims.html`
      ]
    );

    return res.status(201).json({
      success: true,
      message: `Ownership claim submitted successfully. Claim Reference: ${reference_no}`,
      claimId: claimResult.id,
      reference_no
    });
  } catch (err) {
    console.error('[POST CLAIM ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to submit ownership claim.' });
  }
});

// GET /api/claims/my-claims - Get logged-in user's claims
router.get('/my-claims', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;

    const claims = await all(
      `SELECT c.*, 
              i.title as item_title,
              i.reference_no as item_ref,
              i.category as item_category,
              i.location as item_location,
              i.photo_url as item_photo,
              i.status as item_status,
              cp.name as collection_point_name,
              cp.building as collection_point_building,
              cp.desk_incharge as collection_point_incharge,
              cp.contact_number as collection_point_contact,
              cp.operating_hours as collection_point_hours
       FROM claims c
       JOIN items i ON c.item_id = i.id
       LEFT JOIN collection_points cp ON i.collection_point_id = cp.id
       WHERE c.claimant_id = ?
       ORDER BY c.created_at DESC`,
      [userId]
    );

    return res.json({
      success: true,
      claims
    });
  } catch (err) {
    console.error('[GET MY CLAIMS ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve your claims.' });
  }
});

// GET /api/claims - Staff & Admin full claims review queue
router.get('/', requireRole(['staff', 'admin']), async (req, res) => {
  try {
    const { status, search } = req.query;

    let conditions = [];
    let params = [];

    if (status && status !== 'All') {
      conditions.push('c.status = ?');
      params.push(status);
    }

    if (search && search.trim()) {
      conditions.push('(c.reference_no LIKE ? OR i.title LIKE ? OR u.full_name LIKE ? OR u.reg_number LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT c.*, 
             i.title as item_title,
             i.reference_no as item_ref,
             i.category as item_category,
             i.location as item_location,
             i.photo_url as item_photo,
             i.secret_identifiers as item_secret_identifiers,
             i.status as item_status,
             u.full_name as claimant_name,
             u.email as claimant_email,
             u.reg_number as claimant_reg_number,
             u.phone as claimant_phone,
             u.department as claimant_dept,
             u.hostel_block as claimant_hostel,
             rev.full_name as reviewer_name,
             cp.name as collection_point_name,
             cp.building as collection_point_building
      FROM claims c
      JOIN items i ON c.item_id = i.id
      JOIN users u ON c.claimant_id = u.id
      LEFT JOIN users rev ON c.reviewed_by = rev.id
      LEFT JOIN collection_points cp ON i.collection_point_id = cp.id
      ${whereClause}
      ORDER BY c.created_at DESC
    `;

    const claims = await all(sql, params);

    return res.json({
      success: true,
      claims
    });
  } catch (err) {
    console.error('[GET ALL CLAIMS ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve claims queue.' });
  }
});

// PUT /api/claims/:id/review - Staff / Admin approve or reject a claim
router.put('/:id/review', requireRole(['staff', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, staff_notes, collection_point_id } = req.body;
    const reviewer_id = req.session.user.id;

    if (!['approved', 'rejected', 'under_review'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status must be approved, rejected, or under_review.' });
    }

    const claim = await get(
      `SELECT c.*, i.title as item_title, i.reference_no as item_ref, i.collection_point_id as current_cp_id
       FROM claims c
       JOIN items i ON c.item_id = i.id
       WHERE c.id = ?`,
      [id]
    );

    if (!claim) {
      return res.status(404).json({ success: false, error: 'Claim record not found.' });
    }

    // Update claim
    await run(
      `UPDATE claims 
       SET status = ?, 
           staff_notes = ?, 
           reviewed_by = ?, 
           reviewed_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [status, staff_notes || '', reviewer_id, id]
    );

    // Update Item status accordingly
    if (status === 'approved') {
      const targetCp = collection_point_id || claim.current_cp_id || 1;
      await run(
        `UPDATE items 
         SET status = 'ready_for_collection', 
             collection_point_id = ?,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [targetCp, claim.item_id]
      );

      const cp = await get('SELECT * FROM collection_points WHERE id = ?', [targetCp]);
      const cpText = cp ? `${cp.name} (${cp.building}) during ${cp.operating_hours}` : 'the designated campus security office';

      // Send approval notification to claimant with collection details
      await run(
        `INSERT INTO notifications (user_id, title, message, link, type)
         VALUES (?, 'Ownership Claim Approved! 🎉', ?, ?, 'success')`,
        [
          claim.claimant_id,
          `Your claim ${claim.reference_no} for "${claim.item_title}" has been approved! Please visit ${cpText} with your Student ID Card to complete handover.`,
          `/item-detail.html?id=${claim.item_id}`
        ]
      );
    } else if (status === 'rejected') {
      // Check if there are other pending claims on this item
      const otherClaims = await get(
        'SELECT COUNT(*) as count FROM claims WHERE item_id = ? AND id != ? AND status IN ("pending", "under_review")',
        [claim.item_id, id]
      );

      if (!otherClaims || otherClaims.count === 0) {
        // Revert item to active
        await run('UPDATE items SET status = "active", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [claim.item_id]);
      }

      // Notify claimant of rejection
      await run(
        `INSERT INTO notifications (user_id, title, message, link, type)
         VALUES (?, 'Claim Update: Verification Unsuccessful', ?, ?, 'error')`,
        [
          claim.claimant_id,
          `Your claim ${claim.reference_no} for "${claim.item_title}" was rejected. Reason: ${staff_notes || 'Identifying details did not match item properties.'}`,
          `/my-claims.html`
        ]
      );
    }

    // Log Activity
    await run(
      `INSERT INTO activity_logs (user_id, action, target_type, target_id, details)
       VALUES (?, 'CLAIM_REVIEWED', 'claim', ?, ?)`,
      [
        reviewer_id,
        id,
        `Claim ${claim.reference_no} was ${status.toUpperCase()} by ${req.session.user.full_name}. Notes: ${staff_notes || 'N/A'}`
      ]
    );

    return res.json({
      success: true,
      message: `Claim ${claim.reference_no} marked as ${status.toUpperCase()}.`
    });
  } catch (err) {
    console.error('[REVIEW CLAIM ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to process claim review.' });
  }
});

// POST /api/claims/:id/handover - Record physical handover and mark item as returned
router.post('/:id/handover', requireRole(['staff', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { handover_notes, verified_student_reg } = req.body;
    const staff_id = req.session.user.id;

    const claim = await get(
      `SELECT c.*, i.title as item_title, i.reference_no as item_ref, u.full_name as claimant_name, u.reg_number as claimant_reg
       FROM claims c
       JOIN items i ON c.item_id = i.id
       JOIN users u ON c.claimant_id = u.id
       WHERE c.id = ?`,
      [id]
    );

    if (!claim) {
      return res.status(404).json({ success: false, error: 'Claim record not found.' });
    }

    if (claim.status !== 'approved') {
      return res.status(400).json({ success: false, error: 'Handover can only be recorded for approved claims.' });
    }

    const fullNotes = `Handover verified by ${req.session.user.full_name}. Physical ID verified: ${verified_student_reg || claim.claimant_reg}. Notes: ${handover_notes || 'Item received in good condition by student.'}`;

    // Update claim to handed_over
    await run(
      `UPDATE claims 
       SET status = 'handed_over', 
           handed_over_at = CURRENT_TIMESTAMP, 
           handover_notes = ? 
       WHERE id = ?`,
      [fullNotes, id]
    );

    // Update item to returned
    await run(
      `UPDATE items 
       SET status = 'returned', 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [claim.item_id]
    );

    // Log Activity
    await run(
      `INSERT INTO activity_logs (user_id, action, target_type, target_id, details)
       VALUES (?, 'ITEM_HANDOVER', 'claim', ?, ?)`,
      [
        staff_id,
        id,
        `Physical handover completed for "${claim.item_title}" (${claim.item_ref}) to ${claim.claimant_name} (${claim.claimant_reg})`
      ]
    );

    // Notify claimant
    await run(
      `INSERT INTO notifications (user_id, title, message, link, type)
       VALUES (?, 'Recovery Complete! Belonging Returned', ?, ?, 'success')`,
      [
        claim.claimant_id,
        `Your belonging "${claim.item_title}" has been successfully returned to you. Thank you for using Retrivo!`,
        `/item-detail.html?id=${claim.item_id}`
      ]
    );

    return res.json({
      success: true,
      message: `Physical handover recorded successfully. Item "${claim.item_title}" is now marked as Returned.`
    });
  } catch (err) {
    console.error('[HANDOVER CLAIM ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to record physical handover.' });
  }
});

module.exports = router;

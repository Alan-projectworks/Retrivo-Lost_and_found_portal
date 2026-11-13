const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { run, get, all } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { full_name, email, reg_number, phone, password, confirm_password, department, hostel_block } = req.body;

    // Validation
    if (!full_name || !email || !reg_number || !password) {
      return res.status(400).json({ success: false, error: 'Full name, university email, registration number, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    if (confirm_password && password !== confirm_password) {
      return res.status(400).json({ success: false, error: 'Passwords do not match.' });
    }

    // Email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanReg = reg_number.trim().toUpperCase();

    // Check duplicate email
    const existingEmail = await get('SELECT id FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (existingEmail) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists.' });
    }

    // Check duplicate registration number
    const existingReg = await get('SELECT id FROM users WHERE UPPER(reg_number) = ?', [cleanReg]);
    if (existingReg) {
      return res.status(400).json({ success: false, error: 'An account with this Registration Number already exists.' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Default role is always student for public registration
    const result = await run(
      `INSERT INTO users (full_name, email, reg_number, phone, password_hash, role, department, hostel_block)
       VALUES (?, ?, ?, ?, ?, 'student', ?, ?)`,
      [full_name.trim(), cleanEmail, cleanReg, phone ? phone.trim() : null, password_hash, department || '', hostel_block || '']
    );

    const newUser = await get('SELECT id, full_name, email, reg_number, phone, role, department, hostel_block, created_at FROM users WHERE id = ?', [result.id]);

    // Set authenticated session
    req.session.user = newUser;

    // Log activity
    await run(
      `INSERT INTO activity_logs (user_id, action, target_type, target_id, details)
       VALUES (?, 'USER_REGISTERED', 'user', ?, ?)`,
      [newUser.id, newUser.id, `New student account registered: ${newUser.full_name} (${newUser.reg_number})`]
    );

    // Welcome notification
    await run(
      `INSERT INTO notifications (user_id, title, message, link, type)
       VALUES (?, 'Welcome to Retrivo!', 'Your account has been activated. Report lost or found belongings across LPU anytime.', '/dashboard.html', 'success')`,
      [newUser.id]
    );

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: newUser
    });
  } catch (err) {
    console.error('[AUTH REGISTER ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Internal server error during registration.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier can be email or registration number

    if (!identifier || !password) {
      return res.status(400).json({ success: false, error: 'Email/Registration number and password are required.' });
    }

    const cleanIdentifier = identifier.trim();

    // Query user
    const user = await get(
      `SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR UPPER(reg_number) = UPPER(?)`,
      [cleanIdentifier, cleanIdentifier]
    );

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid credentials. Please verify your email/registration number.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid password. Please check and try again.' });
    }

    // Clean user object for session
    const safeUser = {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      reg_number: user.reg_number,
      phone: user.phone,
      role: user.role,
      department: user.department,
      hostel_block: user.hostel_block,
      avatar_url: user.avatar_url
    };

    req.session.user = safeUser;

    // Log activity
    await run(
      `INSERT INTO activity_logs (user_id, action, target_type, target_id, details)
       VALUES (?, 'USER_LOGIN', 'user', ?, ?)`,
      [user.id, user.id, `User logged in from session: ${user.role}`]
    );

    return res.json({
      success: true,
      message: 'Sign in successful.',
      user: safeUser
    });
  } catch (err) {
    console.error('[AUTH LOGIN ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Internal server error during login.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ success: false, error: 'Logout failed.' });
      }
      res.clearCookie('connect.sid');
      return res.json({ success: true, message: 'Signed out successfully.' });
    });
  } else {
    return res.json({ success: true, message: 'Already signed out.' });
  }
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ success: true, user: req.session.user });
  }
  return res.json({ success: true, user: null });
});

// PUT /api/auth/profile
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { full_name, phone, department, hostel_block } = req.body;
    const userId = req.session.user.id;

    await run(
      `UPDATE users 
       SET full_name = COALESCE(?, full_name),
           phone = COALESCE(?, phone),
           department = COALESCE(?, department),
           hostel_block = COALESCE(?, hostel_block)
       WHERE id = ?`,
      [full_name, phone, department, hostel_block, userId]
    );

    const updatedUser = await get(
      'SELECT id, full_name, email, reg_number, phone, role, department, hostel_block, created_at FROM users WHERE id = ?',
      [userId]
    );

    req.session.user = updatedUser;

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: updatedUser
    });
  } catch (err) {
    console.error('[AUTH PROFILE ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to update profile.' });
  }
});

// PUT /api/auth/change-password
router.put('/change-password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password, confirm_new_password } = req.body;
    const userId = req.session.user.id;

    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, error: 'Current password and new password are required.' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters.' });
    }

    if (confirm_new_password && new_password !== confirm_new_password) {
      return res.status(400).json({ success: false, error: 'New passwords do not match.' });
    }

    const user = await get('SELECT password_hash FROM users WHERE id = ?', [userId]);
    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Current password does not match records.' });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('[AUTH PASSWORD ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to update password.' });
  }
});

module.exports = router;

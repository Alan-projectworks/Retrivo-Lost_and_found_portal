const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const { initDb } = require('./db/database');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET;

if (isProduction && !sessionSecret) {
  throw new Error('SESSION_SECRET must be set in production.');
}

if (isProduction) {
  app.set('trust proxy', 1);
}

const PORT = process.env.PORT || 3000;
const uploadsDir = process.env.DATA_DIR
  ? path.join(path.resolve(process.env.DATA_DIR), 'uploads')
  : path.join(__dirname, 'public/uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(
  session({
    secret: sessionSecret || 'retrivo-local-development-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days session
    }
  })
);

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// Mount REST API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/items', require('./routes/items'));
app.use('/api/claims', require('./routes/claims'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/locations', require('./routes/locations'));
app.use('/api/qr', require('./routes/qr'));

// Clean URL routing for frontend pages
app.get('/browse', (req, res) => res.sendFile(path.join(__dirname, 'public/browse.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public/register.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public/dashboard.html')));
app.get('/report-lost', (req, res) => res.sendFile(path.join(__dirname, 'public/report-lost.html')));
app.get('/report-found', (req, res) => res.sendFile(path.join(__dirname, 'public/report-found.html')));
app.get('/my-reports', (req, res) => res.sendFile(path.join(__dirname, 'public/my-reports.html')));
app.get('/my-claims', (req, res) => res.sendFile(path.join(__dirname, 'public/my-claims.html')));
app.get('/notifications', (req, res) => res.sendFile(path.join(__dirname, 'public/notifications.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.get('/staff', (req, res) => res.sendFile(path.join(__dirname, 'public/staff.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'public/profile.html')));
app.get('/qr-campus', (req, res) => res.sendFile(path.join(__dirname, 'public/qr-campus.html')));
app.get('/item/:id', (req, res) => res.sendFile(path.join(__dirname, 'public/item-detail.html')));

// Global 404 handler for unmatched API routes
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found.' });
});

// Root fallback handler for frontend navigation
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Start Server after initializing database
const startServer = async () => {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`
=============================================================
  RETRIVO – LPU CAMPUS RECOVERY NETWORK
  Design Thinking Project: P04 – 600-Acre Campus Recovery
=============================================================
  ✓ Server running on: http://localhost:${PORT}
  ✓ Database directory: ${process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'db')}
  ✓ Mode: Full-Stack Express Application
  ✓ Demo Student: student@lpu.in / Student@123
  ✓ Demo Staff:   staff.security@lpu.in / Staff@123
  ✓ Demo Admin:   admin.recovery@lpu.in / Admin@123
=============================================================
      `);
    });
  } catch (err) {
    console.error('Failed to start Retrivo server:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = app;

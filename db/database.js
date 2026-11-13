const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(__dirname);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'retrivo.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('[DB] Connected to SQLite database at', dbPath);
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON;');

// Promisified query helpers
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
};

// Initialize Schema
const initDb = async () => {
  // Users table
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      reg_number TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('student', 'staff', 'admin')) NOT NULL DEFAULT 'student',
      department TEXT,
      hostel_block TEXT,
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Collection Points table
  await run(`
    CREATE TABLE IF NOT EXISTS collection_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      zone TEXT NOT NULL,
      building TEXT NOT NULL,
      desk_incharge TEXT,
      contact_number TEXT,
      operating_hours TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Items table
  await run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_no TEXT UNIQUE NOT NULL,
      type TEXT CHECK(type IN ('lost', 'found')) NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      secret_identifiers TEXT,
      location TEXT NOT NULL,
      specific_spot TEXT,
      date_occurred DATE NOT NULL,
      photo_url TEXT,
      status TEXT CHECK(status IN ('active', 'matched', 'under_review', 'ready_for_collection', 'returned', 'cancelled')) NOT NULL DEFAULT 'active',
      contact_preference TEXT DEFAULT 'platform',
      is_sensitive INTEGER DEFAULT 0,
      reporter_id INTEGER NOT NULL,
      collection_point_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reporter_id) REFERENCES users(id),
      FOREIGN KEY (collection_point_id) REFERENCES collection_points(id)
    );
  `);

  // Claims table
  await run(`
    CREATE TABLE IF NOT EXISTS claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_no TEXT UNIQUE NOT NULL,
      item_id INTEGER NOT NULL,
      claimant_id INTEGER NOT NULL,
      proof_description TEXT NOT NULL,
      secret_answers TEXT NOT NULL,
      proof_file_url TEXT,
      status TEXT CHECK(status IN ('pending', 'under_review', 'approved', 'rejected', 'handed_over')) NOT NULL DEFAULT 'pending',
      staff_notes TEXT,
      reviewed_by INTEGER,
      reviewed_at DATETIME,
      handed_over_at DATETIME,
      handover_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (item_id) REFERENCES items(id),
      FOREIGN KEY (claimant_id) REFERENCES users(id),
      FOREIGN KEY (reviewed_by) REFERENCES users(id)
    );
  `);

  // Notifications table
  await run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT,
      type TEXT DEFAULT 'info',
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Activity Logs table
  await run(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Indexes for high performance queries
  await run(`CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_items_location ON items(location);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_claims_item ON claims(item_id);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_claims_claimant ON claims(claimant_id);`);
  await run(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);`);

  await run(
    `UPDATE items SET photo_url = '/uploads/lpu-id-card.svg' WHERE photo_url = '/uploads/realistic-id-card.jpg';`
  );

  console.log('[DB] All tables and indexes initialized successfully.');
};

module.exports = {
  db,
  run,
  get,
  all,
  initDb
};

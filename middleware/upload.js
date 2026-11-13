const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadsDir = process.env.DATA_DIR
  ? path.join(path.resolve(process.env.DATA_DIR), 'uploads')
  : path.resolve(__dirname, '../public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Storage configuration with secure unique naming
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanExt = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.pdf'].includes(ext) ? ext : '.png';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'item-' + uniqueSuffix + cleanExt);
  }
});

// File filter for safety
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/pdf'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Please upload a JPEG, PNG, WEBP, or SVG image.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024 // 8 MB limit
  }
});

module.exports = upload;

'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const visionService = require('../services/visionService');

// ── Upload configuration ──────────────────────────────────────────────────────
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `upload_${Date.now()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error(
      `Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP, GIF.`
    );
    err.code = 'INVALID_FILE_TYPE';
    cb(err, false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_BYTES }
});

// ── POST /api/analyze ─────────────────────────────────────────────────────────
router.post('/', upload.single('image'), async (req, res, next) => {
  const filePath = req.file ? req.file.path : null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided. Send as multipart/form-data field "image".' });
    }

    const result = await visionService.analyzeImage(filePath);

    res.json(result);
  } catch (err) {
    next(err);
  } finally {
    // Always delete the uploaded file after processing
    if (filePath && fs.existsSync(filePath)) {
      fs.unlink(filePath, () => {}); // fire-and-forget cleanup
    }
  }
});

module.exports = router;

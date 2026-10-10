'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const projectsRouter = require('./routes/projects');
const analyzeRouter = require('./routes/analyze');
const troubleshootRouter = require('./routes/troubleshoot');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/projects', projectsRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/troubleshoot', troubleshootRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const visionConfigured = Boolean(
    process.env.VISION_API_KEY || process.env.OPENAI_API_KEY
  );
  const textConfigured = Boolean(
    process.env.TEXT_API_KEY || process.env.OPENAI_API_KEY
  );

  res.json({
    status: 'ok',
    version: '1.0.0',
    mode: visionConfigured ? 'live' : 'demo',
    capabilities: {
      vision: visionConfigured,
      text: textConfigured
    },
    timestamp: new Date().toISOString()
  });
});

// ── SPA fallback (serve index.html for any non-API route) ─────────────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[CircuitVision] Unhandled error:', err.message);

  // Multer file size / type errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Image too large. Maximum size is 5 MB.' });
  }
  if (err.code === 'INVALID_FILE_TYPE') {
    return res.status(415).json({ error: err.message });
  }

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred.'
      : err.message
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const visionConfigured = Boolean(
    process.env.VISION_API_KEY || process.env.OPENAI_API_KEY
  );
  console.log(`
╔══════════════════════════════════════════════╗
║          CircuitVision AI  v1.0.0            ║
║  "Snap it. Understand it. Build something."  ║
╚══════════════════════════════════════════════╝
  Server  : http://localhost:${PORT}
  Mode    : ${visionConfigured ? '🟢 Live AI' : '🟡 Demo (no API key configured)'}
  Health  : http://localhost:${PORT}/api/health
`);
});

module.exports = app; // exported for testing

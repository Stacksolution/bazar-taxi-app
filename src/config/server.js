'use strict';

const http     = require('http');
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');
const logger   = require('../utils/logger');
const { NODE_ENV, SOCKET_CORS_ORIGIN } = require('./env');

/**
 * Create and configure the Express app + raw HTTP server.
 * Socket.IO is attached separately in src/socket/index.js.
 */
function createServer() {
  const app = express();

  // ── Security headers ──────────────────────────────
  app.use(helmet());

  // ── CORS ──────────────────────────────────────────
  app.use(cors({
    origin: SOCKET_CORS_ORIGIN === '*' ? '*' : SOCKET_CORS_ORIGIN.split(','),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  }));

  // ── Body parsing ──────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── HTTP request logging ──────────────────────────
  app.use(
    morgan('combined', {
      stream: { write: (msg) => logger.http(msg.trim()) },
      skip: () => NODE_ENV === 'test',
    })
  );

  // ── Health check ──────────────────────────────────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ── API routes (future) ───────────────────────────
  // app.use('/api/v1/users', require('../routes/userRoutes'));

  // ── 404 fallback ──────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });

  // ── Global error handler ──────────────────────────
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    logger.error('Unhandled error:', err);
    res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Internal Server Error',
    });
  });

  const httpServer = http.createServer(app);
  return { app, httpServer };
}

module.exports = { createServer };

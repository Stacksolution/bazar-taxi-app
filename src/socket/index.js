'use strict';

const { Server }   = require('socket.io');
const { getSocketConfig }         = require('../config/socket');
const { socketAuthMiddleware }    = require('../middlewares/socketAuth');
const { socketLoggerMiddleware }  = require('../middlewares/socketLogger');
const { registerPresenceHandlers} = require('./handlers/presenceHandler');
const { registerChatHandlers }    = require('./handlers/chatHandler');
const UserService = require('../services/UserService');
const logger      = require('../utils/logger');

/** @type {import('socket.io').Server | null} */
let io = null;

/**
 * Attach Socket.IO to the HTTP server, register global middlewares,
 * and set up per-connection event handlers.
 *
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
async function initializeSocket(httpServer) {
  // Reset stale online states from a previous server run
  await UserService.resetAllOffline();

  io = new Server(httpServer, getSocketConfig());

  // ── Global middlewares (run on every new connection) ──────────────────
  io.use(socketAuthMiddleware);
  io.use(socketLoggerMiddleware);

  // ── Connection handler ────────────────────────────────────────────────
  io.on('connection', (socket) => {
    logger.info(`🔌 Socket connected: ${socket.id}`);

    // Register feature-specific handlers
    registerPresenceHandlers(socket, io);
    registerChatHandlers(socket, io);

    // Generic error guard
    socket.on('error', (err) => {
      logger.error(`Socket error [${socket.id}]:`, err.message);
    });
  });

  logger.info('⚡ Socket.IO server initialised');
  return io;
}

/**
 * Get the singleton Socket.IO instance (use after init).
 * @returns {import('socket.io').Server}
 */
function getIO() {
  if (!io) throw new Error('Socket.IO has not been initialised yet');
  return io;
}

module.exports = { initializeSocket, getIO };

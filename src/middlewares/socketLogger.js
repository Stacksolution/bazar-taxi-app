'use strict';

const logger = require('../utils/logger');

/**
 * Logs every socket connection and disconnection to the console.
 * Useful for debugging; keep it lightweight.
 *
 * @param {import('socket.io').Socket} socket
 * @param {Function} next
 */
function socketLoggerMiddleware(socket, next) {
  logger.socket(
    `📡 [${socket.id}] handshake from ${socket.handshake.address} ` +
    `(userId=${socket.data.userId ?? 'anon'})`
  );
  next();
}

module.exports = { socketLoggerMiddleware };

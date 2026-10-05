'use strict';

const { Server } = require('socket.io');
const { SOCKET_CORS_ORIGIN } = require('./env');

/**
 * Returns a fully-configured Socket.IO options object.
 */
function getSocketConfig() {
  return {
    cors: {
      origin : SOCKET_CORS_ORIGIN === '*' ? '*' : SOCKET_CORS_ORIGIN.split(','),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Connection state recovery (Socket.IO v4+)
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 min
      skipMiddlewares: true,
    },
    pingTimeout  : 20000,
    pingInterval : 25000,
    transports   : ['websocket', 'polling'],
  };
}

module.exports = { getSocketConfig };

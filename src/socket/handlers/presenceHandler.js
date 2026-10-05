'use strict';

const UserService      = require('../../services/UserService');
const { asyncHandler } = require('../../utils/asyncHandler');
const { success }      = require('../../utils/response');
const logger           = require('../../utils/logger');

/**
 * Presence Handler
 *
 * Events broadcast to ALL clients:
 *   presence:user_online   — when any user connects
 *   presence:user_offline  — when any user disconnects
 *
 * Events (client → server, with ack callback):
 *   presence:get_online_users → returns list of online users
 *
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
function registerPresenceHandlers(socket, io) {

  // ── 1. On connect — mark user online ───────────────────────────────────
  const handleUserConnect = async () => {
    const { userId, anonymous, userName, userType } = socket.data;
    if (anonymous || !userId) return;

    try {
      const user = await UserService.handleConnect({
        userId,
        socketId  : socket.id,
        ipAddress : socket.handshake.address,
        userAgent : socket.handshake.headers['user-agent'],
      });

      // Join a personal room — emit to specific user later via: io.to(`user:${id}`)
      socket.join(`user:${userId}`);

      // Join role room — emit to all drivers/customers via: io.to('driver')
      socket.join(userType || 'customer');

      // Broadcast to ALL connected clients
      io.emit('presence:user_online', {
        userId   : user.id,
        name     : user.name,
        userType : userType || user.role,
        socketId : socket.id,
        connectedAt: new Date().toISOString(),
      });

      logger.socket(`✅ [CONNECT] userId=${userId} name="${user.name}" type=${userType} socket=${socket.id}`);

    } catch (err) {
      // Full error log — code + message + stack
      logger.error(`❌ [CONNECT ERROR] userId=${userId} socket=${socket.id}`, {
        message : err.message,
        code    : err.code,        // MySQL error code e.g. ER_NO_SUCH_TABLE
        sqlState: err.sqlState,
        stack   : err.stack,
      });
    }
  };

  // Run immediately on connection
  handleUserConnect();

  // ── 2. Get online users list (with ack) ────────────────────────────────
  socket.on(
    'presence:get_online_users',
    asyncHandler(async (_data, callback) => {
      const users = await UserService.getOnlineUsers();
      if (typeof callback === 'function') {
        callback(success(users, 'Online users fetched'));
      }
    })
  );

  // ── 3. On disconnect — mark user offline ───────────────────────────────
  socket.on('disconnect', async (reason) => {
    const { userId, anonymous, userType } = socket.data;
    if (anonymous || !userId) return;

    try {
      await UserService.handleDisconnect({
        userId,
        socketId : socket.id,
        reason,
      });

      io.emit('presence:user_offline', {
        userId,
        userType : userType || null,
        socketId : socket.id,
        reason,
        lastSeen : new Date().toISOString(),
      });

      logger.socket(`✅ [DISCONNECT] userId=${userId} reason="${reason}" socket=${socket.id}`);

    } catch (err) {
      logger.error(`❌ [DISCONNECT ERROR] userId=${userId} socket=${socket.id}`, {
        message : err.message,
        code    : err.code,
        sqlState: err.sqlState,
        stack   : err.stack,
      });
    }
  });
}

module.exports = { registerPresenceHandlers };

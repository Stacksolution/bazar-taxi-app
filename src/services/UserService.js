'use strict';

const UserModel      = require('../models/UserModel');
const SocketLogModel = require('../models/SocketLogModel');
const logger         = require('../utils/logger');

/**
 * UserService — orchestrates user-related business logic.
 * Socket handlers call this instead of touching models directly.
 */
const UserService = {
  /**
   * Called when a socket connects and provides a userId.
   * Updates the user row and logs the event.
   *
   * @param {{ userId: number, socketId: string, ipAddress?: string, userAgent?: string }} opts
   */
  async handleConnect({ userId, socketId, ipAddress, userAgent }) {
    // Verify user exists
    const user = await UserModel.findById(userId);
    if (!user) throw new Error(`User ${userId} not found`);

    // Mark online
    await UserModel.setOnline(userId, socketId);

    // Audit log
    await SocketLogModel.create({
      userId,
      socketId,
      event     : 'connected',
      ipAddress,
      userAgent,
    });

    logger.socket(`🟢 User ${user.name} (${userId}) connected → socket ${socketId}`);
    return user;
  },

  /**
   * Called when a socket disconnects.
   *
   * @param {{ userId: number, socketId: string, reason?: string }} opts
   */
  async handleDisconnect({ userId, socketId, reason }) {
    await UserModel.setOffline(userId);

    await SocketLogModel.create({
      userId,
      socketId,
      event : 'disconnected',
      reason,
    });

    logger.socket(`🔴 User ${userId} disconnected (${reason ?? 'unknown'})`);
  },

  /**
   * Return the list of all currently online users.
   */
  async getOnlineUsers() {
    return UserModel.getOnlineUsers();
  },

  /**
   * Reset all users to offline — call on server boot.
   */
  async resetAllOffline() {
    const result = await UserModel.resetAllOffline();
    if (result.affectedRows > 0) {
      logger.warn(`⚠️  Reset ${result.affectedRows} stale online user(s) to offline`);
    }
  },
};

module.exports = UserService;

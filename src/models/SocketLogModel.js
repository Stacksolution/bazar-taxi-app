'use strict';

const { query } = require('../database/connection');

/**
 * SocketLog model
 *
 * Table: socket_logs
 * Columns (socket_ prefix on all except id):
 *   id, socket_user_id, socket_socket_id, socket_event,
 *   socket_ip_address, socket_user_agent, socket_reason, created_at
 */
const SocketLogModel = {
  /**
   * Insert a new socket log entry.
   */
  create({
    userId    = null,
    socketId,
    event,
    ipAddress = null,
    userAgent = null,
    reason    = null,
  }) {
    return query(
      `INSERT INTO socket_logs
         (socket_user_id, socket_socket_id, socket_event,
          socket_ip_address, socket_user_agent, socket_reason, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())`,
      [userId, socketId, event, ipAddress, userAgent, reason]
    );
  },

  /**
   * Get recent logs for a specific user.
   * @param {number} userId
   * @param {number} [limit=20]
   */
  getByUser(userId, limit = 20) {
    return query(
      `SELECT * FROM socket_logs
       WHERE socket_user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit]
    );
  },
};

module.exports = SocketLogModel;

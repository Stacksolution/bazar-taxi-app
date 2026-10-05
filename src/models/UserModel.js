'use strict';

const { query, queryOne } = require('../database/connection');

/**
 * UserModel — matches Laravel's users table structure.
 *
 * Laravel default columns:
 *   id, name, email, email_verified_at, password,
 *   remember_token, created_at, updated_at
 *
 * Extra columns added via Laravel migration (add_socket_fields_to_users_table):
 *   user_socket_id, user_is_online, user_last_seen_at
 *
 * All timestamps stored as UTC (Laravel default).
 */
const UserModel = {
  /**
   * Find a user by primary key.
   * @param {number} id
   */
  findById(id) {
    return queryOne(
      `SELECT id, name, email, email_verified_at,
              user_socket_id, user_is_online, user_last_seen_at,
              created_at, updated_at
       FROM users
       WHERE id = ?`,
      [id]
    );
  },

  /**
   * Find by email (includes password for auth).
   * @param {string} email
   */
  findByEmail(email) {
    return queryOne(
      `SELECT * FROM users WHERE email = ?`,
      [email]
    );
  },

  /**
   * Mark user ONLINE — set socket id + is_online flag.
   * updated_at handled by Laravel's timestamp convention (we set it manually here).
   * @param {number} userId
   * @param {string} socketId
   */
  setOnline(userId, socketId) {
    return query(
      `UPDATE users
       SET user_socket_id = ?,
           user_is_online = 1,
           updated_at     = UTC_TIMESTAMP()
       WHERE id = ?`,
      [socketId, userId]
    );
  },

  /**
   * Mark user OFFLINE — clear socket id, record user_last_seen_at in UTC.
   * @param {number} userId
   */
  setOffline(userId) {
    return query(
      `UPDATE users
       SET user_socket_id = NULL,
           user_is_online = 0,
           user_last_seen_at   = UTC_TIMESTAMP(),
           updated_at     = UTC_TIMESTAMP()
       WHERE id = ?`,
      [userId]
    );
  },

  /**
   * Get all currently online users.
   */
  getOnlineUsers() {
    return query(
      `SELECT id, name, email, user_socket_id, user_last_seen_at
       FROM users
       WHERE user_is_online = 1`
    );
  },

  /**
   * Reset ALL stale online users on server restart.
   */
  resetAllOffline() {
    return query(
      `UPDATE users
       SET user_socket_id = NULL,
           user_is_online = 0,
           user_last_seen_at   = UTC_TIMESTAMP(),
           updated_at     = UTC_TIMESTAMP()
       WHERE user_is_online = 1`
    );
  },
};

module.exports = UserModel;

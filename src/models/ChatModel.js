'use strict';

const { query, queryOne, withTransaction } = require('../database/connection');

/**
 * Persistence layer for booking chat.
 *
 * Chat identity is deliberately ID-only. A user id is globally unique, so
 * room ownership, participant membership, sender identity and read receipts
 * never depend on customer/driver/vendor types.
 */
const ChatModel = {
  /** Create the one room allowed for a booking and register its owner. */
  async findOrCreateRoom({ bookingId, ownerId }) {
    let room = await queryOne(
      'SELECT * FROM socket_chat_rooms WHERE room_booking_id = ? LIMIT 1',
      [bookingId]
    );

    if (!room) {
      const result = await query(
        `INSERT INTO socket_chat_rooms
          (room_name, room_booking_id, room_owner_id, room_user_id, room_status)
         VALUES (?, ?, ?, ?, 'active')`,
        [`booking_${bookingId}`, bookingId, ownerId, ownerId]
      );
      room = await queryOne('SELECT * FROM socket_chat_rooms WHERE id = ?', [result.insertId]);
    }

    await this.addParticipant({ roomId: room.id, userId: room.room_owner_id });
    return room;
  },

  getRoomById(roomId) {
    return queryOne('SELECT * FROM socket_chat_rooms WHERE id = ?', [roomId]);
  },

  getRoomByBookingId(bookingId) {
    return queryOne('SELECT * FROM socket_chat_rooms WHERE room_booking_id = ?', [bookingId]);
  },

  /** Add or reactivate any user joining an existing booking room. */
  async addParticipant({ roomId, userId }) {
    await query(
      `INSERT INTO socket_chat_participants (chat_room_id, participant_user_id)
       VALUES (?, ?) ON DUPLICATE KEY UPDATE participant_status = 'active'`,
      [roomId, userId]
    );
    return this.getParticipantByUserId({ roomId, userId });
  },

  getParticipantByUserId({ roomId, userId }) {
    return queryOne(
      `SELECT * FROM socket_chat_participants
       WHERE chat_room_id = ? AND participant_user_id = ? AND participant_status = 'active'
       LIMIT 1`,
      [roomId, userId]
    );
  },

  getRoomParticipants(roomId) {
    return query(
      `SELECT * FROM socket_chat_participants
       WHERE chat_room_id = ? AND participant_status = 'active'`,
      [roomId]
    );
  },

  async createMessage({ roomId, senderId, conversationUserId, message, messageType = 'text', attachmentUrl = null }) {
    const result = await query(
      `INSERT INTO socket_chat_messages
        (chat_room_id, chat_sender_id, chat_conversation_user_id,
         chat_message, chat_message_type, chat_attachment_url, chat_message_status)
       VALUES (?, ?, ?, ?, ?, ?, 'sent')`,
      [roomId, senderId, conversationUserId, message, messageType, attachmentUrl]
    );
    return queryOne('SELECT * FROM socket_chat_messages WHERE id = ?', [result.insertId]);
  },

  /** Return only messages where the authenticated user is sender or recipient. */
  async getRoomMessages({ roomId, userId, receiverId, limit = 50, offset = 0 }) {
    const safeRoomId = Number(roomId);
    const safeUserId = Number(userId);
    const safeReceiverId = receiverId ? Number(receiverId) : null;
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const safeOffset = Math.max(Number(offset) || 0, 0);

    // Agar receiverId bhi diya hai to sirf (userId <-> receiverId) ke beech ke messages aayenge
    if (safeReceiverId) {
      return query(
        `SELECT
           m.id,
           m.chat_room_id,
           m.chat_sender_id,
           m.chat_conversation_user_id,
           m.chat_message,
           m.chat_message_type,
           m.chat_attachment_url,
           m.chat_message_status,
           m.chat_delivered_at,
           m.chat_read_at,
           m.created_at,
           m.updated_at
         FROM socket_chat_messages m
         WHERE m.chat_room_id = ?
           AND (
             (m.chat_sender_id = ? AND m.chat_conversation_user_id = ?)
             OR
             (m.chat_conversation_user_id = ? AND m.chat_sender_id = ?)
           )
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT ? OFFSET ?`,
        [
          safeRoomId,
          safeUserId,
          safeReceiverId,
          safeReceiverId,
          safeUserId,
          safeLimit,
          safeOffset,
        ]
      );
    }

    // Agar receiverId nahi diya (jaise room owner ka full room view) to userId se jude saare messages
    return query(
      `SELECT
         m.id,
         m.chat_room_id,
         m.chat_sender_id,
         m.chat_conversation_user_id,
         m.chat_message,
         m.chat_message_type,
         m.chat_attachment_url,
         m.chat_message_status,
         m.chat_delivered_at,
         m.chat_read_at,
         m.created_at,
         m.updated_at
       FROM socket_chat_messages m
       WHERE m.chat_room_id = ?
         AND (m.chat_sender_id = ? OR m.chat_conversation_user_id = ?)
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT ? OFFSET ?`,
      [safeRoomId, safeUserId, safeUserId, safeLimit, safeOffset]
    );
  },

  /** Mark messages in the current user's visible conversation as read. */
  async markRoomAsRead({ roomId, userId }) {
    const rows = await query(
      `SELECT id FROM socket_chat_messages
       WHERE chat_room_id = ? AND chat_sender_id != ?
         AND chat_conversation_user_id = ? AND chat_message_status != 'read'`,
      [roomId, userId, userId]
    );
    if (!rows.length) return [];

    const ids = rows.map((row) => row.id);
    await withTransaction(async (conn) => {
      for (const id of ids) {
        await conn.execute(
          `INSERT INTO socket_message_receipts
             (receipt_message_id, receipt_user_id, receipt_status)
           VALUES (?, ?, 'read')
           ON DUPLICATE KEY UPDATE receipt_status = 'read', updated_at = UTC_TIMESTAMP()`,
          [id, userId]
        );
      }
      await conn.execute(
        `UPDATE socket_chat_messages
         SET chat_message_status = 'read', chat_read_at = UTC_TIMESTAMP()
         WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
    });
    return ids;
  },

  async markDelivered({ messageId, userId }) {
    const result = await query(
      `UPDATE socket_chat_messages
       SET chat_message_status = 'delivered', chat_delivered_at = UTC_TIMESTAMP()
       WHERE id = ? AND chat_conversation_user_id = ? AND chat_message_status = 'sent'`,
      [messageId, userId]
    );

    if (result.affectedRows) {
      await query(
        `INSERT INTO socket_message_receipts
           (receipt_message_id, receipt_user_id, receipt_status)
         VALUES (?, ?, 'delivered')
         ON DUPLICATE KEY UPDATE
           receipt_status = IF(receipt_status = 'read', 'read', 'delivered'),
           updated_at = UTC_TIMESTAMP()`,
        [messageId, userId]
      );
    }

    return queryOne('SELECT * FROM socket_chat_messages WHERE id = ?', [messageId]);
  },

  async markPendingDeliveredForUser(userId) {
    const messages = await query(
      `SELECT * FROM socket_chat_messages
       WHERE chat_conversation_user_id = ? AND chat_message_status = 'sent'
       ORDER BY id ASC`,
      [userId]
    );
    if (!messages.length) return [];

    await withTransaction(async (conn) => {
      for (const message of messages) {
        await conn.execute(
          `UPDATE socket_chat_messages
           SET chat_message_status = 'delivered', chat_delivered_at = UTC_TIMESTAMP()
           WHERE id = ? AND chat_message_status = 'sent'`,
          [message.id]
        );
        await conn.execute(
          `INSERT INTO socket_message_receipts
             (receipt_message_id, receipt_user_id, receipt_status)
           VALUES (?, ?, 'delivered')
           ON DUPLICATE KEY UPDATE
             receipt_status = IF(receipt_status = 'read', 'read', 'delivered'),
             updated_at = UTC_TIMESTAMP()`,
          [message.id, userId]
        );
      }
    });

    return query(
      `SELECT * FROM socket_chat_messages WHERE id IN (${messages.map(() => '?').join(',')})`,
      messages.map((message) => message.id)
    );
  },
};

module.exports = ChatModel;

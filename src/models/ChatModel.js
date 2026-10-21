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

  /** Owners see every thread; participants see only their owner thread. */
  getRoomMessages({ roomId, userId, limit = 50, offset = 0 }) {
    return query(
      `SELECT m.* FROM socket_chat_messages m
       WHERE m.chat_room_id = ? AND
        (EXISTS (
          SELECT 1 FROM socket_chat_rooms r
          WHERE r.id = m.chat_room_id AND r.room_owner_id = ?
        ) OR m.chat_conversation_user_id = ?)
       ORDER BY m.created_at DESC LIMIT ? OFFSET ?`,
      [roomId, userId, userId, limit, offset]
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

  markDelivered(messageId) {
    return query(
      `UPDATE socket_chat_messages
       SET chat_message_status = 'delivered', chat_delivered_at = UTC_TIMESTAMP()
       WHERE id = ? AND chat_message_status = 'sent'`,
      [messageId]
    );
  },
};

module.exports = ChatModel;

'use strict';

const ChatModel = require('../models/ChatModel');
const UserModel = require('../models/UserModel');

/**
 * Booking chat business rules.
 *
 * Chat deliberately uses user IDs only. Socket authentication may still keep
 * a role for presence/authentication, but the chat room never reads or stores
 * customer/driver/vendor type values.
 */
const ChatService = {
  /**
   * Create the single room for a booking.
   *
   * Call this from the booking-created server flow with the authenticated
   * booking creator's ID. The owner ID must not come from an app payload.
   */
  async createRoom({ bookingId, userId }) {
    if (!bookingId) throw new Error('bookingId is required to create a chat room');
    if (!userId) throw new Error('Authenticated user is required to create a chat room');

    return ChatModel.findOrCreateRoom({
      bookingId: Number(bookingId),
      ownerId: Number(userId),
    });
  },

  /**
   * Join an existing booking room.
   *
   * The client sends only bookingId/roomId. The joining user is taken from
   * socket authentication and is automatically added as a participant. Any
   * authenticated user may join a room that already exists.
   */
  async joinRoom({ roomId, bookingId, userId }) {
    const callerId = Number(userId);
    const room = roomId
      ? await ChatModel.getRoomById(Number(roomId))
      : await ChatModel.getRoomByBookingId(Number(bookingId));

    if (!room) throw new Error(`Booking room ${bookingId || roomId} does not exist`);
    if (room.room_status === 'closed') throw new Error(`Room ${room.id} is closed`);

    const isOwner = room.room_owner_id === callerId;
    if (!isOwner) await ChatModel.addParticipant({ roomId: room.id, userId: callerId });

    return {
      room,
      isOwner,
      participant: await ChatModel.getParticipantByUserId({ roomId: room.id, userId: callerId }),
    };
  },

  /** Verify that the authenticated user belongs to this room. */
  async assertRoomAccess({ roomId, userId }) {
    const room = await ChatModel.getRoomById(Number(roomId));
    if (!room) throw new Error(`Room ${roomId} not found`);
    if (room.room_status === 'closed') throw new Error(`Room ${roomId} is closed`);

    const callerId = Number(userId);
    const isOwner = room.room_owner_id === callerId;
    const participant = await ChatModel.getParticipantByUserId({ roomId: room.id, userId: callerId });
    if (!isOwner && !participant) throw new Error(`Access denied: user ${callerId} is not a participant of room ${roomId}`);

    return { room, isOwner };
  },
  /**
   * Return the active numeric user IDs in a room.
   * Access is checked first so an arbitrary user cannot enumerate members.
   */
  async getParticipants({ roomId, userId }) {
    const { room } = await this.assertRoomAccess({ roomId, userId });
    const participantRows = await ChatModel.getRoomParticipants(room.id);
    const users = await UserModel.findByIds(participantRows.map((participant) => participant.participant_user_id));
    const usersById = new Map(users.map((user) => [Number(user.id), user]));

    return participantRows.map((participant) => {
      const participantUserId = Number(participant.participant_user_id);
      return {
        userId: participantUserId,
        name: usersById.get(participantUserId)?.name || null,
        joinedAt: participant.joined_at,
        isOwner: participantUserId === room.room_owner_id,
      };
    });
  },

  /**
   * Save a message in the correct owner conversation.
   * Participants always message the owner. The owner selects only a target
   * user ID; no participant type is required or accepted.
   */
  async sendMessage({ roomId, senderId, toUserId, message, messageType, attachmentUrl }) {
    const access = await this.assertRoomAccess({ roomId, userId: senderId });
    const conversationUserId = access.isOwner ? Number(toUserId) : access.room.room_owner_id;

    if (!conversationUserId) throw new Error('Owner must provide toUserId');
    if (access.isOwner && !(await ChatModel.getParticipantByUserId({ roomId: access.room.id, userId: conversationUserId }))) {
      throw new Error('toUserId is not an active participant in this booking room');
    }

    return ChatModel.createMessage({
      roomId: Number(roomId),
      senderId: Number(senderId),
      conversationUserId,
      message,
      messageType,
      attachmentUrl,
    });
  },

  /** Return history visible to the authenticated user ID. */
  async getRoomHistory({ roomId, userId, page = 1, perPage = 50 }) {
    const rows = await ChatModel.getRoomMessages({
      roomId: Number(roomId),
      userId: Number(userId),
      limit: Number(perPage),
      offset: (Number(page) - 1) * Number(perPage),
    });
    return rows.reverse();
  },

  markRoomRead({ roomId, userId }) {
    return ChatModel.markRoomAsRead({ roomId: Number(roomId), userId: Number(userId) });
  },

  markDelivered({ messageId, userId }) {
    return ChatModel.markDelivered({
      messageId: Number(messageId),
      userId: Number(userId),
    });
  },

  markPendingDeliveredForUser(userId) {
    return ChatModel.markPendingDeliveredForUser(Number(userId));
  },
};

module.exports = ChatService;

'use strict';

const ChatService = require('../../services/ChatService');
const { SOCKET_EVENTS } = require('../events/eventNames');
const { success, failure } = require('../../utils/response');
const logger = require('../../utils/logger');

const EV = SOCKET_EVENTS.CHAT;
const ioRoom = (roomId) => `chat_room:${roomId}`;
const ack = (callback, payload) => { if (typeof callback === 'function') callback(payload); };

function addLiveSocketDetails(participants, io) {
  const socketIdsByUser = new Map();
  for (const client of io.sockets.sockets.values()) {
    const userId = Number(client.data.userId);
    if (!userId) continue;
    const socketIds = socketIdsByUser.get(userId) || [];
    socketIds.push(client.id);
    socketIdsByUser.set(userId, socketIds);
  }

  return participants.map((participant) => {
    const socketIds = socketIdsByUser.get(Number(participant.userId)) || [];
    return {
      ...participant,
      socketId: socketIds[0] || null,
      socketIds,
      isOnline: socketIds.length > 0,
    };
  });
}

/** A message is visible to the owner or to the participant conversation ID. */
function canReceiveMessage(socket, room, message) {
  return room.room_owner_id === socket.data.userId ||
    message.chat_conversation_user_id === socket.data.userId;
}

/** Emit a message only to users allowed to see that conversation thread. */
function emitMessage(io, room, message) {
  for (const client of io.sockets.sockets.values()) {
    if (client.rooms.has(ioRoom(room.id)) && canReceiveMessage(client, room, message)) {
      client.emit(EV.NEW_MESSAGE, success(message, 'New message'));
    }
  }
}

function registerChatHandlers(socket, io) {
  // Chat uses only the authenticated numeric user ID. The socket role may be
  // used by presence, but it is intentionally ignored by this chat module.
  const { userId } = socket.data;

  /**
   * Client payload: { bookingId } or { roomId }.
   * The room must already have been created by the booking flow.
   */
  socket.on(EV.JOIN_ROOM, async (data = {}, callback) => {
    try {
      const bookingId = Number(data.bookingId || data.orderId);
      if (!bookingId && !data.roomId) return ack(callback, failure('bookingId is required'));

      const result = await ChatService.joinRoom({
        roomId: data.roomId,
        bookingId,
        userId,
      });
      socket.join(ioRoom(result.room.id));

      const history = await ChatService.getRoomHistory({
        roomId: result.room.id,
        userId,
      });
      const participants = await ChatService.getParticipants({
        roomId: result.room.id,
        userId,
      });
      const participantsWithSocketDetails = addLiveSocketDetails(participants, io);
      socket.to(ioRoom(result.room.id)).emit(EV.ROOM_JOINED, {
        room: result.room,
        joinedBy: { userId },
        participant: participantsWithSocketDetails.find((participant) => participant.userId === userId),
      });
      // Broadcast the complete list so every open client updates immediately.
      io.to(ioRoom(result.room.id)).emit(EV.PARTICIPANTS_LIST, {
        roomId: result.room.id,
        participants: participantsWithSocketDetails,
      });
      ack(callback, success({ room: result.room, history, participants: participantsWithSocketDetails, isOwner: result.isOwner }, 'Room joined'));
    } catch (err) {
      logger.error(`[JOIN_ROOM] ${err.message}`);
      ack(callback, failure(err.message));
    }
  });

  /** Fetch the current participant list without joining again. */
  socket.on(EV.GET_PARTICIPANTS, async (data = {}, callback) => {
    try {
      const participants = await ChatService.getParticipants({ roomId: Number(data.roomId), userId });
      ack(callback, success(addLiveSocketDetails(participants, io), 'Participants fetched'));
    } catch (err) { ack(callback, failure(err.message)); }
  });

  socket.on(EV.LEAVE_ROOM, (data = {}, callback) => {
    if (data.roomId) socket.leave(ioRoom(Number(data.roomId)));
    ack(callback, success(null, 'Left room'));
  });

  /** Owner sends to toUserId; participants automatically send to the owner. */
  socket.on(EV.SEND_MESSAGE, async (data = {}, callback) => {
    try {
      if (!data.roomId || (!data.message && !data.attachmentUrl)) {
        return ack(callback, failure('roomId and message (or attachmentUrl) are required'));
      }

      const saved = await ChatService.sendMessage({
        roomId: Number(data.roomId),
        senderId: userId,
        toUserId: data.toUserId,
        message: data.message,
        messageType: data.messageType,
        attachmentUrl: data.attachmentUrl,
      });
      const room = (await ChatService.assertRoomAccess({ roomId: data.roomId, userId })).room;
      emitMessage(io, room, saved);
      ack(callback, success(saved, 'Message sent'));
    } catch (err) {
      logger.error(`[SEND_MESSAGE] ${err.message}`);
      ack(callback, failure(err.message));
    }
  });

  for (const [event, isTyping] of [[EV.TYPING_START, true], [EV.TYPING_STOP, false]]) {
    socket.on(event, async (data = {}) => {
      if (!data.roomId) return;
      try {
        await ChatService.assertRoomAccess({ roomId: data.roomId, userId });
        socket.to(ioRoom(Number(data.roomId))).emit(EV.USER_TYPING, {
          roomId: data.roomId,
          userId,
          isTyping,
        });
      } catch (_) { /* Do not leak room access errors through typing events. */ }
    });
  }

  socket.on(EV.MARK_READ, async (data = {}, callback) => {
    try {
      const messageIds = await ChatService.markRoomRead({ roomId: data.roomId, userId });
      if (messageIds.length) {
        io.to(ioRoom(Number(data.roomId))).emit(EV.MESSAGE_READ, {
          roomId: data.roomId,
          messageIds,
          readBy: { userId },
          readAt: new Date().toISOString(),
        });
      }
      ack(callback, success({ markedCount: messageIds.length }, 'Marked as read'));
    } catch (err) { ack(callback, failure(err.message)); }
  });

  socket.on(EV.GET_ROOM_HISTORY, async (data = {}, callback) => {
    try {
      await ChatService.assertRoomAccess({ roomId: data.roomId, userId });
      const history = await ChatService.getRoomHistory({ roomId: data.roomId, userId, page: Number(data.page || 1) });
      ack(callback, success(history, 'History fetched'));
    } catch (err) { ack(callback, failure(err.message)); }
  });

  socket.on(EV.GET_ORDER_ROOMS, async (data = {}, callback) => {
    try {
      const result = await ChatService.joinRoom({
        roomId: data.roomId,
        bookingId: Number(data.bookingId || data.orderId),
        userId,
      });
      ack(callback, success([result.room], 'Booking room fetched'));
    } catch (err) { ack(callback, failure(err.message)); }
  });
}

module.exports = { registerChatHandlers };

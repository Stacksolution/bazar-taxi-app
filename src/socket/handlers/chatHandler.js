'use strict';

const logger = require('../../utils/logger');

/**
 * Placeholder for the upcoming Chat module.
 *
 * Events (to be implemented):
 *   Client → Server:
 *     chat:send_message  — { toUserId, message, type }
 *     chat:typing        — { toUserId, isTyping }
 *     chat:read_receipt  — { messageId }
 *
 *   Server → Client:
 *     chat:new_message   — full message object
 *     chat:typing        — { fromUserId, isTyping }
 *     chat:message_read  — { messageId, readAt }
 *
 * @param {import('socket.io').Socket} socket
 * @param {import('socket.io').Server} io
 */
function registerChatHandlers(socket, io) {
  // TODO: Implement in the next sprint
  logger.debug(`[ChatHandler] Placeholder registered for socket ${socket.id}`);
}

module.exports = { registerChatHandlers };

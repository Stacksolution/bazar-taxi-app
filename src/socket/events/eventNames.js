'use strict';

/**
 * Centralised registry of every socket event name.
 * Use these constants in handlers and on the client to avoid typos.
 */
const SOCKET_EVENTS = {
  // ── Presence ──────────────────────────────────────────────────────────
  PRESENCE_USER_ONLINE    : 'presence:user_online',
  PRESENCE_USER_OFFLINE   : 'presence:user_offline',
  PRESENCE_GET_ONLINE_USERS : 'presence:get_online_users',

  // ── Chat (upcoming) ───────────────────────────────────────────────────
  CHAT_SEND_MESSAGE : 'chat:send_message',
  CHAT_NEW_MESSAGE  : 'chat:new_message',
  CHAT_TYPING       : 'chat:typing',
  CHAT_READ_RECEIPT : 'chat:read_receipt',
  CHAT_MESSAGE_READ : 'chat:message_read',

  // ── Ride / booking (future) ───────────────────────────────────────────
  RIDE_REQUEST        : 'ride:request',
  RIDE_ACCEPTED       : 'ride:accepted',
  RIDE_REJECTED       : 'ride:rejected',
  RIDE_LOCATION_UPDATE: 'ride:location_update',
  RIDE_COMPLETED      : 'ride:completed',

  // ── System ────────────────────────────────────────────────────────────
  ERROR : 'error',
};

module.exports = { SOCKET_EVENTS };

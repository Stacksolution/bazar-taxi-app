'use strict';

/**
 * @typedef {Object} SocketEventsRegistry
 * Centralised, immutable registry of all Socket.IO event names across the platform.
 * Follows the standard `module:action` namespace convention.
 */

const SOCKET_EVENTS = Object.freeze({
  // ── 1. PRESENCE & USER STATUS ──────────────────────────────────────────────
  PRESENCE: Object.freeze({
    USER_ONLINE       : 'presence:user_online',
    USER_OFFLINE      : 'presence:user_offline',
    GET_ONLINE_USERS  : 'presence:get_online_users',
    STATUS_CHANGE     : 'presence:status_change',
  }),

  // ── 2. REAL-TIME CHAT & MESSAGING ──────────────────────────────────────────
  CHAT: Object.freeze({
    // ── Room management (Client → Server, with ack) ──────────────────────
    JOIN_ROOM         : 'chat:join_room',          // { bookingId, roomId? } — identity comes from socket auth
    LEAVE_ROOM        : 'chat:leave_room',         // { roomId }
    GET_ROOM_HISTORY  : 'chat:get_room_history',   // { roomId, page? }
    GET_PARTICIPANTS  : 'chat:get_participants',   // { roomId }
    GET_ORDER_ROOMS   : 'chat:get_order_rooms',    // { bookingId } — returns the single booking room

    // ── Messaging (Client → Server, with ack) ────────────────────────────
    SEND_MESSAGE      : 'chat:send_message',       // { roomId, message, toUserId?, messageType?, attachmentUrl? }
    TYPING_START      : 'chat:typing_start',       // { roomId }
    TYPING_STOP       : 'chat:typing_stop',        // { roomId }
    MARK_READ         : 'chat:mark_read',          // { roomId } — marks all unread as read

    // ── Server → Client broadcasts ───────────────────────────────────────
    ROOM_JOINED       : 'chat:room_joined',        // full room object + history
    PARTICIPANTS_LIST : 'chat:participants_list',  // { roomId, participants }
    NEW_MESSAGE       : 'chat:new_message',        // new message object
    USER_TYPING       : 'chat:user_typing',        // { roomId, userId, isTyping }
    MESSAGE_READ      : 'chat:message_read',       // { roomId, messageIds, readBy, readAt }
    MESSAGE_DELIVERED : 'chat:message_delivered',  // { messageId, deliveredAt }
    ORDER_ROOMS_LIST  : 'chat:order_rooms_list',   // customer's room list for an order
  }),

  // ── 3. BOOKING / RIDE LIFECYCLE ───────────────────────────────────────────
  RIDE: Object.freeze({
    // Request & Discovery
    REQUEST           : 'ride:request',           // Customer creates booking
    NEW_FEED          : 'ride:new_feed',          // Broadcasted to nearby Vendors
    CANCEL            : 'ride:cancel',           // Ride cancelled by user/vendor

    // Lifecycle Actions
    ACCEPT            : 'ride:accept',
    ACCEPTED          : 'ride:accepted',
    REJECT            : 'ride:reject',
    REJECTED          : 'ride:rejected',
    ARRIVED           : 'ride:arrived',           // Driver reached pickup point
    START             : 'ride:start',             // OTP verification & trip start
    STARTED           : 'ride:started',
    COMPLETE          : 'ride:complete',          // Trip finished
    COMPLETED         : 'ride:completed',
    EXPIRED           : 'ride:expired',           // No vendor accepted in time
  }),

  // ── 4. MULTI-VENDOR BIDDING SYSTEM ───────────────────────────────────────
  BIDDING: Object.freeze({
    PLACE_BID         : 'bidding:place_bid',       // Vendor submits price offer
    UPDATE_BID        : 'bidding:update_bid',      // Vendor modifies price offer
    WITHDRAW_BID      : 'bidding:withdraw_bid',    // Vendor cancels offer
    NEW_BID_RECEIVED  : 'bidding:new_bid_received',// Customer sees new vendor offer
    ACCEPT_BID        : 'bidding:accept_bid',      // Customer confirms 1 vendor
    REJECT_BID        : 'bidding:reject_bid',      // Customer declines offer
    FINALIZED         : 'bidding:finalized',       // Deal locked, chat/ride initiated
  }),

  // ── 5. LIVE GPS TRACKING & TELEMETRY ─────────────────────────────────────
  TRACKING: Object.freeze({
    UPDATE_LOCATION   : 'tracking:update_location', // Vendor sends Lat/Lng
    LOCATION_CHANGED  : 'tracking:location_changed',// Broadcasted to Customer map
    ETA_UPDATED       : 'tracking:eta_updated',     // Estimated time update
  }),

  // ── 6. ROOM MANAGEMENT ──────────────────────────────────────────────────
  ROOM: Object.freeze({
    JOIN              : 'room:join',
    LEAVE             : 'room:leave',
    JOINED            : 'room:joined',
    LEFT              : 'room:left',
  }),

  // ── 7. SYSTEM & EXCEPTIONS ──────────────────────────────────────────────
  SYSTEM: Object.freeze({
    ERROR             : 'system:error',
    UNAUTHORIZED      : 'system:unauthorized',
    NOTIFICATION      : 'system:notification',
  }),
});

module.exports = { SOCKET_EVENTS };

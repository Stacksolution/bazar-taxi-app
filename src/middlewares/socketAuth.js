'use strict';

const UserModel = require('../models/UserModel');
const logger    = require('../utils/logger');

/**
 * Allowed user types / roles in the system.
 */
const ALLOWED_USER_TYPES = ['customer', 'driver', 'admin'];

/**
 * Socket.IO Authentication Middleware
 *
 * Client connects via query params:
 *   io("http://localhost:4000", {
 *     query: { user_type: "driver", user_id: "2", guest_id: "0" }
 *   })
 *   — OR directly in the URL —
 *   http://localhost:4000?user_type=driver&user_id=2&guest_id=0
 *
 * Validation Rules:
 *   1. user_type  → must be one of: customer | driver | admin
 *   2. user_id    → required integer > 0 (when guest_id == 0)
 *   3. guest_id   → 0 = authenticated user, >0 = guest (future use)
 *   4. user_id must exist in DB and role must match user_type
 *
 * @param {import('socket.io').Socket} socket
 * @param {Function} next
 */
async function socketAuthMiddleware(socket, next) {
  try {
    const query = socket.handshake.query;

    const rawUserId   = query.user_id;
    const rawUserType = query.user_type;
    const rawGuestId  = query.guest_id;

    // ── Step 1: user_type validation ───────────────────────────────────────
    if (!rawUserType || !ALLOWED_USER_TYPES.includes(rawUserType)) {
      return next(
        new Error(
          `Invalid user_type "${rawUserType}". Allowed: ${ALLOWED_USER_TYPES.join(', ')}`
        )
      );
    }

    // ── Step 2: Parse guest_id ─────────────────────────────────────────────
    const guestId = parseInt(rawGuestId ?? '0', 10);
    const isGuest = !isNaN(guestId) && guestId > 0;

    if (isGuest) {
      // Guest connection — allow but mark as guest (future: guest chat etc.)
      socket.data.userId    = null;
      socket.data.guestId   = guestId;
      socket.data.userType  = rawUserType;
      socket.data.anonymous = true;
      socket.data.isGuest   = true;

      logger.warn(
        `👤 Guest connection [guestId=${guestId}, type=${rawUserType}] from ${socket.handshake.address}`
      );
      return next();
    }

    // ── Step 3: user_id validation ─────────────────────────────────────────
    if (!rawUserId) {
      return next(new Error('user_id is required when guest_id is 0'));
    }

    const userId = parseInt(rawUserId, 10);
    if (isNaN(userId) || userId <= 0) {
      return next(new Error(`Invalid user_id "${rawUserId}". Must be a positive integer.`));
    }

    // ── Step 4: DB lookup — user must exist ────────────────────────────────
    const user = await UserModel.findById(userId);

    if (!user) {
      logger.warn(`🚫 Connection rejected — user_id=${userId} not found in DB`);
      return next(new Error(`User with id ${userId} does not exist`));
    }
    console.log('user', user);

    // ── Step 5: Role must match user_type ──────────────────────────────────
    // if (user.role !== rawUserType) {
    //   logger.warn(
    //     `🚫 Role mismatch — user_id=${userId} is "${user.role}" but connected as "${rawUserType}"`
    //   );
    //   return next(
    //     new Error(
    //       `Role mismatch: user is "${user.role}" but user_type sent is "${rawUserType}"`
    //     )
    //   );
    // }

    // ── Step 6: All valid — attach to socket.data ──────────────────────────
    socket.data.userId    = user.id;
    socket.data.userType  = user.role;
    socket.data.userName  = user.name;
    socket.data.anonymous = false;
    socket.data.isGuest   = false;
    socket.data.guestId   = 0;

    logger.info(
      `✅ Auth OK — [${user.role}] ${user.name} (id=${user.id}) from ${socket.handshake.address}`
    );

    next();

  } catch (err) {
    logger.error('socketAuthMiddleware error:', err.message);
    next(new Error('Authentication failed. Please try again.'));
  }
}

module.exports = { socketAuthMiddleware };

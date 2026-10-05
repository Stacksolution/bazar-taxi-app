'use strict';

/**
 * Async wrapper so Socket.IO handlers can use async/await
 * without uncaught promise rejections.
 *
 * Usage:
 *   socket.on('some:event', asyncHandler(async (data, callback) => { … }));
 */
function asyncHandler(fn) {
  return function (...args) {
    Promise.resolve(fn.apply(this, args)).catch((err) => {
      const callback = args[args.length - 1];
      if (typeof callback === 'function') {
        callback({ success: false, message: err.message });
      }
    });
  };
}

module.exports = { asyncHandler };

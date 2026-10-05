'use strict';

/**
 * Standardised API / socket response builder.
 */

/**
 * @param {any}    data
 * @param {string} [message]
 */
function success(data = null, message = 'Success') {
  return { success: true, message, data };
}

/**
 * @param {string} message
 * @param {any}    [errors]
 * @param {number} [code]
 */
function failure(message = 'Something went wrong', errors = null, code = 500) {
  return { success: false, message, errors, code };
}

module.exports = { success, failure };

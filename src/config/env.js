'use strict';

/**
 * Central environment variable loader.
 * All other modules import from here — never from process.env directly.
 */

const required = (key) => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env variable: ${key}`);
  return val;
};

module.exports = {
  // Server
  NODE_ENV : process.env.NODE_ENV   || 'development',
  PORT     : parseInt(process.env.PORT || '4000', 10),
  APP_NAME : process.env.APP_NAME   || 'BazarTaxiApp',

  // Database
  DB: {
    host            : process.env.DB_HOST             || 'localhost',
    port            : parseInt(process.env.DB_PORT    || '3306', 10),
    user            : process.env.DB_USER             || 'root',
    password        : process.env.DB_PASSWORD         || '',
    database        : process.env.DB_NAME             || 'bazar_taxi_db',
    connectionLimit : parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    waitForConnections: true,
    timezone        : 'Z',        // UTC — matches Laravel's default timestamp storage
  },

  // Socket
  SOCKET_CORS_ORIGIN: process.env.SOCKET_CORS_ORIGIN || '*',

  // JWT
  JWT_SECRET     : process.env.JWT_SECRET     || 'change_me_in_production',
  JWT_EXPIRES_IN : process.env.JWT_EXPIRES_IN || '7d',

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

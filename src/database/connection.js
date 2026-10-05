'use strict';

const mysql  = require('mysql2/promise');
const { DB } = require('../config/env');
const logger = require('../utils/logger');

/** Singleton connection pool */
let pool = null;

/**
 * Create the MySQL connection pool and verify connectivity.
 */
async function connectDatabase() {
  try {
    pool = mysql.createPool(DB);

    // Verify with a lightweight probe
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();

    logger.info(`✅ MySQL connected → ${DB.host}:${DB.port}/${DB.database}`);
  } catch (err) {
    logger.error('❌ MySQL connection failed:', err.message);
    throw err;
  }
}

/**
 * Returns the active pool. Throws if pool hasn't been initialised yet.
 */
function getPool() {
  if (!pool) throw new Error('Database pool is not initialised. Call connectDatabase() first.');
  return pool;
}

/**
 * Execute a query on the pool.
 * @param {string} sql
 * @param {any[]}  params
 */
async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

/**
 * Execute a query and return only the first row.
 */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] ?? null;
}

/**
 * Run multiple queries in a transaction.
 * @param {(conn: import('mysql2/promise').PoolConnection) => Promise<T>} callback
 */
async function withTransaction(callback) {
  const conn = await getPool().getConnection();
  await conn.beginTransaction();
  try {
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { connectDatabase, getPool, query, queryOne, withTransaction };

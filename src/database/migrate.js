'use strict';

/**
 * Minimal migration runner.
 * Reads schema.sql and executes it against the configured database.
 * Run with:  npm run db:migrate
 */

require('dotenv').config();

const fs      = require('fs');
const path    = require('path');
const mysql   = require('mysql2/promise');
const { DB }  = require('../config/env');

async function migrate() {
  const sqlFile = path.join(__dirname, 'schema.sql');
  const sql     = fs.readFileSync(sqlFile, 'utf8');

  // Split on semicolons, drop empty lines
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  // Connect without specifying a database first (so we can CREATE it)
  const conn = await mysql.createConnection({
    host    : DB.host,
    port    : DB.port,
    user    : DB.user,
    password: DB.password,
    multipleStatements: false,
  });

  console.log('🔄 Running migrations…');
  for (const stmt of statements) {
    try {
      await conn.query(stmt);
      console.log('  ✅', stmt.slice(0, 60).replace(/\n/g, ' '), '…');
    } catch (err) {
      console.error('  ❌', stmt.slice(0, 60));
      console.error('     Error:', err.message);
    }
  }

  await conn.end();
  console.log('✅ Migration complete');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

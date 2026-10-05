'use strict';

const winston = require('winston');
const path    = require('path');
const { LOG_LEVEL, NODE_ENV } = require('../config/env');

// ── Custom log levels ──────────────────────────────────────────────────────
const levels = {
  error  : 0,
  warn   : 1,
  info   : 2,
  http   : 3,
  socket : 4,
  debug  : 5,
};

const colors = {
  error  : 'red',
  warn   : 'yellow',
  info   : 'green',
  http   : 'magenta',
  socket : 'cyan',
  debug  : 'white',
};

winston.addColors(colors);

// ── Formatters ────────────────────────────────────────────────────────────
const prettyFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${extra}`;
  })
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// ── Transports ────────────────────────────────────────────────────────────
const transports = [
  // Console (pretty in dev, JSON in prod)
  new winston.transports.Console({
    format: NODE_ENV === 'production' ? jsonFormat : prettyFormat,
  }),
  // Persistent error file
  new winston.transports.File({
    filename : path.join(process.cwd(), 'logs', 'error.log'),
    level    : 'error',
    format   : jsonFormat,
    maxsize  : 5 * 1024 * 1024, // 5 MB
    maxFiles : 5,
  }),
  // Persistent combined file
  new winston.transports.File({
    filename : path.join(process.cwd(), 'logs', 'combined.log'),
    format   : jsonFormat,
    maxsize  : 10 * 1024 * 1024, // 10 MB
    maxFiles : 10,
  }),
];

// ── Logger instance ───────────────────────────────────────────────────────
const logger = winston.createLogger({
  level      : LOG_LEVEL,
  levels,
  transports,
  exitOnError: false,
});

module.exports = logger;

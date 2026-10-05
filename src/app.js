'use strict';

require('dotenv').config();
const { createServer } = require('./config/server');
const { connectDatabase } = require('./database/connection');
const { initializeSocket } = require('./socket');
const logger = require('./utils/logger');
const { APP_NAME, PORT } = require('./config/env');

/**
 * Bootstrap the entire application.
 */
async function bootstrap() {
  try {
    // 1. Connect to MySQL
    await connectDatabase();

    // 2. Create Express HTTP server
    const { app, httpServer } = createServer();

    // 3. Attach Socket.IO to HTTP server
    initializeSocket(httpServer);

    // 4. Start listening
    httpServer.listen(PORT, () => {
      logger.info(`🚀 ${APP_NAME} running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.warn(`${signal} received – shutting down gracefully…`);
      httpServer.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));

  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

bootstrap();

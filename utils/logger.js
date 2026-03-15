// utils/logger.js
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.info;

const logger = {
  error: (...args) => {
    if (currentLevel >= LOG_LEVELS.error) {
      console.error(`[${new Date().toISOString()}] [ERROR]`, ...args);
    }
  },
  
  warn: (...args) => {
    if (currentLevel >= LOG_LEVELS.warn) {
      console.warn(`[${new Date().toISOString()}] [WARN]`, ...args);
    }
  },
  
  info: (...args) => {
    if (currentLevel >= LOG_LEVELS.info) {
      console.log(`[${new Date().toISOString()}] [INFO]`, ...args);
    }
  },
  
  debug: (...args) => {
    if (currentLevel >= LOG_LEVELS.debug) {
      console.log(`[${new Date().toISOString()}] [DEBUG]`, ...args);
    }
  },
  
  // HTTP request logger
  http: (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
    });
    next();
  }
};

module.exports = logger;

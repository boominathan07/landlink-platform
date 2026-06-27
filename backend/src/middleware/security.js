const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

const sanitizeRequest = mongoSanitize();

// Express 5 exposes req.query via an IncomingMessage getter; express-mongo-sanitize reassigns it.
function mongoSanitizeMiddleware(req, res, next) {
  Object.defineProperty(req, 'query', {
    value: { ...req.query },
    writable: true,
    configurable: true,
    enumerable: true,
  });
  sanitizeRequest(req, res, next);
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many auth attempts. Please try again later.' },
});

const avatarUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many upload attempts. Please wait a few minutes and try again.' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Upload limit reached. Please try again in an hour.' },
});

function validateEnv() {
  const required = ['JWT_SECRET', 'MONGODB_URI'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.warn(`Warning: missing env vars: ${missing.join(', ')}`);
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    console.warn('Warning: JWT_SECRET should be at least 16 characters.');
  }
  if (process.env.NODE_ENV === 'production') {
    const prodRequired = ['JWT_SECRET', 'MONGODB_URI', 'FIREBASE_PROJECT_ID'];
    const prodMissing = prodRequired.filter((key) => !process.env[key]);
    if (prodMissing.length) {
      console.error(`Production missing required env vars: ${prodMissing.join(', ')}`);
    }
    if (process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production') {
      console.error('Production JWT_SECRET must be changed from the default placeholder.');
    }
  }
}

module.exports = {
  apiLimiter,
  authLimiter,
  avatarUploadLimiter,
  uploadLimiter,
  validateEnv,
  mongoSanitizeMiddleware,
};

require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  validateEnv,
  mongoSanitizeMiddleware,
} = require('./middleware/security');

validateEnv();

if (process.env.CLOUDINARY_CLOUD_NAME) {
  const cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  cloudinary.api.ping()
    .then(result => console.log('Cloudinary Connected:', result))
    .catch(err => console.error('Cloudinary Auth Failed:', err));
}


const { initSocket } = require('./services/socketService');
const { registerSocketHandlers } = require('./socket/handlers');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const settingsRoutes = require('./routes/settingsRoutes');
const plotRoutes = require('./routes/plots');
const bookingRoutes = require('./routes/bookings');
const documentRoutes = require('./routes/documents');
const notificationRoutes = require('./routes/notifications');
const subscriptionRoutes = require('./routes/subscription');
const analyticsRoutes = require('./routes/analytics');
const publicRoutes = require('./routes/public');


const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true },
});
initSocket(io);
registerSocketHandlers(io);

const clientOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: clientOrigins.length ? clientOrigins : 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(apiLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitizeMiddleware);

const uploadsDir = path.join(__dirname, '../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', async (_, res) => {
  const status = { status: 'ok', app: 'LandLink API', services: {} };
  try {
    status.services.mongodb = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  } catch {
    status.services.mongodb = 'error';
  }
  status.services.firebase = process.env.FIREBASE_PROJECT_ID ? 'configured' : 'missing';
  status.services.cloudinary = process.env.CLOUDINARY_CLOUD_NAME ? 'configured' : 'missing';
  res.json(status);
});

app.use('/api/public', publicRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/user', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/plots', plotRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? (status < 500 ? err.message : 'Internal server error')
    : (err.message || 'Internal server error');
  res.status(status).json({ message });
});

const PORT = process.env.PORT || 5000;

mongoose.connection.on('error', (err) => console.error('MongoDB error:', err));
mongoose.connection.on('connected', () => console.log('MongoDB connected'));

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    server.listen(PORT, () => console.log(`LandLink API running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });

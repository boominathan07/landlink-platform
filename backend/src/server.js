require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

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


const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true },
});
initSocket(io);
registerSocketHandlers(io);

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(__dirname, '../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (_, res) => res.json({ status: 'ok', app: 'LandLink API' }));

app.use('/api/auth', authRoutes);
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
  res.status(500).json({ message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/landlink')
  .then(() => {
    console.log('MongoDB connected');
    server.listen(PORT, () => console.log(`LandLink API running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });

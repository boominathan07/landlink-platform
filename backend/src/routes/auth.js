const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const UserSettings = require('../models/UserSettings');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/avatars';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${req.user._id}-${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

const router = express.Router();

const normalizeEmail = (email) => email?.trim().toLowerCase();

router.post(
  '/verify-token',
  [
    body('firebaseIdToken').isString().notEmpty(),
    body('role').optional().isIn(['owner', 'broker']),
    body('name').optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { role, name, firebaseIdToken } = req.body;
    let email = null;

    if (!process.env.FIREBASE_PROJECT_ID) {
      return res.status(500).json({ message: 'Firebase Admin not configured' });
    }

    try {
      const admin = require('firebase-admin');
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          }),
        });
      }
      const decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);
      if (!decodedToken.email) {
        return res.status(400).json({ message: 'No email found in Firebase token' });
      }
      email = normalizeEmail(decodedToken.email);
    } catch (error) {
      console.error("Token verification failed:", error);
      return res.status(401).json({ message: 'Invalid Firebase token' });
    }

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        email,
        name: name || '',
        role: role || 'owner',
      });
    } else if (name && !user.name) {
      user.name = name;
      await user.save();
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        plan: user.plan,
      },
    });
  }
);

router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user });
});

router.put('/me', auth, async (req, res) => {
  const { name, email, role } = req.body;
  if (name !== undefined) req.user.name = name;
  if (email !== undefined) req.user.email = email;
  if (role && ['owner', 'broker'].includes(role)) req.user.role = role;
  await req.user.save();
  res.json({ user: req.user });
});

router.get('/settings', auth, async (req, res) => {
  let settings = await UserSettings.findOne({ userId: req.user._id });
  if (!settings) {
    settings = await UserSettings.create({ userId: req.user._id });
  }
  res.json({ settings, user: req.user });
});

router.put('/profile', auth, async (req, res) => {
  const { name, email, phone } = req.body;
  if (name !== undefined) req.user.name = name;
  if (email !== undefined) req.user.email = email;
  if (phone !== undefined) req.user.phone = phone.replace(/\D/g, '').slice(-10);
  await req.user.save();
  res.json({ user: req.user });
});

router.put('/theme', auth, async (req, res) => {
  const { theme } = req.body;
  const settings = await UserSettings.findOneAndUpdate(
    { userId: req.user._id },
    { $set: { theme } },
    { new: true, upsert: true }
  );
  res.json({ settings });
});

router.put('/language', auth, async (req, res) => {
  const { language } = req.body;
  const settings = await UserSettings.findOneAndUpdate(
    { userId: req.user._id },
    { $set: { language } },
    { new: true, upsert: true }
  );
  res.json({ settings });
});

router.put('/notifications', auth, async (req, res) => {
  const { notifications } = req.body;
  const settings = await UserSettings.findOneAndUpdate(
    { userId: req.user._id },
    { $set: { notifications } },
    { new: true, upsert: true }
  );
  res.json({ settings });
});

router.post('/avatar', auth, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  
  try {
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'avatars',
    });
    
    try {
      fs.unlinkSync(req.file.path);
    } catch (err) {
      console.error('Failed to delete temp file:', err);
    }

    req.user.avatar = result.secure_url;
    await req.user.save();
    
    res.json({ avatarUrl: result.secure_url, user: req.user });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({ message: 'Upload failed' });
  }
});


router.put('/password', auth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  
  if (req.user.password) {
    const isMatch = await bcrypt.compare(oldPassword, req.user.password);
    if (!isMatch) return res.status(400).json({ message: 'Incorrect current password' });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  req.user.password = await bcrypt.hash(newPassword, 10);
  await req.user.save();
  
  res.json({ message: 'Password updated successfully' });
});


router.get('/cloudinary-info', async (req, res) => {
  try {
    const result = await cloudinary.api.usage();
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json(err);
  }
});
module.exports = router;

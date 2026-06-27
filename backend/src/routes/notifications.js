const express = require('express');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  const notifications = await Notification.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50);
  const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });
  res.json({ notifications, unreadCount });
});

router.put('/:id/read', async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { read: true },
    { new: true }
  );
  if (!notification) return res.status(404).json({ message: 'Not found' });
  res.json({ notification });
});

router.put('/read-all', async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
  res.json({ message: 'All marked as read' });
});

router.delete('/:id', async (req, res) => {
  const result = await Notification.deleteOne({ _id: req.params.id, userId: req.user._id });
  if (result.deletedCount === 0) return res.status(404).json({ message: 'Not found' });
  res.json({ message: 'Notification deleted' });
});

router.delete('/', async (req, res) => {
  await Notification.deleteMany({ userId: req.user._id });
  res.json({ message: 'All notifications cleared' });
});

module.exports = router;

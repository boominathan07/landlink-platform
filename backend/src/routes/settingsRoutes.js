const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Get all settings
router.get('/', auth, async (req, res) => {
  try {
    const settings = await Settings.find();
    const settingsMap = {};
    settings.forEach(s => {
      settingsMap[s.key] = s.value;
    });
    res.json({ success: true, settings: settingsMap });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update a setting (Owner only)
router.post('/', auth, roleCheck('owner'), async (req, res) => {
  try {
    const { key, value } = req.body;
    const updatedSetting = await Settings.findOneAndUpdate(
      { key },
      { value, updatedBy: req.user._id, updatedAt: Date.now() },
      { upsert: true, new: true }
    );
    res.json({ success: true, setting: updatedSetting });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;

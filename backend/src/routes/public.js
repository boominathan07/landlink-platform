const express = require('express');
const Project = require('../models/Project');
const Plot = require('../models/Plot');
const Document = require('../models/Document');
const User = require('../models/User');

const router = express.Router();

router.get('/stats', async (_req, res) => {
  try {
    const [projects, plots, brokers, documents] = await Promise.all([
      Project.countDocuments(),
      Plot.countDocuments(),
      User.countDocuments({ role: 'broker' }),
      Document.countDocuments(),
    ]);

    res.json({
      success: true,
      stats: { projects, plots, brokers, documents },
    });
  } catch (err) {
    console.error('Public stats error:', err);
    res.status(500).json({ success: false, message: 'Failed to load platform stats' });
  }
});

module.exports = router;

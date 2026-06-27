const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const sharp = require('sharp');

const Project = require('../models/Project');
const Plot = require('../models/Plot');
const User = require('../models/User');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { checkProjectLimit, checkBrokerLimit, requireFeature } = require('../middleware/planLimits');
const { getProjectForUser, isProjectOwner } = require('../utils/projectAccess');
const { processLayoutFile } = require('../services/pdfProcessor');
const { createNotification } = require('../services/notificationService');
const { getIO } = require('../services/socketService');
const { extractPlotMarkers } = require('../services/pdfExtractor');
const { analyzeClaudeVision, analyzeGoogleVision } = require('../services/visionService');
const Settings = require('../models/Settings');
const { validatePlot, validatePlotMinimal, dedupePlots, filterSpurious } = require('../services/plotOcrParser');
const {
  extractPlotsFromLayoutImage,
  resolveImagePath,
} = require('../services/layoutOcr');
const { runPlotExtraction, runPlotDetection } = require('../services/plotLayoutService');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});


const router = express.Router();
const { getUploadsDir } = require('../services/pdfProcessor');

async function extractPlotsHelper(imagePath) {
  console.log('Extracting plot table with PaddleOCR:', imagePath);
  const plots = await extractPlotsFromLayoutImage(imagePath);
  if (!plots || plots.length === 0) {
    throw new Error('Could not extract plot data from image. Ensure the image shows a clear table with plot numbers and cents.');
  }
  return { plots, engine: 'paddleocr-row-parser' };
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const layoutUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(getUploadsDir(), 'tmp');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      /\.(pdf|png|jpe?g|webp)$/i.test(file.originalname) ||
      ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('Only PDF, PNG, JPG, or WEBP files allowed'), ok);
  },
});

router.use(auth);

router.post('/', roleCheck('owner'), checkProjectLimit, async (req, res) => {
  const { name, location, totalArea, pricePerSqft } = req.body;
  const project = await Project.create({
    name,
    location,
    totalArea,
    pricePerSqft,
    createdBy: req.user._id,
    owners: [{ userId: req.user._id, ownershipPercent: 100, status: 'active' }],
  });
  res.status(201).json({ project });
});

router.get('/', async (req, res) => {
  try {
    let query;
    if (req.user.role === 'owner') {
      query = {
        $or: [{ createdBy: req.user._id }, { 'owners.userId': req.user._id, 'owners.status': 'active' }],
      };
    } else {
      query = { 'brokers.userId': req.user._id, 'brokers.status': 'active' };
    }

    const projects = await Project.find(query)
      .populate('createdBy', 'name')
      .populate('brokers.userId', 'name phone email')
      .sort({ createdAt: -1 });

    const withStats = await Promise.all(
      projects.map(async (p) => {
        const plots = await Plot.find({ projectId: p._id });
        return {
          ...p.toObject(),
          stats: {
            total: plots.length,
            available: plots.filter((pl) => pl.status === 'available').length,
            booked: plots.filter((pl) => pl.status === 'booked').length,
            sold: plots.filter((pl) => pl.status === 'sold').length,
            onHold: plots.filter((pl) => pl.status === 'hold').length,
          },
        };
      })
    );

    res.json({ projects: withStats });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to load projects' });
  }
});

// ⚠️  Must be BEFORE /:id to avoid route collision
router.get('/dashboard-analytics', roleCheck('owner'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const projects = await Project.find({
      $or: [{ createdBy: req.user._id }, { 'owners.userId': req.user._id, 'owners.status': 'active' }],
    });
    const projectIds = projects.map(p => p._id);
    const Booking = require('../models/Booking');
    
    const query = { projectId: { $in: projectIds }, status: { $in: ['completed', 'approved'] } };
    let bookings = await Booking.find(query)
      .populate('brokerId', 'name').populate('projectId', 'name');

    if (startDate || endDate) {
      const range = {};
      if (startDate) {
        const start = new Date(startDate);
        if (Number.isNaN(start.getTime())) return res.status(400).json({ message: 'Invalid startDate' });
        start.setHours(0, 0, 0, 0);
        range.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (Number.isNaN(end.getTime())) return res.status(400).json({ message: 'Invalid endDate' });
        end.setHours(23, 59, 59, 999);
        range.$lte = end;
      }
      bookings = bookings.filter((b) => {
        const d = new Date(b.completedAt || b.approvedAt || b.createdAt);
        if (range.$gte && d < range.$gte) return false;
        if (range.$lte && d > range.$lte) return false;
        return true;
      });
    }

    const revenue    = bookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const commissions = bookings.reduce((s, b) => s + (b.commissionAmount || 0), 0);

    const plots = await Plot.find({ projectId: { $in: projectIds } });
    const plotStats = {
      total:     plots.length,
      available: plots.filter(p => p.status === 'available').length,
      booked:    plots.filter(p => p.status === 'booked').length,
      sold:      plots.filter(p => p.status === 'sold').length,
      onHold:    plots.filter(p => p.status === 'hold').length,
    };

    const brokerMap = {};
    for (const b of bookings) {
      if (!b.brokerId) continue;
      const bid = b.brokerId._id.toString();
      if (!brokerMap[bid]) brokerMap[bid] = { name: b.brokerId.name || 'Unknown', bookings: 0, revenue: 0 };
      brokerMap[bid].bookings += 1;
      brokerMap[bid].revenue  += b.totalAmount || 0;
    }

    const monthlyData = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      monthlyData[key] = { month: d.toLocaleDateString('en', { month: 'short' }), revenue: 0, bookings: 0 };
    }
    for (const b of bookings) {
      const key = new Date(b.completedAt || b.createdAt).toISOString().slice(0, 7);
      if (monthlyData[key]) { 
        monthlyData[key].revenue += b.totalAmount || 0; 
        monthlyData[key].bookings += 1; 
      }
    }

    res.json({
      revenue, commissions, netRevenue: revenue - commissions,
      completedSales: bookings.length, plotStats,
      brokerPerformance: Object.values(brokerMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      monthlyStats: Object.values(monthlyData),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/invitations/pending', roleCheck('broker'), async (req, res) => {
  try {
    const projects = await Project.find({
      brokers: { $elemMatch: { userId: req.user._id, status: 'invited' } },
    }).populate('createdBy', 'name email');

    const invitations = projects.map((project) => {
      const entry = project.brokers.find(
        (b) => b.userId.toString() === req.user._id.toString() && b.status === 'invited'
      );
      return {
        projectId: project._id,
        projectName: project.name,
        ownerName: project.createdBy?.name || 'Project Owner',
        ownerEmail: project.createdBy?.email || '',
        invitedAt: entry?.invitedAt,
        commissionPercent: entry?.commissionPercent,
      };
    });

    res.json({ success: true, invitations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  const project = await getProjectForUser(req.params.id, req.user._id, req.user.role);
  if (!project) return res.status(404).json({ message: 'Project not found' });

  const plots = await Plot.find({ projectId: project._id }).sort({ plotNumber: 1 });
  res.json({ project, plots });
});

router.put('/:id', roleCheck('owner'), async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project || !isProjectOwner(project, req.user._id)) {
    return res.status(404).json({ message: 'Project not found' });
  }

  const fields = ['name', 'location', 'totalArea', 'pricePerSqft', 'pricePerCent', 'status'];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) project[f] = req.body[f];
  });
  await project.save();
  res.json({ project });
});



router.post('/:id/upload-pdf', roleCheck('owner'), (req, res, next) => {
  layoutUpload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Invalid file upload' });
    next();
  });
}, async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project || !isProjectOwner(project, req.user._id)) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    return res.status(404).json({ message: 'Project not found' });
  }
  if (!req.file) return res.status(400).json({ message: 'File required. Use field name "file".' });

  try {
    console.log('Layout upload:', req.file.originalname, req.file.size, 'bytes');
    const result = await processLayoutFile(req.file);
    project.pdfUrl = result.pdfUrl;
    project.imageUrl = result.imageUrl;
    project.layoutImageUrl = result.imageUrl;
    project.imageUrl = result.imageUrl;
    project.layoutPublicId = result.publicId || null;
    project.layoutWidth = result.width;
    project.layoutHeight = result.height;
    project.layoutUpdatedAt = new Date();
    // Clear stale plot grid so UI does not show data from a previous layout
    await Plot.deleteMany({ projectId: project._id });
    project.totalPlots = 0;
    await project.save();
    res.json({
      project,
      imageUrl: result.imageUrl,
      pdfUrl: result.pdfUrl,
      width: result.width,
      height: result.height,
    });
  } catch (err) {
    console.error('Layout upload failed:', err);
    res.status(500).json({ message: err.message || 'Upload failed' });
  } finally {
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    }
  }
});

router.post('/:id/invite-broker', roleCheck('owner'), checkBrokerLimit, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || !isProjectOwner(project, req.user._id)) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const { email, commissionPercent, name, phone } = req.body;
    if (!email?.trim()) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    if (!phone?.trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit phone number' });
    }

    const normalized = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalized });
    if (existingUser && existingUser.role === 'owner') {
      return res.status(400).json({
        success: false,
        message: 'This email is already registered. Cannot invite.',
      });
    }

    let broker = existingUser;
    if (!broker) {
      broker = await User.create({
        email: normalized,
        role: 'broker',
        name: name || 'Broker',
        phone: phoneDigits.slice(-10),
      });
    } else {
      if (broker.role !== 'broker') {
        return res.status(400).json({
          success: false,
          message: 'This email is already registered. Cannot invite.',
        });
      }
      if (name) broker.name = name;
      broker.phone = phoneDigits.slice(-10);
      await broker.save();
    }

    const existing = project.brokers.find((b) => b.userId.toString() === broker._id.toString());
    if (existing && existing.status !== 'revoked') {
      return res.status(400).json({ success: false, message: 'Broker already invited to this project' });
    }

    if (existing?.status === 'revoked') {
      existing.status = 'invited';
      existing.commissionPercent = commissionPercent ?? 2;
      existing.invitePhone = phoneDigits.slice(-10);
      existing.inviteName = name || broker.name;
      existing.inviteEmail = normalized;
      existing.invitedAt = new Date();
    } else {
      project.brokers.push({
        userId: broker._id,
        commissionPercent: commissionPercent ?? 2,
        status: 'invited',
        invitePhone: phoneDigits.slice(-10),
        inviteName: name || broker.name,
        inviteEmail: normalized,
      });
    }
    await project.save();

    await createNotification({
      userId: broker._id,
      type: 'broker_invited',
      title: 'Project invitation',
      message: `You've been invited to broker "${project.name}"`,
      data: { projectId: project._id },
      email: true,
    });

    res.json({ success: true, data: { project, broker }, message: 'Invite sent' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id/invitation', roleCheck('broker'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate('createdBy', 'name email');
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const entry = project.brokers.find(
      (b) => b.userId.toString() === req.user._id.toString() && b.status === 'invited'
    );
    if (!entry) {
      return res.status(404).json({ success: false, message: 'No pending invitation for this project' });
    }

    res.json({
      success: true,
      invitation: {
        projectId: project._id,
        projectName: project.name,
        ownerName: project.createdBy?.name || 'Project Owner',
        ownerEmail: project.createdBy?.email || '',
        invitedAt: entry.invitedAt,
        commissionPercent: entry.commissionPercent,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/brokers/accept', roleCheck('broker'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate('createdBy', 'name');
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const entry = project.brokers.find((b) => b.userId.toString() === req.user._id.toString());
    if (!entry || entry.status !== 'invited') {
      return res.status(400).json({ success: false, message: 'No pending invitation to accept' });
    }

    entry.status = 'active';
    await project.save();

    await createNotification({
      userId: project.createdBy._id,
      type: 'broker_accepted',
      title: 'Broker accepted invitation',
      message: `${req.user.name || 'A broker'} accepted the invitation to "${project.name}"`,
      data: { projectId: project._id, brokerId: req.user._id },
    });

    res.json({ success: true, message: 'Invitation accepted', project });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/brokers/decline', roleCheck('broker'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate('createdBy', 'name');
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

    const entry = project.brokers.find((b) => b.userId.toString() === req.user._id.toString());
    if (!entry || entry.status !== 'invited') {
      return res.status(400).json({ success: false, message: 'No pending invitation to decline' });
    }

    entry.status = 'revoked';
    await project.save();

    await createNotification({
      userId: project.createdBy._id,
      type: 'broker_declined',
      title: 'Broker declined invitation',
      message: `${req.user.name || 'A broker'} declined the invitation to "${project.name}"`,
      data: { projectId: project._id, brokerId: req.user._id },
    });

    res.json({ success: true, message: 'Invitation declined' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id/brokers/:brokerId/invite', roleCheck('owner'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || !isProjectOwner(project, req.user._id)) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const entry = project.brokers.find((b) => b.userId.toString() === req.params.brokerId);
    if (!entry || entry.status !== 'invited') {
      return res.status(400).json({ success: false, message: 'Only pending invites can be edited' });
    }

    const { email, name, phone, commissionPercent } = req.body;
    const broker = await User.findById(req.params.brokerId);
    if (!broker) return res.status(404).json({ success: false, message: 'Broker not found' });

    if (email) {
      const normalized = email.trim().toLowerCase();
      const conflict = await User.findOne({ email: normalized, _id: { $ne: broker._id } });
      if (conflict) {
        return res.status(400).json({ success: false, message: 'This email is already registered. Cannot invite.' });
      }
      broker.email = normalized;
      entry.inviteEmail = normalized;
    }
    if (name) { broker.name = name; entry.inviteName = name; }
    if (phone) {
      const digits = phone.replace(/\D/g, '').slice(-10);
      if (digits.length < 10) {
        return res.status(400).json({ success: false, message: 'Enter a valid phone number' });
      }
      broker.phone = digits;
      entry.invitePhone = digits;
    }
    if (commissionPercent != null) entry.commissionPercent = commissionPercent;

    await broker.save();
    await project.save();
    res.json({ success: true, data: { project, broker }, message: 'Invite updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/brokers/:brokerId/resend', roleCheck('owner'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || !isProjectOwner(project, req.user._id)) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const entry = project.brokers.find((b) => b.userId.toString() === req.params.brokerId);
    if (!entry || entry.status !== 'invited') {
      return res.status(400).json({ success: false, message: 'No pending invite to resend' });
    }

    entry.invitedAt = new Date();
    await project.save();

    await createNotification({
      userId: entry.userId,
      type: 'broker_invited',
      title: 'Invitation reminder',
      message: `Reminder: you've been invited to broker "${project.name}"`,
      data: { projectId: project._id },
      email: true,
    });

    res.json({ success: true, message: 'Invite resent' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id/brokers/:brokerId', roleCheck('owner'), async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project || !isProjectOwner(project, req.user._id)) {
    return res.status(404).json({ message: 'Project not found' });
  }

  const broker = project.brokers.find((b) => b.userId.toString() === req.params.brokerId);
  if (broker) broker.status = 'revoked';
  await project.save();
  res.json({ project });
});

router.post('/:id/invite-coowner', roleCheck('owner'), async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project || !isProjectOwner(project, req.user._id)) {
    return res.status(404).json({ message: 'Project not found' });
  }

  const { email, ownershipPercent, name } = req.body;
  const normalized = email.trim().toLowerCase();
  let coOwner = await User.findOne({ email: normalized });
  if (!coOwner) {
    coOwner = await User.create({ email: normalized, role: 'owner', name: name || '' });
  }

  const existing = project.owners.find((o) => o.userId.toString() === coOwner._id.toString());
  if (!existing) {
    project.owners.push({
      userId: coOwner._id,
      ownershipPercent: ownershipPercent ?? 0,
      status: 'invited',
    });
  }
  await project.save();
  res.json({ project });
});

router.get('/:id/analytics', roleCheck('owner'), requireFeature('analytics'), async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project || !isProjectOwner(project, req.user._id)) {
    return res.status(404).json({ message: 'Project not found' });
  }

  const Booking = require('../models/Booking');
  const bookings = await Booking.find({ projectId: project._id, status: 'completed' });

  const revenue = bookings.reduce((s, b) => s + b.totalAmount, 0);
  const commissions = bookings.reduce((s, b) => s + (b.commissionAmount || 0), 0);

  const brokerMap = {};
  for (const b of bookings) {
    const bid = b.brokerId.toString();
    if (!brokerMap[bid]) brokerMap[bid] = { bookings: 0, commission: 0, revenue: 0 };
    brokerMap[bid].bookings += 1;
    brokerMap[bid].commission += b.commissionAmount || 0;
    brokerMap[bid].revenue += b.totalAmount;
  }

  res.json({
    revenue,
    commissions,
    netRevenue: revenue - commissions,
    completedSales: bookings.length,
    brokerPerformance: Object.entries(brokerMap).map(([brokerId, stats]) => ({ brokerId, ...stats })),
    monthlyRevenue: bookings.reduce((acc, b) => {
      const month = new Date(b.completedAt || b.createdAt).toISOString().slice(0, 7);
      acc[month] = (acc[month] || 0) + b.totalAmount;
      return acc;
    }, {}),
  });
});

router.post('/:id/plots/generate', roleCheck('owner'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || !isProjectOwner(project, req.user._id)) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const {
      totalPlots, columns, defaultAreaSqft, defaultPrice,
      prefix, startNumber = 1, defaultFacing = 'East',
      cornerPlots = '', roadFacingPlots = '', notForSalePlots = '',
      plots: tablePlots
    } = req.body;

    let plotsToInsert = [];

    if (tablePlots && Array.isArray(tablePlots) && tablePlots.length > 0) {
      // Table-based grid generation
      const pricePerCentSetting = await Settings.findOne({ key: 'pricePerCent' });
      const pricePerCent = pricePerCentSetting ? parseFloat(pricePerCentSetting.value) : 10000;

      const cols = parseInt(columns) || 7;
      const seenPlotNumbers = new Set();
      let index = 0;

      for (let i = 0; i < tablePlots.length; i++) {
        const p = tablePlots[i];
        let plotNumber = String(p.plot_number || p.plotNumber || p.PlotNo || '').trim();
        
        if (!plotNumber) {
          plotNumber = String(i + 1);
        }
        
        if (seenPlotNumbers.has(plotNumber)) {
          let suffix = 1;
          let fallbackPlotNumber = `${plotNumber}-${suffix}`;
          while (seenPlotNumbers.has(fallbackPlotNumber)) {
            suffix++;
            fallbackPlotNumber = `${plotNumber}-${suffix}`;
          }
          plotNumber = fallbackPlotNumber;
        }
        
        seenPlotNumbers.add(plotNumber);

        const row = Math.floor(index / cols);
        const col = index % cols;
        const rows = Math.ceil(tablePlots.length / cols);
        const cent = parseFloat(p.cent || p.Cent || p.cents || 0) || null;
        const areaSqft = parseFloat(p.area || p.areaSqft || p.areaSqFeet || (cent ? cent * 435.6 : 0)) || null;
        const price = (cent || 0) * pricePerCent;
        const plotNumberInt = parseInt(plotNumber.replace(/\D/g, ''), 10) || index + 1;

        plotsToInsert.push({
          projectId: req.params.id,
          plotNumber,
          plotNumberInt,
          width: parseFloat(p.width || p.Width || p.widthMeters || 0) || null,
          length: parseFloat(p.length || p.Length || p.lengthMeters || 0) || null,
          widthMeters: parseFloat(p.widthMeters || p.width || p.Width || 0) || null,
          lengthMeters: parseFloat(p.lengthMeters || p.length || p.Length || 0) || null,
          cents: cent,
          cent,
          areaSqft,
          areaSqFeet: areaSqft,
          areaSqMeters: areaSqft ? Number((areaSqft / 10.7639).toFixed(2)) : null,
          needsReview: p.needsReview === true,
          price,
          plotType: 'regular',
          status: 'available',
          facing: 'North',
          gridPosition: { row, col },
          position: {
            x: (col / cols) * 100,
            y: (row / rows) * 100,
            width: 100 / cols,
            height: 100 / rows,
          },
        });
        index++;
      }
    } else {
      // Standard/Manual grid generation
      const cornerArr = cornerPlots ? cornerPlots.split(',').map(s => s.trim()) : [];
      const roadArr = roadFacingPlots ? roadFacingPlots.split(',').map(s => s.trim()) : [];
      const noSaleArr = notForSalePlots ? notForSalePlots.split(',').map(s => s.trim()) : [];

      const cols = parseInt(columns) || 7;
      const total = parseInt(totalPlots) || 35;
      let num = parseInt(startNumber) || 1;

      for (let row = 0; ; row++) {
        for (let col = 0; col < cols; col++) {
          if (plotsToInsert.length >= total) break;
          const plotNumber = prefix ? `${prefix}-${num}` : `${num}`;
          const isCorner = cornerArr.includes(plotNumber);
          const isRoad = roadArr.includes(plotNumber);
          const isNoSale = noSaleArr.includes(plotNumber);
          const price = (isCorner || isRoad)
            ? Math.round(parseInt(defaultPrice) * 1.1)
            : parseInt(defaultPrice);

          plotsToInsert.push({
            projectId: req.params.id,
            plotNumber,
            areaSqft: parseInt(defaultAreaSqft) || 1200,
            price,
            plotType: isCorner ? 'corner' : isRoad ? 'road_facing' : isNoSale ? 'not_for_sale' : 'regular',
            status: isNoSale ? 'not_for_sale' : 'available',
            facing: defaultFacing,
            gridPosition: { row, col },
          });
          num++;
        }
        if (plotsToInsert.length >= total) break;
      }
    }

    await Plot.deleteMany({ projectId: req.params.id });
    const created = await Plot.insertMany(plotsToInsert);
    const gridCols = parseInt(columns) || 7;
    const gridRows = Math.ceil(created.length / gridCols);
    await Project.findByIdAndUpdate(req.params.id, {
      totalPlots: created.length,
      gridCols,
      gridRows,
    });

    const io = getIO();
    io.to(`project:${req.params.id}`).emit('plots:generated', { count: created.length });

    res.json({ success: true, count: created.length, plots: created });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', roleCheck('owner'), async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project || !isProjectOwner(project, req.user._id)) {
    return res.status(404).json({ message: 'Project not found' });
  }

  await Plot.deleteMany({ projectId: project._id });
  await Project.findByIdAndDelete(req.params.id);

  res.json({ message: 'Project and all associated plots deleted' });
});

router.post('/:id/extract-table', roleCheck('owner'), (req, res, next) => {
  layoutUpload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Invalid image upload' });
    next();
  });
}, async (req, res) => {
  let uploadedPath = null;
  try {
    const project = await Project.findById(req.params.id);

    if (!project || !isProjectOwner(project, req.user._id)) {
      return res.status(404).json({ message: 'Project not found' });
    }

    let result;

    if (req.file) {
      uploadedPath = req.file.path;
      console.log('extract-table: using uploaded image', uploadedPath);
      const extraction = await extractPlotsHelper(uploadedPath);
      result = {
        success: true,
        total_plots: extraction.plots.length,
        plots: extraction.plots,
        processing_time: 0,
        engine: extraction.engine,
        needsReviewCount: extraction.plots.filter((p) => p.needsReview).length,
      };
    } else {
      return res.status(400).json({
        message: 'Upload a plot table image or PDF with the request. Blueprint layouts are not used for OCR.',
      });
    }

    res.json(result);
  } catch (err) {
    console.error('Table extraction failed:', err);
    res.status(500).json({ message: err.message || 'Table extraction failed' });
  } finally {
    if (uploadedPath) {
      try { await fs.promises.unlink(uploadedPath); } catch { /* ignore */ }
    }
  }
});

router.post('/:id/analyze-layout', roleCheck('owner'), (req, res, next) => {
  layoutUpload.single('image')(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message || 'Invalid image upload' });
    next();
  });
}, async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project || !isProjectOwner(project, req.user._id)) {
    if (req.file?.path) try { await fs.promises.unlink(req.file.path); } catch { /* ignore */ }
    return res.status(404).json({ message: 'Project not found' });
  }
  if (!req.file) return res.status(400).json({ message: 'Image file required. Use field name "image".' });

  const imagePath = req.file.path;
  console.log('analyze-layout: processing', imagePath, 'size', req.file.size);

  try {
    const extraction = await extractPlotsHelper(imagePath);
    const rawExtractedPlots = extraction.plots;

    if (!rawExtractedPlots || rawExtractedPlots.length === 0) {
      return res.status(400).json({ 
        message: 'Could not extract plot data from image. Please ensure image shows a clear table.' 
      });
    }

    const sanitizedPlots = rawExtractedPlots.map((p) => {
      const plotNumStr = String(p.plotNumber || p.plot_number || '').trim();
      const plotNum = parseInt(plotNumStr.replace(/\D/g, ''), 10);
      if (!Number.isFinite(plotNum) || plotNum < 1) return null;
      
      const width = parseFloat(p.widthMeters || p.width || p.width_meters || p.width_m) || null;
      const length = parseFloat(p.lengthMeters || p.length || p.length_meters || p.length_m) || null;
      const areaSqFt = parseFloat(p.areaSqFeet || p.areaSqft || p.area || p.area_sqft) || null;
      
      let cents = parseFloat(p.cents || p.cent || p.cents_value) || null;
      if (!cents && areaSqFt) {
        cents = Number((areaSqFt / 435.6).toFixed(2));
      }
      if (!areaSqFt && cents) {
        areaSqFt = Number((cents * 435.6).toFixed(2));
      }
      
      let areaSqM = parseFloat(p.areaSqMeters || p.area_sqm || p.areaSqM) || null;
      if (!areaSqM && areaSqFt) {
        areaSqM = Number((areaSqFt / 10.7639).toFixed(2));
      }

      return {
        plotNumber: String(plotNum),
        widthMeters: width,
        lengthMeters: length,
        areaSqMeters: areaSqM,
        areaSqFeet: areaSqFt,
        cents,
        needsReview: p.needsReview === true || !Number.isFinite(cents),
      };
    }).filter(Boolean);

    const extractedPlots = filterSpurious(dedupePlots(
      sanitizedPlots.filter((p) =>
        validatePlotMinimal(p) ||
        validatePlot({
          plotNumber: p.plotNumber,
          widthMeters: p.widthMeters,
          lengthMeters: p.lengthMeters,
          areaSqFeet: p.areaSqFeet,
          areaSqMeters: p.areaSqMeters,
          cents: p.cents,
        }, false) ||
        validatePlot({
          plotNumber: p.plotNumber,
          widthMeters: p.widthMeters,
          lengthMeters: p.lengthMeters,
          areaSqFeet: p.areaSqFeet,
          areaSqMeters: p.areaSqMeters,
          cents: p.cents,
        }, true)
      )
    ));

    if (extractedPlots.length < 2) {
      return res.status(400).json({
        message: 'Extraction failed: less than 2 plots detected. Please ensure image shows a clear table.',
      });
    }

    // Reject only when multiple plots share the same full record fingerprint (not just null areas)
    const fingerprint = (p) =>
      [p.plotNumber, p.widthMeters, p.lengthMeters, p.areaSqFeet, p.cents].join('|');
    const fingerprints = extractedPlots.map(fingerprint);
    const uniqueFingerprints = new Set(fingerprints);
    const uniquePlotNumbers = new Set(extractedPlots.map((p) => p.plotNumber));

    if (
      uniquePlotNumbers.size < extractedPlots.length ||
      (uniqueFingerprints.size === 1 &&
        extractedPlots.length > 1 &&
        extractedPlots[0].widthMeters != null &&
        extractedPlots[0].areaSqFeet != null)
    ) {
      return res.status(400).json({
        message: 'Extraction returned identical data for all plots — likely OCR failure. Try a clearer table image or use Auto-Detect Plots on the Map tab.',
      });
    }

    console.log(`OCR detected ${extractedPlots.length} validated unique plots`);

    // Debug Mode: Add console logs
    console.log('Total plots:', extractedPlots.length);
    console.log('First plot:', extractedPlots[0]);
    console.log('Last plot:', extractedPlots[extractedPlots.length - 1]);

    // CRITICAL FIX: Sort plots by numeric plot number before saving
    extractedPlots.sort((a, b) => {
      const na = parseInt(String(a.plotNumber).replace(/\D/g, '')) || 0;
      const nb = parseInt(String(b.plotNumber).replace(/\D/g, '')) || 0;
      return na - nb;
    });

    // Calculate grid layout
    const total = extractedPlots.length;
    const cols = total <= 10 ? total : total <= 25 ? 5 : total <= 50 ? 10 : total <= 100 ? 10 : Math.ceil(Math.sqrt(total));
    const rows = Math.ceil(total / cols);

    const pricePerCent = project.pricePerCent || 10000;

    // Build plot documents — NO facing field
    const seenPlotNumbers = new Set();
    const plotDocs = extractedPlots.map((p, idx) => {
      const plotNumber = String(p.plotNumber).trim();
      seenPlotNumbers.add(plotNumber);
      
      return {
        projectId: req.params.id,
        plotNumber: plotNumber,
        plotNumberInt: parseInt(plotNumber.replace(/\D/g, '')) || idx + 1,
        widthMeters: parseFloat(p.widthMeters) || null,
        lengthMeters: parseFloat(p.lengthMeters) || null,
        areaSqMeters: parseFloat(p.areaSqMeters) || null,
        areaSqFeet: parseFloat(p.areaSqFeet) || null,
        cents: parseFloat(p.cents) || null,
        needsReview: p.needsReview === true,
      
        // Backward compatibility aliases
        length: parseFloat(p.lengthMeters) || null,
        width: parseFloat(p.widthMeters) || null,
        cent: parseFloat(p.cents) || null,
        areaSqft: parseFloat(p.areaSqFeet) || null,
        price: (parseFloat(p.cents) || 0) * pricePerCent,

        gridPosition: {
          row: Math.floor(idx / cols),
          col: idx % cols
        },
        position: {
          x: (idx % cols) / cols * 100,
          y: Math.floor(idx / cols) / rows * 100,
          width: 100 / cols,
          height: 100 / rows
        },
        plotType: 'regular',
        status: 'available',
      };
    });

    // Save to DB — delete old plots first
    await Plot.deleteMany({ projectId: req.params.id });
    const savedPlots = await Plot.insertMany(plotDocs);

    // Save plot data only — OCR upload file is ephemeral and must not become blueprint
    await Project.findByIdAndUpdate(req.params.id, {
      totalPlots: total,
      gridCols: cols,
      gridRows: rows,
    });

    if (req.file?.path) {
      try { await fs.promises.unlink(req.file.path); } catch { /* ignore */ }
    }

    res.json({
      success: true,
      totalPlots: total,
      gridCols: cols,
      gridRows: rows,
      engine: extraction.engine,
      needsReviewCount: savedPlots.filter((p) => p.needsReview).length,
      plots: savedPlots,
    });

  } catch (err) {
    console.error('Plot analysis error:', err);
    // Cleanup on error
    if (req.file?.path) {
      try { await fs.promises.unlink(req.file.path); } catch { /* ignore */ }
    }
    res.status(500).json({
      success: false,
      message: err.message || 'Image analysis failed. Please try again with a clearer image.'
    });
  }
});

// Owner sets price per cent — all plot prices auto-calculate from this
router.patch('/:id/price-per-cent', roleCheck('owner'), async (req, res) => {
  try {
    const { pricePerCent } = req.body;
    if (pricePerCent === undefined || pricePerCent < 0) {
      return res.status(400).json({ message: 'Invalid price per cent value' });
    }
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { pricePerCent: parseFloat(pricePerCent) },
      { new: true }
    );

    // Update existing plot price caches in database
    const plots = await Plot.find({ projectId: project._id });
    for (const plot of plots) {
      plot.price = (plot.cent || plot.cents || 0) * project.pricePerCent;
      await plot.save();
    }

    res.json({ success: true, pricePerCent: project.pricePerCent });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/plots', async (req, res) => {
  try {
    // CRITICAL: always sort by plotNumberInt so grid order is correct
    const plots = await Plot.find({ projectId: req.params.id })
      .sort({ plotNumberInt: 1 })
      .lean();

    const project = await Project.findById(req.params.id).lean();

    res.json({
      plots,
      pricePerCent: project?.pricePerCent || 0,
      gridCols: project?.gridCols || 10,
      totalPlots: project?.totalPlots || plots.length
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/plots/:plotId/status', roleCheck('owner'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['available', 'hold', 'booked', 'sold', 'not_for_sale'].includes(status)) {
      return res.status(400).json({ message: 'Invalid plot status' });
    }
    const plot = await Plot.findOneAndUpdate(
      { _id: req.params.plotId, projectId: req.params.id },
      { status },
      { new: true }
    );
    if (!plot) return res.status(404).json({ message: 'Plot not found' });

    try {
      const io = getIO();
      if (io) {
        io.to(`project:${req.params.id}`).emit('plot:status_changed', {
          plotId: plot._id,
          projectId: req.params.id,
          newStatus: status,
          plot,
        });
      }
    } catch { /* ignore */ }

    res.json({ success: true, plot });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/layout', roleCheck('owner'), (req, res, next) => {
  layoutUpload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message || 'Invalid file upload' });
    next();
  });
}, async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project || !isProjectOwner(project, req.user._id)) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    return res.status(404).json({ success: false, message: 'Project not found' });
  }
  if (!req.file) return res.status(400).json({ success: false, message: 'File required' });

  try {
    const result = await processLayoutFile(req.file);
    project.layoutImageUrl = result.imageUrl;
    project.layoutPublicId = result.publicId || null;
    project.layoutWidth = result.width;
    project.layoutHeight = result.height;
    project.layoutUpdatedAt = new Date();
    await project.save();
    res.json({
      success: true,
      data: { project, layoutImageUrl: result.imageUrl, width: result.width, height: result.height },
      message: 'Layout uploaded',
    });
  } catch (err) {
    console.error('Layout upload failed:', err.message, err);
    res.status(500).json({ success: false, message: err.message || 'Upload failed' });
  } finally {
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    }
  }
});

router.get('/:id/layout', async (req, res) => {
  const project = await getProjectForUser(req.params.id, req.user._id, req.user.role);
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });
  res.json({
    success: true,
    data: {
      layoutImageUrl: project.layoutImageUrl,
      layoutUpdatedAt: project.layoutUpdatedAt,
      layoutWidth: project.layoutWidth,
      layoutHeight: project.layoutHeight,
    },
  });
});

router.delete('/:id/layout', roleCheck('owner'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || !isProjectOwner(project, req.user._id)) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (project.layoutPublicId && process.env.CLOUDINARY_CLOUD_NAME) {
      try {
        const { v2: cloudinary } = require('cloudinary');
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        });
        await cloudinary.uploader.destroy(project.layoutPublicId);
      } catch (err) {
        console.warn('Cloudinary delete failed:', err.message);
      }
    }

    await Plot.deleteMany({ projectId: project._id });
    project.layoutImageUrl = null;
    project.layoutPublicId = null;
    project.imageUrl = null;
    project.layoutWidth = null;
    project.layoutHeight = null;
    project.layoutUpdatedAt = new Date();
    project.totalPlots = 0;
    project.detectedPlotsPreview = [];
    await project.save();

    res.json({ success: true, message: 'Layout deleted' });
  } catch (err) {
    console.error('Layout delete error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/layout/process', roleCheck('owner'), (req, res, next) => {
  layoutUpload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
}, async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project || !isProjectOwner(project, req.user._id)) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    return res.status(404).json({ success: false, message: 'Project not found' });
  }

  let filePath = req.file?.path;
  try {
    if (req.body.replace === 'true' || req.body.replace === true) {
      await Plot.deleteMany({ projectId: project._id });
    }

    if (!filePath && project.imageUrl) {
      filePath = resolveImagePath(project.imageUrl);
    }
    if (!filePath) {
      return res.status(400).json({ success: false, message: 'Upload a layout file first' });
    }

    const extracted = await runPlotExtraction(filePath);
    if (!extracted.length) {
      return res.status(400).json({ success: false, message: 'No plots detected in layout' });
    }

    const pricePerCent = project.pricePerCent || 10000;
    const plotDocs = extracted.map((p, idx) => {
      const coords = p.coordinates || {};
      const size = p.size || {};
      return {
        projectId: project._id,
        plotNumber: String(p.plotNumber || idx + 1),
        plotNumberInt: parseInt(String(p.plotNumber).replace(/\D/g, ''), 10) || idx + 1,
        widthMeters: size.widthMeters || null,
        lengthMeters: size.lengthMeters || null,
        areaSqFeet: size.areaSqFeet || null,
        cents: size.cents || null,
        width: size.widthMeters || null,
        length: size.lengthMeters || null,
        cent: size.cents || null,
        areaSqft: size.areaSqFeet || null,
        price: (size.cents || 0) * pricePerCent,
        position: {
          x: coords.x ?? 0,
          y: coords.y ?? 0,
          width: coords.width ?? 5,
          height: coords.height ?? 5,
        },
        status: p.status || 'available',
        plotType: 'regular',
      };
    });

    if (req.body.replace === 'true' || req.body.replace === true) {
      await Plot.deleteMany({ projectId: project._id });
    }
    const saved = await Plot.insertMany(plotDocs);
    project.totalPlots = saved.length;
    project.layoutUpdatedAt = new Date();
    await project.save();

    res.json({ success: true, data: { plots: saved, count: saved.length }, message: 'Layout processed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Layout processing failed' });
  } finally {
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    }
  }
});

router.get('/:id/plots-map', async (req, res) => {
  const project = await getProjectForUser(req.params.id, req.user._id, req.user.role);
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

  const plots = await Plot.find({ projectId: project._id }).sort({ plotNumberInt: 1 }).lean();
  res.json({
    success: true,
    data: {
      layoutImageUrl: project.layoutImageUrl,
      layoutWidth: project.layoutWidth,
      layoutHeight: project.layoutHeight,
      plots: plots.map((p) => ({
        plotId: p._id,
        plotNumber: p.plotNumber,
        status: p.status,
        coordinates: p.position || { x: 0, y: 0, width: 5, height: 5 },
        size: {
          widthMeters: p.widthMeters,
          lengthMeters: p.lengthMeters,
          areaSqFeet: p.areaSqFeet,
          cents: p.cents,
        },
        price: p.price,
      })),
    },
  });
});

/** Resolve layout image to absolute URL or local path for Python detection */
function resolveLayoutSource(project) {
  const url = project.layoutImageUrl;
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const { resolveImagePath } = require('../services/layoutOcr');
  try {
    return resolveImagePath(url);
  } catch {
    const localPath = path.join(getUploadsDir(), path.basename(url));
    return fs.existsSync(localPath) ? localPath : null;
  }
}

router.post('/:id/auto-detect-plots', roleCheck('owner'), async (req, res) => {
  res.setTimeout(120000);
  try {
    const project = await Project.findById(req.params.id);
    if (!project || !isProjectOwner(project, req.user._id)) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const source = resolveLayoutSource(project);
    if (!source) {
      return res.status(400).json({ success: false, message: 'Upload a layout image first' });
    }

    console.log('Auto-detect plots from:', source);
    const { plots, width, height } = await runPlotDetection(source);

    if (!plots || plots.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Could not auto-detect plots. Please check image quality or upload manually.',
      });
    }

    project.detectedPlotsPreview = plots;
    if (width) project.layoutWidth = width;
    if (height) project.layoutHeight = height;
    await project.save();

    res.json({ success: true, plots, count: plots.length, layoutImageUrl: project.layoutImageUrl });
  } catch (err) {
    console.error('Auto-detect plots error:', err.message);
    res.status(400).json({ success: false, message: err.message || 'Plot detection failed' });
  }
});

router.get('/:id/detected-plots-preview', roleCheck('owner'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || !isProjectOwner(project, req.user._id)) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    res.json({
      success: true,
      plots: project.detectedPlotsPreview || [],
      layoutImageUrl: project.layoutImageUrl,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/confirm-plots', roleCheck('owner'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || !isProjectOwner(project, req.user._id)) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const incoming = req.body.plots || project.detectedPlotsPreview || [];
    if (!Array.isArray(incoming) || incoming.length < 1) {
      return res.status(400).json({ success: false, message: 'No plots to save' });
    }

    const pricePerCent = project.pricePerCent || 10000;
    const plotDocs = incoming.map((p, idx) => {
      const coords = p.coordinates || p.percentBounds || { x: p.x, y: p.y, width: p.width, height: p.height };
      const w = coords.width ?? coords.w ?? 5;
      const h = coords.height ?? coords.h ?? 5;
      const plotNumber = String(p.plotNumber || p.plotId || idx + 1);
      return {
        projectId: project._id,
        plotNumber,
        plotNumberInt: parseInt(plotNumber.replace(/\D/g, ''), 10) || idx + 1,
        position: {
          x: coords.x ?? 0,
          y: coords.y ?? 0,
          width: w,
          height: h,
        },
        rawText: p.rawText || '',
        extractedArea: p.extractedArea || '',
        status: p.status || 'available',
        plotType: 'regular',
        price: (p.cents || 0) * pricePerCent,
      };
    });

    await Plot.deleteMany({ projectId: project._id });
    const saved = await Plot.insertMany(plotDocs);
    project.totalPlots = saved.length;
    project.detectedPlotsPreview = [];
    await project.save();

    res.json({ success: true, plots: saved, count: saved.length });
  } catch (err) {
    console.error('Confirm plots error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/plots-bulk', roleCheck('owner'), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project || !isProjectOwner(project, req.user._id)) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    req.params.id = project._id.toString();
    req.body.plots = req.body.plots;
    // Delegate to confirm-plots logic
    const incoming = req.body.plots || [];
    const pricePerCent = project.pricePerCent || 10000;
    const plotDocs = incoming.map((p, idx) => ({
      projectId: project._id,
      plotNumber: String(p.plotNumber || idx + 1),
      plotNumberInt: parseInt(String(p.plotNumber).replace(/\D/g, ''), 10) || idx + 1,
      position: p.position || p.coordinates || { x: 0, y: 0, width: 5, height: 5 },
      status: p.status || 'available',
      plotType: 'regular',
      price: (p.cents || 0) * pricePerCent,
    }));
    await Plot.deleteMany({ projectId: project._id });
    const saved = await Plot.insertMany(plotDocs);
    project.totalPlots = saved.length;
    await project.save();
    res.json({ success: true, plots: saved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

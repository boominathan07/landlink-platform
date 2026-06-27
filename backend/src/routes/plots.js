const express = require('express');
const Plot = require('../models/Plot');
const Project = require('../models/Project');
const auth = require('../middleware/auth');
const { getProjectForUser, isProjectOwner } = require('../utils/projectAccess');
const { getIO } = require('../services/socketService');

const router = express.Router();
router.use(auth);

const HOLD_HOURS = 24;

const emitPlotChange = (plot, projectId) => {
  try {
    getIO().to(`project:${projectId}`).emit('plot:status_changed', {
      plotId: plot._id,
      projectId,
      newStatus: plot.status,
      plot,
    });
  } catch {
    /* ignore */
  }
};

router.post('/projects/:id/plots', async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project || !isProjectOwner(project, req.user._id)) {
    return res.status(404).json({ message: 'Project not found' });
  }

  const { plots } = req.body;
  if (!Array.isArray(plots) || !plots.length) {
    return res.status(400).json({ message: 'plots array required' });
  }

  const created = [];
  for (const p of plots) {
    const price = p.price ?? (p.areaSqft && project.pricePerSqft ? p.areaSqft * project.pricePerSqft : 0);
    const plot = await Plot.findOneAndUpdate(
      { projectId: project._id, plotNumber: p.plotNumber },
      {
        projectId: project._id,
        plotNumber: p.plotNumber,
        coordinates: p.coordinates,
        areaSqft: p.areaSqft,
        facing: p.facing || 'North',
        price,
        status: p.status || 'available',
      },
      { upsert: true, new: true }
    );
    created.push(plot);
  }

  project.totalPlots = await Plot.countDocuments({ projectId: project._id });
  await project.save();

  res.status(201).json({ plots: created });
});

router.get('/projects/:id/plots', async (req, res) => {
  try {
    const project = await getProjectForUser(req.params.id, req.user._id, req.user.role);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const plots = await Plot.find({ projectId: project._id }).sort({ plotNumberInt: 1 });
    const stats = {
      total: plots.length,
      available: plots.filter((p) => p.status === 'available').length,
      booked: plots.filter((p) => p.status === 'booked').length,
      sold: plots.filter((p) => p.status === 'sold').length,
      onHold: plots.filter((p) => p.status === 'hold').length,
    };

    res.json({
      plots,
      stats,
      pricePerCent: project.pricePerCent || 0,
      gridCols: project.gridCols || 10,
      totalPlots: project.totalPlots || plots.length
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const plot = await Plot.findById(req.params.id);
  if (!plot) return res.status(404).json({ message: 'Plot not found' });

  const project = await Project.findById(plot.projectId);
  if (!isProjectOwner(project, req.user._id)) {
    return res.status(403).json({ message: 'Only owners can edit plots' });
  }

  const fields = ['plotNumber', 'coordinates', 'areaSqft', 'facing', 'price', 'status'];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) plot[f] = req.body[f];
  });
  await plot.save();
  emitPlotChange(plot, plot.projectId);
  res.json({ plot });
});

router.post('/:id/hold', async (req, res) => {
  if (req.user.role !== 'broker') return res.status(403).json({ message: 'Brokers only' });

  const plot = await Plot.findById(req.params.id);
  if (!plot) return res.status(404).json({ message: 'Plot not found' });
  if (plot.status !== 'available') {
    return res.status(400).json({ message: 'Plot is not available' });
  }

  const project = await getProjectForUser(plot.projectId, req.user._id, 'broker');
  if (!project) return res.status(403).json({ message: 'Not assigned to this project' });

  plot.status = 'hold';
  plot.holdBy = req.user._id;
  plot.holdExpiry = new Date(Date.now() + HOLD_HOURS * 60 * 60 * 1000);
  await plot.save();
  emitPlotChange(plot, plot.projectId);
  res.json({ plot });
});

router.delete('/:id/hold', async (req, res) => {
  const plot = await Plot.findById(req.params.id);
  if (!plot) return res.status(404).json({ message: 'Plot not found' });

  const isHolder = plot.holdBy?.toString() === req.user._id.toString();
  const project = await Project.findById(plot.projectId);
  const owner = isProjectOwner(project, req.user._id);

  if (!isHolder && !owner) return res.status(403).json({ message: 'Cannot release hold' });

  plot.status = 'available';
  plot.holdBy = undefined;
  plot.holdExpiry = undefined;
  await plot.save();
  emitPlotChange(plot, plot.projectId);
  res.json({ plot });
});

module.exports = router;

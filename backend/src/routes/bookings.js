const express = require('express');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Plot = require('../models/Plot');
const Project = require('../models/Project');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { isProjectOwner, isProjectBroker } = require('../utils/projectAccess');
const { calculateCommission } = require('../services/commissionService');
const { createNotification, notifyProjectOwners } = require('../services/notificationService');
const { getIO } = require('../services/socketService');
const { requireFeature } = require('../middleware/planLimits');

const router = express.Router();
router.use(auth);

router.post('/', roleCheck('broker'), async (req, res) => {
  const {
    projectId,
    plotId,
    customerName,
    customerPhone,
    customerAddress,
    advanceAmount,
    totalAmount,
    paymentMode,
    notes,
  } = req.body;

  const plot = await Plot.findById(plotId);
  if (!plot) return res.status(404).json({ message: 'Plot not found' });
  if (!['available', 'hold'].includes(plot.status)) {
    return res.status(400).json({ message: 'Plot cannot be booked' });
  }
  if (plot.status === 'hold' && plot.holdBy?.toString() !== req.user._id.toString()) {
    return res.status(400).json({ message: 'Plot held by another broker' });
  }

  const project = await Project.findById(projectId);
  if (!project || !isProjectBroker(project, req.user._id)) {
    return res.status(403).json({ message: 'Not assigned to project' });
  }

  const brokerEntry = project.brokers.find(
    (b) => b.userId.toString() === req.user._id.toString() && b.status === 'active'
  );
  const commissionPercent = brokerEntry?.commissionPercent ?? 2;

  const booking = await Booking.create({
    projectId,
    plotId,
    brokerId: req.user._id,
    customerName,
    customerPhone,
    customerAddress,
    advanceAmount: advanceAmount || 0,
    totalAmount: totalAmount || plot.price,
    paymentMode: paymentMode || 'cash',
    notes,
    commissionPercent,
    commissionAmount: calculateCommission(totalAmount || plot.price, commissionPercent),
    status: 'pending',
  });

  plot.status = 'booked';
  plot.bookedBy = req.user._id;
  plot.bookingId = booking._id;
  plot.holdBy = undefined;
  plot.holdExpiry = undefined;
  await plot.save();

  try {
    getIO().to(`project:${projectId}`).emit('plot:status_changed', {
      plotId: plot._id,
      projectId,
      newStatus: 'booked',
      plot,
    });
    const ownerIds = [
      project.createdBy.toString(),
      ...project.owners.filter((o) => o.status === 'active').map((o) => o.userId.toString()),
    ];
    const uniqueOwnerIds = [...new Set(ownerIds)];
    uniqueOwnerIds.forEach((ownerId) => {
      getIO().to(`user:${ownerId}`).emit('booking:new_request', {
        booking, plot, broker: { _id: req.user._id, name: req.user.name },
      });
    });
  } catch {
    /* ignore */
  }

  await notifyProjectOwners(project, {
    type: 'booking_request',
    title: 'New booking request',
    message: `Broker ${req.user.name || req.user.phone} requested booking for plot ${plot.plotNumber}`,
    data: { projectId, plotId, bookingId: booking._id },
    email: true,
  });

  res.status(201).json({ booking, plot });
});

router.get('/', async (req, res) => {
  try {
    let query = {};
    let allowedProjectIds = null;

    if (req.user.role === 'broker') {
      query.brokerId = req.user._id;
      const projects = await Project.find({
        'brokers.userId': req.user._id,
        'brokers.status': 'active',
      }).select('_id');
      allowedProjectIds = projects.map((p) => p._id);
    } else {
      const projects = await Project.find({
        $or: [
          { createdBy: req.user._id },
          { 'owners.userId': req.user._id, 'owners.status': 'active' },
        ],
      }).select('_id');
      allowedProjectIds = projects.map((p) => p._id);
      query.projectId = { $in: allowedProjectIds };
    }

    if (req.query.status) query.status = req.query.status;

    if (req.query.projectId) {
      const pid = String(req.query.projectId);
      if (!mongoose.Types.ObjectId.isValid(pid)) {
        return res.status(400).json({ message: 'Invalid projectId' });
      }
      const projectOid = new mongoose.Types.ObjectId(pid);
      const allowed = allowedProjectIds.some((id) => id.equals(projectOid));
      if (!allowed) {
        return res.status(403).json({ message: 'Not authorized for this project' });
      }
      query.projectId = projectOid;
    }

    const bookings = await Booking.find(query)
      .populate('plotId', 'plotNumber widthMeters lengthMeters width length areaSqMeters areaSqFeet areaSqft cents cent price status holdExpiry')
      .populate('brokerId', 'name phone email')
      .populate('projectId', 'name')
      .sort({ createdAt: -1 });

    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to load bookings' });
  }
});

const handleApproval = async (req, res, status) => {
  const booking = await Booking.findById(req.params.id).populate('plotId');
  if (!booking) return res.status(404).json({ message: 'Booking not found' });

  const project = await Project.findById(booking.projectId);
  if (!isProjectOwner(project, req.user._id)) {
    return res.status(403).json({ message: 'Only owners can approve bookings' });
  }

  booking.status = status;
  if (status === 'approved') {
    booking.approvedBy = req.user._id;
    booking.approvedAt = new Date();
  }
  if (status === 'rejected') {
    booking.rejectReason = req.body.reason || '';
    const plot = await Plot.findById(booking.plotId);
    if (plot) {
      plot.status = 'available';
      plot.bookedBy = undefined;
      plot.bookingId = undefined;
      await plot.save();
    }
  }
  await booking.save();

  const event = status === 'approved' ? 'booking:approved' : 'booking:rejected';
  try {
    getIO().to(`user:${booking.brokerId}`).emit(event, { booking, reason: req.body.reason });
  } catch {
    /* ignore */
  }

  await createNotification({
    userId: booking.brokerId,
    type: status === 'approved' ? 'booking_approved' : 'booking_rejected',
    title: `Booking ${status}`,
    message: `Your booking for plot ${booking.plotId?.plotNumber} was ${status}`,
    data: { bookingId: booking._id, projectId: booking.projectId },
    email: true,
  });

  res.json({ booking });
};

router.put('/:id/approve', roleCheck('owner'), (req, res) => handleApproval(req, res, 'approved'));
router.put('/:id/reject', roleCheck('owner'), (req, res) => handleApproval(req, res, 'rejected'));

router.put('/:id/complete', roleCheck('owner'), requireFeature('commission'), async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });

  const project = await Project.findById(booking.projectId);
  if (!isProjectOwner(project, req.user._id)) {
    return res.status(403).json({ message: 'Only owners can complete sales' });
  }

  booking.status = 'completed';
  booking.completedAt = new Date();
  booking.commissionAmount = calculateCommission(booking.totalAmount, booking.commissionPercent);

  const plot = await Plot.findById(booking.plotId);
  if (plot) {
    plot.status = 'sold';
    await plot.save();
    try {
      getIO().to(`project:${booking.projectId}`).emit('plot:status_changed', {
        plotId: plot._id,
        projectId: booking.projectId,
        newStatus: 'sold',
        plot,
      });
    } catch {
      /* ignore */
    }
  }

  await booking.save();

  await createNotification({
    userId: booking.brokerId,
    type: 'commission_earned',
    title: 'Sale completed',
    message: `Commission of ₹${booking.commissionAmount} earned on completed sale`,
    data: { bookingId: booking._id },
    email: true,
  });

  res.json({ booking, plot });
});

module.exports = router;

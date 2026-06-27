const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Plot = require('../models/Plot');
const Booking = require('../models/Booking');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.use(auth);

function parseDateRange(startDate, endDate) {
  const range = {};
  if (startDate) {
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) return { error: 'Invalid startDate' };
    start.setHours(0, 0, 0, 0);
    range.$gte = start;
  }
  if (endDate) {
    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) return { error: 'Invalid endDate' };
    end.setHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return { range };
}

function bookingEffectiveDate(booking) {
  return new Date(booking.completedAt || booking.approvedAt || booking.createdAt);
}

function filterBookingsByDate(bookings, range) {
  if (!range || (!range.$gte && !range.$lte)) return bookings;
  return bookings.filter((b) => {
    const d = bookingEffectiveDate(b);
    if (range.$gte && d < range.$gte) return false;
    if (range.$lte && d > range.$lte) return false;
    return true;
  });
}

router.get('/overview', roleCheck('owner'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const parsed = parseDateRange(startDate, endDate);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    
    const projects = await Project.find({
      $or: [{ createdBy: req.user._id }, { 'owners.userId': req.user._id, 'owners.status': 'active' }],
    });
    const projectIds = projects.map(p => p._id);
    
    const query = { projectId: { $in: projectIds }, status: { $in: ['completed', 'approved'] } };
    let bookings = await Booking.find(query).populate('brokerId', 'name');
    bookings = filterBookingsByDate(bookings, parsed.range);

    const revenue = bookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const commissions = bookings.reduce((s, b) => s + (b.commissionAmount || 0), 0);
    
    const plots = await Plot.find({ projectId: { $in: projectIds } });
    const plotStats = {
      total: plots.length,
      available: plots.filter(p => p.status === 'available').length,
      booked: plots.filter(p => p.status === 'booked').length,
      sold: plots.filter(p => p.status === 'sold').length,
      onHold: plots.filter(p => p.status === 'hold').length,
    };

    res.json({
      revenue,
      commissions,
      netRevenue: revenue - commissions,
      completedSales: bookings.length,
      plotStats,
      activeBrokers: new Set(bookings.map(b => b.brokerId?._id?.toString()).filter(Boolean)).size
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to load analytics overview' });
  }
});

router.get('/charts', roleCheck('owner'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const parsed = parseDateRange(startDate, endDate);
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const projects = await Project.find({
      $or: [{ createdBy: req.user._id }, { 'owners.userId': req.user._id, 'owners.status': 'active' }],
    });
    const projectIds = projects.map(p => p._id);
    
    const query = { projectId: { $in: projectIds }, status: { $in: ['completed', 'approved'] } };
    let bookings = await Booking.find(query).populate('brokerId', 'name');
    bookings = filterBookingsByDate(bookings, parsed.range);

    const monthlyData = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      monthlyData[key] = { month: d.toLocaleDateString('en', { month: 'short' }), revenue: 0, bookings: 0 };
    }
    for (const b of bookings) {
      const key = bookingEffectiveDate(b).toISOString().slice(0, 7);
      if (monthlyData[key]) { 
        monthlyData[key].revenue += b.totalAmount || 0; 
        monthlyData[key].bookings += 1; 
      }
    }

    const brokerMap = {};
    for (const b of bookings) {
      if (!b.brokerId) continue;
      const bid = b.brokerId._id.toString();
      if (!brokerMap[bid]) brokerMap[bid] = { name: b.brokerId.name || 'Unknown', bookings: 0, revenue: 0 };
      brokerMap[bid].bookings += 1;
      brokerMap[bid].revenue += b.totalAmount || 0;
    }

    res.json({
      monthlyStats: Object.values(monthlyData),
      brokerPerformance: Object.values(brokerMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to load analytics charts' });
  }
});

router.get('/export', roleCheck('owner'), async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [{ createdBy: req.user._id }, { 'owners.userId': req.user._id, 'owners.status': 'active' }],
    });
    const projectIds = projects.map(p => p._id);
    const bookings = await Booking.find({ projectId: { $in: projectIds }, status: 'completed' })
      .populate('brokerId', 'name')
      .populate('projectId', 'name');

    const csvRows = ['Date,Project,Broker,Amount,Commission'];
    bookings.forEach(b => {
      csvRows.push(`${new Date(b.completedAt || b.createdAt).toLocaleDateString()},${b.projectId.name},${b.brokerId?.name || 'N/A'},${b.totalAmount},${b.commissionAmount || 0}`);
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=analytics_export.csv');
    res.send(csvRows.join('\n'));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/broker/:id', roleCheck('broker'), async (req, res) => {
  try {
    if (req.params.id !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const projects = await Project.find({ 'brokers.userId': req.user._id, 'brokers.status': 'active' });
    const projectIds = projects.map((p) => p._id);

    const bookings = await Booking.find({ brokerId: req.user._id, status: 'completed' });
    const totalEarned = bookings.reduce((s, b) => s + (b.commissionAmount || 0), 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEarned = bookings
      .filter((b) => new Date(b.completedAt || b.createdAt) >= monthStart)
      .reduce((s, b) => s + (b.commissionAmount || 0), 0);

    const monthlyData = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      monthlyData[key] = { month: d.toLocaleDateString('en', { month: 'short' }), earnings: 0 };
    }
    for (const b of bookings) {
      const key = new Date(b.completedAt || b.createdAt).toISOString().slice(0, 7);
      if (monthlyData[key]) monthlyData[key].earnings += b.commissionAmount || 0;
    }

    res.json({
      success: true,
      data: {
        totalEarned,
        monthEarned,
        completedSales: bookings.length,
        assignedProjects: projects.length,
        monthlyEarnings: Object.values(monthlyData),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

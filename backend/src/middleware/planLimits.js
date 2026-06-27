const Project = require('../models/Project');
const Document = require('../models/Document');

const PLAN_LIMITS = {
  free: { maxProjects: 3, maxBrokersPerProject: 3, maxStorageBytes: 1e9, analytics: false, commission: false },
  pro: { maxProjects: Infinity, maxBrokersPerProject: Infinity, maxStorageBytes: 10e9, analytics: true, commission: true },
  agency: { maxProjects: Infinity, maxBrokersPerProject: Infinity, maxStorageBytes: 50e9, analytics: true, commission: true },
};

const getLimits = (user) => PLAN_LIMITS[user.plan] || PLAN_LIMITS.free;

const checkProjectLimit = async (req, res, next) => {
  const limits = getLimits(req.user);
  if (limits.maxProjects === Infinity) return next();
  const count = await Project.countDocuments({
    $or: [{ createdBy: req.user._id }, { 'owners.userId': req.user._id }],
  });
  if (count >= limits.maxProjects) {
    return res.status(403).json({ message: 'Free plan allows up to 3 projects. Upgrade for higher limits.' });
  }
  next();
};

const checkBrokerLimit = async (req, res, next) => {
  const limits = getLimits(req.user);
  if (limits.maxBrokersPerProject === Infinity) return next();
  const project = req.project || (await require('../models/Project').findById(req.params.id));
  if (!project) return res.status(404).json({ message: 'Project not found' });
  const activeBrokers = project.brokers.filter((b) => b.status !== 'revoked').length;
  if (activeBrokers >= limits.maxBrokersPerProject) {
    return res.status(403).json({ message: 'Free plan allows up to 3 brokers per project. Upgrade for higher limits.' });
  }
  next();
};

const checkStorageLimit = async (req, res, next) => {
  const limits = getLimits(req.user);
  if (limits.maxStorageBytes === Infinity) return next();
  const docs = await Document.find({ uploadedBy: req.user._id });
  const used = docs.reduce((sum, d) => sum + (d.fileSize || 0), 0);
  const incoming = req.file?.size || 0;
  if (incoming <= 0) return next();
  if (used + incoming > limits.maxStorageBytes) {
    return res.status(403).json({
      message: `Storage limit reached (${Math.round(limits.maxStorageBytes / 1e9)}GB plan). Upgrade your plan to upload more documents.`,
    });
  }
  next();
};

const requireFeature = (feature) => (req, res, next) => {
  const limits = getLimits(req.user);
  if (!limits[feature]) {
    return res.status(403).json({ message: `This feature requires a paid plan (${feature}).` });
  }
  next();
};

module.exports = { getLimits, checkProjectLimit, checkBrokerLimit, checkStorageLimit, requireFeature };

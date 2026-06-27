const Project = require('../models/Project');

/** Normalize ObjectId, populated doc, or string to id string */
const toIdString = (ref) => {
  if (!ref) return '';
  if (typeof ref === 'string') return ref;
  if (ref._id) return ref._id.toString();
  return ref.toString();
};

const isProjectOwner = (project, userId) => {
  const id = toIdString(userId);
  if (toIdString(project.createdBy) === id) return true;
  return project.owners.some(
    (o) => toIdString(o.userId) === id && o.status === 'active'
  );
};

const isProjectBroker = (project, userId) => {
  const id = toIdString(userId);
  return project.brokers.some(
    (b) => toIdString(b.userId) === id && b.status === 'active'
  );
};

const getProjectForUser = async (projectId, userId, role) => {
  const project = await Project.findById(projectId)
    .populate('createdBy', 'name phone')
    .populate('owners.userId', 'name phone')
    .populate('brokers.userId', 'name phone');

  if (!project) return null;

  if (isProjectOwner(project, userId) || isProjectBroker(project, userId)) {
    return project;
  }

  return null;
};

module.exports = { isProjectOwner, isProjectBroker, getProjectForUser, toIdString };

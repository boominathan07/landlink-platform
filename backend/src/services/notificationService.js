const Notification = require('../models/Notification');
const { getIO } = require('./socketService');
const { sendEmail } = require('./emailService');
const User = require('../models/User');

const createNotification = async ({ userId, type, title, message, data, email }) => {
  const notification = await Notification.create({
    userId,
    type,
    title,
    message,
    data,
  });

  try {
    const io = getIO();
    io.to(`user:${userId}`).emit('notification:new', { notification });
  } catch {
    /* socket not ready */
  }

  if (email) {
    const user = await User.findById(userId);
    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject: title,
        html: `<p>${message}</p>`,
      });
    }
  }

  return notification;
};

const notifyProjectOwners = async (project, payload) => {
  const ownerIds = project.owners
    .filter((o) => o.status === 'active')
    .map((o) => o.userId.toString());
  const unique = [...new Set([project.createdBy.toString(), ...ownerIds])];
  return Promise.all(unique.map((userId) => createNotification({ userId, ...payload })));
};

module.exports = { createNotification, notifyProjectOwners };

let io;

const initSocket = (socketServer) => {
  io = socketServer;
};

const getIO = () => {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
};

module.exports = { initSocket, getIO };

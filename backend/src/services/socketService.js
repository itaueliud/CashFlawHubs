const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const devAuthStore = require('../services/devAuthStore');

const initSocket = (httpServer, corsOrigins = []) => {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigins,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('Unauthorized'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = mongoose.connection.readyState === 1
        ? await User.findById(decoded.id)
        : devAuthStore.findById(decoded.id);
      if (!user) return next(new Error('Unauthorized'));
      socket.user = user;
      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = String(socket.user._id || socket.user.id);
    socket.join(`presence:${userId}`);
    if (['ledger', 'admin', 'superadmin'].includes(String(socket.user.role || '').toLowerCase())) {
      socket.join('ledger-room');
    }
    io.emit('presence:update', { userId, status: 'online', at: new Date().toISOString() });

    socket.on('chat:join', ({ sessionId }) => {
      if (!sessionId) return;
      socket.join(`chat:${sessionId}`);
      socket.to(`chat:${sessionId}`).emit('presence:update', { userId, status: 'active', sessionId, at: new Date().toISOString() });
    });

    socket.on('chat:typing', ({ sessionId, isTyping }) => {
      if (!sessionId) return;
      socket.to(`chat:${sessionId}`).emit('chat:typing', {
        sessionId,
        userId,
        isTyping: Boolean(isTyping),
        at: new Date().toISOString(),
      });
    });

    socket.on('disconnect', () => {
      io.emit('presence:update', { userId, status: 'offline', at: new Date().toISOString() });
    });
  });

  return io;
};

module.exports = { initSocket };

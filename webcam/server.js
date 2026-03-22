const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize : 1e7
});

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('device connected:', socket.id);

  // Frame relay (PC → relay → AI & app)
  socket.on('frame', (data) => socket.broadcast.emit('frame', data));

  // Calibration control
  socket.on('calibrate-start', () => {
    console.log('[CALIBRATE] Start signal received, broadcasting to AI...');
    socket.broadcast.emit('calibrate-start');
  });

  // AI → App alerts
  socket.on('posture-alert', (data) => {
    console.log('[ALERT]', data.message);
    socket.broadcast.emit('posture-alert', data);
  });

  // Calibration completion
  socket.on('calibration-complete', (data) => {
    console.log('[CALIBRATION COMPLETE]', data.message);
    socket.broadcast.emit('calibration-complete', data);
  });

  // Legacy events
  socket.on('posture-data', (data) => {socket.broadcast.emit('posture-update', data);});
  socket.on('session-control', (data) => {socket.broadcast.emit('session-command', data);});

  socket.on('disconnect', () => {console.log('device disconnected:', socket.id);});
});

server.listen(4000, () => console.log('server running on port 4000'));
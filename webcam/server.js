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

  socket.on('posture-data', (data) => {socket.broadcast.emit('posture-update', data);});

  socket.on('session-control', (data) => {socket.broadcast.emit('session-command', data);});

  socket.on('frame', (data) => socket.broadcast.emit('frame', data));

  socket.on('disconnect', () => {console.log('device disconnected:', socket.id);});
});

server.listen(3000, () => console.log('server running on port 3000'));
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

// Initialize Socket.io for Real-time Signaling
const io = new Server(server, {
  cors: {
    origin: '*', // In production, restrict this to your app's domain
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Here is where we will later add WebRTC signaling logic 
  // (e.g., joining rooms, sending 'offers' and 'answers')

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Signaling Server listening on port ${PORT}`);
});

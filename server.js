const express = require('express');
const http = require('http');
const cors = require('cors');
const { ExpressPeerServer } = require('peer');
const path = require('path');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname)));

// Embedded PeerServer for WebRTC signaling
const peerServer = ExpressPeerServer(server, {
  debug: false,
  path: '/peerjs',
  allow_discovery: true
});

app.use('/peerjs', peerServer);

peerServer.on('connection', (client) => {
  console.log(`[PeerJS] Client connected: ${client.getId()}`);
});

peerServer.on('disconnect', (client) => {
  console.log(`[PeerJS] Client disconnected: ${client.getId()}`);
});

server.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` xerTransfer (By Mayank Mandrai) Running `);
  console.log(` URL: http://localhost:${PORT}          `);
  console.log(` PeerJS signaling ready at /peerjs       `);
  console.log(`=========================================`);
});

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = 3000;

// Store latest game state
let currentGameState = null;
const overlayClients = new Set();

// Simple HTTP server to serve static files
const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/overlay-board.html' : req.url;
  filePath = path.join(__dirname, filePath);

  const ext = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
    res.end(content);
  });
});

// WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const clientType = req.url;

  if (clientType === '/extension') {
    console.log('Extension connected');

    ws.on('message', (data) => {
      try {
        currentGameState = JSON.parse(data);
        console.log('Game state updated:', currentGameState.players?.white?.name, 'vs', currentGameState.players?.black?.name);

        // Broadcast to all overlay clients
        overlayClients.forEach(client => {
          if (client.readyState === 1) {
            client.send(JSON.stringify(currentGameState));
          }
        });
      } catch (e) {
        console.error('Invalid game data:', e);
      }
    });

    ws.on('close', () => {
      console.log('Extension disconnected');
    });
  } else {
    // Overlay client
    console.log('Overlay client connected');
    overlayClients.add(ws);

    // Send current state if available
    if (currentGameState) {
      ws.send(JSON.stringify(currentGameState));
    }

    ws.on('close', () => {
      overlayClients.delete(ws);
      console.log('Overlay client disconnected');
    });
  }
});

server.listen(PORT, () => {
  console.log(`Chess overlay server running at http://localhost:${PORT}`);
  console.log('Extension connects to: ws://localhost:' + PORT + '/extension');
  console.log('');
  console.log('OBS Browser Source URLs:');
  console.log('  Board:     http://localhost:' + PORT + '/overlay-board.html  (960x960)');
  console.log('  Players:   http://localhost:' + PORT + '/overlay-players.html');
});

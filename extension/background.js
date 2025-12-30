// Chess.com OBS Overlay - Background Service Worker
// Manages WebSocket connection to local overlay server

const WS_URL = 'ws://localhost:3000/extension';
let ws = null;
let reconnectTimeout = null;

function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    return;
  }

  console.log('[Chess Overlay] Connecting to server...');

  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('[Chess Overlay] Connected to overlay server');
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    };

    ws.onclose = () => {
      console.log('[Chess Overlay] Disconnected from server');
      ws = null;
      scheduleReconnect();
    };

    ws.onerror = (error) => {
      console.error('[Chess Overlay] WebSocket error:', error);
    };
  } catch (e) {
    console.error('[Chess Overlay] Failed to connect:', e);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (!reconnectTimeout) {
    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null;
      connect();
    }, 3000);
  }
}

function sendGameState(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  } else {
    connect();
  }
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'gameState') {
    sendGameState(message.data);
  }
  return true;
});

// Initial connection
connect();

// Keep service worker alive by reconnecting periodically
setInterval(() => {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connect();
  }
}, 5000);

# Chess.com OBS Overlay

A Chrome extension that extracts live game data from Chess.com and streams it to an OBS overlay via WebSocket.

## Setup

### 1. Install the Chrome Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `extension` folder from this project
5. The extension icon should appear in your toolbar

### 2. Start the WebSocket Server

```bash
cd server
npm install
npm start
```

The server runs on `http://localhost:3000`.

### 3. Add OBS Browser Sources

| Overlay | URL | Size |
|---------|-----|------|
| Board | `http://localhost:3000/overlay-board.html` | 960x960 |
| Players | `http://localhost:3000/overlay-players.html` | 540x~120 |

The board is 960px wide (half of 1920) for HD streaming.

## Usage

1. Start the server
2. Open Chess.com and start a game
3. The extension automatically detects the game and sends data to the overlay

## Troubleshooting

- **Extension not connecting**: Make sure the server is running before starting a game
- **No game data**: Check the browser console (F12) for `[Chess Overlay]` logs
- **Server not receiving data**: Verify the extension is enabled in `chrome://extensions`

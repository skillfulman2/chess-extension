let currentOrientation = 'white';

function connectWebSocket() {
  const ws = new WebSocket(`ws://${window.location.host}`);

  ws.onopen = () => {
    console.log('Players overlay connected');
  };

  ws.onmessage = (event) => {
    try {
      const gameState = JSON.parse(event.data);
      updatePlayers(gameState);
    } catch (e) {
      console.error('Failed to parse game state:', e);
    }
  };

  ws.onclose = () => {
    console.log('Disconnected, reconnecting in 2s...');
    setTimeout(connectWebSocket, 2000);
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
  };
}

function updatePlayers(state) {
  currentOrientation = state.orientation || 'white';

  const topColor = currentOrientation === 'white' ? 'black' : 'white';
  const bottomColor = currentOrientation === 'white' ? 'white' : 'black';

  const topPlayer = state.players?.[topColor] || {};
  const bottomPlayer = state.players?.[bottomColor] || {};

  updatePlayerInfo('top', topPlayer, state.clocks?.[topColor], state.turn === topColor);
  updatePlayerInfo('bottom', bottomPlayer, state.clocks?.[bottomColor], state.turn === bottomColor);
}

function updatePlayerInfo(position, player, clockSeconds, isActive) {
  const titleEl = document.getElementById(`${position}-title`);
  const nameEl = document.getElementById(`${position}-name`);
  const ratingEl = document.getElementById(`${position}-rating`);
  const clockEl = document.getElementById(`${position}-clock`);

  titleEl.textContent = player.title || '';
  nameEl.textContent = player.name || 'Unknown';
  ratingEl.textContent = player.rating ? `(${player.rating})` : '';

  if (clockSeconds !== undefined && clockSeconds !== null) {
    clockEl.textContent = formatTime(clockSeconds);
    clockEl.classList.toggle('active', isActive);
    clockEl.classList.toggle('low-time', clockSeconds < 30);
  } else {
    clockEl.textContent = '--:--';
    clockEl.classList.remove('active', 'low-time');
  }
}

function formatTime(seconds) {
  if (seconds === null || seconds === undefined) return '--:--';

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hours}:${remainMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

connectWebSocket();

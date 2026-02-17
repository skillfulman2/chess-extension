function connectWebSocket() {
  const ws = new WebSocket(`ws://${window.location.host}`);

  ws.onopen = () => {
    console.log('Moves overlay connected');
  };

  ws.onmessage = (event) => {
    try {
      const gameState = JSON.parse(event.data);
      updateMoveList(gameState.moveList || []);
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

function updateMoveList(moves) {
  const container = document.getElementById('move-list');
  if (!container) return;

  if (moves.length === 0) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  moves.forEach((move, i) => {
    const rowClass = i % 2 === 0 ? 'move-row-light' : 'move-row-dark';
    const whiteClass = move.white?.selected ? ' move-selected' : '';
    const blackClass = move.black?.selected ? ' move-selected' : '';

    html += `<div class="move-row ${rowClass}">`;
    html += `<span class="move-number">${move.number}.</span>`;
    html += `<span class="move-white${whiteClass}">${move.white?.text || ''}</span>`;
    html += `<span class="move-black${blackClass}">${move.black?.text || ''}</span>`;
    html += `</div>`;
  });

  container.innerHTML = html;
}

connectWebSocket();

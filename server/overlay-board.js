// Chess piece Unicode characters (using filled symbols for both colors)
const PIECES = {
  'K': '\u265A', 'Q': '\u265B', 'R': '\u265C', 'B': '\u265D', 'N': '\u265E', 'P': '\u265F',
  'k': '\u265A', 'q': '\u265B', 'r': '\u265C', 'b': '\u265D', 'n': '\u265E', 'p': '\u265F'
};

const WHITE_PIECES = new Set(['K', 'Q', 'R', 'B', 'N', 'P']);
const SQUARE_SIZE = 120; // 960px / 8 = 120px per square

let currentOrientation = 'white';

function connectWebSocket() {
  const ws = new WebSocket(`ws://${window.location.host}`);

  ws.onopen = () => {
    console.log('Board overlay connected');
  };

  ws.onmessage = (event) => {
    try {
      const gameState = JSON.parse(event.data);
      updateBoard(gameState);
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

function updateBoard(state) {
  currentOrientation = state.orientation || 'white';
  renderBoard(state.board, state.lastMove, state.markedSquares, state.hints, state.selectedSquare);
  renderArrows(state.arrows);
}

function renderBoard(fen, lastMove, markedSquares, hints, selectedSquare) {
  const boardEl = document.getElementById('board');
  boardEl.innerHTML = '';

  // Build set of marked squares for quick lookup
  const markedMap = new Map();
  if (markedSquares) {
    markedSquares.forEach(mark => {
      markedMap.set(mark.square, mark.color);
    });
  }

  // Build set of hint squares
  const hintSet = new Set(hints || []);

  if (!fen) {
    fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  }

  const rows = fen.split(' ')[0].split('/');
  const board = [];

  for (const row of rows) {
    const boardRow = [];
    for (const char of row) {
      if (/\d/.test(char)) {
        for (let i = 0; i < parseInt(char); i++) {
          boardRow.push(null);
        }
      } else {
        boardRow.push(char);
      }
    }
    board.push(boardRow);
  }

  let lastMoveSquares = new Set();
  if (lastMove) {
    lastMoveSquares.add(lastMove.from);
    lastMoveSquares.add(lastMove.to);
  }

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  if (currentOrientation === 'black') {
    files.reverse();
    ranks.reverse();
  }

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = document.createElement('div');

      const actualRow = currentOrientation === 'white' ? row : 7 - row;
      const actualCol = currentOrientation === 'white' ? col : 7 - col;

      const isLight = (actualRow + actualCol) % 2 === 0;
      square.className = `square ${isLight ? 'light' : 'dark'}`;

      const squareName = files[col] + ranks[row];
      if (squareName === selectedSquare) {
        square.classList.add('selected');
      } else if (lastMoveSquares.has(squareName)) {
        square.classList.add('last-move');
      } else if (markedMap.has(squareName)) {
        square.classList.add('marked');
        square.style.setProperty('--mark-color', markedMap.get(squareName));
      }

      // Add hint dot for legal moves
      if (hintSet.has(squareName)) {
        const hintDot = document.createElement('span');
        hintDot.className = 'hint-dot';
        square.appendChild(hintDot);
      }

      const piece = board[actualRow]?.[actualCol];
      if (piece && PIECES[piece]) {
        const pieceSpan = document.createElement('span');
        pieceSpan.className = 'piece ' + (WHITE_PIECES.has(piece) ? 'white-piece' : 'black-piece');
        pieceSpan.textContent = PIECES[piece];
        square.appendChild(pieceSpan);

        const isMyKing = (currentOrientation === 'white' && piece === 'K') ||
                         (currentOrientation === 'black' && piece === 'k');
        if (isMyKing) {
          square.classList.add('king');
        }
      }

      boardEl.appendChild(square);
    }
  }
}

function renderArrows(arrows) {
  const existingArrows = document.getElementById('arrows-svg');
  if (existingArrows) {
    existingArrows.remove();
  }

  if (!arrows || arrows.length === 0) return;

  const boardEl = document.getElementById('board');
  const boardSize = SQUARE_SIZE * 8;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'arrows-svg';
  svg.setAttribute('viewBox', `0 0 ${boardSize} ${boardSize}`);
  svg.setAttribute('width', boardSize);
  svg.setAttribute('height', boardSize);
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.pointerEvents = 'none';
  svg.style.zIndex = '10';

  const files = 'abcdefgh';
  const ranks = '87654321';

  arrows.forEach(arrow => {
    if (!arrow.from || !arrow.to) return;

    const fromFile = files.indexOf(arrow.from[0]);
    const fromRank = ranks.indexOf(arrow.from[1]);
    const toFile = files.indexOf(arrow.to[0]);
    const toRank = ranks.indexOf(arrow.to[1]);

    if (fromFile < 0 || fromRank < 0 || toFile < 0 || toRank < 0) return;

    let x1, y1, x2, y2;

    if (currentOrientation === 'black') {
      x1 = (7 - fromFile) * SQUARE_SIZE + SQUARE_SIZE / 2;
      y1 = (7 - fromRank) * SQUARE_SIZE + SQUARE_SIZE / 2;
      x2 = (7 - toFile) * SQUARE_SIZE + SQUARE_SIZE / 2;
      y2 = (7 - toRank) * SQUARE_SIZE + SQUARE_SIZE / 2;
    } else {
      x1 = fromFile * SQUARE_SIZE + SQUARE_SIZE / 2;
      y1 = fromRank * SQUARE_SIZE + SQUARE_SIZE / 2;
      x2 = toFile * SQUARE_SIZE + SQUARE_SIZE / 2;
      y2 = toRank * SQUARE_SIZE + SQUARE_SIZE / 2;
    }

    const fileDiff = Math.abs(toFile - fromFile);
    const rankDiff = Math.abs(toRank - fromRank);
    const isKnightMove = (fileDiff === 2 && rankDiff === 1) || (fileDiff === 1 && rankDiff === 2);

    const color = getArrowColor(arrow.color);

    if (isKnightMove) {
      svg.appendChild(createKnightArrow(x1, y1, x2, y2, color));
    } else {
      svg.appendChild(createStraightArrow(x1, y1, x2, y2, color));
    }
  });

  boardEl.style.position = 'relative';
  boardEl.appendChild(svg);
}

function createStraightArrow(x1, y1, x2, y2, color) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  const headLength = 35;
  const headWidth = 40;
  const shaftWidth = 20;
  const shortenBy = 15;
  const effectiveLength = length - shortenBy;
  const shaftLength = effectiveLength - headLength;

  const points = [
    [0, -shaftWidth / 2],
    [shaftLength, -shaftWidth / 2],
    [shaftLength, -headWidth / 2],
    [effectiveLength, 0],
    [shaftLength, headWidth / 2],
    [shaftLength, shaftWidth / 2],
    [0, shaftWidth / 2]
  ];

  const transformedPoints = points.map(([px, py]) => {
    const rotatedX = px * Math.cos(angle) - py * Math.sin(angle);
    const rotatedY = px * Math.sin(angle) + py * Math.cos(angle);
    return [x1 + rotatedX, y1 + rotatedY];
  });

  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  polygon.setAttribute('points', transformedPoints.map(p => p.join(',')).join(' '));
  polygon.setAttribute('fill', color);
  polygon.setAttribute('opacity', '0.6');

  return polygon;
}

function createKnightArrow(x1, y1, x2, y2, color) {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('opacity', '0.6');

  const dx = x2 - x1;
  const dy = y2 - y1;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  let midX, midY;

  if (absX > absY) {
    midX = x2;
    midY = y1;
  } else {
    midX = x1;
    midY = y2;
  }

  const shaftWidth = 20;
  const headLength = 30;
  const headWidth = 38;

  const leg1Angle = Math.atan2(midY - y1, midX - x1);
  const leg1Length = Math.sqrt((midX - x1) ** 2 + (midY - y1) ** 2);

  if (leg1Length > 0) {
    const leg1Points = [
      [0, -shaftWidth / 2],
      [leg1Length + shaftWidth / 2, -shaftWidth / 2],
      [leg1Length + shaftWidth / 2, shaftWidth / 2],
      [0, shaftWidth / 2]
    ];

    const transformedLeg1 = leg1Points.map(([px, py]) => {
      const rx = px * Math.cos(leg1Angle) - py * Math.sin(leg1Angle);
      const ry = px * Math.sin(leg1Angle) + py * Math.cos(leg1Angle);
      return [x1 + rx, y1 + ry];
    });

    const leg1 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    leg1.setAttribute('points', transformedLeg1.map(p => p.join(',')).join(' '));
    leg1.setAttribute('fill', color);
    group.appendChild(leg1);
  }

  const leg2Angle = Math.atan2(y2 - midY, x2 - midX);
  const leg2Length = Math.sqrt((x2 - midX) ** 2 + (y2 - midY) ** 2);
  const shortenBy = 15;
  const effectiveLength = leg2Length - shortenBy;
  const shaftLength = effectiveLength - headLength;

  if (leg2Length > 0) {
    const leg2Points = [
      [-shaftWidth / 2, -shaftWidth / 2],
      [shaftLength, -shaftWidth / 2],
      [shaftLength, -headWidth / 2],
      [effectiveLength, 0],
      [shaftLength, headWidth / 2],
      [shaftLength, shaftWidth / 2],
      [-shaftWidth / 2, shaftWidth / 2]
    ];

    const transformedLeg2 = leg2Points.map(([px, py]) => {
      const rx = px * Math.cos(leg2Angle) - py * Math.sin(leg2Angle);
      const ry = px * Math.sin(leg2Angle) + py * Math.cos(leg2Angle);
      return [midX + rx, midY + ry];
    });

    const leg2 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    leg2.setAttribute('points', transformedLeg2.map(p => p.join(',')).join(' '));
    leg2.setAttribute('fill', color);
    group.appendChild(leg2);
  }

  return group;
}

function getArrowColor(color) {
  // Colors matched to Chess.com's arrow palette
  const colors = {
    red: 'rgb(218, 64, 79)',      // Shift+right-click
    green: 'rgb(101, 168, 58)',   // Ctrl+right-click
    blue: 'rgb(82, 176, 220)',    // Alt+right-click
    yellow: 'rgb(241, 194, 50)',  // Ctrl+Shift+right-click
    orange: 'rgb(255, 170, 0)'    // Default right-click
  };
  return colors[color] || colors.orange;
}

connectWebSocket();

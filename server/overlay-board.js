// Chess.com piece image URLs
const PIECE_THEME = 'neo'; // Options: neo, neo_wood, classic, wood, glass, gothic, etc.
const PIECE_BASE_URL = `https://images.chesscomfiles.com/chess-themes/pieces/${PIECE_THEME}/150`;

// Map FEN notation to Chess.com piece image filenames
const PIECE_IMAGES = {
  'K': 'wk.png', 'Q': 'wq.png', 'R': 'wr.png', 'B': 'wb.png', 'N': 'wn.png', 'P': 'wp.png',
  'k': 'bk.png', 'q': 'bq.png', 'r': 'br.png', 'b': 'bb.png', 'n': 'bn.png', 'p': 'bp.png'
};

const WHITE_PIECES = new Set(['K', 'Q', 'R', 'B', 'N', 'P']);
const SQUARE_SIZE = 120; // 960px / 8 = 120px per square

let currentOrientation = 'white';
let lastGameResult = null;

// Track knights that have captured (pig knights!)
let pigKnightSquare = null;
let previousFen = null;
let lastMoveStr = null;

// Track piece positions for slide animation
let previousPiecePositions = new Map(); // piece+square -> {row, col}

// Oink sound for knight captures
const oinkSound = new Audio('pig-oink.mp3');
oinkSound.volume = 1.0;
oinkSound.preload = 'auto';

// Stockfish engine for evaluation
let stockfish = null;
let stockfishReady = false;
let currentFen = null;
let pendingFen = null;
let isAnalyzing = false;
let analysisDepth = 18; // Depth for analysis (higher = more accurate but slower)

function initStockfish() {
  try {
    stockfish = new Worker('stockfish.js');
    setupStockfishHandlers();
  } catch (e) {}
}

function setupStockfishHandlers() {
  stockfish.onmessage = function(event) {
    const line = typeof event === 'string' ? event : event.data;

    if (line.includes('score cp')) {
      const match = line.match(/score cp (-?\d+)/);
      if (match) {
        const cp = parseInt(match[1]);
        const isBlackTurn = currentFen && currentFen.includes(' b ');
        const normalizedCp = isBlackTurn ? -cp : cp;
        updateEvalBar(normalizedCp / 100, null);
      }
    } else if (line.includes('score mate')) {
      const match = line.match(/score mate (-?\d+)/);
      if (match) {
        let mateIn = parseInt(match[1]);
        const isBlackTurn = currentFen && currentFen.includes(' b ');
        if (isBlackTurn) mateIn = -mateIn;
        updateEvalBar(null, mateIn);
      }
    }

    if (line.includes('bestmove')) {
      isAnalyzing = false;
    }

    if (line.includes('readyok')) {
      stockfishReady = true;
      if (pendingFen) {
        const fen = pendingFen;
        pendingFen = null;
        analyzePosition(fen);
      }
    }
  };

  stockfish.postMessage('uci');
  stockfish.postMessage('isready');
  stockfish.postMessage('setoption name Threads value 1');
  stockfish.postMessage('setoption name Hash value 128');
}

function analyzePosition(fen) {
  if (!stockfish || !fen) return;

  if (!stockfishReady) {
    pendingFen = fen;
    return;
  }

  currentFen = fen;
  stockfish.postMessage('stop');

  setTimeout(() => {
    stockfish.postMessage('position fen ' + fen);
    stockfish.postMessage('go depth ' + analysisDepth);
    isAnalyzing = true;
  }, 50);
}

function updateEvalBar(evalScore, mateIn) {
  const whiteBar = document.getElementById('eval-bar-white');
  const scoreDisplay = document.getElementById('eval-score');

  if (!whiteBar || !scoreDisplay) return;

  let percentage;
  let displayText;

  if (mateIn !== null) {
    // Mate score
    if (mateIn > 0) {
      percentage = 100; // White winning
      displayText = `M${mateIn}`;
    } else {
      percentage = 0; // Black winning
      displayText = `M${Math.abs(mateIn)}`;
    }
    scoreDisplay.className = 'mate';
  } else {
    // Centipawn score - convert to percentage using sigmoid-like function
    // This maps eval to a 0-100% scale where 0 = -5, 50 = 0, 100 = +5
    const clampedEval = Math.max(-10, Math.min(10, evalScore));
    percentage = 50 + (50 * (2 / (1 + Math.exp(-clampedEval * 0.5)) - 1));

    // Format display
    const absEval = Math.abs(evalScore).toFixed(1);
    displayText = evalScore >= 0 ? `+${absEval}` : `-${absEval}`;

    // Color based on who's winning
    if (evalScore > 0.5) {
      scoreDisplay.className = 'winning-white';
    } else if (evalScore < -0.5) {
      scoreDisplay.className = 'winning-black';
    } else {
      scoreDisplay.className = '';
    }
  }

  // Update the bar - if board is flipped (black orientation), invert the bar
  if (currentOrientation === 'black') {
    whiteBar.style.height = (100 - percentage) + '%';
  } else {
    whiteBar.style.height = percentage + '%';
  }

  scoreDisplay.textContent = displayText;
}

// Initialize Stockfish when page loads
document.addEventListener('DOMContentLoaded', initStockfish);

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

let lastAnalyzedFen = null;

function parseFenToBoard(fen) {
  if (!fen) return null;
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
  return board;
}

function squareToIndices(square) {
  const file = square.charCodeAt(0) - 97; // a=0, h=7
  const rank = 8 - parseInt(square[1]);   // 8=0, 1=7
  return { row: rank, col: file };
}

function detectKnightCaptures(fen, lastMove) {
  if (!lastMove) {
    previousFen = fen;
    return;
  }

  const moveStr = lastMove.from + lastMove.to;

  // Only process new moves
  if (moveStr === lastMoveStr) return;

  // Reset pig on any new move
  pigKnightSquare = null;

  // Parse boards
  const currentBoard = parseFenToBoard(fen);
  const prevBoard = parseFenToBoard(previousFen);

  if (currentBoard && prevBoard) {
    const to = squareToIndices(lastMove.to);

    // What piece is now at the destination?
    const pieceAtDest = currentBoard[to.row]?.[to.col];

    // Was there a piece at destination before? (capture)
    const capturedPiece = prevBoard[to.row]?.[to.col];

    // Is it a knight that just moved there?
    if ((pieceAtDest === 'N' || pieceAtDest === 'n') && capturedPiece) {
      console.log('Knight capture detected!', lastMove.to, pieceAtDest, 'captured', capturedPiece);
      pigKnightSquare = lastMove.to;

      // Play oink
      oinkSound.currentTime = 0;
      oinkSound.play().catch(e => console.log('Audio error:', e));
    }
  }

  lastMoveStr = moveStr;
  previousFen = fen;
}

function updateBoard(state) {
  currentOrientation = state.orientation || 'white';

  // Detect knight captures for pig mode
  detectKnightCaptures(state.board, state.lastMove);

  renderBoard(state.board, state.lastMove, state.markedSquares, state.hints, state.selectedSquare);
  renderArrows(state.arrows);

  // Handle game result animation
  if (state.gameResult && state.gameResult !== lastGameResult) {
    lastGameResult = state.gameResult;
    showGameResultAnimation(state.gameResult);
  } else if (!state.gameResult && lastGameResult) {
    // Game result cleared (new game started)
    lastGameResult = null;
    hideGameResultAnimation();
  }

  // Analyze position with Stockfish
  if (state.board && !state.gameResult) {
    // Construct full FEN string
    const turn = state.turn === 'black' ? 'b' : 'w';
    const fullFen = `${state.board} ${turn} KQkq - 0 1`;

    // Only analyze if position changed
    if (fullFen !== lastAnalyzedFen) {
      lastAnalyzedFen = fullFen;
      analyzePosition(fullFen);
    }
  }
}

function showGameResultAnimation(result) {
  // Remove any existing overlay
  hideGameResultAnimation();

  const overlay = document.createElement('div');
  overlay.id = 'game-result-overlay';
  overlay.className = `game-result-${result}`;

  const text = document.createElement('div');
  text.className = 'game-result-text';

  const icon = document.createElement('div');
  icon.className = 'game-result-icon';

  if (result === 'win') {
    text.textContent = 'VICTORY';
    icon.textContent = '👑';
  } else if (result === 'loss') {
    text.textContent = 'DEFEAT';
    icon.textContent = '💀';
  } else if (result === 'draw') {
    text.textContent = 'DRAW';
    icon.textContent = '🤝';
  }

  overlay.appendChild(icon);
  overlay.appendChild(text);

  const boardEl = document.getElementById('board');
  boardEl.style.position = 'relative';
  boardEl.appendChild(overlay);

  // Trigger animation
  requestAnimationFrame(() => {
    overlay.classList.add('show');
  });
}

function hideGameResultAnimation() {
  const existing = document.getElementById('game-result-overlay');
  if (existing) {
    existing.remove();
  }
}

function renderBoard(fen, lastMove, markedSquares, hints, selectedSquare) {
  const boardEl = document.getElementById('board');

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

  // Build current piece positions map
  const currentPiecePositions = new Map();

  // Check if we need to rebuild the board (first render or structure change)
  const needsRebuild = boardEl.children.length !== 64;

  if (needsRebuild) {
    boardEl.innerHTML = '';
  }

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const actualRow = currentOrientation === 'white' ? row : 7 - row;
      const actualCol = currentOrientation === 'white' ? col : 7 - col;
      const squareName = files[col] + ranks[row];
      const piece = board[actualRow]?.[actualCol];

      let square;
      if (needsRebuild) {
        square = document.createElement('div');
        const isLight = (actualRow + actualCol) % 2 === 0;
        square.className = `square ${isLight ? 'light' : 'dark'}`;
        square.dataset.square = squareName;
        boardEl.appendChild(square);
      } else {
        square = boardEl.children[row * 8 + col];
        // Clear previous state classes but keep base classes
        square.className = square.className.replace(/\s*(selected|last-move|marked|king)\s*/g, ' ').trim();
        // Remove old pieces and hints
        square.querySelectorAll('.piece, .pig-knight, .hint-dot').forEach(el => el.remove());
      }

      // Apply square states
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

      // Track piece position
      if (piece) {
        currentPiecePositions.set(squareName, piece);
      }
    }
  }

  // Now render pieces with animation
  renderPiecesWithAnimation(board, files, ranks, currentPiecePositions, lastMove);

  // Update previous positions for next render
  previousPiecePositions = currentPiecePositions;
}

function renderPiecesWithAnimation(board, files, ranks, currentPiecePositions, lastMove) {
  const boardEl = document.getElementById('board');

  // Get or create pieces container
  let piecesContainer = document.getElementById('pieces-container');
  if (!piecesContainer) {
    piecesContainer = document.createElement('div');
    piecesContainer.id = 'pieces-container';
    piecesContainer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
    boardEl.style.position = 'relative';
    boardEl.appendChild(piecesContainer);
  }

  // Clear old pieces
  piecesContainer.innerHTML = '';

  // Find the piece that moved (if any)
  let fromPos = null;
  let toPos = null;

  if (lastMove) {
    const piece = currentPiecePositions.get(lastMove.to);
    if (piece && previousPiecePositions.has(lastMove.from)) {
      const prevPiece = previousPiecePositions.get(lastMove.from);
      // Check if same type of piece (accounting for promotion)
      if (prevPiece && (prevPiece === piece || (prevPiece.toLowerCase() === 'p' && piece !== prevPiece))) {
        fromPos = lastMove.from;
        toPos = lastMove.to;
      }
    }
  }

  // Render each piece
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const actualRow = currentOrientation === 'white' ? row : 7 - row;
      const actualCol = currentOrientation === 'white' ? col : 7 - col;
      const squareName = files[col] + ranks[row];
      const piece = board[actualRow]?.[actualCol];

      if (piece && PIECE_IMAGES[piece]) {
        const isPigKnight = (piece === 'N' || piece === 'n') && pigKnightSquare === squareName;
        const isMovingPiece = squareName === toPos;

        let pieceEl;
        if (isPigKnight) {
          pieceEl = document.createElement('span');
          pieceEl.className = 'piece pig-knight animated-piece';
          pieceEl.textContent = '🐷';
        } else {
          pieceEl = document.createElement('img');
          pieceEl.className = 'piece animated-piece';
          pieceEl.src = `${PIECE_BASE_URL}/${PIECE_IMAGES[piece]}`;
          pieceEl.alt = piece;
          pieceEl.draggable = false;
        }

        // Position the piece
        const targetX = col * SQUARE_SIZE;
        const targetY = row * SQUARE_SIZE;

        if (isMovingPiece && fromPos) {
          // Animate from old position to new position
          const fromCol = files.indexOf(fromPos[0]);
          const fromRow = ranks.indexOf(fromPos[1]);
          const startX = fromCol * SQUARE_SIZE;
          const startY = fromRow * SQUARE_SIZE;

          pieceEl.style.cssText = `position:absolute;left:${startX}px;top:${startY}px;width:${SQUARE_SIZE}px;height:${SQUARE_SIZE}px;transition:left 0.15s ease-out,top 0.15s ease-out;`;

          // Trigger animation after append
          requestAnimationFrame(() => {
            pieceEl.style.left = targetX + 'px';
            pieceEl.style.top = targetY + 'px';
          });
        } else {
          pieceEl.style.cssText = `position:absolute;left:${targetX}px;top:${targetY}px;width:${SQUARE_SIZE}px;height:${SQUARE_SIZE}px;`;
        }

        piecesContainer.appendChild(pieceEl);

        // Add king class to square
        const isMyKing = (currentOrientation === 'white' && piece === 'K') ||
                         (currentOrientation === 'black' && piece === 'k');
        if (isMyKing) {
          const square = boardEl.children[row * 8 + col];
          if (square) square.classList.add('king');
        }
      }
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

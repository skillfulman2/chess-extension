// Chess.com OBS Overlay - Content Script
// Extracts game data and sends to background script

let lastState = null;
let cachedLastMove = null;
let cachedBoard = null;

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

// Map Chess.com captured piece names to short codes
const CAPTURED_PIECE_NAME_MAP = {
  'pawn': 'p',
  'knight': 'n',
  'bishop': 'b',
  'rook': 'r',
  'queen': 'q',
  'king': 'k'
};

// Map Chess.com piece classes to FEN notation
const PIECE_MAP = {
  'wp': 'P', 'wn': 'N', 'wb': 'B', 'wr': 'R', 'wq': 'Q', 'wk': 'K',
  'bp': 'p', 'bn': 'n', 'bb': 'b', 'br': 'r', 'bq': 'q', 'bk': 'k'
};

function extractGameState() {
  try {
    const board = extractBoard();

    // Detect new game - reset state when board is starting position
    const isNewGame = board === STARTING_FEN;
    if (isNewGame && cachedBoard !== STARTING_FEN) {
      // New game started - reset cached state
      cachedLastMove = null;
      console.log('[Chess Overlay] New game detected - resetting state');
    }

    // Only update lastMove when the board position changes (actual move made)
    if (board !== cachedBoard) {
      cachedBoard = board;
      const newLastMove = extractLastMove();
      if (newLastMove) {
        cachedLastMove = newLastMove;
      }
    }

    const state = {
      board: board,
      players: extractPlayers(),
      clocks: extractClocks(),
      turn: extractTurn(),
      orientation: extractOrientation(),
      lastMove: cachedLastMove,
      arrows: extractArrows(),
      markedSquares: extractMarkedSquares(),
      hints: extractHints(),
      selectedSquare: extractSelectedSquare(),
      gameResult: extractGameResult(),
      capturedPieces: extractCapturedPieces(),
      moveList: extractMoveList(),
      isNewGame: isNewGame
    };

    // Only send if state changed
    const stateStr = JSON.stringify(state);
    if (stateStr !== lastState) {
      lastState = stateStr;
      chrome.runtime.sendMessage({ type: 'gameState', data: state });
      console.log('[Chess Overlay] State updated');
    }
  } catch (e) {
    console.error('[Chess Overlay] Error extracting state:', e);
  }
}

function extractBoard() {
  // Initialize empty board
  const board = Array(8).fill(null).map(() => Array(8).fill(null));

  // Find all pieces on the board
  // Chess.com uses classes like "piece wp square-85" for white pawn on e5
  const pieces = document.querySelectorAll('.piece');

  pieces.forEach(piece => {
    const classList = Array.from(piece.classList);

    // Find piece type (wp, bp, wn, bn, etc.)
    let pieceType = null;
    for (const cls of classList) {
      if (PIECE_MAP[cls]) {
        pieceType = PIECE_MAP[cls];
        break;
      }
    }

    // Find square (square-XY where X is file 1-8, Y is rank 1-8)
    let square = null;
    for (const cls of classList) {
      const match = cls.match(/^square-(\d)(\d)$/);
      if (match) {
        const file = parseInt(match[1]) - 1; // 0-7
        const rank = parseInt(match[2]) - 1; // 0-7
        square = { file, rank };
        break;
      }
    }

    if (pieceType && square) {
      // Board array: row 0 = rank 8, row 7 = rank 1
      const row = 7 - square.rank;
      const col = square.file;
      board[row][col] = pieceType;
    }
  });

  // Convert to FEN
  return boardToFEN(board);
}

function boardToFEN(board) {
  const rows = [];
  for (const row of board) {
    let fenRow = '';
    let emptyCount = 0;

    for (const piece of row) {
      if (piece === null) {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          fenRow += emptyCount;
          emptyCount = 0;
        }
        fenRow += piece;
      }
    }

    if (emptyCount > 0) {
      fenRow += emptyCount;
    }

    rows.push(fenRow);
  }

  return rows.join('/');
}

function extractPlayers() {
  const players = { white: {}, black: {} };
  const orientation = extractOrientation();

  // Bottom player is always YOU, top player is always OPPONENT
  const bottomCard = document.querySelector('#board-layout-player-bottom .player-component') ||
                     document.querySelector('#board-layout-player-bottom .player-playerContent') ||
                     document.querySelector('#board-layout-player-bottom');
  const topCard = document.querySelector('#board-layout-player-top .player-component') ||
                  document.querySelector('#board-layout-player-top .player-playerContent') ||
                  document.querySelector('#board-layout-player-top');

  if (bottomCard) {
    const playerInfo = extractPlayerInfo(bottomCard);
    players[orientation] = playerInfo; // You play this color
  }

  if (topCard) {
    const playerInfo = extractPlayerInfo(topCard);
    players[orientation === 'white' ? 'black' : 'white'] = playerInfo; // Opponent plays opposite color
  }

  return players;
}

function extractPlayerInfo(card) {
  const nameEl = card.querySelector('.cc-user-username-component, .user-username-component, [data-username]');
  const ratingEl = card.querySelector('.cc-user-rating-white, .cc-user-rating-black, [data-cy="user-tagline-rating"]');
  const titleEl = card.querySelector('.cc-user-title-component, .user-title-component');
  const avatarEl = card.querySelector('.cc-avatar-img, [data-cy="avatar"]');

  // Flag is a div with country code in class name (e.g., "country-us" or "country-2")
  const flagEl = card.querySelector('.country-flags-component');
  let countryCode = null;
  if (flagEl) {
    // Try letter code first (e.g., "country-us")
    let match = flagEl.className.match(/country-([a-z]{2})\b/);
    if (match) {
      countryCode = match[1];
    } else {
      // Try numeric code (e.g., "country-2") - exclude "country-flags"
      match = flagEl.className.match(/country-(\d+)\b/);
      if (match) {
        countryCode = match[1];
      }
    }
  }

  const rating = ratingEl?.textContent?.trim().replace(/[()]/g, '');

  console.log('[Chess Overlay] Extracted player:', {
    name: nameEl?.textContent?.trim(),
    rating: rating,
    countryCode: countryCode,
    avatar: avatarEl?.src
  });

  return {
    name: nameEl?.textContent?.trim() || 'Unknown',
    rating: parseInt(rating) || null,
    title: titleEl?.textContent?.trim() || null,
    avatar: avatarEl?.src || null,
    countryCode: countryCode
  };
}

function extractClocks() {
  const clocks = { white: null, black: null };

  // Find clock elements
  const clockElements = document.querySelectorAll('.clock-component, .clock-time-monospace');

  clockElements.forEach(clockEl => {
    const isBottom = clockEl.closest('.board-layout-bottom, .player-bottom, .board-player-default-bottom') !== null;
    const isTop = clockEl.closest('.board-layout-top, .player-top, .board-player-default-top') !== null;

    const timeText = clockEl.textContent?.trim();
    const seconds = parseTimeToSeconds(timeText);

    const orientation = extractOrientation();
    if (isBottom) {
      clocks[orientation] = seconds;
    } else if (isTop) {
      clocks[orientation === 'white' ? 'black' : 'white'] = seconds;
    }
  });

  return clocks;
}

function parseTimeToSeconds(timeStr) {
  if (!timeStr) return null;

  // Handle formats: "5:00", "0:30", "1:23:45", "0.5"
  const parts = timeStr.split(':');

  if (parts.length === 3) {
    // H:MM:SS
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    // M:SS
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  } else if (parts.length === 1) {
    // Just seconds (possibly with decimal)
    return parseFloat(parts[0]);
  }

  return null;
}

function extractTurn() {
  // Check which clock is active (running)
  const activeClocks = document.querySelectorAll('.clock-component.clock-player-turn, .clock-running');

  for (const clock of activeClocks) {
    const isBottom = clock.closest('.board-layout-bottom, .player-bottom, .board-player-default-bottom') !== null;
    const orientation = extractOrientation();

    if (isBottom) {
      return orientation;
    } else {
      return orientation === 'white' ? 'black' : 'white';
    }
  }

  // Fallback: try to detect from move indicator
  return 'white';
}

function extractOrientation() {
  // Bottom player (#board-layout-player-bottom) is always YOU
  // Check what color you're playing from the clock or username class

  // Check bottom clock's color class
  const bottomClock = document.querySelector('#board-layout-player-bottom .clock-component');
  if (bottomClock) {
    if (bottomClock.classList.contains('clock-white')) return 'white';
    if (bottomClock.classList.contains('clock-black')) return 'black';
  }

  // Fallback: check username color class
  const bottomUsername = document.querySelector('#board-layout-player-bottom .cc-user-username-component');
  if (bottomUsername) {
    if (bottomUsername.classList.contains('cc-user-username-white')) return 'white';
    if (bottomUsername.classList.contains('cc-user-username-black')) return 'black';
  }

  return 'white';
}

function extractGameResult() {
  // Find the title directly - more reliable
  const title = document.querySelector('.game-over-header-component .header-title-component, .board-modal-container-container .header-title-component');
  if (!title) return null;

  const text = title.textContent?.trim() || '';
  const textLower = text.toLowerCase();

  // Check for win
  if (textLower.includes('you won')) {
    return 'win';
  }

  // Check for loss - "[OpponentName] Won"
  if (textLower.includes(' won')) {
    return 'loss';
  }

  // Check for draw - "Draw" or any draw variant
  if (textLower === 'draw' || textLower.includes('stalemate') ||
      textLower.includes('repetition') || textLower.includes('insufficient') ||
      textLower.includes('agreement') || textLower.includes('timeout vs')) {
    return 'draw';
  }

  return null;
}

function extractLastMove() {
  // Find highlight squares for last move (opacity 0.5)
  const highlights = document.querySelectorAll('.highlight[class*="square-"]');
  const lastMove = { from: null, to: null };

  highlights.forEach(highlight => {
    const inlineStyle = highlight.getAttribute('style') || '';

    // Last-move highlights have opacity 0.5
    if (!inlineStyle.includes('0.5')) return;

    const classList = Array.from(highlight.classList);
    for (const cls of classList) {
      const match = cls.match(/^square-(\d)(\d)$/);
      if (match) {
        const file = String.fromCharCode(96 + parseInt(match[1]));
        const rank = match[2];
        const square = file + rank;

        if (!lastMove.from) {
          lastMove.from = square;
        } else {
          lastMove.to = square;
        }
        break;
      }
    }
  });

  return (lastMove.from && lastMove.to) ? lastMove : null;
}

function extractArrows() {
  const arrows = [];

  // Chess.com uses polygon elements with data-arrow attribute containing "e2e4" format
  document.querySelectorAll('svg.arrows polygon[data-arrow], svg .arrow[data-arrow]').forEach(el => {
    const arrowData = el.getAttribute('data-arrow');
    if (!arrowData || arrowData.length < 4) return;

    // Parse "f2g2" format - first 2 chars are from square, last 2 are to square
    const from = arrowData.slice(0, 2);
    const to = arrowData.slice(2, 4);

    // Detect color from style attribute
    const style = el.getAttribute('style') || '';
    let color = 'yellow';

    if (style.includes('255, 170, 0') || style.includes('rgba(255, 170, 0')) color = 'orange';
    else if (style.includes('255, 0, 0') || style.includes('red')) color = 'red';
    else if (style.includes('0, 255, 0') || style.includes('0, 128, 0') || style.includes('green')) color = 'green';
    else if (style.includes('0, 0, 255') || style.includes('blue')) color = 'blue';
    else if (style.includes('255, 255, 0') || style.includes('yellow')) color = 'yellow';

    arrows.push({ from, to, color });
  });

  // Log for debugging
  if (arrows.length > 0) {
    console.log('[Chess Overlay] Found arrows:', arrows);
  }

  return arrows;
}

function extractMarkedSquares() {
  const marks = [];

  // Chess.com user right-click marks
  document.querySelectorAll('.highlight[class*="square-"]').forEach(el => {
    // Skip hints
    if (el.classList.contains('hint')) return;

    const inlineStyle = el.getAttribute('style') || '';

    // Skip last-move highlights (opacity 0.5)
    if (inlineStyle.includes('opacity: 0.5') || inlineStyle.includes('opacity:0.5')) {
      return;
    }

    // Only process user marks (opacity 0.8)
    if (!inlineStyle.includes('opacity: 0.8') && !inlineStyle.includes('opacity:0.8')) {
      return;
    }

    const classList = Array.from(el.classList);

    // Find square position
    let square = null;
    for (const cls of classList) {
      const match = cls.match(/^square-(\d)(\d)$/);
      if (match) {
        const file = String.fromCharCode(96 + parseInt(match[1]));
        const rank = match[2];
        square = file + rank;
        break;
      }
    }

    if (!square) return;

    // Get the actual RGB color from the DOM
    const rgbMatch = inlineStyle.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!rgbMatch) return;

    const color = `rgb(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]})`;
    marks.push({ square, color });
  });

  return marks;
}

function extractHints() {
  const hints = [];

  // Chess.com shows legal move hints when clicking a piece
  document.querySelectorAll('.hint, .move-dest, [class*="legal"]').forEach(el => {
    const classList = Array.from(el.classList);

    // Find square position
    for (const cls of classList) {
      const match = cls.match(/^square-(\d)(\d)$/);
      if (match) {
        const file = String.fromCharCode(96 + parseInt(match[1]));
        const rank = match[2];
        hints.push(file + rank);
        break;
      }
    }
  });

  return hints;
}

function extractSelectedSquare() {
  // Build set of hint squares - these are legal move destinations
  const hintSquares = new Set();
  document.querySelectorAll('.hint[class*="square-"]').forEach(el => {
    const classList = Array.from(el.classList);
    for (const cls of classList) {
      const match = cls.match(/^square-(\d)(\d)$/);
      if (match) {
        const file = String.fromCharCode(96 + parseInt(match[1]));
        const rank = match[2];
        hintSquares.add(file + rank);
        break;
      }
    }
  });

  // If there are hints, there must be a selected piece - find it
  if (hintSquares.size > 0) {
    // Build a set of squares that have pieces on them
    const pieceSquares = new Set();
    document.querySelectorAll('.piece[class*="square-"]').forEach(el => {
      const classList = Array.from(el.classList);
      for (const cls of classList) {
        const match = cls.match(/^square-(\d)(\d)$/);
        if (match) {
          const file = String.fromCharCode(96 + parseInt(match[1]));
          const rank = match[2];
          pieceSquares.add(file + rank);
          break;
        }
      }
    });

    // The selected square is a highlighted square that:
    // 1. Has a piece on it
    // 2. Is NOT a hint destination (hints are where the piece can move TO)
    const highlights = document.querySelectorAll('.highlight[class*="square-"]');

    for (const el of highlights) {
      // Skip hint elements
      if (el.classList.contains('hint')) continue;

      const classList = Array.from(el.classList);
      for (const cls of classList) {
        const match = cls.match(/^square-(\d)(\d)$/);
        if (match) {
          const file = String.fromCharCode(96 + parseInt(match[1]));
          const rank = match[2];
          const square = file + rank;

          // Skip if this is a hint destination
          if (hintSquares.has(square)) continue;

          // The selected square must have a piece on it
          if (pieceSquares.has(square)) {
            return square;
          }
        }
      }
    }
  }

  return null;
}

function extractMoveList() {
  const moves = [];

  const rows = document.querySelectorAll('.main-line-row.move-list-row');
  if (rows.length === 0) return moves;

  // Take all rows, we'll slice the last 5 on the overlay side
  rows.forEach(row => {
    const moveNumber = row.getAttribute('data-whole-move-number');
    if (!moveNumber) return;

    const whiteNode = row.querySelector('.white-move .node-highlight-content');
    const blackNode = row.querySelector('.black-move .node-highlight-content');

    const move = { number: parseInt(moveNumber), white: null, black: null };

    if (whiteNode) {
      move.white = parseMoveNode(whiteNode);
    }
    if (blackNode) {
      move.black = parseMoveNode(blackNode);
    }

    moves.push(move);
  });

  return moves.slice(-15);
}

function parseMoveNode(node) {
  const figurine = node.querySelector('[data-figurine]');
  const piece = figurine ? figurine.getAttribute('data-figurine') : '';
  const isSelected = node.classList.contains('selected');

  // Get only the text content that isn't inside the figurine span
  let moveText = '';
  node.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      moveText += child.textContent;
    } else if (!child.hasAttribute?.('data-figurine')) {
      moveText += child.textContent;
    }
  });
  moveText = moveText.trim();

  return { text: piece + moveText, selected: isSelected };
}

function extractCapturedPieces() {
  const captured = {
    white: { pieces: [], score: '' },
    black: { pieces: [], score: '' }
  };
  const orientation = extractOrientation();

  const bottomContainer = document.querySelector('#board-layout-player-bottom');
  const topContainer = document.querySelector('#board-layout-player-top');

  if (bottomContainer) {
    captured[orientation] = parseCapturedPiecesFromContainer(bottomContainer);
  }
  if (topContainer) {
    const opponentColor = orientation === 'white' ? 'black' : 'white';
    captured[opponentColor] = parseCapturedPiecesFromContainer(topContainer);
  }

  return captured;
}

function parseCapturedPiecesFromContainer(container) {
  const pieces = [];
  let score = '';

  // Support both old (.captured-pieces) and new (wc-captured-pieces) Chess.com DOM
  const capturedDiv = container.querySelector('wc-captured-pieces, .captured-pieces');
  if (!capturedDiv) return { pieces, score };

  capturedDiv.querySelectorAll('.captured-pieces-cpiece').forEach(el => {
    if (el.classList.contains('captured-pieces-score')) {
      score = el.textContent?.trim() || '';
      return;
    }

    const classList = Array.from(el.classList);
    for (const cls of classList) {
      // Format with count: captured-pieces-w-3-pawns
      let match = cls.match(/^captured-pieces-([wb])-(\d+)-(pawns|knights|bishops|rooks|queens|kings)$/);
      if (match) {
        const color = match[1];
        const count = parseInt(match[2]);
        const pieceName = match[3].replace(/s$/, '');
        const pieceCode = color + CAPTURED_PIECE_NAME_MAP[pieceName];
        for (let i = 0; i < count; i++) {
          pieces.push(pieceCode);
        }
        break;
      }

      // Format without count: captured-pieces-w-bishop or captured-pieces-b-pawn
      match = cls.match(/^captured-pieces-([wb])-(pawn|knight|bishop|rook|queen|king)$/);
      if (match) {
        const color = match[1];
        const pieceCode = color + CAPTURED_PIECE_NAME_MAP[match[2]];
        pieces.push(pieceCode);
        break;
      }
    }
  });

  return { pieces, score };
}

// Set up observers
function initialize() {
  console.log('[Chess Overlay] Initializing...');

  // Debounce function to avoid too many updates
  let debounceTimer = null;
  function debouncedUpdate() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(extractGameState, 50);
  }

  // Observer for board changes (pieces, highlights)
  const boardObserver = new MutationObserver(debouncedUpdate);

  // Observer for arrows SVG
  const arrowObserver = new MutationObserver(debouncedUpdate);

  // Observer for clock updates
  const clockObserver = new MutationObserver(debouncedUpdate);

  // Wait for board to be available
  const waitForBoard = setInterval(() => {
    const board = document.querySelector('.board, #board-layout-main, .board-layout-chessboard');
    if (board) {
      clearInterval(waitForBoard);

      // Observe the board for piece movements
      boardObserver.observe(board, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style']
      });
      console.log('[Chess Overlay] Board observer attached');

      // Find and observe the arrows SVG container
      const arrowsSvg = document.querySelector('svg.arrows');
      if (arrowsSvg) {
        arrowObserver.observe(arrowsSvg, {
          childList: true,
          subtree: true,
          attributes: true
        });
        console.log('[Chess Overlay] Arrows observer attached');
      }

      // Observe parent for arrows SVG being added later
      const boardParent = board.parentElement;
      if (boardParent) {
        const parentObserver = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
              if (node.classList?.contains('arrows') || node.tagName === 'svg') {
                arrowObserver.observe(node, {
                  childList: true,
                  subtree: true,
                  attributes: true
                });
                console.log('[Chess Overlay] Arrows observer attached (late)');
              }
            }
          }
          debouncedUpdate();
        });
        parentObserver.observe(boardParent, { childList: true });
      }

      // Observe clocks
      const clocks = document.querySelectorAll('.clock-component, .clock-time-monospace');
      clocks.forEach(clock => {
        clockObserver.observe(clock, {
          childList: true,
          subtree: true,
          characterData: true
        });
      });
      if (clocks.length > 0) {
        console.log('[Chess Overlay] Clock observers attached');
      }

      // Observe player areas for captured pieces changes
      const playerObserver = new MutationObserver(debouncedUpdate);
      const playerAreas = document.querySelectorAll('#board-layout-player-bottom, #board-layout-player-top');
      playerAreas.forEach(area => {
        playerObserver.observe(area, {
          childList: true,
          subtree: true,
          characterData: true
        });
      });
      if (playerAreas.length > 0) {
        console.log('[Chess Overlay] Player area observers attached');
      }

      // Observe move list for new moves
      const moveListObserver = new MutationObserver(debouncedUpdate);
      const moveList = document.querySelector('wc-simple-move-list, .move-list');
      if (moveList) {
        moveListObserver.observe(moveList, {
          childList: true,
          subtree: true,
          characterData: true
        });
        console.log('[Chess Overlay] Move list observer attached');
      }

      // Initial extraction
      extractGameState();
    }
  }, 200);
}


// Start
initialize();

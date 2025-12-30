// Chess.com OBS Overlay - Content Script
// Extracts game data and sends to background script

let lastState = null;
let cachedLastMove = null;
let cachedBoard = null;

// Map Chess.com piece classes to FEN notation
const PIECE_MAP = {
  'wp': 'P', 'wn': 'N', 'wb': 'B', 'wr': 'R', 'wq': 'Q', 'wk': 'K',
  'bp': 'p', 'bn': 'n', 'bb': 'b', 'br': 'r', 'bq': 'q', 'bk': 'k'
};

function extractGameState() {
  try {
    const board = extractBoard();

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
      selectedSquare: extractSelectedSquare()
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

  // Try multiple selector patterns for player info
  // Chess.com has different layouts for different game modes

  // Pattern 1: Live game player cards
  const playerCards = document.querySelectorAll('.player-component');
  playerCards.forEach(card => {
    const isBottom = card.closest('.board-layout-bottom') !== null ||
                     card.classList.contains('player-bottom');
    const isTop = card.closest('.board-layout-top') !== null ||
                  card.classList.contains('player-top');

    const nameEl = card.querySelector('.user-username-component, .username, [data-username]');
    const ratingEl = card.querySelector('.user-rating-component, .rating');
    const titleEl = card.querySelector('.user-title-component, .title');

    const playerInfo = {
      name: nameEl?.textContent?.trim() || nameEl?.getAttribute('data-username') || 'Unknown',
      rating: parseInt(ratingEl?.textContent?.replace(/[()]/g, '')) || null,
      title: titleEl?.textContent?.trim() || null
    };

    // Determine color based on position and board orientation
    const orientation = extractOrientation();
    if (isBottom) {
      players[orientation] = playerInfo;
    } else if (isTop) {
      players[orientation === 'white' ? 'black' : 'white'] = playerInfo;
    }
  });

  // Pattern 2: Try alternative selectors if above didn't work
  if (!players.white.name || players.white.name === 'Unknown') {
    const bottomUser = document.querySelector('.board-player-default-bottom .user-username-component');
    const topUser = document.querySelector('.board-player-default-top .user-username-component');

    if (bottomUser || topUser) {
      const orientation = extractOrientation();
      if (bottomUser) {
        players[orientation].name = bottomUser.textContent?.trim() || 'Unknown';
      }
      if (topUser) {
        players[orientation === 'white' ? 'black' : 'white'].name = topUser.textContent?.trim() || 'Unknown';
      }
    }
  }

  return players;
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
  // Check if board is flipped
  const board = document.querySelector('.board, .board-layout-chessboard');

  if (board) {
    // Chess.com adds 'flipped' class when playing as black
    if (board.classList.contains('flipped')) {
      return 'black';
    }

    // Alternative: check coordinates
    const coords = document.querySelector('.coordinates-rank');
    if (coords) {
      const firstCoord = coords.firstElementChild?.textContent;
      if (firstCoord === '1') {
        return 'black';
      }
    }
  }

  return 'white';
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
  // Look for selected piece highlight - usually has a different style
  // Chess.com may use various selectors for the selected piece
  const selectors = [
    '.piece.selected',
    '.piece[class*="selected"]',
    '.square-selected',
    '[class*="selected"][class*="square-"]'
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      const classList = Array.from(el.classList);
      for (const cls of classList) {
        const match = cls.match(/^square-(\d)(\d)$/);
        if (match) {
          const file = String.fromCharCode(96 + parseInt(match[1]));
          const rank = match[2];
          return file + rank;
        }
      }
    }
  }

  // Also check for highlight with opacity 1 (selected piece highlight)
  const highlights = document.querySelectorAll('.highlight[class*="square-"]');
  for (const el of highlights) {
    const inlineStyle = el.getAttribute('style') || '';
    // Selected piece might have opacity 1 or no opacity specified
    if (inlineStyle.includes('opacity: 1') || inlineStyle.includes('opacity:1') ||
        (!inlineStyle.includes('opacity: 0.5') && !inlineStyle.includes('opacity: 0.8') &&
         !inlineStyle.includes('opacity:0.5') && !inlineStyle.includes('opacity:0.8'))) {

      // Check if it has a yellowish/selection color
      const rgbMatch = inlineStyle.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (rgbMatch) {
        const r = parseInt(rgbMatch[1]);
        const g = parseInt(rgbMatch[2]);
        // Selection highlight is usually yellow-ish
        if (r > 200 && g > 180) {
          const classList = Array.from(el.classList);
          for (const cls of classList) {
            const match = cls.match(/^square-(\d)(\d)$/);
            if (match) {
              const file = String.fromCharCode(96 + parseInt(match[1]));
              const rank = match[2];
              return file + rank;
            }
          }
        }
      }
    }
  }

  return null;
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

      // Initial extraction
      extractGameState();
    }
  }, 200);
}


// Start
initialize();

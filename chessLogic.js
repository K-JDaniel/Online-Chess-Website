/*
  chessLogic.js
  --------------
  This file owns all chess RULE logic — nothing about React, DOM, or rendering
  lives here. It currently implements: initial board setup, full piece
  movement validation (pawn, knight, rook, bishop, queen, king — including
  path-clearing for sliding pieces), king safety (a move is only legal if it
  doesn't leave the mover's own king in check), and checkmate detection.

  This is a plain script (not an ES module) so it can be loaded with a
  regular <script> tag before App.jsx and used directly as global
  functions/constants — no bundler required.
*/

// Board is an 8x8 array of arrays.
// row 0 = rank 8 ... row 7 = rank 1
// col 0 = file a  ... col 7 = file h
// Each cell is either null (empty) or a two-character piece code:
//   first character: "w" (white) or "b" (black)
//   second character: p, r, n, b, q, k (pawn, rook, knight, bishop, queen, king)

const PIECE_NAMES = {
  p: "Pawn",
  r: "Rook",
  n: "Knight",
  b: "Bishop",
  q: "Queen",
  k: "King",
};

// Returns "w", "b", or null if the square is empty.
function getPieceColor(piece) {
  if (!piece) return null;
  return piece[0];
}

// Returns "p" | "r" | "n" | "b" | "q" | "k", or null if the square is empty.
function getPieceType(piece) {
  if (!piece) return null;
  return piece[1];
}

// Builds a brand-new 8x8 board in the standard starting position.
function createInitialBoard() {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));

  const backRankOrder = ["r", "n", "b", "q", "k", "b", "n", "r"];

  for (let col = 0; col < 8; col++) {
    board[0][col] = "b" + backRankOrder[col]; // black back rank, rank 8
    board[1][col] = "bp"; // black pawns, rank 7
    board[6][col] = "wp"; // white pawns, rank 2
    board[7][col] = "w" + backRankOrder[col]; // white back rank, rank 1
  }

  return board;
}

// Converts a (row, col) pair into standard algebraic notation, e.g. (0,0) -> "a8".
function squareToAlgebraic(row, col) {
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"];
  return files[col] + ranks[row];
}

// ---------------------------------------------------------------------
// Player / color helpers
// ---------------------------------------------------------------------
// ChessGame's currentPlayer state uses the readable strings "white" /
// "black". Board pieces use the single-letter color codes "w" / "b".
// These helpers are the only place that translates between the two, so
// the rest of the app never has to hardcode "w/b vs white/black" logic.

const PLAYER_WHITE = "white";
const PLAYER_BLACK = "black";

// "white" -> "w", "black" -> "b"
function getColorCode(player) {
  return player === PLAYER_WHITE ? "w" : "b";
}

function getOpponentPlayer(player) {
  return player === PLAYER_WHITE ? PLAYER_BLACK : PLAYER_WHITE;
}

// True if the given piece belongs to the given player.
function isOwnPiece(piece, player) {
  return getPieceColor(piece) === getColorCode(player);
}

// ---------------------------------------------------------------------
// Path checking (used by rook, bishop, queen — sliding pieces)
// ---------------------------------------------------------------------
// Checks every square strictly between "from" and "to" (exclusive of both
// endpoints) is empty. Assumes it is only called with a move that is
// already known to be a straight line (horizontal, vertical, or diagonal).
function isPathClear(board, from, to) {
  const rowStep = Math.sign(to.row - from.row);
  const colStep = Math.sign(to.col - from.col);

  let row = from.row + rowStep;
  let col = from.col + colStep;

  while (row !== to.row || col !== to.col) {
    if (board[row][col] !== null) return false;
    row += rowStep;
    col += colStep;
  }

  return true;
}

// ---------------------------------------------------------------------
// simulateMove — pure "what if" board application
// ---------------------------------------------------------------------
// Returns a BRAND NEW board with the given move blindly applied — it does
// not check whether the move is legal, only mechanically moves whatever
// piece is at "from" to "to". Used both to build the real board after a
// legal move is confirmed, and to build hypothetical boards for king-safety
// checking. Always copies row-by-row (board.map(row => [...row])) so the
// original board passed in is never mutated.
function simulateMove(board, from, to) {
  const newBoard = board.map((row) => [...row]);
  newBoard[to.row][to.col] = newBoard[from.row][from.col];
  newBoard[from.row][from.col] = null;
  return newBoard;
}

// ---------------------------------------------------------------------
// Per-piece movement validation
// ---------------------------------------------------------------------
// Each function checks ONLY that piece's movement pattern (plus path
// clearing / capture rules specific to it). Shared checks that apply to
// every piece — own-piece square, whose turn it is — live in
// validateMove() so they aren't repeated in each function below.

function isPawnMoveValid(board, from, to, currentPlayer) {
  // White advances toward row 0 (direction -1), black toward row 7 (+1).
  const direction = currentPlayer === PLAYER_WHITE ? -1 : 1;
  const startRow = currentPlayer === PLAYER_WHITE ? 6 : 1;

  const rowDiff = to.row - from.row;
  const colDiff = to.col - from.col;
  const destinationPiece = board[to.row][to.col];

  // One square straight forward onto an empty square.
  if (colDiff === 0 && rowDiff === direction && destinationPiece === null) {
    return true;
  }

  // Two squares straight forward, only from the starting row, and only
  // if both the square passed over and the destination are empty.
  if (colDiff === 0 && from.row === startRow && rowDiff === direction * 2) {
    const passedOverRow = from.row + direction;
    if (board[passedOverRow][from.col] === null && destinationPiece === null) {
      return true;
    }
  }

  // Diagonal capture: one row forward, one column over, and an opponent
  // piece must be on the destination square (no forward-only capture).
  if (Math.abs(colDiff) === 1 && rowDiff === direction) {
    if (destinationPiece !== null && getPieceColor(destinationPiece) !== getColorCode(currentPlayer)) {
      return true;
    }
  }

  return false;
}

function isKnightMoveValid(from, to) {
  const rowDiff = Math.abs(to.row - from.row);
  const colDiff = Math.abs(to.col - from.col);
  // No path checking — knights jump over anything in between.
  return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
}

function isRookMoveValid(board, from, to) {
  const sameRow = from.row === to.row;
  const sameCol = from.col === to.col;
  if (!sameRow && !sameCol) return false;
  if (sameRow && sameCol) return false; // not actually a move

  return isPathClear(board, from, to);
}

function isBishopMoveValid(board, from, to) {
  const rowDiff = Math.abs(to.row - from.row);
  const colDiff = Math.abs(to.col - from.col);
  if (rowDiff !== colDiff || rowDiff === 0) return false;

  return isPathClear(board, from, to);
}

function isQueenMoveValid(board, from, to) {
  // A queen moves like a rook OR like a bishop — no separate geometry.
  return isRookMoveValid(board, from, to) || isBishopMoveValid(board, from, to);
}

function isKingMoveValid(board, from, to, currentPlayer) {
  const rowDiff = Math.abs(to.row - from.row);
  const colDiff = Math.abs(to.col - from.col);
  if (rowDiff > 1 || colDiff > 1) return false;
  if (rowDiff === 0 && colDiff === 0) return false; // not actually a move

  const destinationPiece = board[to.row][to.col];
  if (destinationPiece && getPieceColor(destinationPiece) === getColorCode(currentPlayer)) {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------
// validateMove — checks piece-movement legality only (no king safety)
// ---------------------------------------------------------------------
// Runs the shared checks (piece exists, belongs to the current player,
// destination isn't a friendly piece), dispatches to the right per-piece
// movement function, and — only if everything passes — builds a new board
// with the move applied via simulateMove(). Never mutates the board it is
// given.
//
// NOTE: this does NOT check whether the move leaves the mover's own king
// in check — that is layered on top by isLegalMove() below, which is what
// the UI actually calls.
function validateMove(board, from, to, currentPlayer) {
  const sourcePiece = board[from.row][from.col];

  if (!sourcePiece) {
    return { valid: false, reason: "There is no piece on the source square." };
  }

  if (getPieceColor(sourcePiece) !== getColorCode(currentPlayer)) {
    return { valid: false, reason: "That piece does not belong to the current player." };
  }

  const destinationPiece = board[to.row][to.col];
  if (destinationPiece && getPieceColor(destinationPiece) === getColorCode(currentPlayer)) {
    return { valid: false, reason: "Cannot capture your own piece." };
  }

  const pieceType = getPieceType(sourcePiece);
  let shapeIsValid = false;

  switch (pieceType) {
    case "p":
      shapeIsValid = isPawnMoveValid(board, from, to, currentPlayer);
      break;
    case "n":
      shapeIsValid = isKnightMoveValid(from, to);
      break;
    case "r":
      shapeIsValid = isRookMoveValid(board, from, to);
      break;
    case "b":
      shapeIsValid = isBishopMoveValid(board, from, to);
      break;
    case "q":
      shapeIsValid = isQueenMoveValid(board, from, to);
      break;
    case "k":
      shapeIsValid = isKingMoveValid(board, from, to, currentPlayer);
      break;
    default:
      shapeIsValid = false;
  }

  if (!shapeIsValid) {
    return { valid: false, reason: "Illegal move for this piece." };
  }

  return { valid: true, newBoard: simulateMove(board, from, to) };
}

// ---------------------------------------------------------------------
// Attack detection helpers (used by isSquareAttacked)
// ---------------------------------------------------------------------
// These describe what a piece THREATENS, which is not always the same as
// where it's allowed to MOVE. A pawn's attack squares are diagonal only
// (unlike its forward-only, non-capturing advance), and attack detection
// must not care whose piece — if any — actually sits on the target square.

// A pawn of attackingColor at "from" attacks "to" if "to" is one row in
// the pawn's forward direction and exactly one column to either side.
function isPawnAttack(from, to, attackingColor) {
  const direction = attackingColor === PLAYER_WHITE ? -1 : 1;
  const rowDiff = to.row - from.row;
  const colDiff = Math.abs(to.col - from.col);
  return rowDiff === direction && colDiff === 1;
}

// A king attacks any of the 8 squares immediately surrounding it.
function isKingAttack(from, to) {
  const rowDiff = Math.abs(to.row - from.row);
  const colDiff = Math.abs(to.col - from.col);
  return rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0);
}

// ---------------------------------------------------------------------
// isSquareAttacked — is (targetRow, targetCol) attacked by attackingColor?
// ---------------------------------------------------------------------
// Scans every square for a piece belonging to attackingColor and checks
// whether that piece's attack pattern reaches the target square. Sliding
// pieces (rook/bishop/queen) reuse their own movement-validity functions,
// since those already combine "correct geometry" with "clear path" — a
// blocked sliding piece correctly does NOT attack past whatever blocks it.
// Knights reuse their movement function too, since knight movement and
// knight attack are identical (no path to check either way). Pawns and
// kings get their own attack-specific functions above.
function isSquareAttacked(board, targetRow, targetCol, attackingColor) {
  const to = { row: targetRow, col: targetCol };

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) continue;
      if (getPieceColor(piece) !== getColorCode(attackingColor)) continue;

      const from = { row, col };
      const pieceType = getPieceType(piece);

      switch (pieceType) {
        case "p":
          if (isPawnAttack(from, to, attackingColor)) return true;
          break;
        case "n":
          if (isKnightMoveValid(from, to)) return true;
          break;
        case "r":
          if (isRookMoveValid(board, from, to)) return true;
          break;
        case "b":
          if (isBishopMoveValid(board, from, to)) return true;
          break;
        case "q":
          if (isQueenMoveValid(board, from, to)) return true;
          break;
        case "k":
          if (isKingAttack(from, to)) return true;
          break;
      }
    }
  }

  return false;
}

// ---------------------------------------------------------------------
// findKing — locate a color's king on a given board
// ---------------------------------------------------------------------
function findKing(board, color) {
  const kingPiece = getColorCode(color) + "k";

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if (board[row][col] === kingPiece) {
        return { row, col };
      }
    }
  }

  return null; // should never happen in a well-formed game
}

// ---------------------------------------------------------------------
// isKingInCheck — is color's king currently attacked by the opponent?
// ---------------------------------------------------------------------
function isKingInCheck(board, color) {
  const kingSquare = findKing(board, color);
  if (!kingSquare) return false;

  const opponent = getOpponentPlayer(color);
  return isSquareAttacked(board, kingSquare.row, kingSquare.col, opponent);
}

// ---------------------------------------------------------------------
// isLegalMove — full legality: movement rules AND king safety
// ---------------------------------------------------------------------
// A move is only truly legal if it (a) follows its piece's movement rules
// and (b) does not leave the moving player's own king in check afterward.
// This is the function the UI should treat as the source of truth for
// "can this move happen" — it wraps validateMove() rather than duplicating
// its logic, then simulates the resulting position to test king safety.
function isLegalMove(board, from, to, currentPlayer) {
  const shapeCheck = validateMove(board, from, to, currentPlayer);
  if (!shapeCheck.valid) {
    return shapeCheck;
  }

  // shapeCheck.newBoard was already built via simulateMove() inside
  // validateMove() — reuse it rather than simulating the move twice.
  if (isKingInCheck(shapeCheck.newBoard, currentPlayer)) {
    return { valid: false, reason: "This move would leave your king in check." };
  }

  return shapeCheck;
}

// ---------------------------------------------------------------------
// hasAnyLegalMove — does this color have ANY legal move on this board?
// ---------------------------------------------------------------------
// Brute-force by design: try every one of this color's pieces against
// every square on the board, and ask isLegalMove() whether that move is
// legal. isLegalMove() already covers movement rules AND king safety, so
// this single loop naturally covers every way out of check — moving the
// king, capturing the attacker, blocking a sliding attack, or any other
// legal response — without special-casing any of them. As soon as one
// legal move is found, we can stop early.
function hasAnyLegalMove(board, color) {
  for (let fromRow = 0; fromRow < 8; fromRow++) {
    for (let fromCol = 0; fromCol < 8; fromCol++) {
      const piece = board[fromRow][fromCol];
      if (!piece || getPieceColor(piece) !== getColorCode(color)) continue;

      for (let toRow = 0; toRow < 8; toRow++) {
        for (let toCol = 0; toCol < 8; toCol++) {
          if (fromRow === toRow && fromCol === toCol) continue;

          const from = { row: fromRow, col: fromCol };
          const to = { row: toRow, col: toCol };

          if (isLegalMove(board, from, to, color).valid) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

// ---------------------------------------------------------------------
// isCheckmate — is color checkmated on this board?
// ---------------------------------------------------------------------
// Checkmate is exactly two conditions, both required:
//   1. The player's king is currently in check.
//   2. The player has no legal move (of any kind) that gets them out of it.
// Deliberately does NOT stop at step 1 — a king in check with a legal
// response (escape, capture, or block) is just "check", not "checkmate".
// Uses isKingInCheck() and hasAnyLegalMove() (which itself uses
// isLegalMove()) — never calls itself, directly or indirectly, so there is
// no recursion here.
function isCheckmate(board, color) {
  if (!isKingInCheck(board, color)) return false;
  return !hasAnyLegalMove(board, color);
}

// ---------------------------------------------------------------------
// Move attempt (the seam ChessGame calls)
// ---------------------------------------------------------------------
// Delegates to isLegalMove(), which enforces both piece-movement rules
// and king safety. ChessGame never needs to know how legality is
// determined — only that "valid: true" means safe to commit.
function attemptMove(board, from, to, currentPlayer) {
  return isLegalMove(board, from, to, currentPlayer);
}

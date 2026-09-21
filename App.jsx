/*
  App.jsx
  -------
  This file owns the React application: component tree, ChessGame-level
  state, and click handling that coordinates with chessLogic.js.

  ChessGame owns state and reacts to results; chessLogic.js is the sole
  authority on whether a move is legal (movement rules AND king safety)
  and on building the resulting board. App.jsx never inspects board
  squares to decide legality itself — it only calls attemptMove() and
  acts on the { valid, newBoard, reason } result.

  Loaded via Babel's in-browser JSX transform (see index.html), so it can
  use JSX directly without a build step. chessLogic.js is loaded first as a
  plain script, so its functions (createInitialBoard, attemptMove, ...)
  are already available as globals here.
*/

const { useState } = React;

// Maps a piece code (e.g. "wk", "bp") to the Unicode chess glyph used to
// display it. This is purely a presentation concern, so it lives here in
// the UI file rather than in chessLogic.js.
const PIECE_GLYPHS = {
  wk: "♔",
  wq: "♕",
  wr: "♖",
  wb: "♗",
  wn: "♘",
  wp: "♙",
  bk: "♚",
  bq: "♛",
  br: "♜",
  bb: "♝",
  bn: "♞",
  bp: "♟",
};

// ---------------------------------------------------------------------
// Square
// ---------------------------------------------------------------------
// Purely presentational. It knows how to render one square (color, piece
// glyph, selected state) and reports clicks upward — it makes no chess
// decisions of its own.
function Square({ row, col, piece, isLight, isSelected, onClick }) {
  const classNames = [
    "square",
    isLight ? "square-light" : "square-dark",
    isSelected ? "square-selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const squareName = squareToAlgebraic(row, col);
  const pieceLabel = piece
    ? `${getPieceColor(piece) === "w" ? "White" : "Black"} ${PIECE_NAMES[getPieceType(piece)]}`
    : "empty";

  function handleClick() {
    onClick(row, col);
  }

  function handleKeyDown(event) {
    // Make the board usable from the keyboard, not just mouse/touch — a
    // square wrapped in a plain <div> isn't focusable or activatable by
    // default, so without this, tabbing to a square and pressing
    // Enter/Space would silently do nothing.
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick(row, col);
    }
  }

  return (
    <div
      className={classNames}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${squareName}, ${pieceLabel}`}
      data-square={squareName}
    >
      {piece && <span className="piece">{PIECE_GLYPHS[piece]}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------
// ChessBoard
// ---------------------------------------------------------------------
// Renders the 8x8 grid of Square components from the board array it is
// given. Holds no chess state of its own — everything comes from props.
function ChessBoard({ board, selectedSquare, onSquareClick }) {
  const squares = [];

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const isLight = (row + col) % 2 === 0;
      const isSelected =
        selectedSquare !== null &&
        selectedSquare.row === row &&
        selectedSquare.col === col;

      squares.push(
        <Square
          key={`${row}-${col}`}
          row={row}
          col={col}
          piece={board[row][col]}
          isLight={isLight}
          isSelected={isSelected}
          onClick={onSquareClick}
        />
      );
    }
  }

  return <div className="chess-board">{squares}</div>;
}

// ---------------------------------------------------------------------
// ChessGame
// ---------------------------------------------------------------------
// Owns all game-level state: board, whose turn it is, the current
// selection, and overall game status. Passes data and callbacks down to
// ChessBoard. Move legality, turn switching, and check detection are all
// wired up; checkmate detection is added in a later step.
function ChessGame() {
  const [board, setBoard] = useState(createInitialBoard());
  const [currentPlayer, setCurrentPlayer] = useState(PLAYER_WHITE);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [gameStatus, setGameStatus] = useState("playing");
  // Purely a UI concern (not chess state): the reason the last move attempt
  // was rejected, shown to the user until their next interaction.
  const [moveWarning, setMoveWarning] = useState(null);

  function handleSquareClick(row, col) {
    // Once the game has ended, the board stays visible but stops
    // responding to further input.
    if (gameStatus === "checkmate") return;

    const piece = board[row][col];

    // Any new click starts a fresh interaction — clear any warning left
    // over from a previous failed attempt. If this click also fails, it
    // gets set again below.
    setMoveWarning(null);

    // Case 1: nothing selected yet — this click is a selection attempt.
    if (!selectedSquare) {
      if (piece && isOwnPiece(piece, currentPlayer)) {
        setSelectedSquare({ row, col });
      }
      // Empty square, or an opponent piece on the current player's turn:
      // ignore the click, nothing changes.
      return;
    }

    // Case 2: clicking the already-selected square again — deselect.
    if (selectedSquare.row === row && selectedSquare.col === col) {
      setSelectedSquare(null);
      return;
    }

    // Case 3: a piece is selected and the user clicked a different square
    // that holds another of their own pieces — switch the selection to it
    // rather than attempting an (always-illegal) move onto your own piece.
    if (piece && isOwnPiece(piece, currentPlayer)) {
      setSelectedSquare({ row, col });
      return;
    }

    // Case 4: a piece is selected and the target square is either empty or
    // holds an opponent piece — treat this as a move attempt. Source and
    // destination are handed to chessLogic.js, which is the only place
    // that decides whether the move is legal (movement rules AND king
    // safety — see isLegalMove in chessLogic.js).
    const from = selectedSquare;
    const to = { row, col };
    const moveResult = attemptMove(board, from, to, currentPlayer);

    if (moveResult.valid) {
      // chessLogic.js already built the new board (via simulateMove,
      // board.map(row => [...row]) under the hood) without touching the
      // original — App.jsx's job is only to commit it, never to build or
      // mutate board state itself.
      const newBoard = moveResult.newBoard;
      const opponent = getOpponentPlayer(currentPlayer);

      // Check (and checkmate) must be evaluated on the RESULTING position
      // (newBoard), for the player who is about to move next (opponent) —
      // never on the board as it was before this move.
      const opponentInCheck = isKingInCheck(newBoard, opponent);
      // isCheckmate() re-confirms check internally and then asks the more
      // expensive question ("does this player have ANY legal move?") — only
      // worth asking at all once we already know the king is in check.
      const opponentCheckmated = opponentInCheck && isCheckmate(newBoard, opponent);

      setBoard(newBoard);
      setCurrentPlayer(opponent);
      setSelectedSquare(null);
      setGameStatus(opponentCheckmated ? "checkmate" : opponentInCheck ? "check" : "playing");
    } else {
      // Illegal move: board and currentPlayer are left completely
      // untouched. The selection is deliberately KEPT (not cleared) so the
      // user can immediately try a different destination for the same
      // piece, and the reason is surfaced so the rejection isn't silent.
      setMoveWarning(moveResult.reason);
    }
  }

  const turnLabel = currentPlayer === PLAYER_WHITE ? "White" : "Black";

  let statusText;
  let statusModifierClass = "";
  let indicatorColor = currentPlayer;

  if (gameStatus === "checkmate") {
    // currentPlayer has already been switched to the player who has no
    // legal move — the winner is simply the other side.
    const winnerColor = getOpponentPlayer(currentPlayer);
    const winnerLabel = winnerColor === PLAYER_WHITE ? "White" : "Black";
    statusText = `Checkmate — ${winnerLabel} wins`;
    statusModifierClass = "status-checkmate";
    indicatorColor = winnerColor;
  } else if (gameStatus === "check") {
    statusText = `${turnLabel} to move — Check`;
    statusModifierClass = "status-check";
  } else {
    statusText = `${turnLabel} to move`;
  }

  return (
    <div className="chess-game">
      <div className={`game-status ${statusModifierClass}`.trim()} data-player={indicatorColor}>
        {statusText}
      </div>
      {moveWarning && <div className="move-warning">{moveWarning}</div>}
      <div className={`board-wrapper${gameStatus === "checkmate" ? " game-over" : ""}`}>
        <ChessBoard
          board={board}
          selectedSquare={selectedSquare}
          onSquareClick={handleSquareClick}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// App
// ---------------------------------------------------------------------
// Top-level component. Renders the page chrome and the ChessGame.
function App() {
  return (
    <div className="app">
      <h1 className="app-title">Chess</h1>
      <ChessGame />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

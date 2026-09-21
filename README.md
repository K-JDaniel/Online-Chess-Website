# Chess

A local, two-player chess game built from scratch in React — no chess library, no chess engine, no backend. Every rule (piece movement, check, checkmate) is implemented by hand in a plain JavaScript rules engine that's kept completely separate from the UI.

This project was built as a learning/resume project, so the code favors clarity over cleverness: meaningful names, small single-purpose functions, and comments that explain *why* rather than *what*.

## Features

- Full 8×8 board with standard starting position
- Click-to-select, click-to-move interaction
- Legal-move enforcement for all six piece types (pawn, knight, rook, bishop, queen, king), including:
  - Pawn one/two-square advances, diagonal captures, no forward captures, no backward movement
  - Knight L-shaped jumps (ignoring blocking pieces)
  - Sliding-piece (rook/bishop/queen) movement with path-blocking
  - King one-square movement
- **King safety**: a move is rejected if it would leave your own king in check — this naturally covers pins, and forces you to respond to check by blocking, capturing the attacker, or moving the king
- **Check detection**, evaluated on the resulting position after every move
- **Checkmate detection**: a player is only checkmated if they're in check *and* have no legal move at all (escape, block, or capture) — not just "king is attacked"
- Turn tracking (White/Black) with a clear current-player indicator
- Illegal-move feedback (a short message explaining why a move was rejected), without losing your current selection
- The board locks (stops accepting input) once checkmate occurs, while staying visible
- Responsive layout that scales cleanly from mobile to desktop, keeping the board perfectly square
- Basic keyboard accessibility (squares are focusable and activatable with Enter/Space, with descriptive `aria-label`s)

## Tech Stack

- **React 18** (UMD build, loaded via CDN)
- **JavaScript (JSX)**
- **HTML5 / CSS3** (CSS Grid, Container Queries, custom properties)
- **Babel Standalone** — transforms JSX to plain JavaScript directly in the browser

No build tooling (no Webpack/Vite/npm), no chess library, no backend, no database, and no additional runtime dependencies beyond the three CDN scripts above.

## Architecture

The project deliberately separates **what the rules of chess are** from **what the screen looks like**:

```
index.html      Loads React, Babel, chessLogic.js, then App.jsx
style.css       All visual styling
chessLogic.js   Pure chess rule engine — no DOM, no React
App.jsx         React component tree + state management
```

```
App
 └── ChessGame            (owns board / currentPlayer / selectedSquare / gameStatus state)
      └── ChessBoard      (renders 64 squares from the board array)
           └── Square × 64  (presentational only — reports clicks, makes no chess decisions)
```

`chessLogic.js` is loaded as a plain `<script>` (not an ES module) before `App.jsx`, so its functions are available as globals — no bundler or import/export syntax needed. `App.jsx` calls exactly one entry point into the rules engine, `attemptMove(board, from, to, currentPlayer)`, and reacts to its `{ valid, newBoard, reason }` result. It never inspects the board itself to decide whether a move is legal.

### Click-handling flow

```
click → attemptMove(board, from, to, currentPlayer)
   valid   → commit newBoard, switch currentPlayer, recompute check/checkmate
   invalid → keep selection, show the rejection reason, leave state untouched
```

## Chess Logic Overview

The rules engine is layered so each piece only has to solve its own small problem:

1. **`isPathClear`** — for sliding pieces, walks the squares between two points and confirms none are occupied.
2. **Per-piece shape functions** — `isPawnMoveValid`, `isKnightMoveValid`, `isRookMoveValid`, `isBishopMoveValid`, `isQueenMoveValid`, `isKingMoveValid`. Each checks only that piece's own geometry (queen is literally `isRookMoveValid || isBishopMoveValid`).
3. **`validateMove`** — the shared entry point: confirms a piece exists, belongs to the current player, isn't capturing a friendly piece, and matches its piece-specific shape function. Builds the resulting board via `simulateMove` (a full row-by-row copy — the original board is never mutated).
4. **`isSquareAttacked` / `findKing` / `isKingInCheck`** — attack detection reuses the same per-piece functions above for sliding pieces and knights (since movement and attack patterns are identical there), with dedicated logic for pawns and kings, whose *attack* squares differ from their *move* squares.
5. **`isLegalMove`** — wraps `validateMove`, then simulates the move and checks whether it would leave the mover's own king in check. This one mechanism is what naturally handles pins, "you must respond to check," and everything else — there's no separate hardcoded logic for "can the king escape" or "can I block."
6. **`hasAnyLegalMove` / `isCheckmate`** — checkmate is `isKingInCheck(board, color) && !hasAnyLegalMove(board, color)`. `hasAnyLegalMove` brute-forces every piece against every square and asks `isLegalMove` — so escaping, blocking, and capturing the attacker are all covered by the same generic check, never special-cased.

### Board representation

An 8×8 array of arrays. `row 0` = rank 8 down to `row 7` = rank 1; `col 0` = file a through `col 7` = file h. Each square is either `null` or a two-character code (`"wp"`, `"bk"`, etc.) — first character is color (`w`/`b`), second is piece type (`p`/`r`/`n`/`b`/`q`/`k`).

## How to Run

This project has no build step, but browsers block the `fetch` that Babel Standalone needs to load `App.jsx` from a `file://` URL. Serve the folder with any static server:

```bash
# Option 1: Node (no install needed if you have npx)
npx serve .

# Option 2: Python 3
python3 -m http.server
```

Then open the printed `localhost` URL in your browser.

## Future Improvements

Ideas for extending this project, roughly in order of how much they'd add:

- **Pawn promotion** — currently a pawn reaching the back rank just stays a pawn
- **Castling** and **en passant**
- **Stalemate / draw detection** (no legal moves but not in check, threefold repetition, 50-move rule, insufficient material)
- **Move history** (a scrollable list of moves in algebraic notation)
- **Undo/redo**
- A simple **AI opponent** (even a basic minimax would work well against this existing move-generation code)
- Pinned CDN scripts could be replaced with a small bundler setup if the project grows

## Limitations

- **No castling, en passant, or pawn promotion** — intentionally out of scope for this project.
- **No stalemate or other draw detection** — the game currently only recognizes "playing," "check," and "checkmate." A position with no legal moves that *isn't* check (a stalemate) isn't specially detected.
- **No move history, timers, undo, AI, or multiplayer.**
- **Requires a local server** — won't run by double-clicking `index.html` directly, due to how the browser fetches `App.jsx` for in-browser JSX transformation (see "How to Run" above).
- **Keyboard support is basic** — squares are individually focusable and usable with Tab + Enter/Space, but there's no arrow-key board navigation.

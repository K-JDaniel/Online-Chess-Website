# ♟️ Online Chess Website

A local two-player chess application built from scratch using React and JavaScript.

The project implements the core chess rules without using a chess library or chess engine. The chess board, game state, move validation, king-safety checks, check detection, and checkmate detection are implemented manually.

## Features

- Standard 8×8 chess board with the initial starting position
- Two-player local gameplay
- Click-to-select and click-to-move interaction
- Legal move validation for all six chess pieces:
  - Pawn
  - Knight
  - Bishop
  - Rook
  - Queen
  - King
- Pawn one-square and two-square opening moves
- Diagonal pawn captures
- Knight movement without path blocking
- Rook, bishop, and queen path validation
- King-safety validation
- Prevents moves that leave the player's own king in check
- Check detection after every legal move
- Checkmate detection
- White/Black turn tracking
- Illegal-move feedback explaining why a move was rejected
- Board becomes inactive after checkmate
- Responsive chess board for different screen sizes
- Basic keyboard accessibility using Enter/Space
- Accessible square labels using ARIA attributes

## Tech Stack

- React 18
- JavaScript / JSX
- HTML5
- CSS3
- Babel Standalone
- CSS Grid
- CSS Container Queries

## Architecture

The project separates the chess rules from the React UI.

```text
Online-Chess-Website/
├── index.html
├── style.css
├── chessLogic.js
├── App.jsx
└── README.md

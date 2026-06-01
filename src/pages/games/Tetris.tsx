import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import styles from './Tetris.module.css';

const COLS = 10;
const ROWS = 20;
const CELL = 28;

type Shape = number[][];

const SHAPES: Shape[] = [
  [[1, 1, 1, 1]], // I
  [[1, 1], [1, 1]], // O
  [[0, 1, 0], [1, 1, 1]], // T
  [[1, 0, 0], [1, 1, 1]], // J
  [[0, 0, 1], [1, 1, 1]], // L
  [[0, 1, 1], [1, 1, 0]], // S
  [[1, 1, 0], [0, 1, 1]], // Z
];

const COLORS = ['#38bdf8', '#fbbf24', '#a78bfa', '#4a7cff', '#f97316', '#4ade80', '#f87171'];

function rotate(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: Shape = [];
  for (let c = 0; c < cols; c++) {
    result.push([]);
    for (let r = rows - 1; r >= 0; r--) {
      result[c].push(shape[r][c]);
    }
  }
  return result;
}

type Board = (string | null)[][];

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<string | null>(COLS).fill(null));
}

interface Piece {
  shape: Shape;
  color: string;
  x: number;
  y: number;
}

function randomPiece(): Piece {
  const idx = Math.floor(Math.random() * SHAPES.length);
  const shape = SHAPES[idx];
  return {
    shape,
    color: COLORS[idx],
    x: Math.floor((COLS - shape[0].length) / 2),
    y: 0,
  };
}

function collides(board: Board, piece: Piece): boolean {
  const { shape, x, y } = piece;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = x + c;
      const ny = y + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx] !== null) return true;
    }
  }
  return false;
}

function lock(board: Board, piece: Piece): Board {
  const b = board.map((row) => [...row]);
  const { shape, color, x, y } = piece;
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = x + c;
      const ny = y + r;
      if (ny >= 0) b[ny][nx] = color;
    }
  }
  return b;
}

function clearLines(board: Board): { board: Board; lines: number } {
  const b = board.filter((row) => row.some((cell) => cell === null));
  const cleared = ROWS - b.length;
  while (b.length < ROWS) b.unshift(Array<string | null>(COLS).fill(null));
  return { board: b, lines: cleared };
}

export default function Tetris() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);

  const board = useRef<Board>(emptyBoard());
  const piece = useRef<Piece>(randomPiece());
  const nextPiece = useRef<Piece>(randomPiece());
  const gameOverRef = useRef(false);
  const pausedRef = useRef(false);
  const scoreRef = useRef(0);
  const linesRef = useRef(0);
  const timer = useRef<number | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // board
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const color = board.current[r][c];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(c * CELL, r * CELL, CELL - 1, CELL - 1);
        }
      }
    }

    // ghost piece
    let ghostY = piece.current.y;
    while (!collides(board.current, { ...piece.current, y: ghostY + 1 })) ghostY++;
    const { shape, color, x } = piece.current;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const px = (x + c) * CELL;
        const py = (ghostY + r) * CELL;
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, CELL - 1, CELL - 1);
      }
    }

    // current piece
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const px = (x + c) * CELL;
        const py = (piece.current.y + r) * CELL;
        if (py < 0) continue;
        ctx.fillStyle = color;
        ctx.fillRect(px, py, CELL - 1, CELL - 1);
      }
    }

    // grid lines
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.3;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(COLS * CELL, r * CELL);
      ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL, 0);
      ctx.lineTo(c * CELL, ROWS * CELL);
      ctx.stroke();
    }
  }, []);

  const getSpeed = (lvl: number) => Math.max(60, 800 - (lvl - 1) * 70);

  const tick = useCallback(() => {
    if (gameOverRef.current || pausedRef.current) return;
    const moved = { ...piece.current, y: piece.current.y + 1 };
    if (collides(board.current, moved)) {
      board.current = lock(board.current, piece.current);
      const { board: cleared, lines: l } = clearLines(board.current);
      board.current = cleared;
      if (l > 0) {
        const points = [0, 100, 300, 500, 800][l];
        scoreRef.current += points;
        linesRef.current += l;
        setScore(scoreRef.current);
        setLines(linesRef.current);
        const newLevel = Math.floor(linesRef.current / 10) + 1;
        setLevel(newLevel);
        if (newLevel > level && timer.current) {
          clearInterval(timer.current);
          timer.current = window.setInterval(tick, getSpeed(newLevel));
        }
      }
      piece.current = nextPiece.current;
      nextPiece.current = randomPiece();
      if (collides(board.current, piece.current)) {
        gameOverRef.current = true;
        setGameOver(true);
      }
    } else {
      piece.current = moved;
    }
    draw();
  }, [draw, level]);

  useEffect(() => {
    timer.current = window.setInterval(tick, getSpeed(level));
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [tick, level]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (gameOverRef.current) return;
      if (e.key === 'ArrowLeft') {
        const moved = { ...piece.current, x: piece.current.x - 1 };
        if (!collides(board.current, moved)) {
          piece.current = moved;
          draw();
        }
      } else if (e.key === 'ArrowRight') {
        const moved = { ...piece.current, x: piece.current.x + 1 };
        if (!collides(board.current, moved)) {
          piece.current = moved;
          draw();
        }
      } else if (e.key === 'ArrowDown') {
        const moved = { ...piece.current, y: piece.current.y + 1 };
        if (!collides(board.current, moved)) {
          piece.current = moved;
          draw();
        }
      } else if (e.key === 'ArrowUp') {
        const rotated = { ...piece.current, shape: rotate(piece.current.shape) };
        if (!collides(board.current, rotated)) {
          piece.current = rotated;
          draw();
        }
      } else if (e.key === ' ') {
        while (!collides(board.current, { ...piece.current, y: piece.current.y + 1 })) {
          piece.current = { ...piece.current, y: piece.current.y + 1 };
        }
        tick();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [draw, tick]);

  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  };

  const restart = () => {
    board.current = emptyBoard();
    piece.current = randomPiece();
    nextPiece.current = randomPiece();
    gameOverRef.current = false;
    pausedRef.current = false;
    scoreRef.current = 0;
    linesRef.current = 0;
    setScore(0);
    setLines(0);
    setLevel(1);
    setGameOver(false);
    setPaused(false);
    draw();
  };

  // draw next piece preview
  const drawPreview = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const s = nextPiece.current.shape;
      const color = nextPiece.current.color;
      const size = 20;
      canvas.width = s[0].length * size;
      canvas.height = s.length * size;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let r = 0; r < s.length; r++) {
        for (let c = 0; c < s[r].length; c++) {
          if (!s[r][c]) continue;
          ctx.fillStyle = color;
          ctx.fillRect(c * size, r * size, size - 1, size - 1);
        }
      }
    },
    []
  );

  return (
    <div className={styles.container}>
      <Link to="/games" className={styles.back}>← 返回游戏列表</Link>
      <div className={styles.header}>
        <h1>俄罗斯方块</h1>
        <div className={styles.info}>
          <span>分数: <strong>{score}</strong></span>
          <span>等级: <strong>{level}</strong></span>
          <span>行数: <strong>{lines}</strong></span>
        </div>
      </div>
      <div className={styles.gameArea}>
        <div className={styles.canvasWrap}>
          <canvas
            ref={canvasRef}
            width={COLS * CELL}
            height={ROWS * CELL}
            className={styles.canvas}
          />
          {gameOver && (
            <div className={styles.overlay}>
              <span className={styles.overlayText}>Game Over</span>
              <button className={styles.btn} onClick={restart}>再来一局</button>
            </div>
          )}
          {paused && !gameOver && (
            <div className={styles.overlay}>
              <span className={styles.overlayText}>暂停中</span>
              <button className={styles.btn} onClick={togglePause}>继续</button>
            </div>
          )}
        </div>
        <div className={styles.sidebar}>
          <div className={styles.previewBox}>
            <h3>下一个</h3>
            <canvas
              ref={drawPreview}
              className={styles.previewCanvas}
            />
          </div>
          <div className={styles.controls}>
            <p className={styles.controlTitle}>操作</p>
            <ul className={styles.controlList}>
              <li>← → 移动</li>
              <li>↓ 加速下落</li>
              <li>↑ 旋转</li>
              <li>空格 硬降</li>
            </ul>
          </div>
        </div>
      </div>
      <div className={styles.actions}>
        <button className={styles.btn} onClick={togglePause}>
          {paused ? '继续' : '暂停'}
        </button>
        <button className={styles.btn} onClick={restart}>新游戏</button>
      </div>
    </div>
  );
}

import { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styles from './Minesweeper.module.css';

const DIFFICULTIES = {
  beginner: { rows: 9, cols: 9, mines: 10, label: '初级', cellSize: 40 },
  intermediate: { rows: 16, cols: 16, mines: 40, label: '中级', cellSize: 32 },
  expert: { rows: 16, cols: 30, mines: 99, label: '高级', cellSize: 28 },
} as const;

type Difficulty = keyof typeof DIFFICULTIES;

interface Cell {
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  adjacentMines: number;
}

const DIRS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

function emptyCell(): Cell {
  return { isMine: false, isRevealed: false, isFlagged: false, adjacentMines: 0 };
}

function createBoard(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, emptyCell));
}

function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map(row => row.map(c => ({ ...c })));
}

function placeMines(
  board: Cell[][], rows: number, cols: number, mineCount: number,
  safeR: number, safeC: number,
) {
  const safeZone = new Set<string>();
  safeZone.add(`${safeR},${safeC}`);
  for (const [dr, dc] of DIRS) {
    const nr = safeR + dr;
    const nc = safeC + dc;
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
      safeZone.add(`${nr},${nc}`);
    }
  }

  let placed = 0;
  while (placed < mineCount) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    const key = `${r},${c}`;
    if (!board[r][c].isMine && !safeZone.has(key)) {
      board[r][c].isMine = true;
      placed++;
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].isMine) continue;
      let count = 0;
      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].isMine) {
          count++;
        }
      }
      board[r][c].adjacentMines = count;
    }
  }
}

function reveal(board: Cell[][], startR: number, startC: number, rows: number, cols: number) {
  const queue: [number, number][] = [[startR, startC]];
  const visited = new Set<string>();
  visited.add(`${startR},${startC}`);

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    const cell = board[r][c];
    if (cell.isFlagged || cell.isMine) continue;
    cell.isRevealed = true;

    if (cell.adjacentMines === 0) {
      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        const key = `${nr},${nc}`;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited.has(key)) {
          visited.add(key);
          queue.push([nr, nc]);
        }
      }
    }
  }
}

function checkWin(board: Cell[][], rows: number, cols: number, mineCount: number): boolean {
  let revealed = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (board[r][c].isRevealed) revealed++;
    }
  }
  return revealed === rows * cols - mineCount;
}

const NUMBER_CLASSES: Record<number, string> = {
  1: styles.num1, 2: styles.num2, 3: styles.num3, 4: styles.num4,
  5: styles.num5, 6: styles.num6, 7: styles.num7, 8: styles.num8,
};

export default function Minesweeper() {
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const config = DIFFICULTIES[difficulty];
  const [board, setBoard] = useState<Cell[][]>(() => createBoard(config.rows, config.cols));
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'won' | 'lost'>('idle');
  const [flagCount, setFlagCount] = useState(0);
  const [time, setTime] = useState(0);
  const [clickedMine, setClickedMine] = useState<[number, number] | null>(null);

  const minePlacedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    setTime(0);
    timerRef.current = window.setInterval(() => {
      setTime(t => t + 1);
    }, 1000);
  }, [stopTimer]);

  const resetBoard = useCallback((diff: Difficulty) => {
    stopTimer();
    const cfg = DIFFICULTIES[diff];
    setBoard(createBoard(cfg.rows, cfg.cols));
    setGameState('idle');
    setFlagCount(0);
    setTime(0);
    setClickedMine(null);
    minePlacedRef.current = false;
  }, [stopTimer]);

  // Reset board when difficulty changes
  useEffect(() => {
    resetBoard(difficulty);
  }, [difficulty, resetBoard]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  const handleMouseDown = useCallback((e: React.MouseEvent, r: number, c: number) => {
    if (e.button === 2) {
      // Right click: toggle flag
      e.preventDefault();
      if (gameState === 'won' || gameState === 'lost') return;

      const cell = board[r][c];
      if (cell.isRevealed) return;

      const newBoard = cloneBoard(board);
      newBoard[r][c].isFlagged = !newBoard[r][c].isFlagged;
      setBoard(newBoard);
      setFlagCount(fc => fc + (newBoard[r][c].isFlagged ? 1 : -1));
      return;
    }

    if (e.button === 0) {
      // Left click: reveal
      if (gameState === 'won' || gameState === 'lost') return;

      const cfg = DIFFICULTIES[difficulty];
      const newBoard = cloneBoard(board);
      const cell = newBoard[r][c];

      if (cell.isRevealed || cell.isFlagged) return;

      // First click: place mines safely
      if (!minePlacedRef.current) {
        placeMines(newBoard, cfg.rows, cfg.cols, cfg.mines, r, c);
        minePlacedRef.current = true;
        reveal(newBoard, r, c, cfg.rows, cfg.cols);
        setBoard(newBoard);
        setGameState('playing');
        startTimer();
        return;
      }

      // Hit a mine
      if (cell.isMine) {
        newBoard[r][c].isRevealed = true;
        for (const row of newBoard) {
          for (const c of row) {
            if (c.isMine && !c.isFlagged) c.isRevealed = true;
          }
        }
        setBoard(newBoard);
        setClickedMine([r, c]);
        setGameState('lost');
        stopTimer();
        return;
      }

      // Normal reveal
      reveal(newBoard, r, c, cfg.rows, cfg.cols);
      setBoard(newBoard);

      if (checkWin(newBoard, cfg.rows, cfg.cols, cfg.mines)) {
        setGameState('won');
        stopTimer();
      }
      return;
    }

    if (e.button === 1) {
      // Middle click: chording
      e.preventDefault();
      if (gameState !== 'playing') return;

      const cell = board[r][c];
      if (!cell.isRevealed || cell.isMine || cell.adjacentMines === 0) return;

      const cfg = DIFFICULTIES[difficulty];
      const { rows, cols } = cfg;

      // Count flags around this cell
      let flagCount = 0;
      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].isFlagged) {
          flagCount++;
        }
      }

      if (flagCount !== cell.adjacentMines) return;

      // Reveal all unflagged, unrevealed neighbors
      const newBoard = cloneBoard(board);
      let hitMine = false;
      let mineR = -1;
      let mineC = -1;

      for (const [dr, dc] of DIRS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const neighbor = newBoard[nr][nc];
        if (neighbor.isRevealed || neighbor.isFlagged) continue;

        if (neighbor.isMine) {
          // Wrong flag elsewhere → mine hit
          hitMine = true;
          mineR = nr;
          mineC = nc;
        } else {
          reveal(newBoard, nr, nc, rows, cols);
        }
      }

      if (hitMine) {
        newBoard[mineR][mineC].isRevealed = true;
        for (const row of newBoard) {
          for (const c of row) {
            if (c.isMine && !c.isFlagged) c.isRevealed = true;
          }
        }
        setBoard(newBoard);
        setClickedMine([mineR, mineC]);
        setGameState('lost');
        stopTimer();
        return;
      }

      setBoard(newBoard);
      if (checkWin(newBoard, rows, cols, cfg.mines)) {
        setGameState('won');
        stopTimer();
      }
    }
  }, [board, gameState, difficulty, startTimer, stopTimer]);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const { cellSize } = config;
  const mineDisplay = config.mines - flagCount;

  return (
    <div className={styles.container}>
      <Link to="/games" className={styles.back}>← 返回游戏列表</Link>

      <div className={styles.header}>
        <h1>扫雷</h1>
        <div className={styles.info}>
          <span className={styles.mineCount}>💣 {mineDisplay}</span>
          <span className={styles.timer}>⏱ {formatTime(time)}</span>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.difficultyGroup}>
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map(d => (
            <button
              key={d}
              className={`${styles.diffBtn} ${d === difficulty ? styles.diffActive : ''}`}
              onClick={() => setDifficulty(d)}
            >
              {DIFFICULTIES[d].label}
            </button>
          ))}
        </div>
        <button className={styles.restartBtn} onClick={() => resetBoard(difficulty)}>
          🔄 重新开始
        </button>
      </div>

      <div className={styles.boardWrap}>
        <div
          className={styles.board}
          style={{
            gridTemplateColumns: `repeat(${config.cols}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${config.rows}, ${cellSize}px)`,
            fontSize: cellSize < 30 ? 13 : cellSize < 36 ? 15 : 18,
          }}
          onContextMenu={e => e.preventDefault()}
        >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const isHitMine = clickedMine !== null && clickedMine[0] === r && clickedMine[1] === c;
              const isGameOverMine = gameState === 'lost' && cell.isMine && cell.isRevealed;

              let cellClass = styles.cell;
              if (cell.isRevealed) {
                cellClass += ` ${styles.revealed}`;
                if (isHitMine) cellClass += ` ${styles.mineHit}`;
                else if (isGameOverMine) cellClass += ` ${styles.mineShow}`;
              } else {
                cellClass += ` ${styles.hidden}`;
                if (cell.isFlagged) cellClass += ` ${styles.flagged}`;
              }

              if (cell.isRevealed && !cell.isMine && cell.adjacentMines > 0) {
                cellClass += ` ${NUMBER_CLASSES[cell.adjacentMines] ?? ''}`;
              }

              // Wrong flag indicator
              let content: React.ReactNode = '';
              if (cell.isRevealed) {
                if (cell.isMine) content = '💣';
                else if (cell.adjacentMines > 0) content = cell.adjacentMines;
              } else if (cell.isFlagged) {
                if (gameState === 'lost' && !cell.isMine) {
                  cellClass += ` ${styles.wrongFlag}`;
                  content = '❌';
                } else {
                  content = '🚩';
                }
              }

              return (
                <button
                  key={`${r}-${c}`}
                  className={cellClass}
                  onMouseDown={e => handleMouseDown(e, r, c)}
                  type="button"
                >
                  {content}
                </button>
              );
            })
          )}
        </div>

        {gameState === 'lost' && (
          <div className={styles.overlay}>
            <span className={styles.overlayText}>💥 游戏结束</span>
            <button className={styles.btn} onClick={() => resetBoard(difficulty)}>再来一局</button>
          </div>
        )}

        {gameState === 'won' && (
          <div className={styles.overlay}>
            <span className={styles.overlayIcon}>🎉</span>
            <span className={styles.overlayTitle}>恭喜通关!</span>
            <p className={styles.winDetail}>
              {config.label} · 用时 {formatTime(time)}
            </p>
            <div className={styles.winActions}>
              <button className={styles.btn} onClick={() => resetBoard(difficulty)}>再来一局</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

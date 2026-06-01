import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import styles from './Game2048.module.css';

type Cell = number | null;
type Board = Cell[][];

function emptyBoard(): Board {
  return Array.from({ length: 4 }, () => Array<Cell>(4).fill(null));
}

function randomCell(board: Board): [number, number] | null {
  const empty: [number, number][] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (board[r][c] === null) empty.push([r, c]);
    }
  }
  if (empty.length === 0) return null;
  return empty[Math.floor(Math.random() * empty.length)];
}

function spawn(board: Board): Board {
  const b = board.map((row) => [...row]);
  const pos = randomCell(b);
  if (pos) {
    const [r, c] = pos;
    b[r][c] = Math.random() < 0.9 ? 2 : 4;
  }
  return b;
}

function slide(row: Cell[]): Cell[] {
  const filtered = row.filter((v): v is number => v !== null);
  const merged: Cell[] = [];
  let i = 0;
  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      merged.push(filtered[i] * 2);
      i += 2;
    } else {
      merged.push(filtered[i]);
      i += 1;
    }
  }
  while (merged.length < 4) merged.push(null);
  return merged;
}

function move(board: Board, direction: 'up' | 'down' | 'left' | 'right'): Board {
  let b = board.map((row) => [...row]);
  for (let i = 0; i < 4; i++) {
    let line: Cell[];
    if (direction === 'left') {
      line = slide(b[i]);
      b[i] = line;
    } else if (direction === 'right') {
      line = slide([...b[i]].reverse());
      b[i] = line.reverse();
    } else if (direction === 'up') {
      line = slide([b[0][i], b[1][i], b[2][i], b[3][i]]);
      for (let r = 0; r < 4; r++) b[r][i] = line[r];
    } else {
      line = slide([b[3][i], b[2][i], b[1][i], b[0][i]]);
      for (let r = 0; r < 4; r++) b[3 - r][i] = line[r];
    }
  }
  return b;
}

function boardEqual(a: Board, b: Board): boolean {
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      if (a[r][c] !== b[r][c]) return false;
  return true;
}

function canMove(board: Board): boolean {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (board[r][c] === null) return true;
      if (c < 3 && board[r][c] === board[r][c + 1]) return true;
      if (r < 3 && board[r][c] === board[r + 1][c]) return true;
    }
  }
  return false;
}

const TILE_COLORS: Record<number, string> = {
  2: '#eee',
  4: '#ede0c8',
  8: '#f2b179',
  16: '#f59563',
  32: '#f67c5f',
  64: '#f65e3b',
  128: '#edcf72',
  256: '#edcc61',
  512: '#edc850',
  1024: '#edc53f',
  2048: '#edc22e',
};

export default function Game2048() {
  const [board, setBoard] = useState<Board>(() => spawn(spawn(emptyBoard())));
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => {
    const saved = localStorage.getItem('2048-best');
    return saved ? Number(saved) : 0;
  });
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const prevBoard = useRef<Board>(board);

  const step = useCallback(
    (dir: 'up' | 'down' | 'left' | 'right') => {
      if (gameOver) return;
      const moved = move(board, dir);
      if (boardEqual(moved, board)) return;
      prevBoard.current = board;
      const after = spawn(moved);
      const gained = after.flat().filter((v) => v !== null).reduce((s, v) => s + v, 0) -
        board.flat().filter((v) => v !== null).reduce((s, v) => s + v, 0);
      setScore((s) => s + gained);
      setBoard(after);
      if (after.flat().some((v) => v === 2048) && !won) {
        setWon(true);
      }
      if (!canMove(after)) {
        setGameOver(true);
        if (score + gained > best) {
          const newBest = score + gained;
          setBest(newBest);
          localStorage.setItem('2048-best', String(newBest));
        }
      }
    },
    [board, gameOver, score, best, won]
  );

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const map: Record<string, 'up' | 'down' | 'left' | 'right'> = {
          ArrowUp: 'up',
          ArrowDown: 'down',
          ArrowLeft: 'left',
          ArrowRight: 'right',
        };
        step(map[e.key]);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [step]);

  // touch swipe
  const touchStart = useRef<[number, number] | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = [t.clientX, t.clientY];
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current[0];
    const dy = t.clientY - touchStart.current[1];
    touchStart.current = null;
    if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      step(dx > 0 ? 'right' : 'left');
    } else {
      step(dy > 0 ? 'down' : 'up');
    }
  };

  const undo = () => {
    setBoard(prevBoard.current);
    prevBoard.current = board;
  };

  const restart = () => {
    setBoard(spawn(spawn(emptyBoard())));
    setScore(0);
    setGameOver(false);
    setWon(false);
  };

  return (
    <div className={styles.container}>
      <Link to="/games" className={styles.back}>← 返回游戏列表</Link>
      <div className={styles.header}>
        <div>
          <h1>2048</h1>
          <p className={styles.desc}>合并数字，达到 2048</p>
        </div>
        <div className={styles.scores}>
          <div className={styles.scoreBox}>
            <span className={styles.scoreLabel}>分数</span>
            <span className={styles.scoreVal}>{score}</span>
          </div>
          <div className={styles.scoreBox}>
            <span className={styles.scoreLabel}>最佳</span>
            <span className={styles.scoreVal}>{best}</span>
          </div>
        </div>
      </div>
      <div
        className={styles.board}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {board.map((row, r) =>
          row.map((val, c) => (
            <div
              key={`${r}-${c}`}
              className={styles.tile}
              style={{
                background: val ? (TILE_COLORS[val] || '#edc22e') : '#1e293b',
                color: val && val <= 4 ? '#333' : '#fff',
              }}
            >
              {val ?? ''}
            </div>
          ))
        )}
        {(gameOver || won) && (
          <div className={styles.overlay}>
            <span className={styles.overlayText}>{won ? 'You Win!' : 'Game Over'}</span>
            <button className={styles.btn} onClick={restart}>再来一局</button>
          </div>
        )}
      </div>
      <div className={styles.actions}>
        <button className={styles.btn} onClick={undo}>撤销</button>
        <button className={styles.btn} onClick={restart}>新游戏</button>
      </div>
    </div>
  );
}

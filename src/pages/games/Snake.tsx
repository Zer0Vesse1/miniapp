import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import styles from './Snake.module.css';

const COLS = 20;
const ROWS = 20;
const CELL = 20;
const INITIAL_SPEED = 140;

type Point = { x: number; y: number };

function randomFood(snake: Point[]): Point {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
  const free: Point[] = [];
  for (let x = 0; x < COLS; x++)
    for (let y = 0; y < ROWS; y++)
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
  if (free.length === 0) return { x: 0, y: 0 };
  return free[Math.floor(Math.random() * free.length)];
}

export default function Snake() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const snake = useRef<Point[]>([{ x: 10, y: 10 }]);
  const food = useRef<Point>(randomFood(snake.current));
  const dir = useRef<Point>({ x: 1, y: 0 });
  const nextDir = useRef<Point>({ x: 1, y: 0 });
  const timer = useRef<number | null>(null);
  const gameOverRef = useRef(false);
  const pausedRef = useRef(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // grid
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, ROWS * CELL);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(COLS * CELL, y * CELL);
      ctx.stroke();
    }

    // food
    ctx.fillStyle = '#f87171';
    ctx.fillRect(food.current.x * CELL + 1, food.current.y * CELL + 1, CELL - 2, CELL - 2);

    // snake
    snake.current.forEach((p, i) => {
      const alpha = 1 - i * 0.03;
      ctx.fillStyle = `rgba(74, 222, 128, ${Math.max(0.4, alpha)})`;
      ctx.fillRect(p.x * CELL + 1, p.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }, []);

  const tick = useCallback(() => {
    if (gameOverRef.current || pausedRef.current) return;
    dir.current = nextDir.current;
    const head = snake.current[0];
    const newHead = { x: head.x + dir.current.x, y: head.y + dir.current.y };

    if (newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS) {
      gameOverRef.current = true;
      setGameOver(true);
      draw();
      return;
    }
    if (snake.current.some((p) => p.x === newHead.x && p.y === newHead.y)) {
      gameOverRef.current = true;
      setGameOver(true);
      draw();
      return;
    }

    snake.current = [newHead, ...snake.current];

    if (newHead.x === food.current.x && newHead.y === food.current.y) {
      setScore((s) => {
        const next = s + 10;
        if (next % 50 === 0) {
          setSpeed((sp) => Math.max(50, sp - 10));
        }
        return next;
      });
      food.current = randomFood(snake.current);
    } else {
      snake.current.pop();
    }
    draw();
  }, [draw]);

  useEffect(() => {
    timer.current = window.setInterval(tick, speed);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [tick, speed]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const map: Record<string, Point> = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        w: { x: 0, y: -1 },
        s: { x: 0, y: 1 },
        a: { x: -1, y: 0 },
        d: { x: 1, y: 0 },
      };
      const d = map[e.key];
      if (!d) return;
      e.preventDefault();
      // prevent 180-degree turn
      if (d.x + dir.current.x === 0 && d.y + dir.current.y === 0) return;
      nextDir.current = d;
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  };

  const restart = () => {
    snake.current = [{ x: 10, y: 10 }];
    food.current = randomFood(snake.current);
    dir.current = { x: 1, y: 0 };
    nextDir.current = { x: 1, y: 0 };
    gameOverRef.current = false;
    pausedRef.current = false;
    setScore(0);
    setGameOver(false);
    setPaused(false);
    setSpeed(INITIAL_SPEED);
    draw();
  };

  return (
    <div className={styles.container}>
      <Link to="/games" className={styles.back}>← 返回游戏列表</Link>
      <div className={styles.header}>
        <h1>贪吃蛇</h1>
        <div className={styles.info}>
          <span>分数: <strong>{score}</strong></span>
          <span>速度: <strong>{Math.round((INITIAL_SPEED - speed) / 10 + 1)}</strong></span>
        </div>
      </div>
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
            <span>得分: {score}</span>
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
      <div className={styles.actions}>
        <button className={styles.btn} onClick={togglePause}>
          {paused ? '继续' : '暂停'}
        </button>
        <button className={styles.btn} onClick={restart}>新游戏</button>
      </div>
    </div>
  );
}

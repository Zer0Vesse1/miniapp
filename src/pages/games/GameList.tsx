import { Link } from 'react-router-dom';
import styles from './GameList.module.css';

const games = [
  {
    slug: 'tetris',
    title: '俄罗斯方块',
    desc: '经典下落消除，挑战高分',
    icon: '🧱',
  },
  {
    slug: '2048',
    title: '2048',
    desc: '数字合并，滑动到 2048',
    icon: '🔢',
  },
  {
    slug: 'snake',
    title: '贪吃蛇',
    desc: '吃掉食物，越长越难',
    icon: '🐍',
  },
];

export default function GameList() {
  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>小游戏</h1>
      <p className={styles.subtitle}>选一个开始玩吧</p>
      <div className={styles.grid}>
        {games.map((g) => (
          <Link key={g.slug} to={`/games/${g.slug}`} className={styles.card}>
            <span className={styles.icon}>{g.icon}</span>
            <h2>{g.title}</h2>
            <p>{g.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

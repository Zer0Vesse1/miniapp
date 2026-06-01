import { Link } from 'react-router-dom';
import styles from './Home.module.css';

const modules = [
  {
    to: '/games',
    icon: '🎮',
    title: '小游戏',
    desc: '俄罗斯方块 · 2048 · 贪吃蛇 — 解压休闲小游戏合集',
  },
  {
    to: '/tools',
    icon: '🛠️',
    title: '工具',
    desc: '高级计算器 — 科学计算，实用工具集',
  },
  {
    to: '/guides',
    icon: '📖',
    title: '攻略助手',
    desc: '收集游戏资料，自动生成可视化攻略',
  },
];

export default function Home() {
  return (
    <div className={styles.home}>
      <h1 className={styles.heading}>MiniAPP</h1>
      <p className={styles.subtitle}>生活助手 · 一站式游戏娱乐与攻略站</p>
      <div className={styles.grid}>
        {modules.map((m) => (
          <Link key={m.to} to={m.to} className={styles.card}>
            <span className={styles.cardIcon}>{m.icon}</span>
            <h2 className={styles.cardTitle}>{m.title}</h2>
            <p className={styles.cardDesc}>{m.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

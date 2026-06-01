import { Link } from 'react-router-dom';
import styles from './ToolList.module.css';

const tools = [
  {
    slug: 'calculator',
    title: '高级计算器',
    desc: '科学计算 · 三角函数 · 对数 · 幂运算',
    icon: '🔢',
  },
  {
    slug: 'color-converter',
    title: '颜色转换器',
    desc: 'HEX ↔ RGB 双向互转，实时预览',
    icon: '🎨',
  },
  {
    slug: 'mahjong-hu',
    title: '麻将胡结算',
    desc: '三人麻将胡数结算，累计统计',
    icon: '🀄',
  },
];

export default function ToolList() {
  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>工具</h1>
      <p className={styles.subtitle}>实用工具集</p>
      <div className={styles.grid}>
        {tools.map((t) => (
          <Link key={t.slug} to={`/tools/${t.slug}`} className={styles.card}>
            <span className={styles.icon}>{t.icon}</span>
            <h2>{t.title}</h2>
            <p>{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

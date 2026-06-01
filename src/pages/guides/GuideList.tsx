import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useGuideList } from '../../hooks/useGuides';
import styles from './GuideList.module.css';

function ListSkeleton() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.skelHeading} />
      <div className={styles.skelSubtitle} />
      <div className={styles.skelGameCard} />
      <div className={styles.skelGameCard} />
    </div>
  );
}

export default function GuideList() {
  const { guides, loading } = useGuideList();

  const games = useMemo(() => {
    const map = new Map<string, number>();
    guides.forEach((g) => {
      map.set(g.game, (map.get(g.game) || 0) + 1);
    });
    return Array.from(map.entries()).map(([game, count]) => ({ game, count }));
  }, [guides]);

  if (loading) {
    return <ListSkeleton />;
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>攻略助手</h1>
      <p className={styles.subtitle}>游戏资料收集 · 可视化攻略生成</p>

      {games.length === 0 ? (
        <p className={styles.empty}>暂无攻略，请在 guides/ 目录添加 Markdown 文件</p>
      ) : (
        <div className={styles.grid}>
          {games.map(({ game, count }) => (
            <Link
              key={game}
              to={`/guides/game/${encodeURIComponent(game)}`}
              className={styles.gameCard}
            >
              <h2 className={styles.gameCardTitle}>{game}</h2>
              <span className={styles.gameCardCount}>{count} 篇攻略</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

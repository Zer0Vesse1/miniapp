import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useGuideList } from '../../hooks/useGuides';
import styles from './GuideList.module.css';

export default function GameGuides() {
  const { gameName } = useParams<{ gameName: string }>();
  const { guides, loading } = useGuideList();

  const gameGuides = useMemo(() => {
    return guides.filter((g) => g.game === decodeURIComponent(gameName ?? ''));
  }, [guides, gameName]);

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <p className={styles.empty}>加载中...</p>
      </div>
    );
  }

  if (gameGuides.length === 0) {
    return (
      <div className={styles.wrapper}>
        <Link to="/guides" className={styles.backLink}>← 返回游戏列表</Link>
        <p className={styles.empty}>该游戏暂无攻略</p>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <Link to="/guides" className={styles.backLink}>← 返回游戏列表</Link>
      <h1 className={styles.title}>{gameName}</h1>
      <p className={styles.subtitle}>{gameGuides.length} 篇攻略</p>

      <div className={styles.grid}>
        {gameGuides.map((g) => {
          if (g.externalUrl) {
            return (
              <a
                key={g.slug}
                href={g.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.card}
              >
                <div className={styles.cardHeader}>
                  <h2>{g.title} ↗</h2>
                </div>
                <div className={styles.cardTags}>
                  {g.tags.map((t) => (
                    <span key={t} className={styles.cardTag}>{t}</span>
                  ))}
                </div>
                <div className={styles.cardDate}>{g.created}</div>
              </a>
            );
          }
          return (
            <Link key={g.slug} to={`/guides/${g.slug}`} className={styles.card}>
              <div className={styles.cardHeader}>
                <h2>{g.title}</h2>
              </div>
              <div className={styles.cardTags}>
                {g.tags.map((t) => (
                  <span key={t} className={styles.cardTag}>{t}</span>
                ))}
              </div>
              <div className={styles.cardDate}>{g.created}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

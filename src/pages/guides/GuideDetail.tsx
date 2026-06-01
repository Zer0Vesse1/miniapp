import { useParams, Link } from 'react-router-dom';
import { useGuide } from '../../hooks/useGuides';
import GuideRenderer from '../../components/GuideRenderer';
import styles from './GuideDetail.module.css';

function Skeleton() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.skelBack} />
      <div className={styles.skelTitle} />
      <div className={styles.skelMeta} />
      <div className={styles.skelTags}>
        <div className={styles.skelTag} />
        <div className={styles.skelTag} />
        <div className={styles.skelTag} />
      </div>
      <div className={styles.skelDivider} />
      <div className={styles.skelLine} />
      <div className={styles.skelLineShort} />
      <div className={styles.skelLine} />
      <div className={styles.skelLineShort} />
      <div className={styles.skelBlock} />
      <div className={styles.skelLine} />
      <div className={styles.skelLineShort} />
    </div>
  );
}

function ErrorPage({ message, slug }: { message: string; slug: string }) {
  return (
    <div className={styles.errorWrap}>
      <div className={styles.errorCard}>
        <span className={styles.errorIcon}>!</span>
        <h2 className={styles.errorTitle}>攻略加载失败</h2>
        <p className={styles.errorDesc}>{message}</p>
        <code className={styles.errorPath}>public/guides/{slug}.md</code>
        <div className={styles.errorActions}>
          <Link to="/guides" className={styles.errorBtn}>返回攻略列表</Link>
        </div>
      </div>
    </div>
  );
}

export default function GuideDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { guide, loading, error } = useGuide(slug ?? '');

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <Skeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.wrapper}>
        <Link to="/guides" className={styles.back}>← 返回列表</Link>
        <ErrorPage message={error} slug={slug ?? 'unknown'} />
      </div>
    );
  }

  if (!guide) return null;

  return (
    <div className={styles.wrapper}>
      <Link to="/guides" className={styles.back}>← 返回列表</Link>
      <div className={styles.meta}>
        <h1 className={styles.title}>{guide.meta.title}</h1>
        <div className={styles.metaRow}>
          <span className={styles.game}>{guide.meta.game}</span>
          <span className={styles.date}>{guide.meta.created}</span>
        </div>
        <div className={styles.tags}>
          {guide.meta.tags.map((t) => (
            <span key={t} className={styles.tag}>{t}</span>
          ))}
        </div>
      </div>
      <div className={styles.content}>
        <GuideRenderer markdown={guide.body} />
      </div>
    </div>
  );
}

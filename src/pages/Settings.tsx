import { useTheme, type Theme, type FontSize } from '../context/ThemeContext';
import { version } from '../../package.json';
import styles from './Settings.module.css';

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
];

const FONT_OPTIONS: { value: FontSize; label: string }[] = [
  { value: 'small', label: '小' },
  { value: 'medium', label: '中' },
  { value: 'large', label: '大' },
];

export default function Settings() {
  const { theme, setTheme, fontSize, setFontSize } = useTheme();

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>设置</h1>

      <h2 className={styles.sectionTitle}>外观</h2>
      <div className={styles.section}>
        <div className={styles.row}>
          <div className={styles.rowLabel}>
            <span className={styles.rowIcon}>🎨</span>
            <span>基础颜色</span>
          </div>
          <select
            className={styles.select}
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
          >
            {THEME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.row}>
          <div className={styles.rowLabel}>
            <span className={styles.rowIcon}>🔤</span>
            <span>字体大小</span>
          </div>
          <select
            className={styles.select}
            value={fontSize}
            onChange={(e) => setFontSize(e.target.value as FontSize)}
          >
            {FONT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <h2 className={styles.sectionTitle}>关于</h2>
      <div className={styles.section}>
        <div className={styles.infoRow}>
          <span>项目名称</span>
          <span className={styles.infoValue}>MiniAPP</span>
        </div>
        <div className={styles.infoRow}>
          <span>技术栈</span>
          <span className={styles.infoValue}>React · TypeScript · Vite</span>
        </div>
        <div className={styles.infoRow}>
          <span>版本号</span>
          <span className={styles.infoValue}>v{version}</span>
        </div>
      </div>
    </div>
  );
}

import { useTheme, type Theme } from '../context/ThemeContext';
import styles from './ThemeToggle.module.css';

const LABELS: Record<Theme, string> = {
  light: '浅色',
  dark: '深色',
  system: '跟随系统',
};

const ICONS: Record<Theme, string> = {
  light: '☀️',
  dark: '🌙',
  system: '💻',
};

const CYCLE: Theme[] = ['light', 'dark', 'system'];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const next = () => {
    const idx = CYCLE.indexOf(theme);
    setTheme(CYCLE[(idx + 1) % CYCLE.length]);
  };

  return (
    <button className={styles.toggle} onClick={next} title={`当前：${LABELS[theme]}`}>
      <span className={styles.icon}>{ICONS[theme]}</span>
      <span className={styles.label}>{LABELS[theme]}</span>
    </button>
  );
}

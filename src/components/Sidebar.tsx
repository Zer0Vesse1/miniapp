import { NavLink } from 'react-router-dom';
import styles from './Sidebar.module.css';

const homeItem = { to: '/', label: '首页', icon: '🏠' };

const moduleItems = [
  { to: '/games', label: '小游戏', icon: '🎮' },
  { to: '/tools', label: '工具', icon: '🛠️' },
  { to: '/guides', label: '攻略助手', icon: '📖' },
];

const bottomItems = [
  { to: '/settings', label: '设置', icon: '⚙️' },
];

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>MiniAPP</div>
      <nav className={styles.nav}>
        <NavLink
          to={homeItem.to}
          end
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.active : ''}`
          }
        >
          <span className={styles.icon}>{homeItem.icon}</span>
          <span>{homeItem.label}</span>
        </NavLink>
        <div className={styles.divider} />
        {moduleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
          >
            <span className={styles.icon}>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className={styles.spacer} />
      <nav className={styles.bottom}>
        {bottomItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
          >
            <span className={styles.icon}>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className={styles.credit}>© Vessel</div>
    </aside>
  );
}

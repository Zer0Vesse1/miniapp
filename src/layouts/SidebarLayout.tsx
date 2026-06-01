import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import HistoryPanel from '../components/HistoryPanel';
import styles from './SidebarLayout.module.css';

export default function SidebarLayout() {
  return (
    <div className={styles.layout}>
      <Sidebar />
      <main className={styles.content}>
        <Outlet />
      </main>
      <HistoryPanel />
    </div>
  );
}

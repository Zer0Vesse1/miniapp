import { useState } from 'react';
import { useToolHistory } from '../context/ToolHistoryContext';
import styles from './HistoryPanel.module.css';

export default function HistoryPanel() {
  const { entries, clearHistory } = useToolHistory();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className={styles.toggle} onClick={() => setOpen((v) => !v)} title="历史记录">
        📋
      </button>

      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)} />
      )}

      <div className={`${styles.panel} ${open ? styles.open : ''}`}>
        <div className={styles.head}>
          <h3>历史记录</h3>
          <span className={styles.count}>{entries.length}</span>
        </div>

        <div className={styles.list}>
          {entries.length === 0 ? (
            <p className={styles.empty}>暂无记录</p>
          ) : (
            entries.map((e) => (
              <div key={e.id} className={styles.entry}>
                <div className={styles.entryHead}>
                  <span className={styles.toolTag}>{e.tool}</span>
                  <span className={styles.time}>{new Date(e.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className={styles.summary}>{e.summary}</div>
              </div>
            ))
          )}
        </div>

        {entries.length > 0 && (
          <button className={styles.clearBtn} onClick={() => { if (confirm('确定清空全部历史记录？')) clearHistory(); }}>
            清空全部
          </button>
        )}
      </div>
    </>
  );
}

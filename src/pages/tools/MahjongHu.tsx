import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useToolHistory } from '../../context/ToolHistoryContext';
import styles from './MahjongHu.module.css';

// ---- Types ----
type PlayerKey = 'a' | 'b' | 'c' | 'd';
type ColorMode = 'default' | 'chinese';

interface Round {
  a: number; b: number; c: number; d: number;
  resting: PlayerKey;
  resultA: number; resultB: number; resultC: number; resultD: number;
  rate: number;
}

// ---- Constants ----
const PLAYERS: PlayerKey[] = ['a', 'b', 'c', 'd'];
const DEFAULT_NAMES: Record<PlayerKey, string> = { a: '甲', b: '乙', c: '丙', d: '丁' };
const PLAYER_COLORS: Record<PlayerKey, string> = { a: '#1565c0', b: '#e67e00', c: '#8e24aa', d: '#00897b' };
const STORAGE_KEY = 'mahjong_state_v4';
const APP_VERSION = '2.0.2';

// ---- Pure helpers ----
function roundMoney(v: number) { return Math.round(v * 100) / 100; }

function calcRound(hu: Record<PlayerKey, number>, resting: PlayerKey, rate: number): Record<PlayerKey, number> {
  const result: Record<PlayerKey, number> = { a: 0, b: 0, c: 0, d: 0 };
  const active = PLAYERS.filter(p => p !== resting);
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const p1 = active[i], p2 = active[j];
      const diff = (hu[p1] || 0) - (hu[p2] || 0);
      result[p1] += diff * rate;
      result[p2] -= diff * rate;
    }
  }
  for (const k of PLAYERS) result[k] = roundMoney(result[k]);
  return result;
}

function formatMoney(v: number): string {
  if (v > 0) return '+' + v.toFixed(2);
  if (v < 0) return v.toFixed(2);
  return '0.00';
}

// ---- Component ----
export default function MahjongHu() {
  const history = useToolHistory();
  const [resting, setResting] = useState<PlayerKey>('d');
  const [playerNames, setPlayerNames] = useState<Record<PlayerKey, string>>(DEFAULT_NAMES);
  const [nameValues, setNameValues] = useState<Record<PlayerKey, string>>(DEFAULT_NAMES);
  const [colorMode, setColorMode] = useState<ColorMode>('default');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [rate, setRate] = useState(0.05);
  const [huValues, setHuValues] = useState<Record<PlayerKey, string>>({ a: '', b: '', c: '', d: '' });
  const [showSettings, setShowSettings] = useState(false);

  // -- Persistence: load --
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.rounds) {
          for (const r of saved.rounds) {
            if (!Object.prototype.hasOwnProperty.call(r, 'd')) r.d = 0;
            if (!r.resting) r.resting = 'd';
            if (!Object.prototype.hasOwnProperty.call(r, 'resultD')) r.resultD = 0;
          }
          setRounds(saved.rounds);
        }
        if (saved.resting) setResting(saved.resting);
        if (saved.playerNames) {
          setPlayerNames(saved.playerNames);
          setNameValues(saved.playerNames);
        }
        if (saved.colorMode) setColorMode(saved.colorMode);
        if (saved.rate != null) setRate(saved.rate);
      }
    } catch { /* ignore */ }
  }, []);

  // -- Persistence: save --
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        rounds, resting, playerNames, colorMode, rate
      }));
    } catch { /* ignore */ }
  }, [rounds, resting, playerNames, colorMode, rate]);

  // -- CSS vars for win/lose colors --
  useEffect(() => {
    const root = document.documentElement;
    if (colorMode === 'chinese') {
      root.style.setProperty('--mh-win', '#c62828');
      root.style.setProperty('--mh-lose', '#1a5c2a');
    } else {
      root.style.setProperty('--mh-win', '#1a5c2a');
      root.style.setProperty('--mh-lose', '#c62828');
    }
  }, [colorMode]);

  // -- Handlers --
  const handleResting = useCallback((p: PlayerKey) => {
    setResting(p);
  }, []);

  const handleNameChange = useCallback((p: PlayerKey, val: string) => {
    setNameValues(prev => ({ ...prev, [p]: val }));
  }, []);

  const handleNameCommit = useCallback((p: PlayerKey) => {
    setPlayerNames(prev => {
      const current = nameValues[p].trim();
      if (!current) return prev;
      return { ...prev, [p]: current };
    });
  }, [nameValues]);

  const handleHuChange = useCallback((p: PlayerKey, val: string) => {
    setHuValues(prev => ({ ...prev, [p]: val }));
  }, []);

  // Derive cumulative + last-round results
  const cumulative: Record<PlayerKey, number> = { a: 0, b: 0, c: 0, d: 0 };
  for (const r of rounds) {
    const res = calcRound({ a: r.a, b: r.b, c: r.c, d: r.d }, r.resting, r.rate);
    cumulative.a += res.a; cumulative.b += res.b; cumulative.c += res.c; cumulative.d += res.d;
  }

  const lastRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
  const lastResult = lastRound
    ? calcRound({ a: lastRound.a, b: lastRound.b, c: lastRound.c, d: lastRound.d }, lastRound.resting, lastRound.rate)
    : null;

  const addRound = useCallback(() => {
    const hu: Record<PlayerKey, number> = { a: 0, b: 0, c: 0, d: 0 };
    for (const p of PLAYERS) {
      if (p === resting) continue;
      const val = parseInt(huValues[p], 10);
      if (isNaN(val)) { alert('请填写上场三位玩家的胡数后再记录。'); return; }
      hu[p] = val;
    }
    if (rate <= 0) { alert('每胡金额必须大于0。'); return; }

    const res = calcRound(hu, resting, rate);
    const newRound: Round = {
      a: hu.a, b: hu.b, c: hu.c, d: hu.d,
      resting,
      resultA: res.a, resultB: res.b, resultC: res.c, resultD: res.d,
      rate,
    };
    setRounds(prev => [...prev, newRound]);
    setHuValues({ a: '', b: '', c: '', d: '' });
    const summary = `${playerNames.a}: ${res.a >= 0 ? '+' : ''}${res.a.toFixed(2)}  ${playerNames.b}: ${res.b >= 0 ? '+' : ''}${res.b.toFixed(2)}  ${playerNames.c}: ${res.c >= 0 ? '+' : ''}${res.c.toFixed(2)}  ${playerNames.d !== playerNames[resting] ? `${playerNames.d}: ${res.d >= 0 ? '+' : ''}${res.d.toFixed(2)}` : `(${playerNames.d} 轮休)`}`;
    history.addEntry('麻将胡结算', summary);
  }, [rate, resting, huValues, playerNames, history]);

  const handleHuKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addRound();
  }, [addRound]);

  const deleteRound = useCallback((idx: number) => {
    setRounds(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const resetAll = useCallback(() => {
    if (!confirm('确定要清除所有数据吗？此操作不可撤销。')) return;
    setRounds([]);
  }, []);

  // ---- Render helpers ----

  function amountClass(v: number) {
    if (v > 0) return styles.amountWin;
    if (v < 0) return styles.amountLose;
    return styles.amountZero;
  }

  function cumClass(v: number) {
    return v >= 0 ? styles.cumPos : styles.cumNeg;
  }

  function moneyClass(v: number, isResting: boolean) {
    if (isResting) return styles.moneyRest;
    if (v > 0) return styles.moneyWin;
    if (v < 0) return styles.moneyLose;
    return styles.moneyRest;
  }

  const historyRows = rounds.length === 0 ? null : rounds.map((r, i) => {
    const res = calcRound({ a: r.a, b: r.b, c: r.c, d: r.d }, r.resting, r.rate);
    return (
      <tr key={i}>
        <td>{i + 1}</td>
        <td>{r.resting === 'a' ? '-' : (r.a || 0)}</td>
        <td>{r.resting === 'b' ? '-' : (r.b || 0)}</td>
        <td>{r.resting === 'c' ? '-' : (r.c || 0)}</td>
        <td>{r.resting === 'd' ? '-' : (r.d || 0)}</td>
        <td className={moneyClass(res.a, r.resting === 'a')}>{formatMoney(res.a)}</td>
        <td className={moneyClass(res.b, r.resting === 'b')}>{formatMoney(res.b)}</td>
        <td className={moneyClass(res.c, r.resting === 'c')}>{formatMoney(res.c)}</td>
        <td className={moneyClass(res.d, r.resting === 'd')}>{formatMoney(res.d)}</td>
        <td><button className={styles.delBtn} onClick={() => deleteRound(i)}>&times;</button></td>
      </tr>
    );
  });

  return (
    <div className={styles.container}>
      <Link to="/tools" className={styles.back}>&larr; 返回工具列表</Link>

      {/* Header */}
      <div className={styles.header}>
        <button className={styles.gearBtn} onClick={() => setShowSettings(true)} title="设置">&#9881;</button>
        <span className={styles.tileIcon}>🀄</span>
        <h1>麻将胡结算</h1>
      </div>

      {/* Player names card */}
      <div className={styles.card}>
        <div className={styles.cardTitle}><span className={styles.dot}></span>玩家名称</div>
        <div className={styles.nameRow}>
          {PLAYERS.map(p => (
            <div key={p} className={styles.nameItem}>
              <span className={styles.playerDot} style={{ background: PLAYER_COLORS[p] }}></span>
              <input
                className={styles.nameInput}
                type="text"
                maxLength={6}
                value={nameValues[p]}
                onChange={e => handleNameChange(p, e.target.value)}
                onBlur={() => handleNameCommit(p)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Input card */}
      <div className={styles.card}>
        <div className={styles.cardTitle}><span className={styles.dot}></span>本局胡数</div>

        <div className={styles.restingRow}>
          <span className={styles.restingLabel}>轮休:</span>
          {PLAYERS.map(p => (
            <button
              key={p}
              className={`${styles.restingBtn} ${resting === p ? styles.resting : ''}`}
              style={resting !== p ? { color: PLAYER_COLORS[p] } : undefined}
              onClick={() => handleResting(p)}
            >
              {playerNames[p]}
            </button>
          ))}
        </div>

        <div className={styles.playersRow}>
          {PLAYERS.map(p => (
            <div key={p} className={styles.playerInput}>
              <label className={styles.playerLabel} style={{ color: PLAYER_COLORS[p] }}>
                {playerNames[p]}
              </label>
              <input
                className={styles.huInput}
                type="number"
                step={10}
                inputMode="numeric"
                placeholder={resting === p ? '轮休' : '0'}
                disabled={resting === p}
                value={huValues[p]}
                onChange={e => handleHuChange(p, e.target.value)}
                onKeyDown={handleHuKeyDown}
              />
              <span className={styles.huLabel}>{resting === p ? '轮休' : '胡'}</span>
            </div>
          ))}
        </div>

        <button className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginTop: 14 }} onClick={addRound}>
          记录本局
        </button>

        {lastResult && (
          <div className={styles.roundResult}>
            <div className={styles.cardTitle}><span className={styles.dot}></span>本局结果</div>
            <div className={styles.resultRow}>
              {PLAYERS.map(p => (
                <div key={p} className={`${styles.resultItem} ${lastRound!.resting === p ? styles.restingItem : ''}`}>
                  <div className={styles.resultName} style={{ color: PLAYER_COLORS[p] }}>{playerNames[p]}</div>
                  <div className={`${styles.amount} ${amountClass(lastResult[p])}`}>
                    {formatMoney(lastResult[p])}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cumulative card */}
      {rounds.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <span className={styles.dot}></span>累计输赢（共 {rounds.length} 局）
          </div>
          <div className={styles.cumulativeRow}>
            {PLAYERS.map(p => (
              <div key={p} className={styles.cumulativeItem}>
                <div className={styles.cumName} style={{ color: PLAYER_COLORS[p] }}>{playerNames[p]}</div>
                <div className={`${styles.cumAmount} ${cumClass(cumulative[p])}`}>
                  {formatMoney(roundMoney(cumulative[p]))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History card */}
      <div className={styles.card}>
        <div className={styles.cardTitle}><span className={styles.dot}></span>历史记录</div>
        {historyRows ? (
          <table className={styles.historyTable}>
            <thead>
              <tr>
                <th>局</th>
                <th>{playerNames.a} 胡</th>
                <th>{playerNames.b} 胡</th>
                <th>{playerNames.c} 胡</th>
                <th>{playerNames.d} 胡</th>
                <th>{playerNames.a} 输赢</th>
                <th>{playerNames.b} 输赢</th>
                <th>{playerNames.c} 输赢</th>
                <th>{playerNames.d} 输赢</th>
                <th></th>
              </tr>
            </thead>
            <tbody>{historyRows}</tbody>
          </table>
        ) : (
          <div className={styles.emptyHistory}>暂无记录，输入第一局数据开始吧</div>
        )}
        {rounds.length > 0 && (
          <button className={`${styles.btn} ${styles.btnDanger}`} onClick={resetAll}>全部清除</button>
        )}
      </div>

      {/* Settings overlay */}
      {showSettings && (
        <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}>
          <div className={styles.settingsPanel}>
            <div className={styles.settingsHead}>
              <h2>设置</h2>
              <button className={styles.settingsClose} onClick={() => setShowSettings(false)}>&times;</button>
            </div>

            <div className={styles.settingsSection}>
              <span className={styles.ssLabel}>每胡金额</span>
              <div className={styles.ssRateRow}>
                <span>1胡 =</span>
                <input
                  className={styles.ssRateInput}
                  type="number"
                  value={rate}
                  step={0.01}
                  min={0.01}
                  inputMode="decimal"
                  onChange={e => setRate(parseFloat(e.target.value) || 0.01)}
                />
                <span>元</span>
              </div>
            </div>

            <div className={styles.settingsSection}>
              <span className={styles.ssLabel}>颜色模式</span>
              <div className={styles.colorModeRow}>
                <button
                  className={`${styles.cmBtn} ${colorMode === 'default' ? styles.cmBtnActive : ''}`}
                  onClick={() => setColorMode('default')}
                >
                  <span className={styles.cmSwatch} style={{ background: '#1a5c2a' }}></span>
                  绿赢红输
                </button>
                <button
                  className={`${styles.cmBtn} ${colorMode === 'chinese' ? styles.cmBtnActive : ''}`}
                  onClick={() => setColorMode('chinese')}
                >
                  <span className={styles.cmSwatch} style={{ background: '#c62828' }}></span>
                  红赢绿输
                </button>
              </div>
            </div>

            <div className={styles.settingsSection}>
              <span className={styles.ssLabel}>版本</span>
              <span className={styles.ssVersion}>v{APP_VERSION}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

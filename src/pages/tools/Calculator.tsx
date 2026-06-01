import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useToolHistory } from '../../context/ToolHistoryContext';
import styles from './Calculator.module.css';

// ── types ──

type Mode = 'standard' | 'advanced' | 'scientific';

interface BtnDef {
  label: string;
  action: string;
  shiftAction?: string; // action when SHIFT is active
  wide?: boolean;
  shiftLabel?: string; // second-function text shown on key
  zone?: 'ctrl1' | 'ctrl2' | 'func' | 'num' | 'op';
}

// ── math engine ──

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n === 0 || n === 1) return 1;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function buildScope(deg: boolean) {
  const toRad = (x: number) => (deg ? x * Math.PI / 180 : x);
  const toDeg = (x: number) => (deg ? x * 180 / Math.PI : x);
  return {
    sin: (x: number) => Math.sin(toRad(x)),
    cos: (x: number) => Math.cos(toRad(x)),
    tan: (x: number) => Math.tan(toRad(x)),
    asin: (x: number) => toDeg(Math.asin(x)),
    acos: (x: number) => toDeg(Math.acos(x)),
    atan: (x: number) => toDeg(Math.atan(x)),
    log: Math.log10,
    ln: Math.log,
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    exp: Math.exp,
    pow10: (x: number) => Math.pow(10, x),
    abs: Math.abs,
    fact: factorial,
    PI: Math.PI,
    E: Math.E,
  };

}

function safeEval(expr: string, deg: boolean): number {
  const scope = buildScope(deg);
  let e = expr || '0';
  const open = (e.match(/\(/g) || []).length;
  const close = (e.match(/\)/g) || []).length;
  for (let i = 0; i < open - close; i++) e += ')';
  return Function(...Object.keys(scope), '"use strict"; return (' + e + ')')(...Object.values(scope));
}

function fmt(n: number): string {
  if (!isFinite(n)) return 'Error';
  return String(Number.isInteger(n) ? n : Number(n.toFixed(10)));
}

const FUNC_KEYS = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'log', 'ln', 'sqrt', 'cbrt', 'exp', 'pow10', 'fact',
]);

// ── button layouts ──

const STD_BUTTONS: BtnDef[][] = [
  [
    { label: 'AC', action: 'clear', zone: 'ctrl2' },
    { label: '+/-', action: 'negate', zone: 'num' },
    { label: '%', action: '%', zone: 'op' },
    { label: '÷', action: '/', zone: 'op' },
  ],
  [
    { label: '7', action: '7', zone: 'num' },
    { label: '8', action: '8', zone: 'num' },
    { label: '9', action: '9', zone: 'num' },
    { label: '×', action: '*', zone: 'op' },
  ],
  [
    { label: '4', action: '4', zone: 'num' },
    { label: '5', action: '5', zone: 'num' },
    { label: '6', action: '6', zone: 'num' },
    { label: '−', action: '-', zone: 'op' },
  ],
  [
    { label: '1', action: '1', zone: 'num' },
    { label: '2', action: '2', zone: 'num' },
    { label: '3', action: '3', zone: 'num' },
    { label: '+', action: '+', zone: 'op' },
  ],
  [
    { label: '0', action: '0', wide: true, zone: 'num' },
    { label: '.', action: '.', zone: 'num' },
    { label: '=', action: '=', zone: 'op' },
  ],
];

const ADV_BUTTONS: BtnDef[][] = [
  [
    { label: 'sin', action: 'sin', zone: 'func' },
    { label: 'cos', action: 'cos', zone: 'func' },
    { label: 'tan', action: 'tan', zone: 'func' },
    { label: 'log', action: 'log', zone: 'func' },
    { label: 'ln', action: 'ln', zone: 'func' },
  ],
  [
    { label: 'sin⁻¹', action: 'asin', zone: 'func' },
    { label: 'cos⁻¹', action: 'acos', zone: 'func' },
    { label: 'tan⁻¹', action: 'atan', zone: 'func' },
    { label: '√', action: 'sqrt', zone: 'func' },
    { label: '^', action: '^', zone: 'func' },
  ],
  [
    { label: '(', action: '(', zone: 'op' },
    { label: ')', action: ')', zone: 'op' },
    { label: '⌫', action: 'backspace', zone: 'ctrl2' },
    { label: 'AC', action: 'clear', zone: 'ctrl2' },
    { label: '÷', action: '/', zone: 'op' },
  ],
  [
    { label: '7', action: '7', zone: 'num' },
    { label: '8', action: '8', zone: 'num' },
    { label: '9', action: '9', zone: 'num' },
    { label: '×', action: '*', zone: 'op' },
    { label: '−', action: '-', zone: 'op' },
  ],
  [
    { label: '4', action: '4', zone: 'num' },
    { label: '5', action: '5', zone: 'num' },
    { label: '6', action: '6', zone: 'num' },
    { label: '+', action: '+', zone: 'op' },
    { label: '%', action: '%', zone: 'op' },
  ],
  [
    { label: '1', action: '1', zone: 'num' },
    { label: '2', action: '2', zone: 'num' },
    { label: '3', action: '3', zone: 'num' },
    { label: '.', action: '.', zone: 'num' },
    { label: 'π', action: 'PI', zone: 'func' },
  ],
  [
    { label: '0', action: '0', wide: true, zone: 'num' },
    { label: '+/-', action: 'negate', zone: 'num' },
    { label: '=', action: '=', wide: true, zone: 'op' },
  ],
];

const SCI_BUTTONS: BtnDef[][] = [
  [
    { label: 'SHIFT', action: 'shift', zone: 'ctrl1' },
    { label: 'MENU', action: 'alpha', zone: 'func' },
    { label: 'sin', action: 'sin', shiftAction: 'asin', shiftLabel: 'sin⁻¹', zone: 'func' },
    { label: 'cos', action: 'cos', shiftAction: 'acos', shiftLabel: 'cos⁻¹', zone: 'func' },
    { label: 'tan', action: 'tan', shiftAction: 'atan', shiftLabel: 'tan⁻¹', zone: 'func' },
    { label: 'AC', action: 'clear', zone: 'ctrl2' },
  ],
  [
    { label: 'x⁻¹', action: 'inv', shiftAction: 'exp', shiftLabel: 'eˣ', zone: 'func' },
    { label: 'n!', action: 'fact', shiftAction: 'pow10', shiftLabel: '10ˣ', zone: 'func' },
    { label: 'log', action: 'log', shiftAction: 'pow10', shiftLabel: '10ˣ', zone: 'func' },
    { label: 'ln', action: 'ln', shiftAction: 'exp', shiftLabel: 'eˣ', zone: 'func' },
    { label: '(', action: '(', zone: 'op' },
    { label: ')', action: ')', zone: 'op' },
  ],
  [
    { label: 'x²', action: 'sq', shiftAction: 'cub', shiftLabel: 'x³', zone: 'func' },
    { label: 'xʸ', action: '^', shiftLabel: 'ʸ√', zone: 'func' },
    { label: '√', action: 'sqrt', shiftAction: 'cbrt', shiftLabel: '³√', zone: 'func' },
    { label: 'e', action: 'E', zone: 'func' },
    { label: 'π', action: 'PI', zone: 'func' },
    { label: '⌫', action: 'backspace', zone: 'ctrl2' },
  ],
  [
    { label: '7', action: '7', shiftAction: 'fact', shiftLabel: 'n!', zone: 'num' },
    { label: '8', action: '8', zone: 'num' },
    { label: '9', action: '9', zone: 'num' },
    { label: 'DEL', action: 'clear', zone: 'ctrl2' },
    { label: '÷', action: '/', zone: 'op' },
    { label: '%', action: '%', zone: 'op' },
  ],
  [
    { label: '4', action: '4', zone: 'num' },
    { label: '5', action: '5', zone: 'num' },
    { label: '6', action: '6', zone: 'num' },
    { label: '×', action: '*', zone: 'op' },
    { label: '−', action: '-', zone: 'op' },
    { label: '+/-', action: 'negate', zone: 'num' },
  ],
  [
    { label: '1', action: '1', zone: 'num' },
    { label: '2', action: '2', zone: 'num' },
    { label: '3', action: '3', zone: 'num' },
    { label: '+', action: '+', zone: 'op' },
    { label: '.', action: '.', zone: 'num' },
    { label: 'EXP', action: 'EXP', zone: 'op' },
  ],
  [
    { label: '0', action: '0', wide: true, zone: 'num' },
    { label: '=', action: '=', wide: true, zone: 'op' },
  ],
];

const MODE_LABELS: Record<Mode, string> = {
  standard: '普通',
  advanced: '高级',
  scientific: '科学',
};

// ── component ──

export default function Calculator() {
  const history = useToolHistory();
  const [mode, setMode] = useState<Mode>('advanced');
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [deg, setDeg] = useState(true);
  const [shift, setShift] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    if (settingsOpen) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [settingsOpen]);

  const reset = useCallback(() => {
    setExpr('');
    setResult('');
    setError('');
    setShift(false);
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    setSettingsOpen(false);
    reset();
  };

  const handle = (btn: BtnDef) => {
    setError('');

    const effectiveAction = shift && btn.shiftAction ? btn.shiftAction : btn.action;

    if (btn.action === 'shift') { setShift((s) => !s); return; }
    if (btn.action === 'alpha') return;

    if (effectiveAction === 'clear') { reset(); return; }
    if (effectiveAction === 'backspace') { setExpr((e) => e.slice(0, -1)); return; }

    if (effectiveAction === 'negate') {
      setExpr((e) => { if (!e) return '-'; if (e.startsWith('-')) return e.slice(1); return '-' + e; });
      return;
    }
    if (effectiveAction === '%') { setExpr((e) => e + '/100'); return; }
    if (effectiveAction === 'sq') { setExpr((e) => e + '**2'); return; }
    if (effectiveAction === 'cub') { setExpr((e) => e + '**3'); return; }
    if (effectiveAction === 'inv') { setExpr((e) => e + '**(-1)'); return; }
    if (effectiveAction === 'EXP') { setExpr((e) => e + 'E'); return; }

    if (effectiveAction === '=') {
      try {
        const val = safeEval(expr, deg);
        if (!isFinite(val)) { setError('Error'); setResult(''); return; }
        setResult(fmt(val));
        history.addEntry('计算器', `${expr || '0'} = ${fmt(val)}`);
      } catch { setError('Error'); setResult(''); }
      return;
    }

    const suffix = FUNC_KEYS.has(effectiveAction) ? '(' : '';
    setExpr((e) => e + effectiveAction + suffix);
    if (shift && btn.shiftAction) setShift(false);
  };

  const layout: BtnDef[][] = mode === 'scientific' ? SCI_BUTTONS : mode === 'standard' ? STD_BUTTONS : ADV_BUTTONS;
  const gridCols = mode === 'scientific' ? 6 : mode === 'standard' ? 4 : 5;

  function getLabel(btn: BtnDef): string {
    if (shift && btn.shiftLabel) return btn.shiftLabel;
    return btn.label;
  }

  return (
    <div className={styles.container}>
      <Link to="/tools" className={styles.back}>← 返回工具列表</Link>

      {/* display */}
      <div className={styles.display}>
        <div className={styles.displayHead}>
          <span className={styles.modelabel}>{MODE_LABELS[mode]}</span>
          <div className={styles.statusIcons}>
            {shift && <span className={styles.shiftOn}>S</span>}
            <span className={styles.angleTag}>{deg ? 'DEG' : 'RAD'}</span>
            <div className={styles.settingsWrap} ref={settingsRef}>
              <button className={styles.settingsBtn} onClick={() => setSettingsOpen((v) => !v)}>⚙</button>
              {settingsOpen && (
                <div className={styles.settingsDropdown}>
                  <span className={styles.dropdownLabel}>计算器模式</span>
                  {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
                    <button
                      key={m}
                      className={`${styles.modeOption} ${mode === m ? styles.modeActive : ''}`}
                      onClick={() => switchMode(m)}
                    >
                      {MODE_LABELS[m]}
                    </button>
                  ))}
                  <div className={styles.dropdownDivider} />
                  <span className={styles.dropdownLabel}>角度单位</span>
                  <div className={styles.angleRow}>
                    <button className={`${styles.angleBtn} ${deg ? styles.angleActive : ''}`} onClick={() => { setDeg(true); setSettingsOpen(false); }}>DEG</button>
                    <button className={`${styles.angleBtn} ${!deg ? styles.angleActive : ''}`} onClick={() => { setDeg(false); setSettingsOpen(false); }}>RAD</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className={styles.formula}>{expr || ' '}</div>
        {error ? (
          <div className={styles.errorLine}>{error}</div>
        ) : (
          <div className={styles.result}>{result || '0'}</div>
        )}
      </div>

      {/* buttons */}
      <div className={styles.buttons} style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
        {layout.map((row, ri) =>
          row.map((btn) => {
            const label = getLabel(btn);
            const zoneClass = btn.zone ? styles[`zone${btn.zone.charAt(0).toUpperCase() + btn.zone.slice(1)}`] : '';
            return (
              <button
                key={`${ri}-${btn.action}`}
                className={`${styles.btn} ${zoneClass} ${btn.wide ? styles.btnWide : ''} ${
                  btn.action === 'shift' && shift ? styles.shiftActive : ''
                }`}
                onClick={() => handle(btn)}
              >
                {btn.shiftLabel && <span className={styles.sublabel}>{btn.shiftLabel}</span>}
                <span>{label}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToolHistory } from '../../context/ToolHistoryContext';
import styles from './ColorConverter.module.css';

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return '#' + (toHex(r) + toHex(g) + toHex(b)).toUpperCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export default function ColorConverter() {
  const history = useToolHistory();
  // -- RGB → HEX state --
  const [r, setR] = useState('138');
  const [g, setG] = useState('92');
  const [b, setB] = useState('245');
  const [hexResult, setHexResult] = useState('#8A5CF5');
  const [hexPreview, setHexPreview] = useState('#8A5CF5');
  const [rgbError, setRgbError] = useState('');

  // -- HEX → RGB state --
  const [hexInput, setHexInput] = useState('#8a5cf5');
  const [rgbResult, setRgbResult] = useState('138,92,245');
  const [rgbPreview, setRgbPreview] = useState('#8A5CF5');
  const [hexError, setHexError] = useState('');

  const handleRgbConvert = () => {
    setRgbError('');
    const rn = parseInt(r);
    const gn = parseInt(g);
    const bn = parseInt(b);
    if (isNaN(rn) || isNaN(gn) || isNaN(bn) || r === '' || g === '' || b === '') {
      setRgbError('请填写完整的 R、G、B 数值');
      return;
    }
    if (rn < 0 || rn > 255 || gn < 0 || gn > 255 || bn < 0 || bn > 255) {
      setRgbError('数值必须在 0 至 255 之间');
      return;
    }
    const hex = rgbToHex(rn, gn, bn);
    setHexResult(hex);
    setHexPreview(hex);
    history.addEntry('颜色转换', `RGB(${rn}, ${gn}, ${bn}) → ${hex}`);
  };

  const handleRgbClear = () => {
    setR('');
    setG('');
    setB('');
    setHexResult('');
    setHexPreview('');
    setRgbError('');
  };

  const handleHexConvert = () => {
    setHexError('');
    const val = hexInput.trim();
    if (!val) {
      setHexError('请输入十六进制颜色代码');
      return;
    }
    const rgb = hexToRgb(val);
    if (!rgb) {
      setHexError('无效的十六进制颜色格式');
      return;
    }
    const result = `${rgb.r},${rgb.g},${rgb.b}`;
    setRgbResult(result);
    const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    setRgbPreview(hex);
    history.addEntry('颜色转换', `${val} → RGB(${result})`);
  };

  const handleHexClear = () => {
    setHexInput('');
    setRgbResult('');
    setRgbPreview('');
    setHexError('');
  };

  return (
    <div className={styles.container}>
      <Link to="/tools" className={styles.back}>← 返回工具列表</Link>

      <div className={styles.widget}>

        {/* ── 上半部分：RGB → HEX ── */}
        <div className={styles.section}>
          <p className={styles.label}>RGB颜色值转换成十六进制颜色码：</p>
          <div className={styles.row}>
            <input className={styles.input} type="number" value={r} onChange={(e) => setR(e.target.value)} placeholder="R" />
            <input className={styles.input} type="number" value={g} onChange={(e) => setG(e.target.value)} placeholder="G" />
            <input className={styles.input} type="number" value={b} onChange={(e) => setB(e.target.value)} placeholder="B" />
            <button className={styles.btn} onClick={handleRgbConvert}>转换</button>
            <button className={styles.btn} onClick={handleRgbClear}>清空</button>
            {hexResult && (
              <>
                <span className={styles.result}>{hexResult}</span>
                <span className={styles.swatch} style={{ backgroundColor: hexPreview }} />
              </>
            )}
          </div>
          {rgbError && <p className={styles.error}>{rgbError}</p>}
        </div>

        {/* ── 下半部分：HEX → RGB ── */}
        <div className={styles.divider} />
        <div className={styles.section}>
          <p className={styles.label}>十六进制颜色码转换成RGB颜色值：</p>
          <div className={styles.row}>
            <input className={`${styles.input} ${styles.hexInput}`} type="text" value={hexInput} onChange={(e) => setHexInput(e.target.value)} placeholder="#000000" />
            <button className={styles.btn} onClick={handleHexConvert}>转换</button>
            <button className={styles.btn} onClick={handleHexClear}>清空</button>
            {rgbResult && (
              <>
                <span className={styles.result}>{rgbResult}</span>
                <span className={styles.swatch} style={{ backgroundColor: rgbPreview }} />
              </>
            )}
          </div>
          {hexError && <p className={styles.error}>{hexError}</p>}
        </div>

        <a
          className={styles.ref}
          href="https://www.lzltool.com/colorPicker"
          target="_blank"
          rel="noopener noreferrer"
        >
          颜色选择器
        </a>
      </div>
    </div>
  );
}

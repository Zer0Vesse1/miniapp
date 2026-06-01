import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './GuideRenderer.module.css';

interface Props {
  markdown: string;
}

interface Segment {
  type: 'markdown' | 'tip' | 'timeline';
  content: string;
}

function splitSegments(md: string): Segment[] {
  const segments: Segment[] = [];
  const lines = md.split('\n');
  let i = 0;
  let buf = '';

  while (i < lines.length) {
    const line = lines[i];

    if (/^::tip::\s*(.*)$/.test(line)) {
      if (buf.trim()) segments.push({ type: 'markdown', content: buf.trimEnd() });
      buf = '';
      const text = line.replace(/^::tip::\s*/, '');
      segments.push({ type: 'tip', content: text });
      i++;
      continue;
    }

    if (/^::timeline::/.test(line)) {
      if (buf.trim()) segments.push({ type: 'markdown', content: buf.trimEnd() });
      buf = '';
      i++;
      const timelineLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        timelineLines.push(lines[i]);
        i++;
      }
      segments.push({ type: 'timeline', content: timelineLines.join('\n') });
      continue;
    }

    buf += line + '\n';
    i++;
  }

  if (buf.trim()) segments.push({ type: 'markdown', content: buf.trimEnd() });
  return segments;
}

function TipBlock({ text }: { text: string }) {
  return <div className={styles.tipBlock}>{text}</div>;
}

function TimelineBlock({ content }: { content: string }) {
  const items = content
    .split('\n')
    .filter((l) => l.trim().startsWith('-'))
    .map((l) => l.replace(/^-\s*\*?\*?/, '').trim());
  return (
    <div className={styles.timeline}>
      {items.map((item, idx) => (
        <div className={styles.timelineItem} key={idx}>
          <div className={styles.timelineMarker}>{idx + 1}</div>
          <div className={styles.timelineContent}>{item}</div>
        </div>
      ))}
    </div>
  );
}

export default function GuideRenderer({ markdown }: Props) {
  const segments = useMemo(() => splitSegments(markdown), [markdown]);

  return (
    <div className={styles.renderer}>
      {segments.map((seg, idx) => {
        if (seg.type === 'tip') return <TipBlock key={idx} text={seg.content} />;
        if (seg.type === 'timeline') return <TimelineBlock key={idx} content={seg.content} />;
        return (
          <ReactMarkdown
            key={idx}
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children, ...props }) => (
                <h1 className={styles.h1} {...props}>{children}</h1>
              ),
              h2: ({ children, ...props }) => (
                <h2 className={styles.h2} {...props}>{children}</h2>
              ),
              h3: ({ children, ...props }) => (
                <h3 className={styles.h3} {...props}>{children}</h3>
              ),
              table: ({ children, ...props }) => (
                <div className={styles.tableWrap}>
                  <table className={styles.table} {...props}>{children}</table>
                </div>
              ),
              th: ({ children, ...props }) => (
                <th className={styles.th} {...props}>{children}</th>
              ),
              td: ({ children, ...props }) => (
                <td className={styles.td} {...props}>{children}</td>
              ),
              code: ({ className, children, ...props }) => {
                const isBlock = /language-/.test(className || '');
                if (isBlock) {
                  const lang = (className || '').replace('language-', '');
                  if (lang === 'mermaid') {
                    return <div className={styles.mermaidPlaceholder}>[Mermaid 图表需要在浏览器中渲染]</div>;
                  }
                  return (
                    <pre className={styles.codeBlock}>
                      <code className={className} {...props}>{children}</code>
                    </pre>
                  );
                }
                return <code className={styles.inlineCode} {...props}>{children}</code>;
              },
            }}
          >
            {seg.content}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}

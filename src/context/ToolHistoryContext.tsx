import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export interface HistoryEntry {
  id: string;
  tool: string;
  summary: string;
  time: number;
}

interface ToolHistoryValue {
  entries: HistoryEntry[];
  addEntry: (tool: string, summary: string) => void;
  clearHistory: () => void;
  clearByTool: (tool: string) => void;
}

const ToolHistoryContext = createContext<ToolHistoryValue | null>(null);
const STORAGE_KEY = 'tool-history';

function load(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function ToolHistoryProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<HistoryEntry[]>(load);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch { /* noop */ }
  }, [entries]);

  const addEntry = useCallback((tool: string, summary: string) => {
    setEntries((prev) => [
      { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), tool, summary, time: Date.now() },
      ...prev,
    ]);
  }, []);

  const clearHistory = useCallback(() => setEntries([]), []);
  const clearByTool = useCallback((tool: string) => {
    setEntries((prev) => prev.filter((e) => e.tool !== tool));
  }, []);

  return (
    <ToolHistoryContext.Provider value={{ entries, addEntry, clearHistory, clearByTool }}>
      {children}
    </ToolHistoryContext.Provider>
  );
}

export function useToolHistory() {
  const ctx = useContext(ToolHistoryContext);
  if (!ctx) throw new Error('useToolHistory must be used within ToolHistoryProvider');
  return ctx;
}

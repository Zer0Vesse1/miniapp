import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToolHistoryProvider } from './context/ToolHistoryContext';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <ToolHistoryProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ToolHistoryProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

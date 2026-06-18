import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: showToast }}>
      {children}
      {/* Toast Render Container - positioned in top right */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 p-4 rounded-2xl border shadow-lg animate-in slide-in-from-top-2 fade-in duration-200 ${
              t.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                : t.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/90 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300'
                : 'bg-card border-border text-foreground'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {t.type === 'success' ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : t.type === 'error' ? (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              ) : (
                <Info className="h-4 w-4 shrink-0 text-blue-500" />
              )}
              <span className="text-xs font-semibold">{t.message}</span>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

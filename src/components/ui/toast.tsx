'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  title?: string;
  message?: string;
  description?: string;
  type?: ToastType;
}

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (messageOrOptions: string | ToastOptions, type?: ToastType) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toast = React.useCallback((messageOrOptions: string | ToastOptions, typeParam: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    let msg = '';
    let tType = typeParam;

    if (typeof messageOrOptions === 'string') {
      msg = messageOrOptions;
    } else if (messageOrOptions && typeof messageOrOptions === 'object') {
      msg = messageOrOptions.message || messageOrOptions.description || messageOrOptions.title || '';
      if (messageOrOptions.type) tType = messageOrOptions.type;
    }

    setToasts((prev) => [...prev, { id, message: msg, type: tType }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {mounted && createPortal(
        <div className="fixed top-4 left-4 z-[100] flex flex-col gap-2 w-full max-w-sm" dir="rtl">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cn(
                'flex items-center gap-3 w-full rounded-xl p-4 shadow-lg border animate-in slide-in-from-left duration-300',
                t.type === 'success' && 'bg-emerald-950/80 border-emerald-500/30 text-emerald-100',
                t.type === 'error' && 'bg-red-950/80 border-red-500/30 text-red-100',
                t.type === 'warning' && 'bg-amber-950/80 border-amber-500/30 text-amber-100',
                t.type === 'info' && 'bg-blue-950/80 border-blue-500/30 text-blue-100'
              )}
            >
              {t.type === 'success' && <CheckCircle className="h-5 w-5 text-emerald-500" />}
              {t.type === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
              {t.type === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-500" />}
              {t.type === 'info' && <Info className="h-5 w-5 text-blue-500" />}
              
              <p className="flex-1 text-sm font-medium">{t.message}</p>
              
              <button 
                onClick={() => removeToast(t.id)}
                className="opacity-70 hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
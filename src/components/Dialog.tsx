'use client';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

/**
 * ระบบ Dialog/Toast กลาง — แทน confirm()/prompt()/alert() ของ browser
 * (เข้าถึงได้ดีกว่า, สวยกว่า, สอดคล้อง design system)
 * ใช้: const { confirm, prompt, alert, toast } = useDialog();
 */

interface ConfirmOpts { title?: string; message: string; confirmText?: string; cancelText?: string; danger?: boolean }
interface PromptOpts extends ConfirmOpts { placeholder?: string; defaultValue?: string; multiline?: boolean }
interface DialogState {
  kind: 'confirm' | 'prompt' | 'alert';
  opts: ConfirmOpts & Partial<PromptOpts>;
  resolve: (v: boolean | string | null) => void;
}
interface ToastItem { id: number; message: string; type: 'info' | 'success' | 'error' }

interface DialogCtx {
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  prompt: (o: PromptOpts) => Promise<string | null>;
  alert: (o: { title?: string; message: string }) => Promise<void>;
  toast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

const Ctx = createContext<DialogCtx | null>(null);

export function useDialog(): DialogCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDialog must be used within DialogProvider');
  return c;
}

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [inputVal, setInputVal] = useState('');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>(resolve => {
    setDialog({ kind: 'confirm', opts: o, resolve: v => resolve(!!v) });
  }), []);

  const prompt = useCallback((o: PromptOpts) => new Promise<string | null>(resolve => {
    setInputVal(o.defaultValue || '');
    setDialog({ kind: 'prompt', opts: o, resolve: v => resolve(typeof v === 'string' ? v : null) });
  }), []);

  const alertFn = useCallback((o: { title?: string; message: string }) => new Promise<void>(resolve => {
    setDialog({ kind: 'alert', opts: o, resolve: () => resolve() });
  }), []);

  const toast = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  useEffect(() => {
    if (!dialog) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(dialog.kind === 'prompt' ? null : false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  function close(value: boolean | string | null) {
    dialog?.resolve(value);
    setDialog(null);
  }

  return (
    <Ctx.Provider value={{ confirm, prompt, alert: alertFn, toast }}>
      {children}

      {dialog && (
        <div className="dlg-backdrop" onClick={() => close(dialog.kind === 'prompt' ? null : false)}>
          <div className="dlg-card" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            {dialog.opts.title && <h3 className="dlg-title">{dialog.opts.title}</h3>}
            <p className="dlg-msg">{dialog.opts.message}</p>
            {dialog.kind === 'prompt' && (
              dialog.opts.multiline ? (
                <textarea className="dlg-input" rows={3} value={inputVal} placeholder={dialog.opts.placeholder}
                  autoFocus onChange={e => setInputVal(e.target.value)} />
              ) : (
                <input className="dlg-input" value={inputVal} placeholder={dialog.opts.placeholder}
                  autoFocus onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') close(inputVal); }} />
              )
            )}
            <div className="dlg-actions">
              {dialog.kind !== 'alert' && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => close(dialog.kind === 'prompt' ? null : false)}>
                  {dialog.opts.cancelText || 'ยกเลิก'}
                </button>
              )}
              <button type="button"
                className={`btn btn-sm ${dialog.opts.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => close(dialog.kind === 'prompt' ? inputVal : true)}>
                {dialog.opts.confirmText || (dialog.kind === 'alert' ? 'ตกลง' : 'ยืนยัน')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="dlg-toasts" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`dlg-toast ${t.type}`} role="status">{t.message}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export default DialogProvider;

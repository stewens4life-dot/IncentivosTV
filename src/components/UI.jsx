import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

// ── Toast Liquid Glass ──
export function Toast({ notification, onClose }) {
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [notification, onClose]);
  if (!notification) return null;

  const styles = {
    success: 'bg-emerald-950/40 border-emerald-500/30 text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.2)]',
    error:   'bg-red-950/40 border-red-500/30 text-red-100 shadow-[0_0_30px_rgba(239,68,68,0.2)]',
    warning: 'bg-amber-950/40 border-amber-500/30 text-amber-100 shadow-[0_0_30px_rgba(245,158,11,0.2)]',
    info:    'bg-indigo-950/40 border-indigo-500/30 text-indigo-100 shadow-[0_0_30px_rgba(99,102,241,0.2)]',
  };
  const icons = {
    success: <CheckCircle className="text-emerald-400 shrink-0" size={20} />,
    error:   <AlertTriangle className="text-red-400 shrink-0" size={20} />,
    warning: <AlertTriangle className="text-amber-400 shrink-0" size={20} />,
    info:    <Info className="text-indigo-400 shrink-0" size={20} />,
  };

  return (
    <div className={`fixed top-8 right-8 z-[100] flex items-start gap-4 p-5 rounded-[1.5rem] border backdrop-blur-2xl max-w-sm w-full animate-in slide-in-from-right-4 fade-in duration-500 ${styles[notification.type] || styles.info}`}>
      <div className="pt-0.5">{icons[notification.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm tracking-tight">{notification.title}</p>
        {notification.message && <p className="text-xs opacity-70 mt-1.5 leading-relaxed font-medium">{notification.message}</p>}
      </div>
      <button onClick={onClose} className="opacity-40 hover:opacity-100 transition-opacity shrink-0 p-1 bg-white/5 rounded-full hover:bg-white/20"><X size={14} /></button>
    </div>
  );
}

export function useToast() {
  const [notification, setNotification] = useState(null);
  const showToast = useCallback((title, message, type = 'success') => {
    setNotification({ title, message, type });
  }, []);
  const clearToast = useCallback(() => setNotification(null), []);
  return { notification, showToast, clearToast };
}

// ── Confirm Modal Liquid Glass ──
export function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, actions }) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xl p-4 animate-in fade-in duration-300">
      <div className="liquid-panel border border-white/10 p-6 rounded-3xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-300 text-center">
        <h3 className="text-xl font-bold text-white mb-3 tracking-tight">{title}</h3>
        <p className="text-white/60 text-sm mb-6 leading-relaxed font-medium">{message}</p>
        {actions ? (
          <div className="flex flex-col gap-2">
            {actions.map((a, i) => (
              <button key={i} onClick={a.onClick} className={`w-full py-3 rounded-xl font-bold text-xs transition-all active:scale-95 ${a.className || 'liquid-button text-white'}`}>{a.label}</button>
            ))}
            <button onClick={onCancel} className="w-full py-2.5 rounded-xl text-white/40 font-semibold text-xs hover:text-white transition-colors mt-2">Cancelar</button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 py-3 rounded-xl text-white/60 text-xs liquid-button font-bold hover:text-white transition-all">Cancelar</button>
            <button onClick={onConfirm} className="flex-1 py-3 bg-white text-black hover:bg-white/90 rounded-xl text-xs font-bold shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all active:scale-95">Confirmar</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── StatCard Liquid Glass ──
export function StatCard({ icon: Icon, label, value, color = 'text-indigo-400', sub }) {
  return (
    <div className="liquid-card rounded-3xl p-4 flex flex-col justify-between items-start gap-3 h-full">
      <div className={`p-2.5 rounded-xl bg-white/5 border border-white/5 shadow-inner ${color}`}>
        <Icon size={20} strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-3xl font-black text-white leading-none tracking-tighter drop-shadow-md">{value}</p>
        <p className="text-white/40 text-[9px] uppercase tracking-widest font-bold mt-1.5">{label}</p>
        {sub && <p className="text-white/30 text-[8px] mt-1 font-medium">{sub}</p>}
      </div>
    </div>
  );
}

// ── Badge Liquid Glass ──
export function Badge({ children, color = 'slate' }) {
  const colors = {
    slate:   'bg-white/5 text-white/60 border-white/10',
    green:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    red:     'bg-red-500/10 text-red-400 border-red-500/20',
    yellow:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
    indigo:  'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border backdrop-blur-md ${colors[color]}`}>
      {children}
    </span>
  );
}

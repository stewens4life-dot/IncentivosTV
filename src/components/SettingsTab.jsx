import { useState } from 'react';
import { Shield, Key, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { APP_ID } from '../lib/firebase';
import { useToast, Toast } from './UI';

export default function SettingsTab({ onUpdatePassword }) {
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const { notification, showToast, clearToast } = useToast();

  const handleSave = async (e) => {
    e.preventDefault();
    if (!newPass) return showToast('Campo vacío', 'Ingresa una contraseña.', 'error');
    if (newPass.length < 4) return showToast('Muy corta', 'Mínimo 4 caracteres.', 'warning');
    if (newPass !== confirm) return showToast('No coinciden', 'Las contraseñas no son iguales.', 'error');
    setSaving(true);
    const ok = await onUpdatePassword(newPass);
    setSaving(false);
    if (ok) { showToast('Actualizado', 'Contraseña guardada en Firebase.'); setNewPass(''); setConfirm(''); }
    else showToast('Error', 'No se pudo actualizar. Verifica la conexión.', 'error');
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar pb-24 flex justify-center">
      <Toast notification={notification} onClose={clearToast} />
      
      <div className="w-full max-w-md space-y-6 mt-4">
        {/* Card Principal */}
        <div className="liquid-panel rounded-3xl p-7 animate-in-view">
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-full border border-indigo-500/20 flex items-center justify-center mb-3">
              <Shield className="text-indigo-400 w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">Seguridad</h3>
            <p className="text-white/40 text-xs font-medium mt-1">Contraseña de acceso al Studio Panel</p>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest pl-1">Nueva Contraseña</label>
              <div className="relative">
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={14} />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  className="w-full liquid-input rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-white/20 tracking-wide"
                />
                <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/50 uppercase tracking-widest pl-1">Confirmar</label>
              <div className="relative">
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={14} />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repite la contraseña"
                  className={`w-full bg-black/40 border backdrop-blur-md rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder-white/20 tracking-wide transition-colors ${confirm && confirm !== newPass ? 'border-red-500/50 focus:border-red-500' : confirm && confirm === newPass ? 'border-emerald-500/50 focus:border-emerald-500' : 'border-white/10 focus:border-indigo-500'}`}
                />
                {confirm && confirm === newPass && <CheckCircle className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-400" size={16} />}
              </div>
            </div>

            {/* Indicador de fortaleza */}
            {newPass && (
              <div className="space-y-1.5 pt-1 animate-in fade-in">
                <div className="flex gap-2">
                  {[4, 6, 8, 12].map((len, i) => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${newPass.length >= len ? ['bg-red-400','bg-amber-400','bg-blue-400','bg-emerald-400'][i] : 'bg-white/10'}`} />
                  ))}
                </div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-center text-white/40">
                  {newPass.length < 4 ? 'Muy corta' : newPass.length < 6 ? 'Débil' : newPass.length < 8 ? 'Regular' : newPass.length < 12 ? 'Buena' : 'Excelente'}
                </p>
              </div>
            )}

            <button type="submit" disabled={!newPass || !confirm || saving} className="w-full py-3 bg-white text-black hover:bg-white/90 disabled:opacity-30 disabled:bg-white/10 disabled:text-white rounded-xl font-bold transition-all active:scale-95 text-xs shadow-[0_0_20px_rgba(255,255,255,0.15)] mt-4">
              {saving ? 'Guardando...' : 'Actualizar Credencial'}
            </button>
          </form>
        </div>

        {/* Info del sistema estilo panel iOS */}
        <div className="liquid-card rounded-3xl p-5 space-y-3 animate-in-view" style={{ animationDelay: '0.1s' }}>
          <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-2">Información de Sistema</h4>
          <div className="bg-black/30 rounded-xl border border-white/5 overflow-hidden">
            {[
              ['App ID', APP_ID],
              ['Versión OS', 'Liquid Glass 2.6'],
              ['Base de Datos', 'Firebase Cloud Firestore'],
              ['Autenticación', 'Híbrida (Anónima + Hash)'],
            ].map(([k, v], i) => (
              <div key={k} className={`flex justify-between items-center p-3 ${i !== 3 ? 'border-b border-white/5' : ''}`}>
                <span className="text-white/60 text-[11px] font-medium">{k}</span>
                <span className="text-white/40 text-[9px] font-mono bg-white/5 px-2 py-1 rounded-md">{v}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Shield, Tv, Command, Fingerprint, Layers, Cpu } from 'lucide-react';

export function Landing({ onSelectTV, onSelectAdmin }) {
  const [pulse, setPulse] = useState(false);
  useEffect(() => { const id = setInterval(() => setPulse(p => !p), 2000); return () => clearInterval(id); }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 relative">
      <div className="text-center space-y-12 max-w-3xl mx-auto w-full z-10 animate-in-view">
        
        {/* Title Section */}
        <div className="space-y-6">
          <div className="inline-flex items-center justify-center p-5 liquid-panel rounded-[2rem] mb-4">
            <Command className="w-12 h-12 text-white/80" strokeWidth={1.5} />
          </div>
          <h1 className="text-6xl sm:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white/90 to-white/30 drop-shadow-2xl pb-2">
            4Life<span className="font-light">TVs</span>
          </h1>
          <p className="text-white/50 text-sm sm:text-base font-medium tracking-[0.3em] uppercase">
            Panel de Control Corporativo
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto mt-12">
          <button
            onClick={onSelectTV}
            className="group relative flex flex-col items-center p-10 liquid-card rounded-[2.5rem] overflow-hidden"
          >
            <div className={`absolute top-5 right-6 flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all duration-700 ${pulse ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/5 text-white/40 border border-white/5'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${pulse ? 'bg-emerald-400' : 'bg-white/20'}`} />
              Live Output
            </div>
            
            <Tv className="w-14 h-14 mb-6 text-white/40 group-hover:text-white transition-colors duration-500" strokeWidth={1} />
            <span className="text-2xl font-bold text-white tracking-tight mb-2">Display Mode</span>
            <span className="text-white/40 text-sm font-medium">Lanzar reproductor en pantalla completa</span>
            
            <div className="absolute inset-0 border-2 border-white/0 group-hover:border-white/10 rounded-[2.5rem] transition-colors duration-500 pointer-events-none" />
          </button>

          <button
            onClick={onSelectAdmin}
            className="group relative flex flex-col items-center p-10 liquid-card rounded-[2.5rem] overflow-hidden"
          >
            <div className="absolute top-5 right-6 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-white/70 text-[10px] font-bold tracking-widest uppercase">
              Secure
            </div>
            
            <Fingerprint className="w-14 h-14 mb-6 text-white/40 group-hover:text-white transition-colors duration-500" strokeWidth={1} />
            <span className="text-2xl font-bold text-white tracking-tight mb-2">Control Center</span>
            <span className="text-white/40 text-sm font-medium">Gestión de programación y dispositivos</span>
            
            <div className="absolute inset-0 border-2 border-white/0 group-hover:border-white/10 rounded-[2.5rem] transition-colors duration-500 pointer-events-none" />
          </button>
        </div>

        {/* Feature Strip */}
        <div className="flex flex-wrap justify-center gap-8 text-xs font-medium text-white/40 pt-8 border-t border-white/5 mt-8">
          <span className="flex items-center gap-2"><Cpu size={14} /> Distribución Inteligente</span>
          <span className="flex items-center gap-2"><Layers size={14} /> Panel Centralizado</span>
          <span className="flex items-center gap-2"><Shield size={14} /> Sincronización en Tiempo Real</span>
        </div>
      </div>
    </div>
  );
}

export function Login({ onValidate, onLogin, onBack }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);

  useEffect(() => {
    if (!locked) return;
    let secs = 30;
    setLockTimer(secs);
    const id = setInterval(() => {
      secs -= 1;
      setLockTimer(secs);
      if (secs <= 0) { clearInterval(id); setLocked(false); setAttempts(0); }
    }, 1000);
    return () => clearInterval(id);
  }, [locked]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (locked) return;
    if (onValidate(password)) {
      onLogin();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPassword('');
      if (newAttempts >= 5) {
        setLocked(true);
        setError('Acceso bloqueado por seguridad.');
      } else {
        setError(`Credenciales inválidas. ${5 - newAttempts} intentos restantes.`);
      }
    }
  };

  return (
    <div className="flex items-center justify-center h-full p-4 relative z-10 animate-in-view">
      <div className="w-full max-w-sm">
        <div className="liquid-panel rounded-[2.5rem] p-10 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-inner">
            <Fingerprint className="text-white/80 w-8 h-8" strokeWidth={1.5} />
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Autenticación</h2>
          <p className="text-white/40 text-sm mb-8 text-center font-medium">Ingresa tu credencial de administrador para acceder al Control Center.</p>

          <form onSubmit={handleSubmit} className="w-full space-y-5">
            <div className="relative">
              <input
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                disabled={locked}
                className="w-full liquid-input rounded-2xl px-4 py-4 text-center text-3xl font-bold tracking-[0.5em] text-white outline-none disabled:opacity-40"
                autoFocus
              />
            </div>

            <div className="h-6 flex items-center justify-center">
              {error && (
                <p className="text-red-400 text-xs font-semibold animate-in fade-in slide-in-from-right-4 tracking-wide">
                  {locked ? `${error} Espera ${lockTimer}s` : error}
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                type="button" 
                onClick={onBack} 
                className="flex-1 py-4 liquid-button rounded-xl font-bold text-white/70 text-sm"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                disabled={locked || !password} 
                className="flex-1 py-4 bg-white text-black hover:bg-white/90 disabled:opacity-30 disabled:bg-white/10 disabled:text-white rounded-xl font-bold transition-all active:scale-95 text-sm shadow-[0_0_20px_rgba(255,255,255,0.2)]"
              >
                {locked ? `${lockTimer}s` : 'Acceder'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

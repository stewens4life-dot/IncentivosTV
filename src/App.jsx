import { useState, useEffect } from 'react';
import { signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { List, MonitorPlay, LogOut, Activity, Shield, Tv, Home } from 'lucide-react';

import { app, auth, db, APP_ID, ADMIN_PASSWORD_FALLBACK } from './lib/firebase';
import TVMode from './components/TVMode';
import { Landing, Login } from './components/LandingLogin';
import ContentTab from './components/ContentTab';
import DevicesTab from './components/DevicesTab';
import SettingsTab from './components/SettingsTab';

export default function App() {
  const [view, setView] = useState('landing');
  const [playlist, setPlaylist] = useState([]);
  const [dbPassword, setDbPassword] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminTab, setAdminTab] = useState('content');
  const [initError, setInitError] = useState(false);

  useEffect(() => {
    try {
      const path = window.location.pathname;
      if (path === '/live' || path.endsWith('/live')) setView('tv');
      else if (path === '/dashboard' || path.endsWith('/dashboard')) setView('login');
    } catch {}
  }, []);

  const navigateTo = (newView) => {
    try {
      const paths = { tv: '/live', login: '/dashboard', admin: '/dashboard', landing: '/' };
      window.history.pushState({}, '', paths[newView] || '/');
    } catch {}
    setView(newView);
  };

  useEffect(() => {
    if (!auth) { setInitError(true); return; }
    const init = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token)
          await signInWithCustomToken(auth, __initial_auth_token);
        else await signInAnonymously(auth);
      } catch { try { await signInAnonymously(auth); } catch {} }
    };
    init();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const unsubPlaylist = onSnapshot(
      collection(db, 'artifacts', APP_ID, 'public', 'data', 'playlist'),
      (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPlaylist(items.sort((a, b) => (a.order || 0) - (b.order || 0)));
      },
      (err) => console.error('Playlist sync error:', err)
    );
    const unsubSettings = onSnapshot(
      doc(db, 'artifacts', APP_ID, 'public', 'data', 'settings', 'auth'),
      (snap) => { if (snap.exists()) setDbPassword(snap.data().password); }
    );
    return () => { unsubPlaylist(); unsubSettings(); };
  }, [user]);

  const validateLogin = (pass) => pass === (dbPassword || ADMIN_PASSWORD_FALLBACK);

  const handleUpdatePassword = async (pass) => {
    if (!db || !user) return false;
    try {
      await setDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'settings', 'auth'), { password: pass }, { merge: true });
      return true;
    } catch { return false; }
  };

  if (initError || !app) {
    return (
      <div className="h-screen w-screen bg-black text-white flex flex-col items-center justify-center gap-6">
        <div className="liquid-panel p-8 rounded-[2rem] flex flex-col items-center animate-in zoom-in-95">
          <Tv size={56} className="text-white/20 animate-pulse mb-6" />
          <p className="text-white/60 text-sm font-medium tracking-wide">
            {initError ? 'Conexión interrumpida' : 'Iniciando sistema...'}
          </p>
          {initError && (
            <button onClick={() => window.location.reload()} className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold transition-all">
              REINTENTAR
            </button>
          )}
        </div>
      </div>
    );
  }

  if (view === 'tv') {
    return <TVMode playlist={playlist} onExit={() => navigateTo('landing')} />;
  }

  if (view === 'landing') {
    return (
      <div className="h-screen w-screen relative overflow-hidden">
        <div className="bg-mesh" />
        <div className="relative z-10 h-full">
          <Landing
            onSelectTV={() => navigateTo('tv')}
            onSelectAdmin={() => navigateTo(isAuthenticated ? 'admin' : 'login')}
          />
        </div>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className="h-screen w-screen relative overflow-hidden">
        <div className="bg-mesh" />
        <Login
          onValidate={validateLogin}
          onLogin={() => { setIsAuthenticated(true); setView('admin'); }}
          onBack={() => navigateTo('landing')}
        />
      </div>
    );
  }

  const tabs = [
    { id: 'content', label: 'Programación', icon: List },
    { id: 'devices', label: 'Pantallas', icon: Activity },
    { id: 'settings', label: 'Ajustes', icon: Shield },
  ];

  return (
    <div className="h-screen w-screen relative overflow-hidden flex flex-col">
      <div className="bg-mesh" />

      {/* Header Liquid Glass */}
      <header className="shrink-0 flex flex-col sm:flex-row justify-between items-center gap-3 liquid-panel px-5 py-3 mx-4 mt-4 rounded-3xl z-40 animate-in-view">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/5 rounded-xl border border-white/10 shadow-inner">
            <Home className="text-white w-4 h-4" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight leading-none">Studio Panel</h1>
            <p className="text-white/50 text-[10px] font-medium uppercase tracking-widest mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" /> 
              Online · {playlist.length} items
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-black/20 p-1 rounded-xl border border-white/5 backdrop-blur-md">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setAdminTab(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300 ${adminTab === id ? 'bg-white/15 text-white shadow-sm' : 'text-white/50 hover:text-white hover:bg-white/5'}`}
              >
                <Icon size={14} />{label}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block" />

          <button
            onClick={() => navigateTo('tv')}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500/80 hover:bg-indigo-500 rounded-lg text-xs font-bold text-white shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all active:scale-95 border border-white/10"
          >
            <MonitorPlay size={14} /> MODO TV
          </button>

          <button
            onClick={() => { setIsAuthenticated(false); navigateTo('landing'); }}
            className="p-2 bg-black/20 hover:bg-red-500/20 rounded-lg border border-white/5 transition-colors group"
            title="Cerrar sesión"
          >
            <LogOut size={16} className="text-white/50 group-hover:text-red-400 transition-colors" />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 overflow-hidden px-4 pb-4 pt-4 z-10 animate-in-view" style={{ animationDelay: '0.1s' }}>
        {adminTab === 'content' && <ContentTab playlist={playlist} />}
        {adminTab === 'devices' && <DevicesTab />}
        {adminTab === 'settings' && <SettingsTab onUpdatePassword={handleUpdatePassword} />}
      </div>
    </div>
  );
}

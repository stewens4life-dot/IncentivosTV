import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Tv, Settings, LogOut, MonitorPlay, Lock, AlertTriangle, Film, List, Calendar, VolumeX, Clock, CheckCircle, Shield, Key, Pencil, X, Youtube } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';

// --- Función Segura para Variables de Entorno ---
const getEnv = (key, fallback) => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch (e) {
    console.warn("No se pudieron leer las variables de entorno.");
  }
  return fallback || ""; 
};

// --- Configuración de Firebase ---
const firebaseConfig = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY"),
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnv("VITE_FIREBASE_APP_ID")
};

// --- Contraseña Maestra (Respaldo del .env) ---
const ENV_PASSWORD = getEnv("VITE_ADMIN_PASSWORD");

let app, auth, db;
try {
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (error) {
  console.error("Error inicializando Firebase:", error);
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'tvincentivos-prod';

// --- Utilerías para YouTube ---

const getYouTubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const getTodayString = () => new Date().toISOString().split('T')[0];

export default function App() {
  const [view, setView] = useState('landing');
  const [playlist, setPlaylist] = useState([]);
  const [dbPassword, setDbPassword] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    try {
      const path = window.location.pathname;
      if (path === '/live' || path.endsWith('/live')) {
        setView('tv');
      } else if (path === '/dashboard' || path.endsWith('/dashboard')) {
        setView('login');
      }
    } catch (e) {
      console.warn("Error leyendo ruta.");
    }
  }, []);

  const navigateTo = (newView) => {
    let path = '/';
    if (newView === 'tv') path = '/live';
    if (newView === 'login' || newView === 'admin') path = '/dashboard';
    try {
      window.history.pushState({}, '', path);
    } catch (e) {
      console.warn("Navegación visual activa (pushState bloqueado).");
    }
    setView(newView);
  };

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
          await signInWithCustomToken(auth, __initial_auth_token);
        } catch (error) {
          await signInAnonymously(auth);
        }
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    
    const playlistRef = collection(db, 'artifacts', appId, 'public', 'data', 'playlist');
    const unsubPlaylist = onSnapshot(playlistRef, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPlaylist(items.sort((a, b) => (a.order || 0) - (b.order || 0)));
    });

    const authDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'auth');
    const unsubSettings = onSnapshot(authDocRef, (docSnap) => {
        if (docSnap.exists()) setDbPassword(docSnap.data().password);
    });

    return () => { unsubPlaylist(); unsubSettings(); };
  }, [user]);

  const validateLogin = (inputPass) => {
      const activePassword = dbPassword || ENV_PASSWORD;
      return inputPass === activePassword;
  };

  const handleUpdatePassword = async (newPass) => {
      if (!db || !user) return;
      try {
          const authDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'auth');
          await setDoc(authDocRef, { password: newPass }, { merge: true });
          return true;
      } catch (e) { return false; }
  };

  if (!app) return <div className="min-h-screen bg-black text-white p-10 text-center">Configurando Señal...</div>;

  const renderView = () => {
    switch (view) {
      case 'tv': return <TVMode playlist={playlist} onExit={() => navigateTo('landing')} />;
      case 'login': return <Login onValidate={validateLogin} onLogin={() => { setIsAuthenticated(true); setView('admin'); }} onBack={() => navigateTo('landing')} />;
      case 'admin': return <AdminPanel playlist={playlist} onUpdatePassword={handleUpdatePassword} onLogout={() => { setIsAuthenticated(false); navigateTo('landing'); }} onGoToTV={() => navigateTo('tv')} />;
      default: return <Landing onSelectTV={() => navigateTo('tv')} onSelectAdmin={() => navigateTo(isAuthenticated ? 'admin' : 'login')} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500 selection:text-white">
      {/* Fondo decorativo */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]" />
      </div>
      <div className="relative z-10 w-full h-full">
        {renderView()}
      </div>
    </div>
  );
}

// --- Componentes ---

function Landing({ onSelectTV, onSelectAdmin }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <div className="text-center space-y-10 max-w-2xl mx-auto">
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl mb-4 border border-indigo-500/20 backdrop-blur-sm">
            <Film className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-6xl font-black tracking-tighter text-white drop-shadow-2xl">
            Stream<span className="text-indigo-500">Hub</span>
          </h1>
          <p className="text-slate-400 text-xl font-light italic">Gestión de Pantallas</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full max-w-lg mx-auto">
          <button onClick={onSelectTV} className="group relative flex flex-col items-center p-8 bg-slate-900/50 hover:bg-slate-800/80 rounded-3xl border border-white/5 hover:border-indigo-500/50 transition-all duration-500 hover:-translate-y-2 backdrop-blur-md">
            <div className="absolute -top-3 -right-3 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse shadow-lg">/LIVE</div>
            <Tv className="w-12 h-12 mb-6 text-slate-300 group-hover:text-white transition-colors" />
            <span className="text-2xl font-bold text-white">Modo TV</span>
          </button>
          <button onClick={onSelectAdmin} className="group relative flex flex-col items-center p-8 bg-slate-900/50 hover:bg-slate-800/80 rounded-3xl border border-white/5 hover:border-indigo-500/50 transition-all duration-500 hover:-translate-y-2 backdrop-blur-md">
            <div className="absolute -top-3 -right-3 bg-indigo-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">/ADMIN</div>
            <Settings className="w-12 h-12 mb-6 text-slate-300 group-hover:text-white transition-colors" />
            <span className="text-2xl font-bold text-white">Admin</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Login({ onValidate, onLogin, onBack }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const handleSubmit = (e) => {
    e.preventDefault();
    if (onValidate(password)) onLogin();
    else { setError(true); setPassword(''); }
  };
  return (
    <div className="flex items-center justify-center min-h-screen bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900/90 border border-white/10 rounded-3xl shadow-2xl p-8">
        <h2 className="text-2xl font-bold text-white text-center mb-6">Acceso /dashboard</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <input type="password" placeholder="••••" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-4 bg-slate-950 border border-slate-700 rounded-xl outline-none text-center text-2xl font-bold" autoFocus />
          {error && <p className="text-red-400 text-center text-xs font-bold animate-pulse uppercase tracking-widest">Contraseña Incorrecta</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onBack} className="flex-1 py-3 text-slate-400 rounded-xl font-medium hover:bg-white/5 transition-colors">Volver</button>
            <button type="submit" className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/20">Entrar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminPanel({ playlist, onUpdatePassword, onLogout, onGoToTV }) {
  const [tab, setTab] = useState('content');
  const [scheduleMode, setScheduleMode] = useState('now');
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState('');

  const playlistRef = collection(db, 'artifacts', appId, 'public', 'data', 'playlist');

  const handleSave = async (e) => {
    e.preventDefault();
    const ytId = getYouTubeId(newUrl);
    if (!ytId) return alert("URL de YouTube no válida.");

    try {
      const payload = {
        youtubeId: ytId,
        title: newTitle || `Video de YouTube`,
        visible: editingId ? (playlist.find(p => p.id === editingId)?.visible ?? true) : true,
      };

      if (scheduleMode === 'now') {
        payload.startDate = getTodayString();
        payload.endDate = endDate || null; 
      } else {
        payload.startDate = startDate || getTodayString();
        payload.endDate = endDate || null;
      }

      if (editingId) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'playlist', editingId), payload);
        resetForm();
      } else {
        payload.order = playlist.length;
        payload.createdAt = new Date().toISOString();
        await addDoc(playlistRef, payload);
        resetForm();
      }
    } catch (err) { alert("Error al guardar."); }
  };

  const startEditing = (item) => {
    setEditingId(item.id);
    setNewTitle(item.title);
    setNewUrl(`https://youtu.be/${item.youtubeId}`);
    setStartDate(item.startDate || '');
    setEndDate(item.endDate || '');
    const today = getTodayString();
    setScheduleMode(item.startDate && item.startDate > today ? 'schedule' : 'now');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingId(null); setNewUrl(''); setNewTitle(''); setStartDate(''); setEndDate(''); setScheduleMode('now');
  };

  const handleChangePass = async (e) => {
      e.preventDefault();
      if (!newPass) return;
      if (await onUpdatePassword(newPass)) {
          setPassMsg('¡Éxito!'); setNewPass(''); setTimeout(() => setPassMsg(''), 3000);
      } else setPassMsg('Error.');
  };

  const deleteItem = async (id) => { if(confirm('¿Eliminar?')) { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'playlist', id)); if(editingId === id) resetForm(); } };
  const toggleVisibility = async (id, status) => await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'playlist', id), { visible: !status });
  const moveItem = async (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= playlist.length) return;
    const a = playlist[index], b = playlist[target];
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'playlist', a.id), { order: target });
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'playlist', b.id), { order: index });
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto pb-20">
      <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6 bg-slate-900/50 p-6 rounded-3xl border border-white/5 backdrop-blur-md sticky top-4 z-40">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/20 rounded-xl"><List className="text-indigo-400 w-6 h-6" /></div>
          <div><h1 className="text-2xl font-bold text-white tracking-tight">Consola /dashboard</h1><p className="text-slate-400 text-[10px] font-mono uppercase tracking-widest">Conexión: <span className="animate-pulse text-emerald-400 font-bold">Live</span></p></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-800/50 p-1 rounded-xl border border-white/5">
            <button onClick={() => setTab('content')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${tab === 'content' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>CONTENIDO</button>
            <button onClick={() => setTab('settings')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${tab === 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>SEGURIDAD</button>
          </div>
          <div className="w-px h-8 bg-white/10 mx-1 hidden md:block"></div>
          <button onClick={onGoToTV} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white shadow-lg transition-all active:scale-95"><MonitorPlay size={16} /> LIVE</button>
          <button onClick={onLogout} className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl border border-white/5 transition-colors"><LogOut size={18} /></button>
        </div>
      </header>

      {tab === 'settings' ? (
        <div className="max-w-md mx-auto bg-slate-900/80 rounded-3xl p-8 border border-white/10 shadow-2xl backdrop-blur-xl">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Shield className="text-indigo-400"/> Seguridad</h3>
            <p className="text-slate-400 text-sm mb-6">Cambia la contraseña de acceso al panel. Si la dejas vacía se usará la del sistema.</p>
            <form onSubmit={handleChangePass} className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nueva Clave</label>
                    <div className="relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input type="text" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Ej: admin2026" className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-indigo-500 outline-none transition-colors" />
                    </div>
                </div>
                <button disabled={!newPass} type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 rounded-xl font-bold shadow-lg shadow-emerald-900/10 transition-all">ACTUALIZAR CLAVE</button>
                {passMsg && <p className="text-center text-xs font-bold mt-2 text-emerald-400">{passMsg}</p>}
            </form>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className={`bg-slate-900/80 rounded-3xl p-6 border transition-all lg:sticky lg:top-28 shadow-2xl space-y-5 backdrop-blur-xl ${editingId ? 'border-indigo-500 ring-1 ring-indigo-500/50' : 'border-white/10'}`}>
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                    {editingId ? <Pencil className="text-indigo-400" size={20} /> : <Plus className="text-indigo-500" size={20} />} 
                    {editingId ? 'Editar Video' : 'Nuevo Video'}
                </h3>
                {editingId && <button onClick={resetForm} className="text-[10px] flex items-center gap-1 text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded-lg transition-colors"><X size={14} /> Cancelar</button>}
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button type="button" onClick={() => setScheduleMode('now')} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${scheduleMode === 'now' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>PUBLICAR YA</button>
                <button type="button" onClick={() => setScheduleMode('schedule')} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${scheduleMode === 'schedule' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>PROGRAMAR</button>
              </div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Título</label><input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ej: Promo Verano" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none" /></div>
              <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">URL YouTube</label><input type="text" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://youtube.com/..." className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none" /></div>
              <div className="grid grid-cols-2 gap-3">
                {scheduleMode === 'schedule' && (
                  <div className="space-y-1 col-span-2 sm:col-span-1"><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Inicio</label><div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none" size={14} /><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-2 py-2.5 text-[10px] focus:border-indigo-500 outline-none text-white scheme-dark" /></div></div>
                )}
                <div className={`space-y-1 ${scheduleMode === 'now' ? 'col-span-2' : 'col-span-2 sm:col-span-1'}`}><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Fin (Opcional)</label><div className="relative"><Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14} /><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-2 py-2.5 text-[10px] focus:border-indigo-500 outline-none text-white scheme-dark" /></div></div>
              </div>
              <button disabled={!newUrl} type="submit" className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all mt-2 active:scale-95 ${editingId ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50'}`}>{editingId ? 'GUARDAR CAMBIOS' : 'AÑADIR A PLAYLIST'}</button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center mb-2 px-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Playlist Activa ({playlist.length})</h3>
          </div>
          {/* La lista fluirá naturalmente con el scroll de la página */}
          {playlist.map((item, index) => {
            const isEditing = editingId === item.id;
            const now = getTodayString();
            const isScheduled = item.startDate && item.startDate > now;
            const isExpired = item.endDate && item.endDate < now;

            return (
              <div key={item.id} className={`flex items-center gap-4 p-4 bg-slate-900/60 rounded-2xl border transition-all ${isEditing ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 opacity-90 hover:opacity-100 hover:border-white/10'}`}>
                <div className="w-24 md:w-32 aspect-video bg-black rounded-xl overflow-hidden flex-shrink-0 relative">
                    <img src={`https://img.youtube.com/vi/${item.youtubeId}/mqdefault.jpg`} className="w-full h-full object-cover opacity-80" alt="miniatura" />
                    {isExpired && <div className="absolute inset-0 bg-red-950/80 flex items-center justify-center"><span className="text-[8px] font-bold text-white bg-red-600 px-2 py-0.5 rounded uppercase">Vencido</span></div>}
                    {isScheduled && <div className="absolute inset-0 bg-indigo-950/80 flex items-center justify-center"><span className="text-[8px] font-bold text-white bg-indigo-600 px-2 py-0.5 rounded uppercase">Programado</span></div>}
                    <div className="absolute top-1 left-1 bg-red-600 p-1 rounded-full shadow-lg"><Youtube size={10} color="white"/></div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-white truncate text-sm md:text-base leading-tight">{item.title}</h4>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                    {item.startDate && <span className="text-[9px] flex items-center gap-1 text-slate-400"><Calendar size={10} /> {item.startDate}</span>}
                    {item.endDate && <span className="text-[9px] flex items-center gap-1 text-emerald-400"><Clock size={10} /> {item.endDate}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                  <button onClick={() => startEditing(item)} className={`p-2 rounded-lg transition-colors ${isEditing ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-600/20 text-slate-400 hover:text-white'}`} title="Editar"><Pencil size={16} /></button>
                  <button onClick={() => toggleVisibility(item.id, item.visible)} className={`p-2 rounded-lg transition-colors ${item.visible ? 'hover:bg-slate-700 text-slate-400' : 'bg-red-500/10 text-red-500'}`}>{item.visible ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => moveItem(index, -1)} disabled={index === 0} className="p-0.5 hover:bg-slate-700 rounded disabled:opacity-0 transition-all"><ArrowUp size={14}/></button>
                    <button onClick={() => moveItem(index, 1)} disabled={index === playlist.length-1} className="p-0.5 hover:bg-slate-700 rounded disabled:opacity-0 transition-all"><ArrowDown size={14}/></button>
                  </div>
                  <button onClick={() => deleteItem(item.id)} className="p-2 hover:bg-red-600/20 text-slate-500 hover:text-red-500 rounded-lg ml-1 transition-colors"><Trash2 size={16} /></button>
                </div>
              </div>
            );
          })}
          {playlist.length === 0 && (
              <div className="p-12 text-center bg-slate-900/40 rounded-3xl border border-dashed border-white/10">
                  <Youtube className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-500 text-sm">No hay videos en la lista.</p>
              </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

function TVMode({ playlist, onExit }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showUI, setShowUI] = useState(false); 
  const [errorMsg, setErrorMsg] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  
  const playerRef = useRef(null);
  const uiTimerRef = useRef(null);
  
  const activePlaylist = playlist.filter(v => {
    if (!v.visible) return false;
    const now = getTodayString();
    const startOk = !v.startDate || v.startDate <= now;
    const end = v.endDate || v.expiresAt;
    const endOk = !end || end >= now;
    return startOk && endOk;
  });

  const currentVideo = activePlaylist[currentIdx];

  const resetUITimer = useCallback(() => {
    setShowUI(true);
    if (uiTimerRef.current) clearTimeout(uiTimerRef.current);
    uiTimerRef.current = setTimeout(() => setShowUI(false), 3000);
  }, []);

  const handleNext = useCallback(() => {
    if (activePlaylist.length <= 1) {
        if (playerRef.current?.seekTo) {
            playerRef.current.seekTo(0);
            playerRef.current.playVideo();
        }
        return;
    }
    setCurrentIdx(prev => (prev + 1 >= activePlaylist.length ? 0 : prev + 1));
  }, [activePlaylist.length]);

  useEffect(() => {
    if (!currentVideo) return;
    setErrorMsg(null);

    const initYT = () => {
        if (playerRef.current) { try { playerRef.current.destroy(); } catch(e){} }
        playerRef.current = new window.YT.Player('yt-player', {
            height: '100%', width: '100%', videoId: currentVideo.youtubeId,
            playerVars: { 'autoplay': 1, 'mute': 1, 'controls': 0, 'rel': 0, 'showinfo': 0, 'modestbranding': 1, 'vq': 'hd1080', 'origin': window.location.origin },
            events: {
                'onReady': (e) => { 
                    e.target.playVideo(); 
                    setTimeout(() => { try { if(e.target.isMuted()) { e.target.unMute(); setIsMuted(false); } } catch(err) {} }, 800); 
                },
                'onStateChange': (e) => { 
                    if (e.data === window.YT.PlayerState.PLAYING) { 
                        setIsPlaying(true); 
                        try { if(e.target.isMuted()) { e.target.unMute(); setIsMuted(false); } } catch(err) {} 
                    }
                    if (e.data === window.YT.PlayerState.ENDED) handleNext(); 
                },
                'onError': () => { setErrorMsg("Señal perdida. Saltando..."); setTimeout(handleNext, 3000); }
            }
        });
    };

    if (!window.YT) {
        const tag = document.createElement('script'); 
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag); 
        window.onYouTubeIframeAPIReady = initYT;
    } else {
        initYT();
    }

    window.addEventListener('mousemove', resetUITimer);
    window.addEventListener('touchstart', resetUITimer);
    return () => { 
        window.removeEventListener('mousemove', resetUITimer); 
        window.removeEventListener('touchstart', resetUITimer);
        if (uiTimerRef.current) clearTimeout(uiTimerRef.current); 
    };
  }, [currentVideo, resetUITimer, handleNext]);

  const unmuteManually = () => {
    if(playerRef.current?.unMute) { 
        playerRef.current.unMute(); 
        setIsMuted(false); 
    }
  };

  if (!currentVideo) return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white">
          <Tv size={64} className="text-slate-800 animate-pulse mb-4" />
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-40">Sin Señal Programada</p>
          <button onClick={onExit} className="mt-8 px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold hover:bg-white/10 transition-all uppercase tracking-widest">Salir</button>
      </div>
  );

  return (
    <div className="fixed inset-0 w-screen h-screen bg-black overflow-hidden group">
      <div id="yt-player" className="w-full h-full pointer-events-none scale-[1.01]"></div>
      
      {isMuted && isPlaying && (
        <div className="absolute bottom-10 right-10 z-50 animate-bounce">
            <button onClick={unmuteManually} className="bg-red-600 hover:bg-red-700 text-white p-5 rounded-full shadow-2xl transition-transform hover:scale-110">
                <VolumeX size={32} />
            </button>
            <div className="text-center text-[8px] font-bold mt-2 text-white/40 uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">Activar Audio</div>
        </div>
      )}

      <div className={`absolute top-0 left-0 w-full z-30 transition-all duration-1000 pointer-events-none ${showUI ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="w-full p-8 bg-gradient-to-b from-black/90 to-transparent flex justify-between items-start">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-white drop-shadow-2xl tracking-tighter uppercase italic opacity-90">{currentVideo.title}</h2>
            <div className="flex items-center gap-3">
                <div className="bg-red-600 px-2 py-0.5 rounded text-[8px] font-black text-white tracking-widest uppercase">YouTube</div>
                <p className="text-white/40 font-mono text-[10px] flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> 
                    SINTONIZADO • {activePlaylist.indexOf(currentVideo) + 1}/{activePlaylist.length}
                </p>
            </div>
          </div>
          <button onClick={onExit} className="pointer-events-auto p-3 bg-white/5 hover:bg-red-600/40 backdrop-blur-md rounded-2xl text-white/40 hover:text-white transition-all border border-white/5 hover:scale-110 active:scale-90 shadow-xl"><LogOut size={20} /></button>
        </div>
      </div>

      {errorMsg && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl">
              <AlertTriangle className="w-16 h-16 text-yellow-600 mb-4 animate-pulse" />
              <p className="text-2xl font-black uppercase italic text-white/80">{errorMsg}</p>
          </div>
      )}
    </div>
  );
}

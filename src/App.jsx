import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Tv, Settings, LogOut, MonitorPlay, Lock, AlertTriangle, Film, List, Calendar, VolumeX, Volume2 } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, deleteField } from 'firebase/firestore';

// --- Tu Configuración de Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyBXQPiJ2EA6U9__F87uceUT_YfbB6QXWHM",
  authDomain: "tvincentivos.firebaseapp.com",
  projectId: "tvincentivos",
  storageBucket: "tvincentivos.firebasestorage.app",
  messagingSenderId: "256494121860",
  appId: "1:256494121860:web:de93e55dffaf17c9b063d1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ID interno para organizar los datos en Firestore
const appId = typeof __app_id !== 'undefined' ? __app_id : 'tvincentivos-prod';

// --- Utilerías ---

const getYouTubeId = (url) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export default function App() {
  const [view, setView] = useState('landing');
  const [playlist, setPlaylist] = useState([]);
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 1. Manejo de Rutas (Simulado para Single Page App)
  useEffect(() => {
    const path = window.location.pathname;
    
    // Lógica de enrutamiento directo
    if (path === '/live' || path.endsWith('/live')) {
      setView('tv');
    } else if (path === '/dashboard' || path.endsWith('/dashboard')) {
      setView('login'); // Por seguridad, enviamos a login primero
    }
  }, []);

  // Función para navegar y actualizar URL visualmente
  const navigateTo = (newView) => {
    let path = '/';
    if (newView === 'tv') path = '/live';
    if (newView === 'login' || newView === 'admin') path = '/dashboard';
    
    // Actualizamos la URL sin recargar
    window.history.pushState({}, '', path);
    setView(newView);
  };

  // 2. Manejo de Autenticación
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
    });
    return () => unsubscribe();
  }, [view]);

  // 3. Sincronización en Tiempo Real
  useEffect(() => {
    if (!user) return;
    const playlistRef = collection(db, 'artifacts', appId, 'public', 'data', 'playlist');
    const unsubscribe = onSnapshot(playlistRef, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPlaylist(items.sort((a, b) => (a.order || 0) - (b.order || 0)));
    }, (error) => console.error("Error Sync:", error));
    return () => unsubscribe();
  }, [user]);

  const renderView = () => {
    switch (view) {
      case 'tv':
        return <TVMode playlist={playlist} onExit={() => navigateTo('landing')} />;
      case 'login':
        return <Login onLogin={() => { setIsAuthenticated(true); setView('admin'); }} onBack={() => navigateTo('landing')} />;
      case 'admin':
        return <AdminPanel playlist={playlist} onLogout={() => { setIsAuthenticated(false); navigateTo('landing'); }} onGoToTV={() => navigateTo('tv')} />;
      default:
        return <Landing onSelectTV={() => navigateTo('tv')} onSelectAdmin={() => navigateTo(isAuthenticated ? 'admin' : 'login')} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px]" />
      </div>
      <div className="relative z-10">
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
            Stream<span className="text-indigo-500">Hub</span> <span className="text-xs align-top font-mono bg-indigo-500 px-2 py-1 rounded text-white ml-2">TV INCENTIVOS</span>
          </h1>
          <p className="text-slate-400 text-xl font-light italic">Gestión Centralizada de Canales de Incentivos</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full max-w-lg mx-auto">
          <button onClick={onSelectTV} className="group relative flex flex-col items-center p-8 bg-slate-900/50 hover:bg-slate-800/80 rounded-3xl border border-white/5 hover:border-indigo-500/50 transition-all duration-500 hover:-translate-y-2 backdrop-blur-md">
            <div className="absolute -top-3 -right-3 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse shadow-lg shadow-emerald-500/30">/LIVE</div>
            <Tv className="w-12 h-12 mb-6 text-slate-300 group-hover:text-white transition-colors" />
            <span className="text-2xl font-bold text-white">Modo TV</span>
            <span className="text-sm text-slate-500 mt-2 font-medium tracking-wide">Reproducción Automática</span>
          </button>
          <button onClick={onSelectAdmin} className="group relative flex flex-col items-center p-8 bg-slate-900/50 hover:bg-slate-800/80 rounded-3xl border border-white/5 hover:border-emerald-500/50 transition-all duration-500 hover:-translate-y-2 backdrop-blur-md">
            <div className="absolute -top-3 -right-3 bg-indigo-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg shadow-indigo-500/30">/DASHBOARD</div>
            <Settings className="w-12 h-12 mb-6 text-slate-300 group-hover:text-white transition-colors" />
            <span className="text-2xl font-bold text-white">Admin</span>
            <span className="text-sm text-slate-500 mt-2 font-medium tracking-wide">Gestionar Videos</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Login({ onLogin, onBack }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === '1234') onLogin();
    else { setError(true); setPassword(''); }
  };
  return (
    <div className="flex items-center justify-center min-h-screen bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900/90 border border-white/10 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl">
        <div className="p-8 text-center border-b border-white/5 bg-white/5">
          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
            <Lock className="w-8 h-8 text-indigo-400" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Acceso /dashboard</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <input 
            type="password" 
            placeholder="••••" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            className="w-full px-4 py-4 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-center tracking-[0.5em] text-2xl font-bold transition-all" 
            autoFocus 
          />
          <div className="flex gap-3">
            <button type="button" onClick={onBack} className="flex-1 px-4 py-3 bg-transparent border border-white/10 text-slate-400 rounded-xl font-medium hover:bg-white/5 transition-colors">Volver</button>
            <button type="submit" className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/20">Entrar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminPanel({ playlist, onLogout, onGoToTV }) {
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const playlistRef = collection(db, 'artifacts', appId, 'public', 'data', 'playlist');

  const handleAdd = async (e) => {
    e.preventDefault();
    const yId = getYouTubeId(newUrl);
    if (!yId) return alert("URL de YouTube inválida");

    try {
      await addDoc(playlistRef, {
        youtubeId: yId,
        title: newTitle || 'Video Sin Título',
        visible: true,
        expiresAt: expiryDate || null,
        order: playlist.length,
        createdAt: new Date().toISOString()
      });
      setNewUrl(''); setNewTitle(''); setExpiryDate('');
    } catch (err) {
      alert("Error al guardar en Firebase. Revisa los permisos.");
    }
  };

  const deleteItem = async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'playlist', id));
  };

  const toggleVisibility = async (id, currentStatus) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'playlist', id), { visible: !currentStatus });
  };

  const moveItem = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= playlist.length) return;
    const itemA = playlist[index];
    const itemB = playlist[targetIndex];
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'playlist', itemA.id), { order: targetIndex });
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'playlist', itemB.id), { order: index });
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto pb-20 relative">
      <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6 bg-slate-900/50 p-6 rounded-3xl border border-white/5 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/20 rounded-xl">
            <List className="text-indigo-400 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Consola /dashboard</h1>
            <p className="text-slate-400 text-xs font-mono">DB: <span className="text-emerald-400">tvincentivos</span> • Sync: <span className="animate-pulse text-emerald-400">LIVE</span></p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onGoToTV} className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-bold text-white shadow-lg transition-all hover:scale-105 active:scale-95">
            <MonitorPlay size={18} /> IR A /LIVE
          </button>
          <button onClick={onLogout} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-white/5 transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-slate-900/80 rounded-3xl p-6 border border-white/10 sticky top-6 shadow-2xl space-y-5 backdrop-blur-xl">
            <h3 className="text-lg font-bold flex items-center gap-2 text-white"><Plus className="text-indigo-500" size={20} /> Programar Contenido</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Título del Item</label>
                <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ej: Promo Trimestral" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-colors" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">URL YouTube</label>
                <input type="text" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://..." className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-colors" />
              </div>
              
              {/* --- DATE PICKER MEJORADO --- */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Fecha Límite (Auto-ocultar)</label>
                <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                        <Calendar size={18} className="text-indigo-500 group-hover:text-white transition-colors" />
                    </div>
                    <input 
                        type="date" 
                        value={expiryDate} 
                        onChange={(e) => setExpiryDate(e.target.value)} 
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-indigo-500 outline-none text-white transition-all cursor-pointer hover:bg-slate-900 [color-scheme:dark]" 
                    />
                    {!expiryDate && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 text-xs pointer-events-none italic">
                            Opcional
                        </span>
                    )}
                </div>
              </div>
              {/* ----------------------------- */}

              <button disabled={!newUrl} type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-xl font-bold shadow-lg transition-all hover:shadow-indigo-500/20 active:scale-[0.98] mt-2">
                AÑADIR A LA NUBE
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center mb-2 px-2">
            <h3 className="text-lg font-bold text-white uppercase tracking-wider text-xs">Playlist en tiempo real</h3>
            <span className="text-[10px] bg-slate-800 px-3 py-1 rounded-full text-slate-400 font-bold">{playlist.length} VIDEOS</span>
          </div>
          {playlist.map((item, index) => (
            <div key={item.id} className={`flex items-center gap-4 p-4 bg-slate-900/60 rounded-2xl border border-white/5 transition-all hover:border-white/10 ${!item.visible ? 'opacity-30 grayscale italic' : ''}`}>
              <div className="w-32 aspect-video bg-black rounded-xl overflow-hidden flex-shrink-0 relative">
                <img src={`https://img.youtube.com/vi/${item.youtubeId}/mqdefault.jpg`} className="w-full h-full object-cover" alt="thumb" />
                {new Date(item.expiresAt) < new Date().setHours(0,0,0,0) && item.expiresAt && (
                  <div className="absolute inset-0 bg-red-950/80 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white bg-red-600 px-2 py-1 rounded">EXPIRADO</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-white truncate text-lg tracking-tight">{item.title}</h4>
                <div className="flex gap-4 mt-1">
                  <p className="text-[10px] text-slate-600 font-mono">ID: {item.youtubeId}</p>
                  {item.expiresAt && (
                    <p className={`text-[10px] flex items-center gap-1 font-bold ${new Date(item.expiresAt) < new Date().setHours(0,0,0,0) ? 'text-red-400' : 'text-emerald-400'}`}>
                      <Calendar size={10} /> {new Date(item.expiresAt) < new Date().setHours(0,0,0,0) ? 'Venció:' : 'Expira:'} {item.expiresAt}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => toggleVisibility(item.id, item.visible)} className={`p-2.5 rounded-xl transition-colors ${item.visible ? 'hover:bg-slate-700 text-slate-400' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}>
                  {item.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
                <div className="flex flex-col">
                  <button onClick={() => moveItem(index, -1)} disabled={index === 0} className="p-1 text-slate-600 hover:text-indigo-400 disabled:opacity-0 transition-colors"><ArrowUp size={16} /></button>
                  <button onClick={() => moveItem(index, 1)} disabled={index === playlist.length - 1} className="p-1 text-slate-600 hover:text-indigo-400 disabled:opacity-0 transition-colors"><ArrowDown size={16} /></button>
                </div>
                <button onClick={() => deleteItem(item.id)} className="p-2.5 hover:bg-red-500/10 text-slate-600 hover:text-red-500 rounded-xl ml-1 transition-colors">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TVMode({ playlist, onExit }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showUI, setShowUI] = useState(false); 
  const [errorMsg, setErrorMsg] = useState(null);
  const [isMuted, setIsMuted] = useState(true); // Control real del estado de mute
  
  const playerRef = useRef(null);
  const uiTimerRef = useRef(null);
  
  const activePlaylist = playlist.filter(v => {
    const isVisible = v.visible;
    const isNotExpired = !v.expiresAt || new Date(v.expiresAt) >= new Date(new Date().setHours(0,0,0,0));
    return isVisible && isNotExpired;
  });

  const currentVideo = activePlaylist[currentIdx];

  const resetUITimer = useCallback(() => {
    setShowUI(true);
    if (uiTimerRef.current) clearTimeout(uiTimerRef.current);
    uiTimerRef.current = setTimeout(() => setShowUI(false), 3000);
  }, []);

  useEffect(() => {
    if (!currentVideo) return;

    const init = () => {
      if (playerRef.current) { try { playerRef.current.destroy(); } catch(e){} }

      // ESTRATEGIA: Mute:1 para garantizar reproducción, luego intentar desmutear
      playerRef.current = new window.YT.Player('yt-player', {
        height: '100%',
        width: '100%',
        videoId: currentVideo.youtubeId,
        playerVars: {
          'autoplay': 1,
          'mute': 1, // CRUCIAL: Iniciar mudo permite autoplay en reload
          'controls': 0, 
          'rel': 0,     
          'showinfo': 0,
          'modestbranding': 1,
          'vq': 'hd1080',
          'origin': window.location.origin, // Corrige error de origen
          'host': 'https://www.youtube.com' // Corrige error postMessage
        },
        events: {
          'onReady': (e) => { 
            e.target.playVideo();
            // Intento agresivo de desmutear inmediatamente
            setTimeout(() => {
                try { 
                    if(e.target.isMuted()) {
                        e.target.unMute(); 
                        setIsMuted(false);
                    }
                } catch(err) {}
            }, 500);
          },
          'onStateChange': (e) => { 
            if (e.data === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                // Segundo intento de desmutear al reproducir
                try { 
                    if(e.target.isMuted()) {
                        e.target.unMute(); 
                        setIsMuted(false);
                    }
                } catch(err) {}
            }
            if (e.data === window.YT.PlayerState.ENDED) handleNext(); 
          },
          'onError': (e) => { 
            console.error("Youtube Error:", e.data);
            setErrorMsg("Error de video. Saltando..."); 
            setTimeout(() => handleNext(), 3000); 
          }
        }
      });
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = init;
    } else {
      init();
    }
    
    window.addEventListener('mousemove', resetUITimer);
    window.addEventListener('touchstart', resetUITimer);

    return () => {
      window.removeEventListener('mousemove', resetUITimer);
      window.removeEventListener('touchstart', resetUITimer);
      if (uiTimerRef.current) clearTimeout(uiTimerRef.current);
    };
  }, [currentVideo, resetUITimer]);

  const handleNext = useCallback(() => {
    setCurrentIdx((prev) => (prev + 1 >= activePlaylist.length ? 0 : prev + 1));
  }, [activePlaylist.length]);

  const unmuteManually = () => {
    if(playerRef.current && playerRef.current.unMute) {
        playerRef.current.unMute();
        setIsMuted(false);
    }
  };

  if (playlist.length === 0 && !currentVideo) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-black text-white p-10 text-center">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-500 text-xs font-mono animate-pulse">SINTONIZANDO SEÑAL...</p>
        </div>
      );
  }

  if (activePlaylist.length === 0) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-black text-white p-10 text-center">
        <Tv size={80} className="mb-6 text-slate-900 animate-pulse" />
        <h2 className="text-2xl font-black mb-2 uppercase tracking-tight italic">Señal No Programada</h2>
        <p className="text-slate-600 text-sm">No hay contenido activo en este momento.</p>
        <button onClick={onExit} className="mt-8 px-6 py-2 bg-white/10 text-white rounded-full text-xs font-bold hover:bg-white/20 transition-all border border-white/5">
          VOLVER
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden group">
      <div id="yt-player" className="w-full h-full pointer-events-none scale-[1.02]"></div>
      
      {/* Botón discreto de "Desmutear" solo si falló el auto-unmute */}
      {isMuted && isPlaying && (
        <div className="absolute bottom-6 right-6 z-50 animate-bounce">
            <button onClick={unmuteManually} className="bg-red-600 hover:bg-red-700 text-white p-4 rounded-full shadow-2xl transition-transform hover:scale-110">
                <VolumeX size={24} />
            </button>
            <div className="text-center text-[10px] font-bold mt-2 text-white/50 uppercase tracking-widest bg-black/50 px-2 py-1 rounded">Activar Sonido</div>
        </div>
      )}

      {/* Interfaz Superior (Discreta y Sutil) */}
      <div className={`absolute top-0 left-0 w-full z-30 transition-all duration-700 pointer-events-none ${showUI ? 'opacity-100' : 'opacity-0'}`}>
        <div className="w-full p-6 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-black text-white/90 drop-shadow-lg tracking-tighter uppercase italic opacity-80">{currentVideo.title}</h2>
            <p className="text-white/50 font-mono text-[10px] mt-1 flex items-center gap-2">
               <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span> EN VIVO • {currentIdx + 1}/{activePlaylist.length}
            </p>
          </div>
          <button 
            onClick={onExit} 
            className="pointer-events-auto p-2 bg-black/20 hover:bg-red-900/40 backdrop-blur-md rounded-full text-white/50 hover:text-white transition-all border border-white/5 hover:scale-110"
            title="Salir"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-2xl animate-in zoom-in duration-300">
           <AlertTriangle className="w-16 h-16 text-yellow-600 mb-4 animate-bounce" />
           <p className="text-xl font-black uppercase italic tracking-tighter text-white/80">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}
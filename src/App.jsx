import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Tv, Settings, LogOut, MonitorPlay, Lock, AlertTriangle, Film, List, Calendar, VolumeX, Clock, CheckCircle, Shield, Key, Pencil, X, Youtube, GripVertical, Copy, Info, Layers, Activity, Edit3, Wifi, WifiOff, ExternalLink, RefreshCw, Monitor, Star, Search } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, writeBatch, getDocs } from 'firebase/firestore';

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

const ENV_PASSWORD = getEnv("VITE_ADMIN_PASSWORD", "1234");

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


// --- Utilerías ---
const getYouTubeId = (url) => {
  try {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  } catch (e) { return null; }
};

const getTodayString = () => new Date().toISOString().split('T')[0];

const getDeviceId = () => {
  try {
    let id = localStorage.getItem('tv_device_id');
    if (!id) {
      id = 'tv-' + Math.random().toString(36).substr(2, 9).toUpperCase();
      localStorage.setItem('tv_device_id', id);
    }
    return id;
  } catch (e) {
    return 'tv-temp-' + Math.floor(Math.random() * 10000);
  }
};

const getDeviceInfo = () => {
  try {
    const ua = navigator.userAgent;
    let device = "Desconocido";
    if (/SmartTV|WebOS|Tizen|NetCast|Viera|BRAVIA/i.test(ua)) device = "Smart TV";
    else if (/Android/i.test(ua)) device = "Android";
    else if (/iPhone|iPad|iPod/i.test(ua)) device = "iOS";
    else if (/Windows/i.test(ua)) device = "Windows";
    else if (/Mac/i.test(ua)) device = "Mac";
    else if (/Linux/i.test(ua)) device = "Linux";

    let browser = "Web";
    if (/Chrome/i.test(ua) && !/Edge|Edg/i.test(ua)) browser = "Chrome";
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
    else if (/Firefox/i.test(ua)) browser = "Firefox";
    else if (/Edge|Edg/i.test(ua)) browser = "Edge";
    else if (/Opera|OPR/i.test(ua)) browser = "Opera";

    return `${device} (${browser})`;
  } catch (e) { return "TV Desconocido"; }
};

// --- ALGORITMO DE DISTRIBUCIÓN PROPORCIONAL MATEMÁTICO ---
const getDistributedPlaylist = (draftList) => {
    const regs = draftList.filter(item => !item.isPromo).sort((a,b) => (a.order||0) - (b.order||0));
    const promos = draftList.filter(item => item.isPromo);

    if (promos.length === 0) return regs;
    if (regs.length === 0) return promos;

    // Agrupar promos similares para evitar que se junten 2 promos de la misma campaña
    const promoGroups = {};
    promos.forEach(p => {
        if(!promoGroups[p.youtubeId]) promoGroups[p.youtubeId] = [];
        promoGroups[p.youtubeId].push(p);
    });

    const roundRobinPromos = [];
    let added = true;
    while(added) {
        added = false;
        for(const key in promoGroups) {
            if(promoGroups[key].length > 0) {
                roundRobinPromos.push(promoGroups[key].shift());
                added = true;
            }
        }
    }

    const distributed = [];
    const R = regs.length;
    const P = roundRobinPromos.length;
    
    // Calcula la frecuencia exacta (ej: 21 regs / 3 promos = cada 7)
    const step = R / P;
    let regIdx = 0;
    
    for (let i = 1; i <= P; i++) {
        const targetRegs = Math.round(i * step);
        while (regIdx < targetRegs && regIdx < R) {
            distributed.push(regs[regIdx++]);
        }
        distributed.push(roundRobinPromos[i - 1]);
    }
    
    // Por seguridad, añadir cualquier video regular sobrante al final
    while (regIdx < R) {
        distributed.push(regs[regIdx++]);
    }

    return distributed;
};

export default function App() {
  const [view, setView] = useState('landing');
  const [playlist, setPlaylist] = useState([]);
  const [dbPassword, setDbPassword] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [initError, setInitError] = useState(null);

  // Router simple
  useEffect(() => {
    try {
      const path = window.location.pathname;
      if (path === '/live' || path.endsWith('/live')) {
        setView('tv');
      } else if (path === '/dashboard' || path.endsWith('/dashboard')) {
        setView('login');
      }
    } catch (e) { console.warn("Error en router", e); }
  }, []);

  const navigateTo = (newView) => {
    try {
      let path = '/';
      if (newView === 'tv') path = '/live';
      if (newView === 'login' || newView === 'admin') path = '/dashboard';
      window.history.pushState({}, '', path);
    } catch (e) {}
    setView(newView);
  };

  // Auth
  useEffect(() => {
    if (!auth) { setInitError("Error de conexión."); return; }
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
        else await signInAnonymously(auth);
      } catch (e) { try { await signInAnonymously(auth); } catch (err) {} }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  // Data Sync
  useEffect(() => {
    if (!user || !db) return;
    try {
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
    } catch(e) { console.error("Data Sync Error", e); }
  }, [user]);

  const validateLogin = (pass) => pass === (dbPassword || FIREBASE_DEFAULTS.adminPass);
  const handleUpdatePassword = async (pass) => {
      if (!db || !user) return;
      try { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'auth'), { password: pass }, { merge: true }); return true; } 
      catch (e) { return false; }
  };

  if (initError) return <div className="h-screen bg-black text-white flex items-center justify-center">Reconectando...</div>;
  if (!app) return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-bold animate-pulse">Cargando 4Life TV...</div>;

  const renderView = () => {
    switch (view) {
      case 'tv': return <TVMode playlist={playlist} onExit={() => navigateTo('landing')} />;
      case 'login': return <Login onValidate={validateLogin} onLogin={() => { setIsAuthenticated(true); setView('admin'); }} onBack={() => navigateTo('landing')} />;
      case 'admin': return <AdminPanel playlist={playlist} onUpdatePassword={handleUpdatePassword} onLogout={() => { setIsAuthenticated(false); navigateTo('landing'); }} onGoToTV={() => navigateTo('tv')} />;
      default: return <Landing onSelectTV={() => navigateTo('tv')} onSelectAdmin={() => navigateTo(isAuthenticated ? 'admin' : 'login')} />;
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-white font-sans selection:bg-indigo-500 selection:text-white overflow-hidden flex flex-col">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.5); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6366f1; }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #334155 rgba(15, 23, 42, 0.5); }
      `}</style>
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[120px]" />
      </div>
      <div className="relative z-10 w-full h-full flex flex-col">{renderView()}</div>
    </div>
  );
}

// --- COMPONENTES UI ---

function Toast({ notification, onClose }) {
    if (!notification) return null;
    useEffect(() => { const t = setTimeout(onClose, 2000); return () => clearTimeout(t); }, [notification, onClose]);
    const styles = { success: 'bg-emerald-950/90 border-emerald-500 text-emerald-100', error: 'bg-red-950/90 border-red-500 text-red-100', warning: 'bg-amber-950/90 border-amber-500 text-amber-100' };
    const icons = { success: <CheckCircle className="text-emerald-500" size={20} />, error: <AlertTriangle className="text-red-500" size={20} />, warning: <Info className="text-amber-500" size={20} /> };
    return (
        <div className={`fixed top-6 right-6 z-[60] p-4 rounded-xl border shadow-2xl backdrop-blur-md animate-in slide-in-from-right-4 fade-in duration-300 max-w-sm w-full flex items-start gap-3 ${styles[notification.type]}`}>
            <div className="shrink-0 mt-0.5">{icons[notification.type]}</div>
            <div className="flex-1"><h4 className="font-bold text-sm uppercase tracking-wide">{notification.title}</h4><p className="text-xs opacity-90 mt-1">{notification.message}</p></div>
            <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity"><X size={16}/></button>
        </div>
    );
}

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, actions }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full scale-100 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-slate-400 text-sm mb-6 leading-relaxed">{message}</p>
                {actions ? (
                    <div className="flex flex-col gap-2">
                        {actions.map((action, idx) => (
                             <button key={idx} onClick={action.onClick} className={`w-full py-3 rounded-xl font-bold text-xs shadow-lg transition-transform active:scale-95 ${action.className || 'bg-slate-800 text-white hover:bg-slate-700'}`}>{action.label}</button>
                        ))}
                        <button onClick={onCancel} className="w-full py-3 rounded-xl text-slate-400 font-bold text-xs hover:bg-white/5 transition-colors mt-2">CANCELAR OPERACIÓN</button>
                    </div>
                ) : (
                    <div className="flex gap-3">
                        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-slate-400 font-bold text-xs hover:bg-white/5 transition-colors">CANCELAR</button>
                        <button onClick={onConfirm} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold text-xs shadow-lg">CONFIRMAR</button>
                    </div>
                )}
            </div>
        </div>
    );
}

// --- VISTAS ---

function Landing({ onSelectTV, onSelectAdmin }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 overflow-y-auto custom-scrollbar">
      <div className="text-center space-y-10 max-w-2xl mx-auto">
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl mb-4 border border-indigo-500/20 backdrop-blur-sm"><Film className="w-8 h-8 text-indigo-400" /></div>
          <h1 className="text-6xl font-black tracking-tighter text-white drop-shadow-2xl">4Life <span className="text-indigo-500">TV</span></h1>
          <p className="text-slate-400 text-xl font-light italic">Colombia • Gestión de Pantallas</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full max-w-lg mx-auto">
          <button onClick={onSelectTV} className="group relative flex flex-col items-center p-8 bg-slate-900/50 hover:bg-slate-800/80 rounded-3xl border border-white/5 hover:border-indigo-500/50 transition-all duration-500 hover:-translate-y-2 backdrop-blur-md">
            <div className="absolute -top-3 -right-3 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full animate-pulse shadow-lg">/LIVE</div>
            <Tv className="w-12 h-12 mb-6 text-slate-300 group-hover:text-white transition-colors" /><span className="text-2xl font-bold text-white">Modo TV</span>
          </button>
          <button onClick={onSelectAdmin} className="group relative flex flex-col items-center p-8 bg-slate-900/50 hover:bg-slate-800/80 rounded-3xl border border-white/5 hover:border-indigo-500/50 transition-all duration-500 hover:-translate-y-2 backdrop-blur-md">
            <div className="absolute -top-3 -right-3 bg-indigo-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">/ADMIN</div>
            <div className="w-12 h-12 mb-6 flex items-center justify-center"><Settings className="w-full h-full text-slate-300 group-hover:text-white transition-colors" /></div>
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
  const handleSubmit = (e) => { e.preventDefault(); if (onValidate(password)) onLogin(); else { setError(true); setPassword(''); } };
  return (
    <div className="flex items-center justify-center h-full bg-black/50 backdrop-blur-sm p-4 overflow-y-auto custom-scrollbar">
      <div className="w-full max-w-md bg-slate-900/90 border border-white/10 rounded-3xl shadow-2xl p-8">
        <h2 className="text-2xl font-bold text-white text-center mb-6">Acceso 4Life Colombia</h2>
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
  
  // Promos State
  const [isPromo, setIsPromo] = useState(false);
  const [promoInstances, setPromoInstances] = useState(1);
  
  const [newPass, setNewPass] = useState('');
  
  const [sortedPlaylist, setSortedPlaylist] = useState([]);
  const [dragItemIndex, setDragItemIndex] = useState(null); 
  const [searchTerm, setSearchTerm] = useState(''); // Estado para el buscador
  
  const [devices, setDevices] = useState([]);
  const [editingDevice, setEditingDevice] = useState(null);
  const [deviceLabel, setDeviceLabel] = useState('');

  const [notification, setNotification] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, actions: null });
  const showToast = (title, message, type = 'success') => setNotification({ title, message, type });

  useEffect(() => {
    if (dragItemIndex === null) setSortedPlaylist(playlist);
  }, [playlist, dragItemIndex]);

  useEffect(() => {
      if(tab !== 'devices') return;
      const devicesRef = collection(db, 'artifacts', appId, 'public', 'data', 'devices');
      const unsub = onSnapshot(devicesRef, (snap) => {
          const devs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setDevices(devs.sort((a,b) => {
              const aOnline = (Date.now() - new Date(a.lastSeen).getTime()) < 40000;
              const bOnline = (Date.now() - new Date(b.lastSeen).getTime()) < 40000;
              if (aOnline === bOnline) return (a.label || a.id).localeCompare(b.label || b.id);
              return aOnline ? -1 : 1;
          }));
      });
      return () => unsub();
  }, [tab]);

  // --- Lógica Matemática para el Máximo de Promos ---
  // Se requiere mínimo 1 video regular por cada instancia promocional para evitar que se toquen (incluso en bucle).
  const ytIdCurrent = getYouTubeId(newUrl);
  const currentR = playlist.filter(p => !p.isPromo && p.youtubeId !== ytIdCurrent).length;
  const currentOtherPromos = playlist.filter(p => p.isPromo && p.youtubeId !== ytIdCurrent).length;
  // Permite 1 a 1
  const maxAllowedPromos = Math.max(0, currentR - currentOtherPromos);

  // Funciones de utilidad interna
  const resetForm = () => { 
    setEditingId(null); setNewUrl(''); setNewTitle(''); setStartDate(''); setEndDate(''); 
    setScheduleMode('now'); setIsPromo(false); setPromoInstances(1);
  };

  const startEditing = (item) => {
    setEditingId(item.id); setNewTitle(item.title); setNewUrl(`https://youtu.be/${item.youtubeId}`);
    setStartDate(item.startDate || ''); setEndDate(item.endDate || '');
    setScheduleMode(item.startDate && item.startDate > getTodayString() ? 'schedule' : 'now');
    
    setIsPromo(!!item.isPromo);
    if(item.isPromo) {
        setPromoInstances(playlist.filter(p => p.youtubeId === item.youtubeId).length);
    } else {
        setPromoInstances(1);
    }
  };

  // --- Función Principal de Guardado (Atómica / Batch) ---
  const handleSave = async (e) => {
    e.preventDefault();
    const ytId = getYouTubeId(newUrl);
    if (!ytId) return showToast("URL Inválida", "Enlace de YouTube no válido.", "error");

    // Limites Estrictos de Promo
    const targetInstances = isPromo ? Math.max(1, parseInt(promoInstances, 10)) : 1;
    if (isPromo && targetInstances > maxAllowedPromos && maxAllowedPromos > 0 && targetInstances > playlist.filter(p => p.youtubeId === ytId).length) {
        return showToast("Límite Excedido", `Solo puedes añadir hasta ${maxAllowedPromos} instancias con la cantidad de videos regulares actuales.`, "warning");
    }

    if (!editingId && !isPromo) {
        const isDuplicateId = playlist.some(p => p.youtubeId === ytId && !p.isPromo);
        if (isDuplicateId) return showToast("Ya existe", "Este video ya está en lista. Usa 'Clonar' para repetirlo.", "warning");
    }

    try {
        const batch = writeBatch(db);
        let draftPlaylist = [...playlist];

        if (editingId) {
            const originalItem = playlist.find(p => p.id === editingId);
            draftPlaylist = draftPlaylist.filter(p => p.youtubeId !== originalItem.youtubeId);
            const oldClones = playlist.filter(p => p.youtubeId === originalItem.youtubeId);
            
            for (let i = 0; i < targetInstances; i++) {
                const existingClone = oldClones[i];
                draftPlaylist.push({
                    id: existingClone ? existingClone.id : null,
                    _isNew: !existingClone,
                    youtubeId: ytId,
                    title: newTitle || `Video de YouTube`,
                    visible: editingId ? (originalItem.visible ?? true) : true,
                    startDate: (scheduleMode === 'now') ? getTodayString() : (startDate || getTodayString()),
                    endDate: endDate || null,
                    isPromo: isPromo,
                    createdAt: existingClone ? existingClone.createdAt : new Date().toISOString()
                });
            }

            // Marcar exceso de clones antiguos para borrado
            const clonesToDelete = oldClones.slice(targetInstances);
            clonesToDelete.forEach(clone => {
                batch.delete(doc(db, 'artifacts', appId, 'public', 'data', 'playlist', clone.id));
            });
        } else {
            // Documentos Completamente Nuevos
            for (let i = 0; i < targetInstances; i++) {
                draftPlaylist.push({
                    id: null,
                    _isNew: true,
                    youtubeId: ytId,
                    title: newTitle || `Video de YouTube`,
                    visible: true,
                    startDate: (scheduleMode === 'now') ? getTodayString() : (startDate || getTodayString()),
                    endDate: endDate || null,
                    isPromo: isPromo,
                    createdAt: new Date().toISOString()
                });
            }
        }

        // --- Módulo de Intercalado Automático (Auto-Distribution) ---
        let finalDistributed = draftPlaylist;
        if (isPromo) {
            // Aplicar el nuevo cálculo proporcional matemático
            finalDistributed = getDistributedPlaylist(draftPlaylist);
        } else {
            // Si es regular, solo lo organizamos al final de la lista de forma secuencial
            finalDistributed = draftPlaylist.sort((a,b) => (a.order||0) - (b.order||0));
        }

        // --- Escribir el Batch Final ---
        finalDistributed.forEach((item, idx) => {
            const payload = {
                youtubeId: item.youtubeId,
                title: item.title,
                visible: item.visible,
                startDate: item.startDate,
                endDate: item.endDate,
                isPromo: !!item.isPromo,
                order: idx,
                createdAt: item.createdAt
            };
            
            if (item._isNew) {
                const newRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'playlist'));
                batch.set(newRef, payload);
            } else {
                batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'playlist', item.id), payload);
            }
        });

        await batch.commit();
        showToast("Éxito", isPromo ? "Promoción guardada y lista auto-organizada." : "Video guardado correctamente.");
        resetForm();

    } catch (err) { console.error(err); showToast("Error", "No se pudo guardar la lista.", "error"); }
  };

  // --- Organizador Manual para el Botón ---
  const runManualAutoDistribution = async () => {
    try {
        const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'playlist'));
        const list = snap.docs.map(d => ({id: d.id, ...d.data()}));
        
        // Llamar al nuevo algoritmo de distribución
        const distributed = getDistributedPlaylist(list);

        const distBatch = writeBatch(db);
        distributed.forEach((item, idx) => {
            distBatch.update(doc(db, 'artifacts', appId, 'public', 'data', 'playlist', item.id), { order: idx });
        });
        await distBatch.commit();
        showToast("Organizado", "Las promociones se han distribuido uniformemente.");
    } catch(e) { showToast("Error", "Error al organizar la lista.", "error"); }
  };


  const promptDuplicate = (item) => {
      setConfirmDialog({ 
          isOpen: true, title: "Clonar Video", message: `Esto creará una copia de "${item.title}". Si editas una, afectará a la copia.`, 
          onConfirm: () => handleDuplicate(item) 
      });
  };

  const handleDuplicate = async (item) => {
      try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'playlist'), { youtubeId: item.youtubeId, title: item.title, visible: item.visible, startDate: item.startDate, endDate: item.endDate, isPromo: !!item.isPromo, order: playlist.length, createdAt: new Date().toISOString() }); showToast("Clonado", "Copia añadida al final de la lista."); } 
      catch (e) { showToast("Error", "Error al clonar.", "error"); }
      setConfirmDialog({ ...confirmDialog, isOpen: false });
  };

  const handleChangePass = async (e) => { e.preventDefault(); if (!newPass) return; if (await onUpdatePassword(newPass)) { showToast("Clave Actualizada", "Guardado."); setNewPass(''); } else showToast("Error", "Error al cambiar clave.", "error"); };
  
  const promptDelete = (item) => { 
      const clonesCount = playlist.filter(p => p.youtubeId === item.youtubeId).length;
      if (clonesCount > 1) {
          setConfirmDialog({ 
            isOpen: true, title: "Gestionar Eliminación", message: `Este video tiene ${clonesCount} instancias en la lista. ¿Qué deseas hacer?`, 
            actions: [
                { label: "ELIMINAR SOLO ESTA INSTANCIA", onClick: () => deleteSingleInstance(item.id), className: "bg-indigo-600 hover:bg-indigo-500 text-white" },
                { label: `ELIMINAR TODAS LAS ${clonesCount}`, onClick: () => deleteCampaign(item), className: "bg-red-600 hover:bg-red-500 text-white" }
            ]
        });
      } else {
          setConfirmDialog({ isOpen: true, title: "Eliminar Video", message: "¿Estás seguro de que deseas eliminar este video permanentemente?", onConfirm: () => deleteSingleInstance(item.id) }); 
      }
  };

  const deleteSingleInstance = async (id) => { try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'playlist', id)); if(editingId === id) resetForm(); showToast("Instancia Eliminada", "Se ha borrado el video."); } catch(e) {} setConfirmDialog({ ...confirmDialog, isOpen: false }); };
  const deleteCampaign = async (item) => { try { const batch = writeBatch(db); const clones = playlist.filter(p => p.youtubeId === item.youtubeId); clones.forEach(clone => { const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'playlist', clone.id); batch.delete(docRef); }); await batch.commit(); if(editingId && clones.some(c => c.id === editingId)) resetForm(); showToast("Campaña Eliminada", `Borrados ${clones.length} videos.`); } catch(e) {} setConfirmDialog({ ...confirmDialog, isOpen: false }); };
  const toggleVisibility = async (item) => { const batch = writeBatch(db); const clones = playlist.filter(p => p.youtubeId === item.youtubeId); const newStatus = !item.visible; clones.forEach(clone => { const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'playlist', clone.id); batch.update(docRef, { visible: newStatus }); }); await batch.commit(); };
  
  const onDragStart = (e, index) => { setDragItemIndex(index); e.dataTransfer.effectAllowed = "move"; };
  const onDragEnter = (e, index) => { if (dragItemIndex === null || dragItemIndex === index) return; const newList = [...sortedPlaylist]; const item = newList[dragItemIndex]; newList.splice(dragItemIndex, 1); newList.splice(index, 0, item); setDragItemIndex(index); setSortedPlaylist(newList); };
  const onDragEnd = async () => { const finalIndex = dragItemIndex; setDragItemIndex(null); if (finalIndex === null) return; const batch = writeBatch(db); sortedPlaylist.forEach((item, idx) => { const ref = doc(db, 'artifacts', appId, 'public', 'data', 'playlist', item.id); batch.update(ref, { order: idx }); }); try { await batch.commit(); } catch(e) { setSortedPlaylist(playlist); } };

  // DISPOSITIVOS
  const saveDeviceLabel = async (devId) => { try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'devices', devId), { label: deviceLabel }); setEditingDevice(null); showToast("Guardado", "Nombre actualizado."); } catch(e) {} };
  const deleteDevice = async (devId) => { try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'devices', devId)); showToast("Olvidado", "Dispositivo eliminado."); } catch(e) {} };
  const sendRemoteCommand = async (devId, command) => { try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'devices', devId), { command: command, commandTime: Date.now() }); showToast("Comando Enviado", `Enviado al dispositivo.`); } catch (e) {} };

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto overflow-hidden">
      <Toast notification={notification} onClose={() => setNotification(null)} />
      <ConfirmModal isOpen={confirmDialog.isOpen} title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} actions={confirmDialog.actions} />

      <header className="shrink-0 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/60 p-4 m-4 md:mx-8 rounded-3xl border border-white/5 backdrop-blur-md shadow-2xl z-40">
        <div className="flex items-center gap-4"><div className="p-3 bg-indigo-500/20 rounded-xl"><List className="text-indigo-400 w-6 h-6" /></div><div><h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Panel 4Life Colombia</h1><p className="text-slate-400 text-[10px] font-mono uppercase tracking-widest">Conexión: <span className="animate-pulse text-emerald-400 font-bold">Live</span></p></div></div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-800/50 p-1 rounded-xl border border-white/5"><button onClick={() => setTab('content')} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${tab === 'content' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>CONTENIDO</button><button onClick={() => setTab('devices')} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${tab === 'devices' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>MONITORES</button><button onClick={() => setTab('settings')} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${tab === 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>SEGURIDAD</button></div>
          <div className="w-px h-8 bg-white/10 mx-1 hidden md:block"></div>
          <button onClick={onGoToTV} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white shadow-lg transition-all active:scale-95"><MonitorPlay size={16} /> LIVE</button>
          <button onClick={onLogout} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl border border-white/5 transition-colors"><LogOut size={18} /></button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden px-4 md:px-8 pb-4">
        {tab === 'devices' ? (
             <div className="h-full overflow-y-auto custom-scrollbar pb-20">
                <div className="max-w-4xl mx-auto space-y-4">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Activity className="text-indigo-400"/> Estado de Pantallas</h2>
                            <p className="text-slate-400 text-sm">Monitoreo en tiempo real de los dispositivos conectados.</p>
                        </div>
                        <div className="bg-slate-900/50 px-4 py-2 rounded-xl border border-white/10 text-xs font-mono text-slate-400">
                            Total: <span className="text-white font-bold">{devices.length}</span>
                        </div>
                    </div>

                    {devices.length === 0 && (
                        <div className="p-12 text-center bg-slate-900/40 rounded-3xl border border-dashed border-white/10">
                            <WifiOff className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                            <p className="text-slate-500 text-sm mb-4">No se han detectado pantallas activas aún.</p>
                            <button onClick={() => window.open('/live', '_blank')} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-bold text-sm shadow-lg flex items-center gap-2 mx-auto"><ExternalLink size={16}/> ABRIR SIMULADOR TV</button>
                            <p className="text-slate-600 text-xs mt-4">Usa este botón para abrir una ventana "cliente" y ver cómo aparece aquí.</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {devices.map(dev => {
                            const isOnline = (Date.now() - new Date(dev.lastSeen).getTime()) < 40000;
                            const isEditing = editingDevice === dev.id;

                            return (
                                <div key={dev.id} className={`p-4 rounded-2xl border transition-all ${isOnline ? 'bg-slate-900/80 border-emerald-500/30 shadow-lg shadow-emerald-900/5' : 'bg-slate-900/40 border-white/5 opacity-70'}`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/50 text-slate-500'}`}>
                                            {isOnline ? <Wifi size={12}/> : <WifiOff size={12}/>}
                                            {isOnline ? 'ONLINE' : 'OFFLINE'}
                                        </div>
                                        <button onClick={() => deleteDevice(dev.id)} className="text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={14}/></button>
                                    </div>
                                    
                                    <div className="mb-4">
                                        {isEditing ? (
                                            <div className="flex gap-2 mb-1">
                                                <input 
                                                    autoFocus
                                                    className="w-full bg-slate-950 border border-indigo-500 rounded px-2 py-1 text-sm text-white outline-none"
                                                    value={deviceLabel}
                                                    onChange={e => setDeviceLabel(e.target.value)}
                                                    placeholder="Sede ej: Bogotá Principal"
                                                />
                                                <button onClick={() => saveDeviceLabel(dev.id)} className="bg-indigo-600 text-white px-2 rounded hover:bg-indigo-500"><CheckCircle size={14}/></button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 group mb-1">
                                                <h3 className="font-bold text-white text-lg truncate" title={dev.id}>
                                                    {dev.label || 'Pantalla Sin Nombre'}
                                                </h3>
                                                <button onClick={() => { setEditingDevice(dev.id); setDeviceLabel(dev.label || ''); }} className="text-slate-600 group-hover:text-indigo-400 transition-colors"><Edit3 size={14}/></button>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 truncate">
                                            <Monitor size={10} className="text-slate-600"/> {dev.deviceInfo || 'TV Desconocido'}
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-3 border-t border-white/5">
                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                            <Film size={12} className="text-indigo-400"/>
                                            <span className="truncate flex-1" title={dev.currentVideo}>{dev.currentVideo || 'Sin actividad'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                            <Clock size={10}/>
                                            <span>Visto: {new Date(dev.lastSeen).toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-2 mt-4 pt-3 border-t border-white/5">
                                        <button onClick={() => sendRemoteCommand(dev.id, 'FORCE_PLAY')} className="flex-1 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 active:scale-95"><Play size={10}/> FORZAR PLAY</button>
                                        <button onClick={() => sendRemoteCommand(dev.id, 'REFRESH')} className="flex-1 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/20 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 active:scale-95"><RefreshCw size={10}/> RECARGAR TV</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
             </div>
        ) : tab === 'settings' ? (
          <div className="h-full overflow-y-auto custom-scrollbar">
            <div className="max-w-md mx-auto bg-slate-900/80 rounded-3xl p-8 border border-white/10 shadow-2xl backdrop-blur-xl mt-8"><h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Shield className="text-indigo-400"/> Seguridad</h3><p className="text-slate-400 text-sm mb-6">Cambia la contraseña de acceso al panel.</p><form onSubmit={handleChangePass} className="space-y-4"><div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nueva Clave</label><div className="relative"><Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} /><input type="text" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Ej: admin2026" className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-indigo-500 outline-none transition-colors" /></div></div><button disabled={!newPass} type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 rounded-xl font-bold shadow-lg shadow-emerald-900/10 transition-all">ACTUALIZAR CLAVE</button></form></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
            <div className="lg:col-span-1 h-full overflow-y-auto pr-2 custom-scrollbar">
              <div className={`bg-slate-900/80 rounded-3xl p-6 border transition-all shadow-2xl space-y-5 backdrop-blur-xl mb-4 ${editingId ? 'border-indigo-500 ring-1 ring-indigo-500/50' : 'border-white/10'}`}>
                <div className="flex justify-between items-center"><h3 className="text-lg font-bold flex items-center gap-2 text-white">{editingId ? <Pencil className="text-indigo-400" size={20} /> : <Plus className="text-indigo-500" size={20} />} {editingId ? 'Editar Video' : 'Nuevo Video'}</h3>{editingId && <button onClick={resetForm} className="text-[10px] flex items-center gap-1 text-slate-400 hover:text-white bg-slate-800 px-2 py-1 rounded-lg transition-colors"><X size={14} /> Cancelar</button>}</div>
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800"><button type="button" onClick={() => setScheduleMode('now')} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${scheduleMode === 'now' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>PUBLICAR YA</button><button type="button" onClick={() => setScheduleMode('schedule')} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all ${scheduleMode === 'schedule' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>PROGRAMAR</button></div>
                  
                  <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Título</label><input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Ej: Promo Verano" className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">URL YouTube</label><input type="text" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://youtube.com/..." className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none" /></div>
                  
                  {/* Etiqueta Promocional */}
                  <div className="pt-2">
                    <label className="flex items-center gap-3 cursor-pointer bg-slate-900/60 p-3 rounded-xl border border-white/5 hover:border-yellow-500/50 transition-colors select-none">
                        <input type="checkbox" checked={isPromo} onChange={(e) => setIsPromo(e.target.checked)} className="accent-yellow-500 w-4 h-4" />
                        <span className="text-xs font-bold text-white flex items-center gap-1.5"><Star size={14} className="text-yellow-500"/> MARCAR COMO PROMOCIONAL</span>
                    </label>
                  </div>

                  {isPromo && (
                    <div className="space-y-1 p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20 animate-in fade-in zoom-in-95 duration-200">
                      <label className="text-[10px] font-bold text-yellow-500 uppercase flex items-center justify-between">
                          <span>Instancias de Promo</span>
                          <span className="bg-yellow-500/20 px-2 py-0.5 rounded">Máximo: {maxAllowedPromos}</span>
                      </label>
                      <input 
                        type="number" 
                        min="1" 
                        max={Math.max(1, maxAllowedPromos)} 
                        value={promoInstances} 
                        onChange={(e) => setPromoInstances(e.target.value)} 
                        className="w-full bg-slate-950 border border-yellow-500/30 rounded-xl px-4 py-3 text-sm focus:border-yellow-500 outline-none text-white transition-colors" 
                        disabled={maxAllowedPromos < 1}
                      />
                      {maxAllowedPromos < 1 && <p className="text-[10px] text-red-400 mt-2 leading-tight">Agrega mínimo 1 video normal por cada promoción que desees en la lista para desbloquear esta opción.</p>}
                      {maxAllowedPromos > 0 && <p className="text-[10px] text-yellow-500/60 mt-2 leading-tight">Las promociones se distribuirán automáticamente sin juntarse entre ellas.</p>}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">{scheduleMode === 'schedule' && (<div className="space-y-1 col-span-2 sm:col-span-1"><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Inicio</label><div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none" size={14} /><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-2 py-2.5 text-[10px] focus:border-indigo-500 outline-none text-white scheme-dark" /></div></div>)}<div className={`space-y-1 ${scheduleMode === 'now' ? 'col-span-2' : 'col-span-2 sm:col-span-1'}`}><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Fin (Opcional)</label><div className="relative"><Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14} /><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-2 py-2.5 text-[10px] focus:border-indigo-500 outline-none text-white scheme-dark" /></div></div></div>
                  <button disabled={!newUrl || (isPromo && maxAllowedPromos < 1)} type="submit" className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all mt-2 active:scale-95 ${editingId ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed'}`}>{editingId ? 'GUARDAR CAMBIOS' : 'AÑADIR A PLAYLIST'}</button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2 h-full overflow-y-auto pr-2 custom-scrollbar pb-20">
              <div className="flex justify-between items-center mb-2 px-2 sticky top-0 bg-slate-950/90 py-2 z-10 backdrop-blur">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">Playlist Activa <span className="bg-slate-800 px-2 py-0.5 rounded text-white">{sortedPlaylist.length}</span></h3>
                  <div className="flex items-center gap-3">
                      <button onClick={runManualAutoDistribution} className="bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-colors active:scale-95" title="Distribuir promociones uniformemente">
                          <Star size={12} /> RE-DISTRIBUIR
                      </button>
                      <span className="text-[8px] text-slate-600 italic hidden sm:block">TIP: Arrastra para reordenar</span>
                  </div>
              </div>
              
              {/* --- BUSCADOR INTELIGENTE --- */}
              <div className="mb-4 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input 
                      type="text" 
                      placeholder="Buscar video por título o ID de YouTube..." 
                      value={searchTerm} 
                      onChange={(e) => setSearchTerm(e.target.value)} 
                      className="w-full bg-slate-900/60 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm focus:border-indigo-500 outline-none text-white transition-colors"
                  />
                  {searchTerm && (
                      <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1 transition-colors">
                          <X size={16} />
                      </button>
                  )}
              </div>

              <div className="space-y-4 mt-4">
                {sortedPlaylist.filter(item => item.title.toLowerCase().includes(searchTerm.toLowerCase()) || item.youtubeId.includes(searchTerm)).map((item, mappedIndex) => {
                  const index = sortedPlaylist.findIndex(p => p.id === item.id); // Extraemos el índice real para el ordenamiento
                  const isEditing = editingId === item.id;
                  const now = getTodayString();
                  const isScheduled = item.startDate && item.startDate > now;
                  const isExpired = item.endDate && item.endDate < now;
                  const isDraggingThis = dragItemIndex === index;
                  
                  const cloneCount = sortedPlaylist.filter(p => p.youtubeId === item.youtubeId).length;
                  const isClone = cloneCount > 1 && !item.isPromo; // Ocultamos el badge de clone nativo si es promo

                  return (
                    <div 
                      key={item.id} 
                      draggable={!searchTerm} // Deshabilita arrastrar si hay una búsqueda activa
                      onDragStart={(e) => { if (!searchTerm) onDragStart(e, index) }}
                      onDragEnter={(e) => { if (!searchTerm) onDragEnter(e, index) }}
                      onDragEnd={onDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                      className={`relative transition-all duration-300 ease-out`}
                    >
                        {isDraggingThis && !searchTerm ? (
                          <div className="h-24 border-2 border-dashed border-indigo-500/50 rounded-xl bg-indigo-500/10 flex items-center justify-center animate-pulse">
                              <span className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"><ArrowDown size={14}/> SOLTAR AQUÍ <ArrowUp size={14}/></span>
                          </div>
                        ) : (
                          <div className={`flex items-center gap-3 p-3 bg-slate-900/60 rounded-2xl border transition-all ${!searchTerm ? 'cursor-move' : ''} group ${isEditing ? 'border-indigo-500 bg-indigo-500/10' : item.isPromo ? 'border-yellow-500/30 hover:border-yellow-500/60 bg-yellow-500/5' : 'border-white/5 opacity-90 hover:opacity-100 hover:border-white/10'}`}>
                              {!searchTerm && <div className="text-slate-600 group-hover:text-slate-400 transition-colors cursor-grab active:cursor-grabbing"><GripVertical size={20} /></div>}
                              <div className="w-20 md:w-28 aspect-video bg-black rounded-xl overflow-hidden flex-shrink-0 relative">
                                  <img src={`https://img.youtube.com/vi/${item.youtubeId}/mqdefault.jpg`} className="w-full h-full object-cover opacity-80" alt="miniatura" />
                                  {isExpired && <div className="absolute inset-0 bg-red-950/80 flex items-center justify-center"><span className="text-[8px] font-bold text-white bg-red-600 px-2 py-0.5 rounded uppercase">Fin</span></div>}
                                  {isScheduled && <div className="absolute inset-0 bg-indigo-950/80 flex items-center justify-center"><span className="text-[8px] font-bold text-white bg-indigo-600 px-2 py-0.5 rounded uppercase">Pronto</span></div>}
                                  
                                  {/* Badges */}
                                  {item.isPromo && <div className="absolute top-1 left-1 bg-yellow-500/90 text-black text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-sm uppercase"><Star size={8}/> Promo x{cloneCount}</div>}
                                  {!item.isPromo && isClone && <div className="absolute top-1 left-1 bg-blue-600/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-sm"><Layers size={8}/> x{cloneCount}</div>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className={`font-bold truncate text-xs md:text-sm leading-tight flex items-center gap-2 ${item.isPromo ? 'text-yellow-400' : 'text-white'}`}>{item.title}</h4>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                  {item.startDate && <span className="text-[8px] flex items-center gap-1 text-slate-400"><Calendar size={8} /> {item.startDate}</span>}
                                  {item.endDate && <span className="text-[8px] flex items-center gap-1 text-emerald-400"><Clock size={8} /> {item.endDate}</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {!item.isPromo && <button onClick={() => promptDuplicate(item)} className="p-2 rounded-lg transition-colors hover:bg-emerald-600/20 text-slate-400 hover:text-emerald-400" title="Clonar Video"><Copy size={14} /></button>}
                                <button onClick={() => startEditing(item)} className={`p-2 rounded-lg transition-colors ${isEditing ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-600/20 text-slate-400 hover:text-white'}`} title={item.isPromo ? "Editar Promoción (Escalar instancias)" : "Editar Video"}><Pencil size={14} /></button>
                                <button onClick={() => toggleVisibility(item)} className={`p-2 rounded-lg transition-colors ${item.visible ? 'hover:bg-slate-700 text-slate-400' : 'bg-red-500/10 text-red-500'}`}>{item.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                                <button onClick={() => promptDelete(item)} className="p-2 hover:bg-red-600/20 text-slate-500 hover:text-red-500 rounded-lg ml-1 transition-colors"><Trash2 size={14} /></button>
                              </div>
                          </div>
                        )}
                    </div>
                  );
                })}
                {playlist.length === 0 && <div className="p-12 text-center bg-slate-900/40 rounded-3xl border border-dashed border-white/10"><Youtube className="w-12 h-12 text-slate-700 mx-auto mb-4" /><p className="text-slate-500 text-sm">No hay videos en la lista.</p></div>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TVMode({ playlist, onExit }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showUI, setShowUI] = useState(false); 
  const [errorMsg, setErrorMsg] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [myDeviceId] = useState(getDeviceId());
  
  const deviceInfo = useMemo(() => getDeviceInfo(), []);
  
  const playerRef = useRef(null);
  const uiTimerRef = useRef(null);
  const callbacksRef = useRef({});

  const activePlaylist = useMemo(() => playlist.filter(v => {
    if (!v.visible) return false;
    const now = getTodayString();
    return (!v.startDate || v.startDate <= now) && (!v.endDate || v.expiresAt || v.endDate >= now);
  }), [playlist]);

  const currentVideo = activePlaylist[currentIdx];

  // 1. WAKE LOCK API
  useEffect(() => {
    let wakeLock = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
          wakeLock.addEventListener('release', () => console.log('Wake Lock released'));
        }
      } catch (err) { console.warn(err); }
    };
    requestWakeLock();
    const handleVisibility = () => { if (document.visibilityState === 'visible') requestWakeLock(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { if (wakeLock) wakeLock.release(); document.removeEventListener('visibilitychange', handleVisibility); };
  }, []);

  // 2. PHANTOM ACTIVITY
  useEffect(() => {
      const ghostInterval = setInterval(() => {
          window.dispatchEvent(new MouseEvent('mousemove'));
          const ghost = document.getElementById('ghost-pixel');
          if (ghost) ghost.style.opacity = ghost.style.opacity === '0' ? '0.01' : '0';
      }, 60000); 
      return () => clearInterval(ghostInterval);
  }, []);

  // 3. HEARTBEAT SYSTEM
  useEffect(() => {
    const currentTitle = currentVideo?.title || 'Esperando...';
    const sendHeartbeat = async () => {
        try {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'devices', myDeviceId), {
                lastSeen: new Date().toISOString(),
                currentVideo: currentTitle,
                deviceInfo: deviceInfo 
            }, { merge: true });
        } catch(e) {}
    };
    sendHeartbeat();
    const heartbeat = setInterval(sendHeartbeat, 30000);

    const unsub = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'devices', myDeviceId), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.command) {
                updateDoc(docSnap.ref, { command: null }).then(() => {
                    if (data.command === 'REFRESH') window.location.reload();
                    else if (data.command === 'FORCE_PLAY' && playerRef.current?.playVideo) playerRef.current.playVideo();
                });
            }
        }
    });
    return () => { clearInterval(heartbeat); unsub(); };
  }, [currentVideo, myDeviceId, deviceInfo]);

  const resetUITimer = useCallback(() => {
    setShowUI(true);
    if (uiTimerRef.current) clearTimeout(uiTimerRef.current);
    uiTimerRef.current = setTimeout(() => setShowUI(false), 3000);
  }, []);

  const handleNext = useCallback(() => {
    if (activePlaylist.length === 0) return;
    setCurrentIdx(prev => (prev + 1) % activePlaylist.length);
  }, [activePlaylist.length]);

  useEffect(() => {
    callbacksRef.current.onEnded = handleNext;
    callbacksRef.current.onError = () => {
        setErrorMsg("Señal inestable. Saltando...");
        setTimeout(handleNext, 2000);
    };
  }, [handleNext]);

  useEffect(() => {
    if (currentIdx >= activePlaylist.length && activePlaylist.length > 0) setCurrentIdx(0);
  }, [activePlaylist.length, currentIdx]);

  useEffect(() => {
      const interval = setInterval(() => {
          if (playerRef.current?.getPlayerState) {
              const state = playerRef.current.getPlayerState();
              if (state === 2 || state === 5) playerRef.current.playVideo();
          }
      }, 3000);
      return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!currentVideo) return;
    setErrorMsg(null);

    if (playerRef.current) {
        if (playerRef.current.loadVideoById) {
            playerRef.current.loadVideoById({ videoId: currentVideo.youtubeId, suggestedQuality: 'hd1080' });
        }
        return;
    }

    const initYT = () => {
        playerRef.current = new window.YT.Player('yt-player', {
            height: '100%', width: '100%', videoId: currentVideo.youtubeId,
            playerVars: { 
                'autoplay': 1, 'mute': 1, 'controls': 0, 'rel': 0, 'showinfo': 0, 'modestbranding': 1, 
                'vq': 'hd1080', 'origin': window.location.origin, 'playsinline': 1,
                'disablekb': 1, 'fs': 0
            },
            events: {
                'onReady': (e) => { 
                    e.target.playVideo(); 
                    setTimeout(() => { try { if(e.target.isMuted()) { e.target.unMute(); setIsMuted(false); } } catch(err) {} }, 1000); 
                },
                'onStateChange': (e) => { 
                    if (e.data === window.YT.PlayerState.PLAYING) { 
                        setIsPlaying(true); 
                        try { if(e.target.isMuted()) { e.target.unMute(); setIsMuted(false); } } catch(err) {} 
                    } 
                    if (e.data === window.YT.PlayerState.ENDED) callbacksRef.current.onEnded?.();
                    if (e.data === window.YT.PlayerState.PAUSED) e.target.playVideo();
                },
                'onError': () => callbacksRef.current.onError?.()
            }
        });
    };

    if (!window.YT) {
        const tag = document.createElement('script'); tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag); window.onYouTubeIframeAPIReady = initYT;
    } else { initYT(); }
  }, [currentVideo]);

  useEffect(() => {
    window.addEventListener('mousemove', resetUITimer);
    window.addEventListener('touchstart', resetUITimer);
    return () => { 
        window.removeEventListener('mousemove', resetUITimer); 
        window.removeEventListener('touchstart', resetUITimer);
        if (uiTimerRef.current) clearTimeout(uiTimerRef.current); 
    };
  }, [resetUITimer]);

  if (!currentVideo) return <div className="h-screen bg-black flex flex-col items-center justify-center text-white"><Tv size={64} className="text-slate-800 animate-pulse mb-4" /><p className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-40">Sin Señal Programada</p><button onClick={onExit} className="mt-8 px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold hover:bg-white/10 transition-all uppercase tracking-widest">Salir</button></div>;

  return (
    <div className={`fixed inset-0 w-screen h-screen bg-black overflow-hidden group ${showUI ? '' : 'cursor-none'}`}>
      <div id="ghost-pixel" className="absolute top-0 left-0 w-px h-px bg-white opacity-0 pointer-events-none z-[9999]"></div>
      
      <div id="yt-player" className="w-full h-full pointer-events-none scale-[1.01]"></div>
      {isMuted && isPlaying && <div className="absolute bottom-10 right-10 z-50 animate-bounce"><button onClick={() => {if(playerRef.current?.unMute){playerRef.current.unMute();setIsMuted(false);}}} className="bg-red-600 hover:bg-red-700 text-white p-5 rounded-full shadow-2xl transition-transform hover:scale-110"><VolumeX size={32} /></button><div className="text-center text-[8px] font-bold mt-2 text-white/40 uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">Activar Audio</div></div>}
      <div className={`absolute top-0 left-0 w-full z-30 transition-all duration-1000 pointer-events-none ${showUI ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="w-full p-8 bg-gradient-to-b from-black/90 to-transparent flex justify-between items-start">
          <div className="space-y-1">
            <h2 className={`text-3xl font-black drop-shadow-2xl tracking-tighter uppercase italic opacity-90 ${currentVideo.isPromo ? 'text-yellow-400' : 'text-white'}`}>{currentVideo.title}</h2>
            <div className="flex items-center gap-3">
               {currentVideo.isPromo ? <div className="bg-yellow-500 text-black px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase flex items-center gap-1"><Star size={10}/> Promo</div> : <div className="bg-red-600 px-2 py-0.5 rounded text-[8px] font-black text-white tracking-widest uppercase">YouTube</div>}
               <p className="text-white/40 font-mono text-[10px] flex items-center gap-2"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> SINTONIZADO • {activePlaylist.indexOf(currentVideo) + 1}/{activePlaylist.length}</p>
            </div>
          </div>
          <div className="flex gap-4">
             <div className="hidden sm:block bg-black/40 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10 text-[10px] text-white/50 font-mono pointer-events-auto mt-1">
                 ID: <span className="text-white select-all">{myDeviceId}</span>
             </div>
             <button onClick={() => window.location.reload()} className="pointer-events-auto p-3 bg-white/5 hover:bg-emerald-600/40 backdrop-blur-md rounded-2xl text-white/40 hover:text-white transition-all border border-white/5 hover:scale-110 active:scale-90 shadow-xl" title="Recargar Player"><RefreshCw size={20} /></button>
             <button onClick={onExit} className="pointer-events-auto p-3 bg-white/5 hover:bg-red-600/40 backdrop-blur-md rounded-2xl text-white/40 hover:text-white transition-all border border-white/5 hover:scale-110 active:scale-90 shadow-xl"><LogOut size={20} /></button>
          </div>
        </div>
      </div>
      {errorMsg && <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl"><AlertTriangle className="w-16 h-16 text-yellow-600 mb-4 animate-pulse" /><p className="text-2xl font-black uppercase italic text-white/80">{errorMsg}</p></div>}
    </div>
  );
}

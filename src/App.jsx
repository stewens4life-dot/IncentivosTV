import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Play, Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, Tv, Settings, LogOut, MonitorPlay, Lock, AlertTriangle, Film, List, Calendar, VolumeX, Clock, CheckCircle, Shield, Key, Pencil, X, Youtube, GripVertical, Copy, Info, Layers, Activity, Edit3, Wifi, WifiOff, ExternalLink } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, writeBatch } from 'firebase/firestore';

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

  // Navegación
  const navigateTo = (newView) => {
    try {
      let path = '/';
      if (newView === 'tv') path = '/live';
      if (newView === 'login' || newView === 'admin') path = '/dashboard';
      window.history.pushState({}, '', path);
    } catch (e) {}
    setView(newView);
  };

  // Auth Robusta
  useEffect(() => {
    if (!auth) {
        setInitError("Error de conexión.");
        return;
    }
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
           await signInWithCustomToken(auth, __initial_auth_token);
        } else {
           await signInAnonymously(auth);
        }
      } catch (e) {
        console.warn("Fallo auth, reintentando anónimo...", e);
        try { await signInAnonymously(auth); } catch (err) {}
      }
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
        }, (err) => {
             console.error("Error lectura playlist", err);
             if(err.code === 'permission-denied') signInAnonymously(auth).catch(()=>{});
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
      try {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'auth'), { password: pass }, { merge: true });
          return true;
      } catch (e) { return false; }
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
  const [newPass, setNewPass] = useState('');
  
  const [sortedPlaylist, setSortedPlaylist] = useState([]);
  const [dragItemIndex, setDragItemIndex] = useState(null); 
  
  const [notification, setNotification] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, actions: null });
  const playlistRef = collection(db, 'artifacts', appId, 'public', 'data', 'playlist');
  const showToast = (title, message, type = 'success') => setNotification({ title, message, type });

  useEffect(() => {
    if (dragItemIndex === null) setSortedPlaylist(playlist);
  }, [playlist, dragItemIndex]);

  const handleSave = async (e) => {
    e.preventDefault();
    const ytId = getYouTubeId(newUrl);
    if (!ytId) return showToast("URL Inválida", "Enlace de YouTube no válido.", "error");

    const isEditingClone = editingId && playlist.some(p => p.id !== editingId && p.youtubeId === ytId);
    if (!editingId) {
        const isDuplicateId = playlist.some(p => p.youtubeId === ytId);
        if (isDuplicateId) return showToast("Ya existe", "Este video ya está en lista. Usa el botón 'Clonar' para repetirlo.", "warning");
    }

    try {
      const payload = {
        youtubeId: ytId, title: newTitle || `Video de YouTube`,
        visible: editingId ? (playlist.find(p => p.id === editingId)?.visible ?? true) : true,
        startDate: (scheduleMode === 'now') ? getTodayString() : (startDate || getTodayString()),
        endDate: endDate || null
      };

      if (editingId) {
        const originalItem = playlist.find(p => p.id === editingId);
        const originalYtId = originalItem?.youtubeId;
        const batch = writeBatch(db);
        if (originalYtId === ytId) {
            const clones = playlist.filter(p => p.youtubeId === originalYtId);
            clones.forEach(clone => {
                 const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'playlist', clone.id);
                 batch.update(docRef, payload);
            });
            await batch.commit();
            showToast("Campaña Actualizada", `Se actualizaron ${clones.length} instancias del video.`);
        } else {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'playlist', editingId), payload);
            showToast("Video Actualizado", "Se modificó el video individualmente.");
        }
        resetForm();
      } else {
        payload.order = playlist.length; 
        payload.createdAt = new Date().toISOString(); 
        await addDoc(playlistRef, payload); 
        showToast("Creado", "Nuevo video añadido."); 
        resetForm(); 
      }
    } catch (err) { console.error(err); showToast("Error", "No se pudo guardar.", "error"); }
  };

  const promptDuplicate = (item) => {
      setConfirmDialog({ 
          isOpen: true, title: "Clonar Video", message: `Esto creará una nueva instancia de "${item.title}". Si editas o borras una, afectará a todas las copias.`, 
          onConfirm: () => handleDuplicate(item) 
      });
  };

  const handleDuplicate = async (item) => {
      try { await addDoc(playlistRef, { youtubeId: item.youtubeId, title: item.title, visible: item.visible, startDate: item.startDate, endDate: item.endDate, order: playlist.length, createdAt: new Date().toISOString() }); showToast("Clonado", "Se añadió una copia al final de la lista."); } 
      catch (e) { showToast("Error", "Error al clonar.", "error"); }
      setConfirmDialog({ ...confirmDialog, isOpen: false });
  };

  const startEditing = (item) => {
    setEditingId(item.id); setNewTitle(item.title); setNewUrl(`https://youtu.be/${item.youtubeId}`);
    setStartDate(item.startDate || ''); setEndDate(item.endDate || '');
    setScheduleMode(item.startDate && item.startDate > getTodayString() ? 'schedule' : 'now');
  };

  const resetForm = () => { setEditingId(null); setNewUrl(''); setNewTitle(''); setStartDate(''); setEndDate(''); setScheduleMode('now'); };
  const handleChangePass = async (e) => { e.preventDefault(); if (!newPass) return; if (await onUpdatePassword(newPass)) { showToast("Clave Actualizada", "Guardado."); setNewPass(''); } else showToast("Error", "Error al cambiar clave.", "error"); };
  
  const promptDelete = (item) => { 
      const clonesCount = playlist.filter(p => p.youtubeId === item.youtubeId).length;
      if (clonesCount > 1) {
          setConfirmDialog({ 
            isOpen: true, title: "Gestionar Eliminación", message: `Este video es parte de una campaña con ${clonesCount} copias. ¿Qué deseas hacer?`, 
            actions: [
                { label: "ELIMINAR SOLO ESTA COPIA", onClick: () => deleteSingleInstance(item.id), className: "bg-indigo-600 hover:bg-indigo-500 text-white" },
                { label: `ELIMINAR TODAS (${clonesCount})`, onClick: () => deleteCampaign(item), className: "bg-red-600 hover:bg-red-500 text-white" }
            ]
        });
      } else {
          setConfirmDialog({ isOpen: true, title: "Eliminar Video", message: "¿Estás seguro de que deseas eliminar este video permanentemente?", onConfirm: () => deleteSingleInstance(item.id) }); 
      }
  };

  const deleteSingleInstance = async (id) => { try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'playlist', id)); if(editingId === id) resetForm(); showToast("Instancia Eliminada", "Se ha borrado el video seleccionado."); } catch(e) { showToast("Error", "No se pudo eliminar el elemento.", "error"); } setConfirmDialog({ ...confirmDialog, isOpen: false }); };
  const deleteCampaign = async (item) => { try { const batch = writeBatch(db); const clones = playlist.filter(p => p.youtubeId === item.youtubeId); clones.forEach(clone => { const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'playlist', clone.id); batch.delete(docRef); }); await batch.commit(); if(editingId && clones.some(c => c.id === editingId)) resetForm(); showToast("Campaña Eliminada", `Se eliminaron ${clones.length} videos de la lista.`); } catch(e) { showToast("Error", "Error al borrar.", "error"); } setConfirmDialog({ ...confirmDialog, isOpen: false }); };
  const toggleVisibility = async (item) => { const batch = writeBatch(db); const clones = playlist.filter(p => p.youtubeId === item.youtubeId); const newStatus = !item.visible; clones.forEach(clone => { const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'playlist', clone.id); batch.update(docRef, { visible: newStatus }); }); await batch.commit(); };
  
  const onDragStart = (e, index) => { setDragItemIndex(index); e.dataTransfer.effectAllowed = "move"; };
  const onDragEnter = (e, index) => { if (dragItemIndex === null || dragItemIndex === index) return; const newList = [...sortedPlaylist]; const item = newList[dragItemIndex]; newList.splice(dragItemIndex, 1); newList.splice(index, 0, item); setDragItemIndex(index); setSortedPlaylist(newList); };
  const onDragEnd = async () => { const finalIndex = dragItemIndex; setDragItemIndex(null); if (finalIndex === null) return; const batch = writeBatch(db); sortedPlaylist.forEach((item, idx) => { const ref = doc(db, 'artifacts', appId, 'public', 'data', 'playlist', item.id); batch.update(ref, { order: idx }); }); try { await batch.commit(); } catch(e) { showToast("Error", "Error orden.", "error"); setSortedPlaylist(playlist); } };

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto overflow-hidden">
      <Toast notification={notification} onClose={() => setNotification(null)} />
      <ConfirmModal isOpen={confirmDialog.isOpen} title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} actions={confirmDialog.actions} />

      <header className="shrink-0 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/60 p-4 m-4 md:mx-8 rounded-3xl border border-white/5 backdrop-blur-md shadow-2xl z-40">
        <div className="flex items-center gap-4"><div className="p-3 bg-indigo-500/20 rounded-xl"><List className="text-indigo-400 w-6 h-6" /></div><div><h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Panel 4Life Colombia</h1><p className="text-slate-400 text-[10px] font-mono uppercase tracking-widest">Conexión: <span className="animate-pulse text-emerald-400 font-bold">Live</span></p></div></div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-800/50 p-1 rounded-xl border border-white/5"><button onClick={() => setTab('content')} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${tab === 'content' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>CONTENIDO</button><button onClick={() => setTab('settings')} className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${tab === 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>SEGURIDAD</button></div>
          <div className="w-px h-8 bg-white/10 mx-1 hidden md:block"></div>
          <button onClick={onGoToTV} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold text-white shadow-lg transition-all active:scale-95"><MonitorPlay size={16} /> LIVE</button>
          <button onClick={onLogout} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl border border-white/5 transition-colors"><LogOut size={18} /></button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden px-4 md:px-8 pb-4">
        {tab === 'settings' ? (
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
                  <div className="grid grid-cols-2 gap-3">{scheduleMode === 'schedule' && (<div className="space-y-1 col-span-2 sm:col-span-1"><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Inicio</label><div className="relative"><Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 pointer-events-none" size={14} /><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-2 py-2.5 text-[10px] focus:border-indigo-500 outline-none text-white scheme-dark" /></div></div>)}<div className={`space-y-1 ${scheduleMode === 'now' ? 'col-span-2' : 'col-span-2 sm:col-span-1'}`}><label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Fin (Opcional)</label><div className="relative"><Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14} /><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-2 py-2.5 text-[10px] focus:border-indigo-500 outline-none text-white scheme-dark" /></div></div></div>
                  <button disabled={!newUrl} type="submit" className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all mt-2 active:scale-95 ${editingId ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50'}`}>{editingId ? 'GUARDAR CAMBIOS' : 'AÑADIR A PLAYLIST'}</button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2 h-full overflow-y-auto pr-2 custom-scrollbar pb-20">
              <div className="flex justify-between items-center mb-2 px-2 sticky top-0 bg-slate-950/90 py-2 z-10 backdrop-blur"><h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Playlist Activa ({sortedPlaylist.length})</h3><span className="text-[8px] text-slate-600 italic">TIP: Arrastra para reordenar</span></div>
              <div className="space-y-4">
                {sortedPlaylist.map((item, index) => {
                  const isEditing = editingId === item.id;
                  const now = getTodayString();
                  const isScheduled = item.startDate && item.startDate > now;
                  const isExpired = item.endDate && item.endDate < now;
                  const isDraggingThis = dragItemIndex === index;
                  const cloneCount = sortedPlaylist.filter(p => p.youtubeId === item.youtubeId).length;
                  const isClone = cloneCount > 1;

                  return (
                    <div 
                      key={item.id} 
                      draggable
                      onDragStart={(e) => onDragStart(e, index)}
                      onDragEnter={(e) => onDragEnter(e, index)}
                      onDragEnd={onDragEnd}
                      onDragOver={(e) => e.preventDefault()}
                      className={`relative transition-all duration-300 ease-out`}
                    >
                        {isDraggingThis ? (
                          <div className="h-24 border-2 border-dashed border-indigo-500/50 rounded-xl bg-indigo-500/10 flex items-center justify-center animate-pulse">
                              <span className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2"><ArrowDown size={14}/> SOLTAR AQUÍ <ArrowUp size={14}/></span>
                          </div>
                        ) : (
                          <div className={`flex items-center gap-3 p-3 bg-slate-900/60 rounded-2xl border transition-all cursor-move group ${isEditing ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 opacity-90 hover:opacity-100 hover:border-white/10'}`}>
                              <div className="text-slate-600 group-hover:text-slate-400 transition-colors cursor-grab active:cursor-grabbing"><GripVertical size={20} /></div>
                              <div className="w-20 md:w-28 aspect-video bg-black rounded-xl overflow-hidden flex-shrink-0 relative">
                                  <img src={`https://img.youtube.com/vi/${item.youtubeId}/mqdefault.jpg`} className="w-full h-full object-cover opacity-80" alt="miniatura" />
                                  {isExpired && <div className="absolute inset-0 bg-red-950/80 flex items-center justify-center"><span className="text-[8px] font-bold text-white bg-red-600 px-2 py-0.5 rounded uppercase">Fin</span></div>}
                                  {isScheduled && <div className="absolute inset-0 bg-indigo-950/80 flex items-center justify-center"><span className="text-[8px] font-bold text-white bg-indigo-600 px-2 py-0.5 rounded uppercase">Pronto</span></div>}
                                  {isClone && <div className="absolute top-1 left-1 bg-blue-600/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-sm"><Layers size={8}/> x{cloneCount}</div>}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-white truncate text-xs md:text-sm leading-tight flex items-center gap-2">{item.title}</h4>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                  {item.startDate && <span className="text-[8px] flex items-center gap-1 text-slate-400"><Calendar size={8} /> {item.startDate}</span>}
                                  {item.endDate && <span className="text-[8px] flex items-center gap-1 text-emerald-400"><Clock size={8} /> {item.endDate}</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={() => promptDuplicate(item)} className="p-2 rounded-lg transition-colors hover:bg-emerald-600/20 text-slate-400 hover:text-emerald-400" title="Clonar Video"><Copy size={14} /></button>
                                <button onClick={() => startEditing(item)} className={`p-2 rounded-lg transition-colors ${isEditing ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-600/20 text-slate-400 hover:text-white'}`} title="Editar Campaña"><Pencil size={14} /></button>
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
  
  const playerRef = useRef(null);
  const uiTimerRef = useRef(null);
  const callbacksRef = useRef({});

  // Filtrar y memorizar la playlist activa
  const activePlaylist = useMemo(() => playlist.filter(v => {
    if (!v.visible) return false;
    const now = getTodayString();
    return (!v.startDate || v.startDate <= now) && (!v.endDate || v.expiresAt || v.endDate >= now);
  }), [playlist]);

  const currentVideo = activePlaylist[currentIdx];

  const resetUITimer = useCallback(() => {
    setShowUI(true);
    if (uiTimerRef.current) clearTimeout(uiTimerRef.current);
    uiTimerRef.current = setTimeout(() => setShowUI(false), 3000);
  }, []);

  const handleNext = useCallback(() => {
    if (activePlaylist.length === 0) return;
    setCurrentIdx(prev => (prev + 1) % activePlaylist.length);
  }, [activePlaylist.length]);

  // Actualizar refs de callbacks para que el listener de YT siempre tenga la última versión
  useEffect(() => {
    callbacksRef.current.onEnded = handleNext;
    callbacksRef.current.onError = () => {
        setErrorMsg("Señal inestable. Saltando...");
        setTimeout(handleNext, 2000);
    };
  }, [handleNext]);

  // Resetear índice si cambia la lista y nos quedamos fuera
  useEffect(() => {
    if (currentIdx >= activePlaylist.length && activePlaylist.length > 0) {
      setCurrentIdx(0);
    }
  }, [activePlaylist.length, currentIdx]);

  // Watchdog: Forzar play si se pausa
  useEffect(() => {
      const interval = setInterval(() => {
          if (playerRef.current?.getPlayerState) {
              const state = playerRef.current.getPlayerState();
              if (state === 2 || state === 5) {
                  console.log("Watchdog: Auto-resume");
                  playerRef.current.playVideo();
              }
          }
      }, 3000);
      return () => clearInterval(interval);
  }, []);

  // Inicialización ÚNICA del Player
  useEffect(() => {
    if (!currentVideo) return;
    setErrorMsg(null);

    // Si ya existe el player, solo cargamos el video
    if (playerRef.current) {
        if (playerRef.current.loadVideoById) {
            playerRef.current.loadVideoById({
                videoId: currentVideo.youtubeId,
                suggestedQuality: 'hd1080'
            });
        }
        return;
    }

    // Inicializar Player por primera vez
    const initYT = () => {
        playerRef.current = new window.YT.Player('yt-player', {
            height: '100%', width: '100%', videoId: currentVideo.youtubeId,
            playerVars: { 
                'autoplay': 1, 'mute': 1, 'controls': 0, 'rel': 0, 'showinfo': 0, 'modestbranding': 1, 
                'vq': 'hd1080', 'origin': window.location.origin, 'playsinline': 1 
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
                    if (e.data === window.YT.PlayerState.ENDED) {
                        callbacksRef.current.onEnded?.();
                    }
                    if (e.data === window.YT.PlayerState.PAUSED) {
                        e.target.playVideo(); // Auto-resume inmediato
                    }
                },
                'onError': () => callbacksRef.current.onError?.()
            }
        });
    };

    if (!window.YT) {
        const tag = document.createElement('script'); tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag); window.onYouTubeIframeAPIReady = initYT;
    } else { initYT(); }

  }, [currentVideo]); // Solo depende de currentVideo para cargar, no recrea player si existe

  // Listeners de UI
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
      <div id="yt-player" className="w-full h-full pointer-events-none scale-[1.01]"></div>
      {isMuted && isPlaying && <div className="absolute bottom-10 right-10 z-50 animate-bounce"><button onClick={() => {if(playerRef.current?.unMute){playerRef.current.unMute();setIsMuted(false);}}} className="bg-red-600 hover:bg-red-700 text-white p-5 rounded-full shadow-2xl transition-transform hover:scale-110"><VolumeX size={32} /></button><div className="text-center text-[8px] font-bold mt-2 text-white/40 uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">Activar Audio</div></div>}
      <div className={`absolute top-0 left-0 w-full z-30 transition-all duration-1000 pointer-events-none ${showUI ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="w-full p-8 bg-gradient-to-b from-black/90 to-transparent flex justify-between items-start">
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-white drop-shadow-2xl tracking-tighter uppercase italic opacity-90">{currentVideo.title}</h2>
            <div className="flex items-center gap-3"><div className="bg-red-600 px-2 py-0.5 rounded text-[8px] font-black text-white tracking-widest uppercase">YouTube</div><p className="text-white/40 font-mono text-[10px] flex items-center gap-2"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> SINTONIZADO • {activePlaylist.indexOf(currentVideo) + 1}/{activePlaylist.length}</p></div>
          </div>
          <button onClick={onExit} className="pointer-events-auto p-3 bg-white/5 hover:bg-red-600/40 backdrop-blur-md rounded-2xl text-white/40 hover:text-white transition-all border border-white/5 hover:scale-110 active:scale-90 shadow-xl"><LogOut size={20} /></button>
        </div>
      </div>
      {errorMsg && <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl"><AlertTriangle className="w-16 h-16 text-yellow-600 mb-4 animate-pulse" /><p className="text-2xl font-black uppercase italic text-white/80">{errorMsg}</p></div>}
    </div>
  );
}

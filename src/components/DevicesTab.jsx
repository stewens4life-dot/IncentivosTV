import { useState, useEffect } from 'react';
import { Activity, Wifi, WifiOff, Monitor, Film, Clock, RefreshCw, Edit3, Trash2, CheckCircle, ExternalLink, Play, SkipForward, MonitorPlay, MapPin } from 'lucide-react';
import { db, APP_ID } from '../lib/firebase';
import { doc, collection, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { isDeviceOnline, formatRelativeTime } from '../lib/utils';
import { useToast, Toast, ConfirmModal, StatCard } from './UI';

export default function DevicesTab() {
  const [devices, setDevices] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [labelInput, setLabelInput] = useState('');
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false });
  const { notification, showToast, clearToast } = useToast();

  useEffect(() => {
    if (!db) return;
    const ref = collection(db, 'artifacts', APP_ID, 'public', 'data', 'devices');
    return onSnapshot(ref, (snap) => {
      const devs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      devs.sort((a, b) => {
        const aOn = isDeviceOnline(a.lastSeen), bOn = isDeviceOnline(b.lastSeen);
        if (aOn !== bOn) return aOn ? -1 : 1;
        return (a.label || a.id).localeCompare(b.label || b.id);
      });
      setDevices(devs);
    });
  }, []);

  const saveLabel = async (id) => {
    try {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'devices', id), { label: labelInput.trim() });
      showToast('Guardado', 'Nombre de pantalla actualizado.');
      setEditingId(null);
    } catch { showToast('Error', 'No se pudo guardar.', 'error'); }
  };

  const sendCommand = async (devId, command, label) => {
    try {
      await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'devices', devId), {
        command,
        commandTime: Date.now(),
      });
      showToast('Comando Enviado', `"${label}" enviado a la pantalla.`);
    } catch { showToast('Error', 'No se pudo enviar el comando.', 'error'); }
  };

  const promptDelete = (dev) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Olvidar Dispositivo',
      message: `¿Eliminar "${dev.label || dev.id}" del registro? La próxima vez que se conecte, aparecerá de nuevo.`,
      onConfirm: () => deleteDevice(dev.id),
    });
  };

  const deleteDevice = async (id) => {
    try {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'devices', id));
      showToast('Eliminado', 'Dispositivo olvidado.');
    } catch { showToast('Error', 'No se pudo eliminar.', 'error'); }
    setConfirmDialog({ isOpen: false });
  };

  const onlineCount = devices.filter(d => isDeviceOnline(d.lastSeen)).length;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar pb-24">
      <Toast notification={notification} onClose={clearToast} />
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false })}
      />

      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={Monitor} label="Total Pantallas" value={devices.length} color="text-indigo-400" />
          <StatCard icon={Wifi} label="En Línea" value={onlineCount} color="text-emerald-400" />
          <StatCard icon={WifiOff} label="Offline" value={devices.length - onlineCount} color="text-slate-500" />
          <StatCard icon={Activity} label="Reproduciendo" value={devices.filter(d => d.currentVideo).length} color="text-purple-400" />
        </div>

        {/* Sin dispositivos */}
        {devices.length === 0 && (
          <div className="liquid-panel p-12 text-center rounded-3xl flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-5">
              <WifiOff className="w-8 h-8 text-white/30" />
            </div>
            <p className="text-white/60 text-sm font-medium mb-6">No hay pantallas conectadas a la red StudioOS.</p>
            <button onClick={() => window.open('/live', '_blank')} className="px-6 py-3 bg-white text-black hover:bg-white/90 rounded-xl font-bold shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center gap-2 transition-all active:scale-95 text-xs">
              <ExternalLink size={16} /> Iniciar Simulador TV
            </button>
          </div>
        )}

        {/* Grid de dispositivos */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {devices.map(dev => {
            const online = isDeviceOnline(dev.lastSeen);
            const isEditing = editingId === dev.id;

            return (
              <div key={dev.id} className={`liquid-card p-5 rounded-3xl relative overflow-hidden group ${online ? 'ring-1 ring-emerald-500/30 bg-emerald-950/10' : 'opacity-70 grayscale hover:grayscale-0'}`}>
                {/* Glow de fondo si está online */}
                {online && <div className="absolute -top-10 -right-10 w-28 h-28 bg-emerald-500/20 rounded-full blur-[30px] pointer-events-none" />}
                
                {/* Header */}
                <div className="flex justify-between items-start mb-4 relative z-10">
                  <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[8px] font-bold uppercase tracking-widest backdrop-blur-md border ${online ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-white/5 text-white/50 border-white/10'}`}>
                    {online ? <Wifi size={10} className="animate-pulse" /> : <WifiOff size={10} />}
                    {online ? 'Online' : 'Offline'}
                  </span>
                  <button onClick={() => promptDelete(dev)} className="w-7 h-7 rounded-full bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-white/50 hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Info Principal */}
                <div className="mb-4 relative z-10">
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        className="flex-1 liquid-input rounded-lg px-3 py-1.5 text-xs text-white"
                        value={labelInput}
                        onChange={e => setLabelInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveLabel(dev.id); if (e.key === 'Escape') setEditingId(null); }}
                        placeholder="Nombre de pantalla"
                      />
                      <button onClick={() => saveLabel(dev.id)} className="bg-white text-black px-2.5 rounded-lg hover:bg-white/90 transition-colors">
                        <CheckCircle size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between group/title">
                      <h3 className="font-bold text-white text-base truncate flex-1">{dev.label || 'Studio Display'}</h3>
                      <button
                        onClick={() => { setEditingId(dev.id); setLabelInput(dev.label || ''); }}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white/30 group-hover/title:text-indigo-400 group-hover/title:bg-indigo-500/10 transition-colors"
                      >
                        <Edit3 size={12} />
                      </button>
                    </div>
                  )}
                  <p className="text-white/40 text-[9px] font-mono mt-1 tracking-wide">{dev.deviceInfo || 'Dispositivo desconocido'}</p>
                </div>

                {/* Metadata de reproducción */}
                <div className="bg-black/30 rounded-xl p-3 mb-4 border border-white/5 relative z-10">
                  <div className="flex items-start gap-2 text-[11px] text-white/70 mb-2">
                    <div className="p-1 bg-indigo-500/20 rounded-md shrink-0">
                      <Film size={12} className="text-indigo-400" />
                    </div>
                    <span className="truncate leading-tight font-medium mt-0.5">{dev.currentVideo || 'Standby'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-white/40 font-medium px-1">
                    <span className="flex items-center gap-1"><Clock size={10} /> {formatRelativeTime(dev.lastSeen)}</span>
                    {dev.playlistLength && <span>{dev.currentIndex + 1} / {dev.playlistLength}</span>}
                  </div>
                  {dev.location && (
                    <div className="flex items-center gap-1.5 text-[9px] text-indigo-300/70 font-medium px-1 mt-1.5 bg-indigo-950/20 py-1 rounded-md border border-indigo-500/10">
                      <MapPin size={10} className="text-indigo-400" />
                      <span className="truncate">{dev.location}</span>
                    </div>
                  )}
                </div>

                {/* Comandos - Estilo Compacto */}
                <div className="flex gap-2 relative z-10 pt-2 mt-1 border-t border-white/5">
                  <button onClick={() => sendCommand(dev.id, 'FORCE_PLAY', 'Forzar Play')} className="flex-1 py-2.5 liquid-button hover:bg-emerald-500/20 hover:border-emerald-500/30 hover:text-emerald-400 rounded-lg flex items-center justify-center gap-1.5 text-[10px] font-bold text-white/60 transition-all active:scale-95 group/btn" title="Forzar Play">
                    <Play size={14} className="group-hover/btn:scale-110 transition-transform" /> <span className="hidden xl:inline">Play</span>
                  </button>
                  <button onClick={() => sendCommand(dev.id, 'NEXT', 'Siguiente Video')} className="flex-1 py-2.5 liquid-button hover:bg-indigo-500/20 hover:border-indigo-500/30 hover:text-indigo-400 rounded-lg flex items-center justify-center gap-1.5 text-[10px] font-bold text-white/60 transition-all active:scale-95 group/btn" title="Siguiente">
                    <SkipForward size={14} className="group-hover/btn:scale-110 transition-transform" /> <span className="hidden xl:inline">Next</span>
                  </button>
                  <button onClick={() => sendCommand(dev.id, 'REFRESH', 'Recargar')} className="flex-1 py-2.5 liquid-button hover:bg-white/20 hover:border-white/30 hover:text-white rounded-lg flex items-center justify-center gap-1.5 text-[10px] font-bold text-white/60 transition-all active:scale-95 group/btn" title="Recargar">
                    <RefreshCw size={14} className="group-hover/btn:scale-110 transition-transform" /> <span className="hidden xl:inline">Reload</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

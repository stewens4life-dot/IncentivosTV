import { useState, useEffect } from 'react';
import { Plus, Search, X, Star, Calendar, Clock, GripVertical, Pencil, Copy, Eye, EyeOff, Trash2, Layers, ArrowDown, ArrowUp, Youtube } from 'lucide-react';
import { db, APP_ID } from '../lib/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { getYouTubeId, getTodayString, getDistributedPlaylist } from '../lib/utils';
import { useToast, Toast, ConfirmModal } from './UI';

export default function ContentTab({ playlist }) {
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [scheduleMode, setScheduleMode] = useState('now');
  const [isPromo, setIsPromo] = useState(false);
  const [promoInstances, setPromoInstances] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortedPlaylist, setSortedPlaylist] = useState([]);
  const [dragItemIndex, setDragItemIndex] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false });
  const { notification, showToast, clearToast } = useToast();

  useEffect(() => { if (dragItemIndex === null) setSortedPlaylist(playlist); }, [playlist, dragItemIndex]);

  const ytIdCurrent = getYouTubeId(newUrl);
  const currentR = playlist.filter(p => !p.isPromo && p.youtubeId !== ytIdCurrent).length;
  const currentOtherPromos = playlist.filter(p => p.isPromo && p.youtubeId !== ytIdCurrent).length;
  const maxAllowedPromos = Math.max(0, currentR - currentOtherPromos);

  const resetForm = () => {
    setEditingId(null); setNewUrl(''); setNewTitle('');
    setStartDate(''); setEndDate(''); setScheduleMode('now');
    setIsPromo(false); setPromoInstances(1);
  };

  const startEditing = (item) => {
    setEditingId(item.id);
    setNewTitle(item.title);
    setNewUrl(`https://youtu.be/${item.youtubeId}`);
    setStartDate(item.startDate || '');
    setEndDate(item.endDate || '');
    setScheduleMode(item.startDate && item.startDate > getTodayString() ? 'schedule' : 'now');
    setIsPromo(!!item.isPromo);
    setPromoInstances(item.isPromo ? playlist.filter(p => p.youtubeId === item.youtubeId).length : 1);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const ytId = getYouTubeId(newUrl);
    if (!ytId) return showToast('URL Inválida', 'Ingresa un enlace válido de YouTube.', 'error');

    const targetInstances = isPromo ? Math.max(1, parseInt(promoInstances, 10)) : 1;
    if (isPromo && targetInstances > maxAllowedPromos && maxAllowedPromos > 0 && targetInstances > playlist.filter(p => p.youtubeId === ytId).length)
      return showToast('Límite Excedido', `Máximo ${maxAllowedPromos} instancias permitidas.`, 'warning');

    if (!editingId && !isPromo && playlist.some(p => p.youtubeId === ytId && !p.isPromo))
      return showToast('Ya existe', 'Este video ya está en la lista.', 'warning');

    try {
      const batch = writeBatch(db);
      let draft = [...playlist];

      if (editingId) {
        const original = playlist.find(p => p.id === editingId);
        draft = draft.filter(p => p.youtubeId !== original.youtubeId);
        const oldClones = playlist.filter(p => p.youtubeId === original.youtubeId);
        for (let i = 0; i < targetInstances; i++) {
          const existing = oldClones[i];
          draft.push({
            id: existing?.id || null, _isNew: !existing,
            youtubeId: ytId, title: newTitle || 'Video de YouTube',
            visible: original.visible ?? true,
            startDate: scheduleMode === 'now' ? getTodayString() : (startDate || getTodayString()),
            endDate: endDate || null, isPromo,
            createdAt: existing?.createdAt || new Date().toISOString(),
          });
        }
        oldClones.slice(targetInstances).forEach(c => batch.delete(doc(db, 'artifacts', APP_ID, 'public', 'data', 'playlist', c.id)));
      } else {
        for (let i = 0; i < targetInstances; i++) {
          draft.push({
            id: null, _isNew: true, youtubeId: ytId,
            title: newTitle || 'Video de YouTube', visible: true,
            startDate: scheduleMode === 'now' ? getTodayString() : (startDate || getTodayString()),
            endDate: endDate || null, isPromo, createdAt: new Date().toISOString(),
          });
        }
      }

      const final = isPromo ? getDistributedPlaylist(draft) : draft.sort((a, b) => (a.order || 0) - (b.order || 0));
      final.forEach((item, idx) => {
        const payload = { youtubeId: item.youtubeId, title: item.title, visible: item.visible, startDate: item.startDate, endDate: item.endDate, isPromo: !!item.isPromo, order: idx, createdAt: item.createdAt };
        if (item._isNew) batch.set(doc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'playlist')), payload);
        else batch.update(doc(db, 'artifacts', APP_ID, 'public', 'data', 'playlist', item.id), payload);
      });

      await batch.commit();
      showToast('Guardado', isPromo ? 'Promo guardada y lista auto-organizada.' : 'Video añadido correctamente.');
      resetForm();
    } catch (err) { showToast('Error', 'No se pudo guardar.', 'error'); }
  };

  const runAutoDistribute = async () => {
    try {
      const snap = await getDocs(collection(db, 'artifacts', APP_ID, 'public', 'data', 'playlist'));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const distributed = getDistributedPlaylist(list);
      const batch = writeBatch(db);
      distributed.forEach((item, idx) => batch.update(doc(db, 'artifacts', APP_ID, 'public', 'data', 'playlist', item.id), { order: idx }));
      await batch.commit();
      showToast('Re-distribuido', 'Promociones distribuidas uniformemente.');
    } catch { showToast('Error', 'No se pudo re-distribuir.', 'error'); }
  };

  const toggleVisibility = async (item) => {
    const clones = playlist.filter(p => p.youtubeId === item.youtubeId);
    const batch = writeBatch(db);
    clones.forEach(c => batch.update(doc(db, 'artifacts', APP_ID, 'public', 'data', 'playlist', c.id), { visible: !item.visible }));
    await batch.commit();
  };

  const promptDelete = (item) => {
    const count = playlist.filter(p => p.youtubeId === item.youtubeId).length;
    if (count > 1) {
      setConfirmDialog({
        isOpen: true, title: 'Gestionar Eliminación',
        message: `"${item.title}" tiene ${count} instancias. ¿Qué eliminar?`,
        actions: [
          { label: 'SOLO ESTA INSTANCIA', onClick: () => deleteSingle(item.id), className: 'bg-white/10 hover:bg-white/20 text-white' },
          { label: `TODAS LAS ${count} INSTANCIAS`, onClick: () => deleteCampaign(item), className: 'bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/30' },
        ],
      });
    } else {
      setConfirmDialog({ isOpen: true, title: 'Eliminar Video', message: `¿Eliminar "${item.title}"?`, onConfirm: () => deleteSingle(item.id) });
    }
  };

  const deleteSingle = async (id) => {
    await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'playlist', id));
    if (editingId === id) resetForm();
    showToast('Eliminado', 'Video borrado.');
    setConfirmDialog({ isOpen: false });
  };

  const deleteCampaign = async (item) => {
    const clones = playlist.filter(p => p.youtubeId === item.youtubeId);
    const batch = writeBatch(db);
    clones.forEach(c => batch.delete(doc(db, 'artifacts', APP_ID, 'public', 'data', 'playlist', c.id)));
    await batch.commit();
    if (clones.some(c => c.id === editingId)) resetForm();
    showToast('Eliminado', `${clones.length} instancias eliminadas.`);
    setConfirmDialog({ isOpen: false });
  };

  const handleDuplicate = async (item) => {
    await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'playlist'), {
      youtubeId: item.youtubeId, title: item.title, visible: item.visible,
      startDate: item.startDate, endDate: item.endDate,
      isPromo: !!item.isPromo, order: playlist.length, createdAt: new Date().toISOString(),
    });
    showToast('Clonado', 'Copia añadida al final.');
    setConfirmDialog({ isOpen: false });
  };

  const onDragStart = (e, idx) => { setDragItemIndex(idx); e.dataTransfer.effectAllowed = 'move'; };
  const onDragEnter = (e, idx) => {
    if (dragItemIndex === null || dragItemIndex === idx) return;
    const list = [...sortedPlaylist];
    const [item] = list.splice(dragItemIndex, 1);
    list.splice(idx, 0, item);
    setDragItemIndex(idx);
    setSortedPlaylist(list);
  };
  const onDragEnd = async () => {
    const idx = dragItemIndex;
    setDragItemIndex(null);
    if (idx === null) return;
    const batch = writeBatch(db);
    sortedPlaylist.forEach((item, i) => batch.update(doc(db, 'artifacts', APP_ID, 'public', 'data', 'playlist', item.id), { order: i }));
    try { await batch.commit(); } catch { setSortedPlaylist(playlist); }
  };

  const now = getTodayString();
  const filtered = sortedPlaylist.filter(i => i.title?.toLowerCase().includes(searchTerm.toLowerCase()) || i.youtubeId?.includes(searchTerm));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      <Toast notification={notification} onClose={clearToast} />
      <ConfirmModal isOpen={confirmDialog.isOpen} title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog({ isOpen: false })} actions={confirmDialog.actions} />

      {/* Formulario */}
      <div className="lg:col-span-1 h-full overflow-y-auto custom-scrollbar pr-2 pb-8">
        <div className={`liquid-panel rounded-3xl p-6 transition-all duration-300 ${editingId ? 'ring-1 ring-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.2)]' : ''}`}>
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <div className="p-1.5 bg-white/5 rounded-lg border border-white/10">
                {editingId ? <Pencil size={16} className="text-indigo-400" /> : <Plus size={16} className="text-indigo-400" />}
              </div>
              {editingId ? 'Editar Item' : 'Añadir Video'}
            </h3>
            {editingId && <button onClick={resetForm} className="text-white/40 hover:text-white text-xs flex items-center gap-1 liquid-button px-2 py-1 rounded-lg transition-colors"><X size={12} /> Cancelar</button>}
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex p-1 bg-black/40 rounded-xl border border-white/5 backdrop-blur-md">
              {['now', 'schedule'].map(m => (
                <button key={m} type="button" onClick={() => setScheduleMode(m)} className={`flex-1 py-2 text-[10px] font-bold rounded-lg transition-all duration-300 ${scheduleMode === m ? 'bg-white/15 text-white shadow-sm' : 'text-white/40 hover:text-white/80'}`}>
                  {m === 'now' ? 'Inmediato' : 'Programado'}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Título</label>
              <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ej: Nueva Colección 2026" className="w-full liquid-input rounded-xl px-4 py-3 text-sm text-white placeholder-white/20" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">URL YouTube</label>
              <input type="text" value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://youtu.be/..." className="w-full liquid-input rounded-xl px-4 py-3 text-sm text-white placeholder-white/20" />
              {ytIdCurrent && (
                <div className="mt-2 relative rounded-xl overflow-hidden border border-white/10 aspect-video group">
                  <img src={`https://img.youtube.com/vi/${ytIdCurrent}/maxresdefault.jpg`} onError={(e) => e.target.src = `https://img.youtube.com/vi/${ytIdCurrent}/mqdefault.jpg`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="preview" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                </div>
              )}
            </div>

            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl liquid-button transition-all group">
              <input type="checkbox" checked={isPromo} onChange={e => setIsPromo(e.target.checked)} className="w-3.5 h-3.5 accent-amber-500 rounded bg-white/10 border-white/20" />
              <span className="text-xs font-bold text-white/80 flex items-center gap-1.5 group-hover:text-amber-400 transition-colors">
                <Star size={14} className={isPromo ? 'text-amber-500 fill-amber-500' : 'text-white/40'} /> 
                Campaña Promocional
              </span>
            </label>

            {isPromo && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 backdrop-blur-md animate-in slide-in-from-right-4 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Frecuencia</label>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-1 rounded-lg font-mono">Máx: {maxAllowedPromos}</span>
                </div>
                <input type="number" min="1" max={Math.max(1, maxAllowedPromos)} value={promoInstances} onChange={e => setPromoInstances(e.target.value)} disabled={maxAllowedPromos < 1} className="w-full bg-black/40 border border-amber-500/30 focus:border-amber-500 rounded-xl px-5 py-3 text-sm outline-none text-white transition-colors disabled:opacity-40" />
                {maxAllowedPromos < 1 && <p className="text-[10px] text-amber-400/80 leading-relaxed font-medium">Añade videos regulares a la lista para intercalar promociones.</p>}
              </div>
            )}

            {scheduleMode === 'schedule' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Inicio</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full liquid-input rounded-xl px-4 py-3 text-sm text-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Fin</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full liquid-input rounded-xl px-4 py-3 text-sm text-white" />
                </div>
              </div>
            )}
            {scheduleMode === 'now' && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest pl-1">Vencimiento (Opcional)</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full liquid-input rounded-xl px-4 py-3 text-sm text-white" />
              </div>
            )}

            <button type="submit" disabled={!newUrl || (isPromo && maxAllowedPromos < 1)} className="w-full py-3 bg-white text-black hover:bg-white/90 disabled:opacity-30 disabled:bg-white/10 disabled:text-white rounded-xl font-bold transition-all active:scale-95 text-xs shadow-[0_0_20px_rgba(255,255,255,0.15)] mt-4">
              {editingId ? 'Guardar Cambios' : 'Añadir a Programación'}
            </button>
          </form>
        </div>
      </div>

      {/* Lista */}
      <div className="lg:col-span-2 h-full overflow-y-auto custom-scrollbar pr-2 pb-20">
        <div className="sticky top-0 z-20 pb-3 pt-1 bg-gradient-to-b from-black via-black/80 to-transparent">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              Playlist Activa
              <span className="bg-white/10 border border-white/10 px-2 py-0.5 rounded-lg text-[10px] font-mono">{sortedPlaylist.length}</span>
            </h3>
            <button onClick={runAutoDistribute} className="liquid-button text-amber-400 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all active:scale-95 shadow-[0_0_15px_rgba(245,158,11,0.1)]">
              <Star size={12} /> Distribuir IA
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <input type="text" placeholder="Buscar por título o ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full liquid-input rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-white/30" />
            {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors"><X size={14} /></button>}
          </div>
        </div>

        <div className="space-y-3 mt-2">
          {filtered.map((item) => {
            const realIdx = sortedPlaylist.findIndex(p => p.id === item.id);
            const isEditing = editingId === item.id;
            const isScheduled = item.startDate && item.startDate > now;
            const isExpired = item.endDate && item.endDate < now;
            const isDragging = dragItemIndex === realIdx;
            const cloneCount = sortedPlaylist.filter(p => p.youtubeId === item.youtubeId).length;

            return (
              <div key={item.id} draggable={!searchTerm} onDragStart={e => !searchTerm && onDragStart(e, realIdx)} onDragEnter={e => !searchTerm && onDragEnter(e, realIdx)} onDragEnd={onDragEnd} onDragOver={e => e.preventDefault()}>
                {isDragging && !searchTerm ? (
                  <div className="h-20 border-2 border-dashed border-white/20 rounded-2xl bg-white/5 flex items-center justify-center">
                    <span className="text-white/40 text-[9px] font-bold tracking-widest uppercase flex items-center gap-1.5"><ArrowDown size={12} /> Reordenar <ArrowUp size={12} /></span>
                  </div>
                ) : (
                  <div className={`liquid-card flex items-center gap-3 p-2.5 rounded-2xl group ${!searchTerm ? 'cursor-move' : ''} ${isEditing ? 'ring-1 ring-indigo-500/50 bg-white/10' : ''} ${isExpired ? 'opacity-40 grayscale' : ''}`}>
                    {!searchTerm && <div className="text-white/20 group-hover:text-white/60 transition-colors shrink-0 pl-1"><GripVertical size={16} /></div>}

                    <div className="w-24 aspect-video bg-black/50 rounded-lg overflow-hidden shrink-0 relative border border-white/10">
                      <img src={`https://img.youtube.com/vi/${item.youtubeId}/mqdefault.jpg`} className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-700" alt="" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      {isExpired && <div className="absolute inset-0 bg-red-950/80 flex items-center justify-center backdrop-blur-sm"><span className="text-[8px] font-bold text-white uppercase tracking-widest">Expirado</span></div>}
                      {isScheduled && <div className="absolute inset-0 bg-indigo-950/80 flex items-center justify-center backdrop-blur-sm"><span className="text-[8px] font-bold text-white uppercase tracking-widest">Programado</span></div>}
                      
                      {item.isPromo && <div className="absolute top-1.5 left-1.5 bg-amber-500/90 backdrop-blur-md text-black text-[8px] font-black px-1 py-0.5 rounded flex items-center gap-0.5 shadow-lg"><Star size={8} /> x{cloneCount}</div>}
                      {!item.isPromo && cloneCount > 1 && <div className="absolute top-1.5 left-1.5 bg-indigo-500/90 backdrop-blur-md text-white text-[8px] font-bold px-1 py-0.5 rounded flex items-center gap-0.5 shadow-lg"><Layers size={8} /> x{cloneCount}</div>}
                    </div>

                    <div className="flex-1 min-w-0 py-0.5">
                      <h4 className={`font-semibold text-xs truncate mb-1 ${item.isPromo ? 'text-amber-400' : 'text-white'}`}>{item.title}</h4>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {item.startDate && <span className="text-[9px] text-white/40 flex items-center gap-1 font-medium"><Calendar size={10} /> {item.startDate}</span>}
                        {item.endDate && <span className="text-[9px] text-white/40 flex items-center gap-1 font-medium"><Clock size={10} /> {item.endDate}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 pr-1">
                      {!item.isPromo && <button onClick={() => { setConfirmDialog({ isOpen: true, title: 'Clonar Video', message: `¿Crear una copia de "${item.title}"?`, onConfirm: () => handleDuplicate(item) }); }} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/50 hover:text-white transition-all"><Copy size={14} /></button>}
                      <button onClick={() => startEditing(item)} className={`p-1.5 rounded-lg transition-all ${isEditing ? 'bg-indigo-500 text-white' : 'bg-white/5 hover:bg-white/15 text-white/50 hover:text-white'}`}><Pencil size={14} /></button>
                      <button onClick={() => toggleVisibility(item)} className={`p-1.5 rounded-lg transition-all ${item.visible ? 'bg-white/5 hover:bg-white/15 text-white/50 hover:text-white' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}>{item.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                      <button onClick={() => promptDelete(item)} className="p-1.5 rounded-lg bg-white/0 hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all"><Trash2 size={14} /></button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {playlist.length === 0 && (
            <div className="liquid-panel p-16 text-center rounded-[2rem] flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
                <Youtube className="w-8 h-8 text-white/30" />
              </div>
              <p className="text-white/50 text-sm font-medium">La programación está vacía.</p>
            </div>
          )}
          {playlist.length > 0 && filtered.length === 0 && (
            <div className="p-12 text-center"><p className="text-white/40 text-sm font-medium">Sin resultados para "{searchTerm}"</p></div>
          )}
        </div>
      </div>
    </div>
  );
}

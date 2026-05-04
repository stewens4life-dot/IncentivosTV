import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Tv, RefreshCw, LogOut, AlertTriangle, Star, SkipForward, Wifi } from 'lucide-react';
import { db, APP_ID } from '../lib/firebase';
import { doc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getDeviceId, getDeviceInfo, getActivePlaylist, formatTime, formatDate, getDeviceLocation } from '../lib/utils';

export default function TVMode({ playlist, onExit }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showUI, setShowUI] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [clock, setClock] = useState({ time: formatTime(), date: formatDate() });
  const [isConnected, setIsConnected] = useState(true);
  const [location, setLocation] = useState('Obteniendo ubicación...');

  const [myDeviceId] = useState(getDeviceId);
  const deviceInfo = useMemo(() => getDeviceInfo(), []);
  const playerRef = useRef(null);
  const uiTimerRef = useRef(null);
  const callbacksRef = useRef({});
  const errorCountRef = useRef(0);

  const activePlaylist = useMemo(() => getActivePlaylist(playlist), [playlist]);
  const currentVideo = activePlaylist[currentIdx % Math.max(activePlaylist.length, 1)];

  // 1. Obtener Geolocalización al iniciar
  useEffect(() => {
    getDeviceLocation().then(loc => {
      if (loc) setLocation(loc);
    });
  }, []);

  // 2. Reloj en tiempo real
  useEffect(() => {
    const tick = setInterval(() => {
      setClock({ time: formatTime(), date: formatDate() });
    }, 10000);
    return () => clearInterval(tick);
  }, []);

  // 3. Wake Lock — evita que el TV se apague
  useEffect(() => {
    let wakeLock = null;
    const request = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch {}
    };
    request();
    const onVisible = () => { if (document.visibilityState === 'visible') request(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { wakeLock?.release(); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  // 4. Phantom activity — previene screensaver moviendo el mouse y opacidad
  useEffect(() => {
    const ghost = () => {
      window.dispatchEvent(new MouseEvent('mousemove'));
      const el = document.getElementById('ghost-pixel');
      if (el) el.style.opacity = el.style.opacity === '0' ? '0.01' : '0';
    };
    const id = setInterval(ghost, 55000);
    return () => clearInterval(id);
  }, []);

  // 5. Heartbeat + Comandos remotos
  useEffect(() => {
    if (!db) return;
    const title = currentVideo?.title || 'Standby';
    const deviceRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'devices', myDeviceId);

    const sendHeartbeat = () => {
      setDoc(deviceRef, {
        lastSeen: new Date().toISOString(),
        currentVideo: title,
        currentVideoId: currentVideo?.youtubeId || null,
        deviceInfo,
        location,
        playlistLength: activePlaylist.length,
        currentIndex: currentIdx,
      }, { merge: true }).then(() => setIsConnected(true)).catch(() => setIsConnected(false));
    };

    sendHeartbeat();
    const hbId = setInterval(sendHeartbeat, 28000);

    const unsub = onSnapshot(deviceRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (data.command && data.commandTime) {
        const age = Date.now() - data.commandTime;
        if (age < 30000) { 
          updateDoc(snap.ref, { command: null, commandTime: null });
          if (data.command === 'REFRESH') window.location.reload();
          else if (data.command === 'FORCE_PLAY') playerRef.current?.playVideo?.();
          else if (data.command === 'NEXT') callbacksRef.current.handleNext?.();
        }
      }
    });

    return () => { clearInterval(hbId); unsub(); };
  }, [currentVideo, myDeviceId, deviceInfo, currentIdx, activePlaylist.length, location]);

  // 6. Auto-recuperación
  useEffect(() => {
    const id = setInterval(() => {
      try {
        const state = playerRef.current?.getPlayerState?.();
        if (state === 2 || state === 5) playerRef.current.playVideo();
      } catch {}
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const handleNext = useCallback(() => {
    if (activePlaylist.length === 0) return;
    errorCountRef.current = 0;
    setErrorMsg(null);
    setCurrentIdx(p => (p + 1) % activePlaylist.length);
  }, [activePlaylist.length]);

  useEffect(() => { callbacksRef.current.handleNext = handleNext; }, [handleNext]);

  useEffect(() => {
    if (activePlaylist.length > 0 && currentIdx >= activePlaylist.length) setCurrentIdx(0);
  }, [activePlaylist.length, currentIdx]);

  // 7. Auto-Recarga Diaria a las 3:00 AM (Limpieza profunda de RAM para 24/7)
  useEffect(() => {
    const now = new Date();
    const target = new Date();
    target.setHours(3, 0, 0, 0);
    // Si ya pasaron las 3 AM hoy, programar para mañana a las 3 AM
    if (now.getTime() > target.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    const timeUntil3AM = target.getTime() - now.getTime();
    
    const timeoutId = setTimeout(() => {
      window.location.reload(true); // Recarga fuerte (ignora caché parcial)
    }, timeUntil3AM);
    
    return () => clearTimeout(timeoutId);
  }, []);

  // 8. Inicializar YouTube
  useEffect(() => {
    if (!currentVideo) return;
    setErrorMsg(null);

    if (playerRef.current?.loadVideoById) {
      playerRef.current.loadVideoById({ videoId: currentVideo.youtubeId, suggestedQuality: 'hd1080' });
      return;
    }

    const init = () => {
      playerRef.current = new window.YT.Player('yt-player', {
        height: '100%', width: '100%',
        videoId: currentVideo.youtubeId,
        playerVars: {
          autoplay: 1, mute: 0, controls: 0, rel: 0, showinfo: 0,
          modestbranding: 1, vq: 'hd1080', playsinline: 1,
          origin: window.location.origin, disablekb: 1, fs: 0,
        },
        events: {
          onReady: (e) => { 
            e.target.playVideo(); 
            setTimeout(() => { try { e.target.unMute(); } catch {} }, 500);
          },
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.PLAYING) {
              try { e.target.unMute(); } catch {}
            }
            if (e.data === window.YT.PlayerState.ENDED) callbacksRef.current.handleNext?.();
            if (e.data === window.YT.PlayerState.PAUSED) e.target.playVideo();
          },
          onError: () => {
            errorCountRef.current += 1;
            if (errorCountRef.current >= 3) { errorCountRef.current = 0; setErrorMsg('Video no disponible. Saltando...'); }
            setTimeout(() => callbacksRef.current.handleNext?.(), 2500);
          },
        },
      });
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = init;
    } else { init(); }
  }, [currentVideo]);

  // Mostrar/ocultar UI con mouse o touch
  const resetUITimer = useCallback(() => {
    setShowUI(true);
    clearTimeout(uiTimerRef.current);
    uiTimerRef.current = setTimeout(() => setShowUI(false), 5000);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', resetUITimer);
    window.addEventListener('touchstart', resetUITimer);
    return () => {
      window.removeEventListener('mousemove', resetUITimer);
      window.removeEventListener('touchstart', resetUITimer);
      clearTimeout(uiTimerRef.current);
    };
  }, [resetUITimer]);

  if (!currentVideo && activePlaylist.length === 0) {
    return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 to-transparent pointer-events-none" />
        <Tv size={100} className="text-white/10 mb-8 animate-pulse" strokeWidth={1} />
        <p className="font-mono text-xs uppercase tracking-[0.4em] text-white/40 font-bold">Studio Broadcast</p>
        <p className="text-white/20 text-[10px] uppercase tracking-widest mt-2">Standby Mode</p>
        <button onClick={onExit} className="mt-12 px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-bold transition-all uppercase tracking-widest backdrop-blur-md">
          Exit Display
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 w-screen h-screen bg-black overflow-hidden ${showUI ? '' : 'cursor-none'}`}>
      <div id="ghost-pixel" className="absolute top-0 left-0 w-px h-px opacity-0 pointer-events-none z-[9999]" />

      <div id="yt-player" className="w-full h-full pointer-events-none scale-[1.02]" />

      {/* Overlay Superior Liquid Glass (Aparece al mover mouse) */}
      <div className={`absolute top-0 left-0 w-full z-40 transition-all duration-1000 ease-out pointer-events-none ${showUI ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'}`}>
        <div className="w-full px-12 pt-10 pb-20 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex justify-between items-start">
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {currentVideo?.isPromo
                ? <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1.5 uppercase tracking-widest backdrop-blur-md"><Star size={10} /> PROMO</span>
                : <span className="bg-white/10 text-white border border-white/20 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest backdrop-blur-md">Live Output</span>
              }
              <span className="text-white/50 font-mono text-[10px] flex items-center gap-2 tracking-widest">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                {activePlaylist.indexOf(currentVideo) + 1} OF {activePlaylist.length}
              </span>
              {!isConnected && <span className="text-red-400 bg-red-500/20 border border-red-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md">Offline</span>}
            </div>
            <h2 className={`text-4xl font-black tracking-tighter drop-shadow-2xl ${currentVideo?.isPromo ? 'text-amber-400' : 'text-white'}`}>
              {currentVideo?.title}
            </h2>
          </div>

          <div className="flex flex-col items-end gap-5 pointer-events-auto">
            <div className="text-right">
              <p className="text-white text-4xl font-light font-mono tracking-tighter leading-none drop-shadow-xl">{clock.time}</p>
              <p className="text-white/50 text-xs font-bold uppercase tracking-widest mt-2">{clock.date}</p>
            </div>
            
            <div className="flex gap-3 mt-2">
              <button onClick={handleNext} className="p-3.5 liquid-button rounded-2xl hover:bg-indigo-500/40 hover:border-indigo-500/50 transition-all shadow-lg" title="Skip Video">
                <SkipForward size={20} className="text-white/60 hover:text-white" />
              </button>
              <button onClick={() => window.location.reload()} className="p-3.5 liquid-button rounded-2xl hover:bg-white/20 transition-all shadow-lg" title="Recargar App">
                <RefreshCw size={20} className="text-white/60 hover:text-white" />
              </button>
              <button onClick={onExit} className="p-3.5 liquid-button rounded-2xl hover:bg-red-500/40 hover:border-red-500/50 transition-all shadow-lg" title="Salir de TV Mode">
                <LogOut size={20} className="text-white/60 hover:text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Device ID (Inferior Izquierda) */}
      <div className={`absolute bottom-6 left-8 z-30 transition-all duration-1000 ${showUI ? 'opacity-40' : 'opacity-0'}`}>
        <p className="text-white font-mono text-[10px] tracking-widest flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl backdrop-blur-md border border-white/5">
          <Wifi size={10} /> {myDeviceId}
        </p>
      </div>

      {/* Barra de progreso inferior */}
      <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10 z-30">
        <div
          className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] transition-all duration-1000 ease-out"
          style={{ width: `${((currentIdx % activePlaylist.length) + 1) / activePlaylist.length * 100}%` }}
        />
      </div>

      {errorMsg && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-2xl">
          <AlertTriangle className="w-20 h-20 text-amber-500 mb-6 animate-pulse" strokeWidth={1.5} />
          <p className="text-3xl font-black uppercase tracking-tighter text-white drop-shadow-xl">{errorMsg}</p>
        </div>
      )}
    </div>
  );
}

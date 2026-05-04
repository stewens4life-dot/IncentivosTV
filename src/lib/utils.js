// ── Utilidades compartidas ──

export const getYouTubeId = (url) => {
  try {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  } catch { return null; }
};

export const getTodayString = () => new Date().toISOString().split('T')[0];

export const getDeviceId = () => {
  try {
    let id = localStorage.getItem('tv_device_id');
    if (!id) {
      id = 'TV-' + Math.random().toString(36).substr(2, 8).toUpperCase();
      localStorage.setItem('tv_device_id', id);
    }
    return id;
  } catch { return 'TV-' + Math.floor(Math.random() * 99999); }
};

export const getDeviceInfo = () => {
  try {
    const ua = navigator.userAgent;
    let device = 'Desconocido';
    if (/SmartTV|WebOS|Tizen|NetCast|Viera|BRAVIA/i.test(ua)) device = 'Smart TV';
    else if (/Android/i.test(ua)) device = 'Android';
    else if (/iPhone|iPad/i.test(ua)) device = 'iOS';
    else if (/Windows/i.test(ua)) device = 'Windows PC';
    else if (/Mac/i.test(ua)) device = 'Mac';
    else if (/Linux/i.test(ua)) device = 'Linux';
    let browser = 'Web';
    if (/Chrome/i.test(ua) && !/Edge|Edg/i.test(ua)) browser = 'Chrome';
    else if (/Firefox/i.test(ua)) browser = 'Firefox';
    else if (/Edge|Edg/i.test(ua)) browser = 'Edge';
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
    return `${device} · ${browser}`;
  } catch { return 'TV Desconocido'; }
};

export const getDeviceLocation = async () => {
  try {
    const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
    if (!res.ok) return null;
    const data = await res.json();
    if (data.city && data.region) {
      return `${data.city}, ${data.region}`;
    }
    return data.country || 'Ubicación desconocida';
  } catch {
    return 'Ubicación desconocida';
  }
};

export const formatTime = (date = new Date()) => {
  return date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
};

export const formatDate = (date = new Date()) => {
  return date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
};

export const formatRelativeTime = (isoString) => {
  if (!isoString) return 'nunca';
  const diff = Date.now() - new Date(isoString).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `hace ${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `hace ${hrs}h`;
};

export const isDeviceOnline = (lastSeen) => {
  if (!lastSeen) return false;
  return (Date.now() - new Date(lastSeen).getTime()) < 45000; // 45s
};

// Algoritmo de distribución proporcional de promos
export const getDistributedPlaylist = (draftList) => {
  const regs = draftList.filter(i => !i.isPromo).sort((a, b) => (a.order || 0) - (b.order || 0));
  const promos = draftList.filter(i => i.isPromo);
  if (promos.length === 0) return regs;
  if (regs.length === 0) return promos;

  const promoGroups = {};
  promos.forEach(p => {
    if (!promoGroups[p.youtubeId]) promoGroups[p.youtubeId] = [];
    promoGroups[p.youtubeId].push(p);
  });
  const roundRobinPromos = [];
  let added = true;
  while (added) {
    added = false;
    for (const key in promoGroups) {
      if (promoGroups[key].length > 0) {
        roundRobinPromos.push(promoGroups[key].shift());
        added = true;
      }
    }
  }

  const distributed = [];
  const R = regs.length, P = roundRobinPromos.length;
  const step = R / P;
  let regIdx = 0;
  for (let i = 1; i <= P; i++) {
    const targetRegs = Math.round(i * step);
    while (regIdx < targetRegs && regIdx < R) distributed.push(regs[regIdx++]);
    distributed.push(roundRobinPromos[i - 1]);
  }
  while (regIdx < R) distributed.push(regs[regIdx++]);
  return distributed;
};

// Filtrar playlist activa según fechas
export const getActivePlaylist = (playlist) => {
  const now = getTodayString();
  return playlist.filter(v => {
    if (!v.visible) return false;
    if (v.startDate && v.startDate > now) return false;
    if (v.endDate && v.endDate < now) return false;
    return true;
  });
};

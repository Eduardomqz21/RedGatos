document.addEventListener('DOMContentLoaded', () => {
  if (typeof L === 'undefined') return;

  const estadoMapas = {
    mapaRegistro: null,
    mapaBusqueda: null,
    marcadorRegistro: null,
    marcadoresBusqueda: [],
  };

  const IconoBase = L.divIcon({
    className: '',
    html: `<div style="width:20px;height:20px;border-radius:50%;background:#8ec9c1;border:3px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.2);"></div>`,
    iconSize: [20, 20], iconAnchor: [10, 10]
  });

  const IconoPerdida = L.divIcon({
    className: '',
    html: `<div style="width:20px;height:20px;border-radius:50%;background:#e69595;border:3px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.2); animation: pulse 1.5s infinite;"></div>`,
    iconSize: [20, 20], iconAnchor: [10, 10]
  });

  const escaparHtml = (texto) => String(texto || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const style = document.createElement('style');
  style.innerHTML = `@keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.3); } 100% { transform: scale(1); } }`;
  document.head.appendChild(style);

  const mapRegEl = document.getElementById('mapa-registro');
  const mapBusqEl = document.getElementById('mapa-busqueda');
  
  if (mapRegEl) {
    estadoMapas.mapaRegistro = L.map('mapa-registro', { zoomControl: false }).setView([20.29, -103.18], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(estadoMapas.mapaRegistro);
    L.control.zoom({ position: 'bottomright' }).addTo(estadoMapas.mapaRegistro);

    estadoMapas.mapaRegistro.on('click', (e) => {
      if (estadoMapas.marcadorRegistro) estadoMapas.marcadorRegistro.remove();
      estadoMapas.marcadorRegistro = L.marker(e.latlng, { icon: IconoBase, draggable: true }).addTo(estadoMapas.mapaRegistro);
      window.petmapUI?.establecerCoordenadas(e.latlng.lat, e.latlng.lng);
      
      estadoMapas.marcadorRegistro.on('dragend', (ev) => {
        window.petmapUI?.establecerCoordenadas(ev.target.getLatLng().lat, ev.target.getLatLng().lng);
      });
    });
  }

  if (mapBusqEl) {
    estadoMapas.mapaBusqueda = L.map('mapa-busqueda', { zoomControl: false }).setView([20.29, -103.18], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(estadoMapas.mapaBusqueda);
    L.control.zoom({ position: 'bottomright' }).addTo(estadoMapas.mapaBusqueda);
  }

  const cargarMascotasPerdidas = async () => {
    if (!estadoMapas.mapaBusqueda) return;
    
    estadoMapas.marcadoresBusqueda.forEach((m) => m.remove());
    estadoMapas.marcadoresBusqueda = [];

    try {
      const resp = await fetch('/api/mascotas/perdidas');
      if (!resp.ok) return;
      const datos = await resp.json();

      (datos.mascotas || []).forEach((m) => {
        if (!m.latitud || !m.longitud) return;
        const mascotaSerializada = encodeURIComponent(JSON.stringify(m));
        const marker = L.marker([m.latitud, m.longitud], { icon: IconoPerdida })
          .addTo(estadoMapas.mapaBusqueda)
          .bindPopup(`
            <div style="min-width:180px">
              ${m.foto_url ? `<img src="${escaparHtml(m.foto_url)}" alt="${escaparHtml(m.nombre)}" style="width:100%;height:110px;object-fit:cover;border-radius:12px;margin-bottom:10px;" />` : ''}
              <h6 class="mb-1">${escaparHtml(m.nombre)}</h6>
              <p class="small mb-2">${escaparHtml(m.especie)}</p>
              <button
                type="button"
                class="btn btn-sm boton-acento w-100"
                onclick="window.abrirPerfilPublico(decodeURIComponent('${mascotaSerializada}'))"
              >
                Ayudar
              </button>
            </div>
          `);
        estadoMapas.marcadoresBusqueda.push(marker);
      });
    } catch (e) { console.error('Error cargando mapa:', e); }
  };

  window.petmapMapas = {
    redimensionarMapaRegistro: () => estadoMapas.mapaRegistro?.invalidateSize(),
    redimensionarMapaBusqueda: () => estadoMapas.mapaBusqueda?.invalidateSize(),
    cargarMascotasPerdidas,
  };

  setTimeout(cargarMascotasPerdidas, 500);
});
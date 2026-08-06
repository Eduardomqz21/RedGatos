document.addEventListener('DOMContentLoaded', () => {
  if (typeof L === 'undefined') return;

  const estadoMapas = {
    mapaRegistro: null,
    mapaBusqueda: null,
    mapaEstado: null,
    marcadorRegistro: null,
    circuloRegistro: null,
    marcadorEstado: null,
    circuloEstado: null,
    clusterBusqueda: null
  };

  const IconoBase = L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;border-radius:50%;background:#2e4a45;border:3px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.4);"></div>`,
    iconSize: [24, 24], iconAnchor: [12, 12]
  });

  const IconoPerdida = L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;border-radius:50%;background:#c94c4c;border:3px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.4); animation: pulse-suave 2s infinite;"></div>`,
    iconSize: [24, 24], iconAnchor: [12, 12]
  });

  const escaparHtml = (texto) => {
    return String(texto || '').replace(/[&<>"']/g, (match) => {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return map[match];
    }).replace(/\n/g, '<br>');
  };

  const style = document.createElement('style');
  style.innerHTML = `@keyframes pulse-suave { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.85; } 100% { transform: scale(1); opacity: 1; } }`;
  document.head.appendChild(style);

  const esMovil = L.Browser.mobile;
  
  // Se añade explícitamente keyboard: true para soporte A11y (WCAG 2.2)
  const opcionesMapaBase = { 
    zoomControl: false,
    scrollWheelZoom: false, 
    dragging: !esMovil,     
    tap: !esMovil,
    keyboard: true 
  };

  const inicializarMapaRegistro = () => {
    const el = document.getElementById('mapa-registro');
    if (!el) return;

    if (!estadoMapas.mapaRegistro) {
      estadoMapas.mapaRegistro = L.map('mapa-registro', opcionesMapaBase).setView([20.29, -103.18], 12);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(estadoMapas.mapaRegistro);
      L.control.zoom({ position: 'bottomright' }).addTo(estadoMapas.mapaRegistro);

      estadoMapas.mapaRegistro.locate({ setView: true, maxZoom: 14 });

      estadoMapas.mapaRegistro.on('click', (e) => {
        if (estadoMapas.marcadorRegistro) estadoMapas.marcadorRegistro.remove();
        if (estadoMapas.circuloRegistro) estadoMapas.circuloRegistro.remove();

        estadoMapas.marcadorRegistro = L.marker(e.latlng, { icon: IconoBase, draggable: true }).addTo(estadoMapas.mapaRegistro);
        estadoMapas.circuloRegistro = L.circle(e.latlng, {
          radius: 500, color: '#2e4a45', fillColor: '#2e4a45', fillOpacity: 0.2, weight: 2,
        }).addTo(estadoMapas.mapaRegistro);
        
        window.petmapUI?.establecerCoordenadas(e.latlng.lat, e.latlng.lng);
        
        estadoMapas.marcadorRegistro.on('drag', (ev) => {
          estadoMapas.circuloRegistro?.setLatLng(ev.target.getLatLng());
        });

        estadoMapas.marcadorRegistro.on('dragend', (ev) => {
          window.petmapUI?.establecerCoordenadas(ev.target.getLatLng().lat, ev.target.getLatLng().lng);
        });
      });
    } else {
      setTimeout(() => estadoMapas.mapaRegistro.invalidateSize(), 400);
    }
  };

  const cargarMascotasPerdidas = async () => {
    if (!estadoMapas.mapaBusqueda || !estadoMapas.clusterBusqueda) return;
    
    const bounds = estadoMapas.mapaBusqueda.getBounds();
    const norte = bounds.getNorth();
    const sur = bounds.getSouth();
    const este = bounds.getEast();
    const oeste = bounds.getWest();

    estadoMapas.clusterBusqueda.clearLayers();

    try {
      const urlFetch = `/api/mascotas/perdidas?norte=${norte}&sur=${sur}&este=${este}&oeste=${oeste}&limit=300`;
      const resp = await fetch(urlFetch);
      if (!resp.ok) return;
      const datos = await resp.json();

      const gruposMascotas = {};

      (datos.mascotas || []).forEach((m) => {
        if (m.latitud == null || m.longitud == null) return;
        const claveZona = `${Number(m.latitud).toFixed(4)},${Number(m.longitud).toFixed(4)}`;
        if (!gruposMascotas[claveZona]) gruposMascotas[claveZona] = [];
        gruposMascotas[claveZona].push(m);
      });

      const nuevosMarcadores = [];

      Object.values(gruposMascotas).forEach((grupo) => {
        const lat = grupo[0].latitud;
        const lng = grupo[0].longitud;

        let htmlPopup = `<div style="min-width:200px; max-height:300px; overflow-y:auto; overflow-x:hidden;">`;
        if (grupo.length > 1) {
          htmlPopup += `<div class="alert alert-danger p-2 text-center small mb-3"><strong>¡${grupo.length} mascotas perdidas en esta zona!</strong></div>`;
        }

        grupo.forEach((m) => {
          const mascotaSerializada = encodeURIComponent(JSON.stringify(m));
          htmlPopup += `
            <div class="mb-3 ${grupo.length > 1 ? 'border-bottom pb-3' : ''}">
              ${m.foto_url ? `<img src="${escaparHtml(m.foto_url)}" alt="foto de ${escaparHtml(m.nombre)}" style="width:100%;height:130px;object-fit:cover;border-radius:8px;margin-bottom:10px;" />` : ''}
              <h6 class="mb-1 text-dark fw-bold">${escaparHtml(m.nombre)}</h6>
              <p class="small mb-2 text-muted">${escaparHtml(m.especie)}</p>
              <button type="button" class="btn btn-sm btn-danger w-100 fw-bold" onclick="window.abrirPerfilPublico(decodeURIComponent('${mascotaSerializada}'))">Ayudar</button>
            </div>
          `;
        });

        htmlPopup += `</div>`;
        const marcador = L.marker([lat, lng], { icon: IconoPerdida }).bindPopup(htmlPopup);
        nuevosMarcadores.push(marcador);
      });

      estadoMapas.clusterBusqueda.addLayers(nuevosMarcadores);
    } catch (e) { 
      console.error('Error cargando mapa:', e); 
    }
  };

  const inicializarMapaBusqueda = () => {
    const el = document.getElementById('mapa-busqueda');
    if (!el) return;

    if (!estadoMapas.mapaBusqueda) {
      estadoMapas.mapaBusqueda = L.map('mapa-busqueda', opcionesMapaBase).setView([20.29, -103.18], 12);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(estadoMapas.mapaBusqueda);
      L.control.zoom({ position: 'bottomright' }).addTo(estadoMapas.mapaBusqueda);
      
      estadoMapas.clusterBusqueda = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 40 });
      estadoMapas.mapaBusqueda.addLayer(estadoMapas.clusterBusqueda);
      
      estadoMapas.mapaBusqueda.on('moveend', cargarMascotasPerdidas);
      
      estadoMapas.mapaBusqueda.locate({ setView: true, maxZoom: 14 });
    } else {
      setTimeout(() => estadoMapas.mapaBusqueda.invalidateSize(), 400);
    }
  };

  const inicializarMapaEstado = () => {
    const el = document.getElementById('mapa-estado');
    if (!el) return;

    if (!estadoMapas.mapaEstado) {
      estadoMapas.mapaEstado = L.map('mapa-estado', { ...opcionesMapaBase, dragging: true, tap: true }).setView([20.29, -103.18], 12);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(estadoMapas.mapaEstado);
      L.control.zoom({ position: 'bottomright' }).addTo(estadoMapas.mapaEstado);
      estadoMapas.mapaEstado.locate({ setView: true, maxZoom: 14 });

      estadoMapas.mapaEstado.on('click', (e) => {
        if (estadoMapas.marcadorEstado) estadoMapas.marcadorEstado.remove();
        if (estadoMapas.circuloEstado) estadoMapas.circuloEstado.remove();

        estadoMapas.marcadorEstado = L.marker(e.latlng, { icon: IconoPerdida, draggable: true }).addTo(estadoMapas.mapaEstado);
        estadoMapas.circuloEstado = L.circle(e.latlng, {
          radius: 500, color: '#c94c4c', fillColor: '#c94c4c', fillOpacity: 0.2, weight: 2,
        }).addTo(estadoMapas.mapaEstado);

        const inputLatitud = document.getElementById('latitudEstado');
        const inputLongitud = document.getElementById('longitudEstado');

        if (inputLatitud) inputLatitud.value = String(e.latlng.lat);
        if (inputLongitud) inputLongitud.value = String(e.latlng.lng);

        estadoMapas.marcadorEstado.on('dragend', (ev) => {
          const posicion = ev.target.getLatLng();
          estadoMapas.circuloEstado?.setLatLng(posicion);
          if (inputLatitud) inputLatitud.value = String(posicion.lat);
          if (inputLongitud) inputLongitud.value = String(posicion.lng);
        });
      });
    } else {
      setTimeout(() => estadoMapas.mapaEstado.invalidateSize(), 300);
    }
  };

  const limpiarMapaRegistro = () => {
    if (estadoMapas.marcadorRegistro) {
      estadoMapas.marcadorRegistro.remove();
      estadoMapas.marcadorRegistro = null;
    }
    if (estadoMapas.circuloRegistro) {
      estadoMapas.circuloRegistro.remove();
      estadoMapas.circuloRegistro = null;
    }
    const inputLatitud = document.getElementById('latitud');
    const inputLongitud = document.getElementById('longitud');
    
    if (inputLatitud) inputLatitud.value = '';
    if (inputLongitud) inputLongitud.value = '';
  };

  window.petmapMapas = {
    inicializarMapaRegistro,
    inicializarMapaBusqueda,
    inicializarMapaEstado,
    limpiarMapaRegistro,
    cargarMascotasPerdidas,
  };
});
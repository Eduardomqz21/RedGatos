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
  const mapEstadoEl = document.getElementById('mapa-estado');
  
  if (mapRegEl) {
    estadoMapas.mapaRegistro = L.map('mapa-registro', { zoomControl: false }).setView([20.29, -103.18], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(estadoMapas.mapaRegistro);
    L.control.zoom({ position: 'bottomright' }).addTo(estadoMapas.mapaRegistro);

    estadoMapas.mapaRegistro.locate({ setView: true, maxZoom: 14 });

    estadoMapas.mapaRegistro.on('click', (e) => {
      if (estadoMapas.marcadorRegistro) estadoMapas.marcadorRegistro.remove();
      if (estadoMapas.circuloRegistro) estadoMapas.circuloRegistro.remove();

      estadoMapas.marcadorRegistro = L.marker(e.latlng, { icon: IconoBase, draggable: true }).addTo(estadoMapas.mapaRegistro);
      estadoMapas.circuloRegistro = L.circle(e.latlng, {
        radius: 500,
        color: '#8ec9c1',
        fillColor: '#8ec9c1',
        fillOpacity: 0.3,
        weight: 2,
      }).addTo(estadoMapas.mapaRegistro);
      window.petmapUI?.establecerCoordenadas(e.latlng.lat, e.latlng.lng);
      
      estadoMapas.marcadorRegistro.on('drag', (ev) => {
        estadoMapas.circuloRegistro?.setLatLng(ev.target.getLatLng());
      });

      estadoMapas.marcadorRegistro.on('dragend', (ev) => {
        window.petmapUI?.establecerCoordenadas(ev.target.getLatLng().lat, ev.target.getLatLng().lng);
      });
    });
  }

  if (mapBusqEl) {
    estadoMapas.mapaBusqueda = L.map('mapa-busqueda', { zoomControl: false }).setView([20.29, -103.18], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(estadoMapas.mapaBusqueda);
    L.control.zoom({ position: 'bottomright' }).addTo(estadoMapas.mapaBusqueda);
    estadoMapas.mapaBusqueda.locate({ setView: true, maxZoom: 14 });
  }

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
    const etiqueta = document.getElementById('coordenadasSeleccionadas');

    if (inputLatitud) inputLatitud.value = '';
    if (inputLongitud) inputLongitud.value = '';
    if (etiqueta) etiqueta.textContent = 'Sin seleccionar';
  };

  const limpiarMapaEstado = () => {
    if (estadoMapas.marcadorEstado) {
      estadoMapas.marcadorEstado.remove();
      estadoMapas.marcadorEstado = null;
    }

    if (estadoMapas.circuloEstado) {
      estadoMapas.circuloEstado.remove();
      estadoMapas.circuloEstado = null;
    }

    const inputLatitud = document.getElementById('latitudEstado');
    const inputLongitud = document.getElementById('longitudEstado');

    if (inputLatitud) inputLatitud.value = '';
    if (inputLongitud) inputLongitud.value = '';
  };

  const inicializarMapaEstado = () => {
    if (!mapEstadoEl) {
      return;
    }

    if (!estadoMapas.mapaEstado) {
      estadoMapas.mapaEstado = L.map('mapa-estado', { zoomControl: false }).setView([20.29, -103.18], 12);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(estadoMapas.mapaEstado);
      L.control.zoom({ position: 'bottomright' }).addTo(estadoMapas.mapaEstado);
      estadoMapas.mapaEstado.locate({ setView: true, maxZoom: 14 });

      estadoMapas.mapaEstado.on('click', (e) => {
        if (estadoMapas.marcadorEstado) {
          estadoMapas.marcadorEstado.remove();
        }

        if (estadoMapas.circuloEstado) {
          estadoMapas.circuloEstado.remove();
        }

        estadoMapas.marcadorEstado = L.marker(e.latlng, { icon: IconoPerdida, draggable: true }).addTo(estadoMapas.mapaEstado);
        estadoMapas.circuloEstado = L.circle(e.latlng, {
          radius: 500,
          color: '#e69595',
          fillColor: '#e69595',
          fillOpacity: 0.3,
          weight: 2,
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
      estadoMapas.mapaEstado.invalidateSize();
    }
  };

  const redimensionarMapaRegistro = () => estadoMapas.mapaRegistro?.invalidateSize();
  const redimensionarMapaBusqueda = () => estadoMapas.mapaBusqueda?.invalidateSize();

  const cargarMascotasPerdidas = async () => {
    if (!estadoMapas.mapaBusqueda) return;
    
    estadoMapas.marcadoresBusqueda.forEach((m) => m.remove());
    estadoMapas.marcadoresBusqueda = [];

    try {
      const resp = await fetch('/api/mascotas/perdidas');
      if (!resp.ok) return;
      const datos = await resp.json();

      const gruposMascotas = {};

      (datos.mascotas || []).forEach((m) => {
        if (m.latitud == null || m.longitud == null) return;
        const claveZona = `${Number(m.latitud).toFixed(4)},${Number(m.longitud).toFixed(4)}`;
        if (!gruposMascotas[claveZona]) gruposMascotas[claveZona] = [];
        gruposMascotas[claveZona].push(m);
      });

      Object.values(gruposMascotas).forEach((grupo) => {
        const lat = grupo[0].latitud;
        const lng = grupo[0].longitud;

        let htmlPopup = `<div style="min-width:180px; max-height:280px; overflow-y:auto; overflow-x:hidden;">`;
        if (grupo.length > 1) {
          htmlPopup += `<div class="alert alert-danger p-2 text-center small mb-3"><strong>¡${grupo.length} mascotas perdidas en esta zona!</strong></div>`;
        }

        grupo.forEach((m) => {
          const mascotaSerializada = encodeURIComponent(JSON.stringify(m));
          htmlPopup += `
            <div class="mb-3 ${grupo.length > 1 ? 'border-bottom pb-3' : ''}">
              ${m.foto_url ? `<img src="${escaparHtml(m.foto_url)}" alt="${escaparHtml(m.nombre)}" style="width:100%;height:110px;object-fit:cover;border-radius:12px;margin-bottom:10px;" />` : ''}
              <h6 class="mb-1">${escaparHtml(m.nombre)}</h6>
              <p class="small mb-2">${escaparHtml(m.especie)}</p>
              <button type="button" class="btn btn-sm boton-acento w-100" onclick="window.abrirPerfilPublico(decodeURIComponent('${mascotaSerializada}'))">Ayudar</button>
            </div>
          `;
        });

        htmlPopup += `</div>`;

        const zonaBusqueda = L.circle([lat, lng], {
          color: '#e69595',
          fillColor: '#e69595',
          fillOpacity: 0.4,
          radius: 500,
          weight: 2,
        })
          .addTo(estadoMapas.mapaBusqueda)
          .bindPopup(htmlPopup);

        estadoMapas.marcadoresBusqueda.push(zonaBusqueda);
      });
    } catch (e) { console.error('Error cargando mapa:', e); }
  };

  window.petmapMapas = {
    redimensionarMapaRegistro,
    redimensionarMapaBusqueda,
    inicializarMapaEstado,
    limpiarMapaRegistro,
    limpiarMapaEstado,
    cargarMascotasPerdidas,
  };

  setTimeout(cargarMascotasPerdidas, 500);
});
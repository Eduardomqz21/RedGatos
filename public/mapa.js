'use strict';

document.addEventListener('DOMContentLoaded', () => {
  if (typeof L === 'undefined') return;

  const estado = { reg: null, busq: null, est: null, marReg: null, cirReg: null, marEst: null, cirEst: null, cluster: null };
  const baseCfg = { zoomControl: false, scrollWheelZoom: false, dragging: !L.Browser.mobile, tap: !L.Browser.mobile, keyboard: true };

  const IconoBase = L.divIcon({ className: '', html: `<div style="width:24px;height:24px;border-radius:50%;background:#2e4a45;border:3px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.4);"></div>`, iconSize: [24, 24], iconAnchor: [12, 12] });
  const IconoPerdida = L.divIcon({ className: '', html: `<div style="width:24px;height:24px;border-radius:50%;background:#c94c4c;border:3px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.4); animation: pulse-suave 2s infinite;"></div>`, iconSize: [24, 24], iconAnchor: [12, 12] });

  const style = document.createElement('style');
  style.innerHTML = `@keyframes pulse-suave { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.85; } 100% { transform: scale(1); opacity: 1; } }`;
  document.head.appendChild(style);

  const initRegistro = () => {
    if (!document.getElementById('mapa-registro')) return;
    if (!estado.reg) {
      estado.reg = L.map('mapa-registro', baseCfg).setView([20.29, -103.18], 12);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(estado.reg);
      L.control.zoom({ position: 'bottomright' }).addTo(estado.reg);
      estado.reg.locate({ setView: true, maxZoom: 14 });

      estado.reg.on('click', (e) => {
        if (estado.marReg) estado.marReg.remove();
        if (estado.cirReg) estado.cirReg.remove();
        estado.marReg = L.marker(e.latlng, { icon: IconoBase, draggable: true }).addTo(estado.reg);
        estado.cirReg = L.circle(e.latlng, { radius: 500, color: '#2e4a45', fillColor: '#2e4a45', fillOpacity: 0.2, weight: 2 }).addTo(estado.reg);
        window.petmapUI?.establecerCoordenadas(e.latlng.lat, e.latlng.lng);
        estado.marReg.on('drag', ev => estado.cirReg?.setLatLng(ev.target.getLatLng()));
        estado.marReg.on('dragend', ev => window.petmapUI?.establecerCoordenadas(ev.target.getLatLng().lat, ev.target.getLatLng().lng));
      });
    } else setTimeout(() => estado.reg.invalidateSize(), 400);
  };

  const cargarPerdidas = async () => {
    if (!estado.busq || !estado.cluster) return;
    const { _northEast: ne, _southWest: sw } = estado.busq.getBounds();
    estado.cluster.clearLayers();
    try {
      const resp = await fetch(`/api/mascotas/perdidas?norte=${ne.lat}&sur=${sw.lat}&este=${ne.lng}&oeste=${sw.lng}&limit=300`);
      if (!resp.ok) return;
      const { mascotas } = await resp.json();
      
      const grupos = {};
      mascotas.forEach(m => {
        if (m.latitud == null) return;
        const key = `${Number(m.latitud).toFixed(4)},${Number(m.longitud).toFixed(4)}`;
        if (!grupos[key]) grupos[key] = [];
        grupos[key].push(m);
      });

      const marcadores = Object.values(grupos).map(g => {
        let html = `<div style="min-width:200px; max-height:300px; overflow-y:auto; overflow-x:hidden;">`;
        if (g.length > 1) html += `<div class="alert alert-danger p-2 text-center small mb-3"><strong>¡${g.length} mascotas aquí!</strong></div>`;
        g.forEach(m => {
          html += `<div class="mb-3 ${g.length > 1 ? 'border-bottom pb-3' : ''}">
            ${m.foto_url ? `<img src="${m.foto_url}" style="width:100%;height:130px;object-fit:cover;border-radius:8px;margin-bottom:10px;"/>` : ''}
            <h6 class="mb-1 fw-bold">${m.nombre}</h6><p class="small text-muted">${m.especie}</p>
            <button class="btn btn-sm btn-danger w-100" onclick="window.abrirPerfilPublico(decodeURIComponent('${encodeURIComponent(JSON.stringify(m))}'))">Ayudar</button>
          </div>`;
        });
        return L.marker([g[0].latitud, g[0].longitud], { icon: IconoPerdida }).bindPopup(html + '</div>');
      });
      estado.cluster.addLayers(marcadores);
    } catch (e) {}
  };

  const initBusqueda = () => {
    if (!document.getElementById('mapa-busqueda')) return;
    if (!estado.busq) {
      estado.busq = L.map('mapa-busqueda', baseCfg).setView([20.29, -103.18], 12);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(estado.busq);
      L.control.zoom({ position: 'bottomright' }).addTo(estado.busq);
      estado.cluster = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 40 });
      estado.busq.addLayer(estado.cluster);
      estado.busq.on('moveend', cargarPerdidas);
      estado.busq.locate({ setView: true, maxZoom: 14 });
    } else setTimeout(() => estado.busq.invalidateSize(), 400);
  };

  const initEstado = () => {
    if (!document.getElementById('mapa-estado')) return;
    if (!estado.est) {
      estado.est = L.map('mapa-estado', { ...baseCfg, dragging: true, tap: true }).setView([20.29, -103.18], 12);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(estado.est);
      estado.est.locate({ setView: true, maxZoom: 14 });
      estado.est.on('click', e => {
        if (estado.marEst) estado.marEst.remove();
        if (estado.cirEst) estado.cirEst.remove();
        estado.marEst = L.marker(e.latlng, { icon: IconoPerdida, draggable: true }).addTo(estado.est);
        estado.cirEst = L.circle(e.latlng, { radius: 500, color: '#c94c4c', fillColor: '#c94c4c', fillOpacity: 0.2 }).addTo(estado.est);
        document.getElementById('latitudEstado').value = e.latlng.lat;
        document.getElementById('longitudEstado').value = e.latlng.lng;
        estado.marEst.on('dragend', ev => {
          estado.cirEst?.setLatLng(ev.target.getLatLng());
          document.getElementById('latitudEstado').value = ev.target.getLatLng().lat;
          document.getElementById('longitudEstado').value = ev.target.getLatLng().lng;
        });
      });
    } else setTimeout(() => estado.est.invalidateSize(), 300);
  };

  const limpiarReg = () => {
    estado.marReg?.remove(); estado.marReg = null;
    estado.cirReg?.remove(); estado.cirReg = null;
    if (document.getElementById('latitud')) document.getElementById('latitud').value = '';
    if (document.getElementById('longitud')) document.getElementById('longitud').value = '';
  };

  window.petmapMapas = { inicializarMapaRegistro: initRegistro, inicializarMapaBusqueda: initBusqueda, inicializarMapaEstado: initEstado, limpiarMapaRegistro: limpiarReg, cargarMascotasPerdidas: cargarPerdidas };
});
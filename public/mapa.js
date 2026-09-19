'use strict';

document.addEventListener('DOMContentLoaded', () => {
  if (typeof L === 'undefined') return;

  const estado = { reg: null, busq: null, est: null, marReg: null, cirReg: null, marEst: null, cirEst: null, cluster: null, zonasLayer: null, cargado: false };
  const baseCfg = { zoomControl: false, scrollWheelZoom: true, dragging: true, tap: !L.Browser.mobile, keyboard: true };

  const escaparHtml = (t) => String(t || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  const IconoBase = L.divIcon({ className: '', html: `<div style="width:24px;height:24px;border-radius:50%;background:#2e4a45;border:3px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.4);"></div>`, iconSize: [24, 24], iconAnchor: [12, 12] });
  
  // Icono para marcar la perdida en mapa de edición
  const IconoPerdidaEdit = L.divIcon({ className: '', html: `<div style="width:24px;height:24px;border-radius:50%;background:#c94c4c;border:3px solid white;box-shadow:0 4px 8px rgba(0,0,0,0.4); animation: pulse-suave 2s infinite;"></div>`, iconSize: [24, 24], iconAnchor: [12, 12] });

  // Icono Pin personalizado tipo Google/Folium para mascotas perdidas
  const IconoPerdidaPin = L.divIcon({
    className: '',
    html: `
      <div style="position:relative; width:30px; height:42px; cursor:pointer;">
        <svg viewBox="0 0 384 512" style="width:30px; height:42px; fill:#c94c4c; filter:drop-shadow(0px 3px 6px rgba(0,0,0,0.4));">
          <path d="M172.268 501.67C26.97 291.031 0 269.413 0 192 0 85.961 85.961 0 192 0s192 85.961 192 192c0 77.413-26.97 99.031-172.268 309.67-9.535 13.774-29.93 13.773-39.464 0zM192 272c44.183 0 80-35.817 80-80s-35.817-80-80-80-80 35.817-80 80 35.817 80 80 80z"/>
        </svg>
        <div style="position:absolute; top:8px; left:50%; transform:translateX(-50%); width:14px; height:14px; background:#fff; border-radius:50%; border:2.5px solid #c94c4c;"></div>
      </div>
    `,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -38]
  });

  const style = document.createElement('style');
  style.innerHTML = `@keyframes pulse-suave { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.85; } 100% { transform: scale(1); opacity: 1; } }`;
  document.head.appendChild(style);

  const initRegistro = () => {
    if (!document.getElementById('mapa-registro')) return;
    if (!estado.reg) {
      estado.reg = L.map('mapa-registro', baseCfg).setView([20.29, -103.18], 12);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(estado.reg);
      L.control.zoom({ position: 'bottomright' }).addTo(estado.reg);
      estado.reg.locate({ setView: true, maxZoom: 14 });

      estado.reg.on('click', (e) => {
        if (estado.marReg) estado.marReg.remove();
        if (estado.cirReg) estado.cirReg.remove();
        estado.marReg = L.marker(e.latlng, { icon: IconoBase, draggable: true }).addTo(estado.reg);
        estado.cirReg = L.circle(e.latlng, { radius: 200, color: '#2e4a45', fillColor: '#2e4a45', fillOpacity: 0.15, weight: 1.5, interactive: false }).addTo(estado.reg);
        window.petmapUI?.establecerCoordenadas(e.latlng.lat, e.latlng.lng);
        estado.marReg.on('drag', ev => estado.cirReg?.setLatLng(ev.target.getLatLng()));
        estado.marReg.on('dragend', ev => window.petmapUI?.establecerCoordenadas(ev.target.getLatLng().lat, ev.target.getLatLng().lng));
      });
    } else setTimeout(() => estado.reg.invalidateSize(), 400);
  };

  const cargarPerdidas = async (forzar = false) => {
    if (!estado.busq || !estado.cluster) return;
    if (estado.cargado && !forzar) return; // Evitar recargas innecesarias al mover el mapa

    try {
      const resp = await fetch(`/api/mascotas/perdidas?limit=500`);
      if (!resp.ok) return;
      const { mascotas } = await resp.json();
      
      estado.cluster.clearLayers();
      if (estado.zonasLayer) estado.zonasLayer.clearLayers();

      // Desduplicar mascotas por ID único
      const idsVistos = new Set();
      const mascotasUnicas = [];
      mascotas.forEach(m => {
        if (m.latitud != null && m.longitud != null && !idsVistos.has(m.id)) {
          idsVistos.add(m.id);
          mascotasUnicas.push(m);
        }
      });

      const marcadores = [];
      mascotasUnicas.forEach(m => {
        const lat = Number(m.latitud);
        const lng = Number(m.longitud);
        if (isNaN(lat) || isNaN(lng)) return;

        // Dibujar zona de búsqueda (círculo 200m) NO INTERACTIVO para que los clics pasen directos al marcador
        if (estado.zonasLayer) {
          const circle = L.circle([lat, lng], { 
            radius: 200, 
            color: '#c94c4c', 
            fillColor: '#c94c4c', 
            fillOpacity: 0.15, 
            weight: 1.5, 
            dashArray: '4,4', 
            interactive: false 
          });
          estado.zonasLayer.addLayer(circle);
        }

        const htmlPopup = `
          <div style="min-width:180px; max-width:220px; text-align:center; padding:4px;">
            ${m.foto_url ? `<img src="${m.foto_url}" style="width:100%;height:110px;object-fit:cover;border-radius:8px;margin-bottom:8px;"/>` : ''}
            <div class="badge bg-danger mb-1">${window.PETMAP_ICONOS ? window.PETMAP_ICONOS.alerta(14, '#ffffff', 'me-1') : ''} ¡PERDIDA!</div>
            <h6 class="mb-1 fw-bold fs-6">${escaparHtml(m.nombre)}</h6>
            <p class="small text-muted mb-2">${escaparHtml(m.especie)}${m.raza ? ` • ${escaparHtml(m.raza)}` : ''}</p>
            <button class="btn btn-sm btn-danger w-100 btn-abrir-publico fw-bold" data-mascota="${encodeURIComponent(JSON.stringify(m))}">Ayudar</button>
          </div>
        `;

        const marker = L.marker([lat, lng], { icon: IconoPerdidaPin }).bindPopup(htmlPopup);
        marcadores.push(marker);
      });

      estado.cluster.addLayers(marcadores);
      estado.cargado = true;
    } catch (e) {}
  };

  const initBusqueda = () => {
    if (!document.getElementById('mapa-busqueda')) return;
    if (!estado.busq) {
      estado.busq = L.map('mapa-busqueda', { ...baseCfg, doubleClickZoom: true }).setView([20.29, -103.18], 12);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(estado.busq);
      L.control.zoom({ position: 'bottomright' }).addTo(estado.busq);
      
      estado.zonasLayer = L.layerGroup().addTo(estado.busq);

      // Configuración uniforme de agrupamientos (MarkerCluster)
      estado.cluster = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 45,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount();
          return L.divIcon({
            html: `<div style="background-color:#c94c4c; border: 3px solid #ffffff; color:#ffffff; font-weight:bold; border-radius:50%; width:38px; height:38px; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(0,0,0,0.3); font-size:14px;">${count}</div>`,
            className: 'marker-cluster-custom',
            iconSize: L.point(38, 38)
          });
        }
      });
      
      estado.busq.addLayer(estado.cluster);
      estado.busq.locate({ setView: true, maxZoom: 14 });
      cargarPerdidas();
    } else {
      setTimeout(() => estado.busq.invalidateSize(), 400);
    }
  };

  const initEstado = () => {
    if (!document.getElementById('mapa-estado')) return;
    if (!estado.est) {
      estado.est = L.map('mapa-estado', { ...baseCfg, doubleClickZoom: true, tap: true, touchZoom: true }).setView([20.29, -103.18], 12);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(estado.est);
      L.control.zoom({ position: 'bottomright' }).addTo(estado.est);
      estado.est.locate({ setView: true, maxZoom: 14 });
      
      estado.est.on('click', e => {
        if (estado.marEst) estado.marEst.remove();
        if (estado.cirEst) estado.cirEst.remove();
        estado.marEst = L.marker(e.latlng, { icon: IconoPerdidaEdit, draggable: true }).addTo(estado.est);
        estado.cirEst = L.circle(e.latlng, { radius: 200, color: '#c94c4c', fillColor: '#c94c4c', fillOpacity: 0.2, weight: 1.5, dashArray: '4,4', interactive: false }).addTo(estado.est);
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

  let mapaPerfilPublico = null;
  let marPerfilPublico = null;
  let cirPerfilPublico = null;

  const mostrarMapaPerfilPublico = (lat, lng) => {
    const contenedor = document.getElementById('mapa-perfil-publico');
    if (!contenedor || lat == null || lng == null) return;
    const coords = [Number(lat), Number(lng)];
    if (!mapaPerfilPublico) {
      mapaPerfilPublico = L.map('mapa-perfil-publico', { zoomControl: true, scrollWheelZoom: false }).setView(coords, 15);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(mapaPerfilPublico);
    } else {
      mapaPerfilPublico.setView(coords, 15);
    }
    if (marPerfilPublico) marPerfilPublico.remove();
    if (cirPerfilPublico) cirPerfilPublico.remove();

    marPerfilPublico = L.marker(coords, { icon: IconoPerdidaPin }).addTo(mapaPerfilPublico);
    cirPerfilPublico = L.circle(coords, { radius: 200, color: '#c94c4c', fillColor: '#c94c4c', fillOpacity: 0.2, weight: 1.5, dashArray: '4,4', interactive: false }).addTo(mapaPerfilPublico);
    setTimeout(() => mapaPerfilPublico.invalidateSize(), 350);
  };

  window.petmapMapas = { 
    inicializarMapaRegistro: initRegistro, 
    inicializarMapaBusqueda: initBusqueda, 
    inicializarMapaEstado: initEstado, 
    limpiarMapaRegistro: limpiarReg, 
    cargarMascotasPerdidas: (forzar = true) => cargarPerdidas(forzar),
    mostrarMapaPerfilPublico: mostrarMapaPerfilPublico
  };
});
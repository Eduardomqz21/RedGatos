document.addEventListener('DOMContentLoaded', () => {
  if (typeof L === 'undefined') {
    return;
  }

  const estadoMapas = {
    mapaRegistro: null,
    mapaBusqueda: null,
    marcadorRegistro: null,
    marcadoresBusqueda: [],
  };

  const crearIconoPersonalizado = (esSeleccion) => L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;border-radius:999px;background:${esSeleccion ? '#8ec9c1' : '#95bde6'};border:3px solid #fff;box-shadow:0 8px 16px rgba(0,0,0,0.14);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

  const escaparHtml = (texto) => String(texto)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  const limpiarMarcadoresBusqueda = () => {
    estadoMapas.marcadoresBusqueda.forEach((marcador) => marcador.remove());
    estadoMapas.marcadoresBusqueda = [];
  };

  const construirPopup = (mascota) => {
    const telefono = mascota.telefono_dueno ? `<div><strong>Teléfono:</strong> ${escaparHtml(mascota.telefono_dueno)}</div>` : '';
    const direccion = mascota.direccion_dueno ? `<div><strong>Dirección:</strong> ${escaparHtml(mascota.direccion_dueno)}</div>` : '';

    return `
      <div style="min-width:180px">
        <h6 class="mb-1">${escaparHtml(mascota.nombre || 'Sin nombre')}</h6>
        <div><strong>Especie:</strong> ${escaparHtml(mascota.especie || 'Sin especie')}</div>
        ${telefono}
        ${direccion}
      </div>
    `;
  };

  const mapaRegistro = L.map('mapa-registro', { zoomControl: true }).setView([20.29, -103.18], 12);
  const mapaBusqueda = L.map('mapa-busqueda', { zoomControl: true }).setView([20.29, -103.18], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(mapaRegistro);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(mapaBusqueda);

  mapaRegistro.on('click', (evento) => {
    const { lat, lng } = evento.latlng;

    if (estadoMapas.marcadorRegistro) {
      estadoMapas.marcadorRegistro.remove();
    }

    estadoMapas.marcadorRegistro = L.marker([lat, lng], {
      icon: crearIconoPersonalizado(true),
      draggable: true,
    }).addTo(mapaRegistro);

    estadoMapas.marcadorRegistro.on('dragend', (arrastre) => {
      const posicion = arrastre.target.getLatLng();
      window.redgatosUI?.establecerCoordenadas(posicion.lat, posicion.lng);
    });

    window.redgatosUI?.establecerCoordenadas(lat, lng);
  });

  const cargarMascotasPerdidas = async () => {
    try {
      limpiarMarcadoresBusqueda();
      const respuesta = await fetch('/api/mascotas/perdidas');
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'No fue posible cargar las mascotas perdidas.');
      }

      const mascotas = Array.isArray(datos.mascotas) ? datos.mascotas : [];

      mascotas.forEach((mascota) => {
        const latitud = Number(mascota.latitud);
        const longitud = Number(mascota.longitud);

        if (Number.isNaN(latitud) || Number.isNaN(longitud)) {
          return;
        }

        const marcador = L.marker([latitud, longitud], {
          icon: crearIconoPersonalizado(false),
        }).addTo(mapaBusqueda).bindPopup(construirPopup(mascota));

        estadoMapas.marcadoresBusqueda.push(marcador);
      });
    } catch (error) {
      // La vista sigue operativa aunque falle la carga inicial.
      // eslint-disable-next-line no-console
      console.error(error);
    }
  };

  const redimensionarMapaRegistro = () => {
    setTimeout(() => mapaRegistro.invalidateSize(), 80);
  };

  const redimensionarMapaBusqueda = () => {
    setTimeout(() => mapaBusqueda.invalidateSize(), 80);
  };

  window.redgatosMapas = {
    mapaRegistro,
    mapaBusqueda,
    cargarMascotasPerdidas,
    redimensionarMapaRegistro,
    redimensionarMapaBusqueda,
  };

  cargarMascotasPerdidas();
});
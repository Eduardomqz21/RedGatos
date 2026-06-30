document.addEventListener('DOMContentLoaded', () => {
  const formularioMascota = document.getElementById('formularioMascota');
  const formularioBusquedaNombre = document.getElementById('formularioBusquedaNombre');
  const formularioLogin = document.getElementById('formularioLogin');
  const botonesVista = document.querySelectorAll('[data-vista]');
  const btnNavLogin = document.getElementById('btnNavLogin');
  const btnNavAdmin = document.getElementById('btnNavAdmin');
  const contenedorResultadosBusqueda = document.getElementById('contenedorResultadosBusqueda');
  const totalResultadosBusqueda = document.getElementById('totalResultadosBusqueda');
  const btnCambiarEstadoMascota = document.getElementById('btnCambiarEstadoMascota');
  const btnCerrarSesion = document.getElementById('btnCerrarSesion');
  const tablaAdminMascotas = document.getElementById('tablaAdminMascotas');

  const estadoAplicacion = {
    mascotaActual: null,
    qrPerfilActual: '',
  };

  const obtenerIdiomaUsuario = () => String(navigator.language || navigator.userLanguage || 'es');

  const mostrarVista = (vista) => {
    const secciones = {
      inicio: document.getElementById('vista-inicio'),
      registro: document.getElementById('vista-registro'),
      busqueda: document.getElementById('vista-busqueda'),
      'buscar-lista': document.getElementById('vista-buscar-lista'),
      login: document.getElementById('vista-login'),
      admin: document.getElementById('vista-admin'),
      perfil: document.getElementById('vista-perfil'),
    };

    Object.entries(secciones).forEach(([nombreVista, seccion]) => {
      if (seccion) {
        seccion.classList.toggle('activa', nombreVista === vista);
      }
    });

    document.querySelectorAll('[data-vista]').forEach((boton) => {
      boton.classList.toggle('activa', boton.dataset.vista === vista);
    });

    if (vista === 'registro') {
      window.redgatosMapas?.redimensionarMapaRegistro?.();
    }

    if (vista === 'busqueda') {
      window.redgatosMapas?.redimensionarMapaBusqueda?.();
    }

    if (vista === 'admin') {
      cargarMascotasAdmin();
    }
  };

  const establecerCoordenadas = (latitud, longitud) => {
    const inputLatitud = document.getElementById('latitud');
    const inputLongitud = document.getElementById('longitud');
    const etiquetaCoordenadas = document.getElementById('coordenadasSeleccionadas');

    if (inputLatitud) {
      inputLatitud.value = String(latitud);
    }

    if (inputLongitud) {
      inputLongitud.value = String(longitud);
    }

    if (etiquetaCoordenadas) {
      etiquetaCoordenadas.textContent = `Lat: ${Number(latitud).toFixed(5)}, Lng: ${Number(longitud).toFixed(5)}`;
    }
  };

  const limpiarResultadosBusqueda = () => {
    if (contenedorResultadosBusqueda) {
      contenedorResultadosBusqueda.innerHTML = '';
    }

    if (totalResultadosBusqueda) {
      totalResultadosBusqueda.textContent = '0 resultados';
    }
  };

  const obtenerToken = () => localStorage.getItem('redgatos_token') || '';

  const actualizarNavegacionAuth = () => {
    const hayToken = Boolean(obtenerToken());

    if (btnNavLogin) {
      btnNavLogin.classList.toggle('d-none', hayToken);
    }

    if (btnNavAdmin) {
      btnNavAdmin.classList.toggle('d-none', !hayToken);
    }
  };

  const cargarMascotasAdmin = async () => {
    if (!tablaAdminMascotas) {
      return;
    }

    const token = obtenerToken();

    if (!token) {
      actualizarNavegacionAuth();
      mostrarVista('login');
      return;
    }

    try {
      const respuesta = await fetch('/api/mascotas/buscar?q=', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        if (respuesta.status === 401 || respuesta.status === 403) {
          localStorage.removeItem('redgatos_token');
          actualizarNavegacionAuth();
          mostrarVista('login');
        }
        throw new Error(datos.mensaje || 'No fue posible cargar las mascotas del panel.');
      }

      const mascotas = Array.isArray(datos.mascotas) ? datos.mascotas : [];

      tablaAdminMascotas.innerHTML = mascotas.length
        ? mascotas.map((mascota) => `
          <tr>
            <td>${mascota.nombre || ''}</td>
            <td>${mascota.especie || ''}</td>
            <td>${mascota.esta_perdida ? 'Perdida' : 'Encontrada'}</td>
            <td>${mascota.telefono_dueno || ''}</td>
            <td>
              <button type="button" class="btn btn-outline-danger btn-sm" onclick="borrarMascotaAdmin('${mascota.id}')" aria-label="Borrar mascota">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm2.5.5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6Zm-6.5-2A1.5 1.5 0 0 1 5.5 2h5A1.5 1.5 0 0 1 12 3.5V4h1.5a.5.5 0 0 1 0 1h-.5l-.6 7.2A1.5 1.5 0 0 1 10.9 13H5.1a1.5 1.5 0 0 1-1.5-1.3L3 5H2.5a.5.5 0 0 1 0-1H4v-.5Zm1 0V4h5v-.5a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 0-.5.5ZM4.02 5 4.6 12.2a.5.5 0 0 0 .5.3h5.8a.5.5 0 0 0 .5-.3L12.98 5H4.02Z"/>
                </svg>
              </button>
            </td>
          </tr>
        `).join('')
        : '<tr><td colspan="5" class="text-center text-muted py-4">No hay mascotas registradas.</td></tr>';
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al cargar admin',
        text: error.message,
      });
    }
  };

  const mostrarPerfilMascota = (respuesta) => {
    const mascota = respuesta?.mascota || respuesta;
    const qrPerfil = respuesta?.qr_perfil || respuesta?.url_perfil || '';
    const nombreMascotaPerfil = document.getElementById('nombreMascotaPerfil');
    const descripcionMascotaPerfil = document.getElementById('descripcionMascotaPerfil');
    const qrPerfilImg = document.getElementById('qr-perfil-img');
    const estadoMascotaPerfil = document.getElementById('estadoMascotaPerfil');

    estadoAplicacion.mascotaActual = mascota;
    estadoAplicacion.qrPerfilActual = qrPerfil;

    if (nombreMascotaPerfil) {
      nombreMascotaPerfil.textContent = mascota?.nombre || 'Nombre';
    }

    if (descripcionMascotaPerfil) {
      descripcionMascotaPerfil.textContent = mascota?.descripcion || 'Sin descripción';
    }

    if (qrPerfilImg) {
      qrPerfilImg.src = qrPerfil || '';
      qrPerfilImg.alt = `Código QR de ${mascota?.nombre || 'la mascota'}`;
    }

    if (estadoMascotaPerfil) {
      estadoMascotaPerfil.textContent = `Estado actual: ${mascota?.esta_perdida ? 'Perdida' : 'Encontrada'}`;
    }

    if (btnCambiarEstadoMascota) {
      btnCambiarEstadoMascota.dataset.idMascota = mascota?.id || '';
      btnCambiarEstadoMascota.dataset.estadoActual = String(Boolean(mascota?.esta_perdida));
    }

    mostrarVista('perfil');
  };

  const borrarMascotaAdmin = async (idMascota) => {
    const token = obtenerToken();

    if (!token) {
      actualizarNavegacionAuth();
      mostrarVista('login');
      return;
    }

    const confirmacion = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar mascota',
      text: 'Esta acción no se puede deshacer.',
      showCancelButton: true,
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar',
    });

    if (!confirmacion.isConfirmed) {
      return;
    }

    try {
      const respuesta = await fetch(`/api/mascotas/${idMascota}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        if (respuesta.status === 401 || respuesta.status === 403) {
          localStorage.removeItem('redgatos_token');
          actualizarNavegacionAuth();
          mostrarVista('login');
        }
        throw new Error(datos.mensaje || 'No fue posible borrar la mascota.');
      }

      Swal.fire({
        icon: 'success',
        title: 'Mascota eliminada',
        text: datos.mensaje || 'El registro fue eliminado correctamente.',
      });

      await cargarMascotasAdmin();
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error al borrar',
        text: error.message,
      });
    }
  };

  window.borrarMascotaAdmin = borrarMascotaAdmin;

  const solicitarVerificacionMascota = async (idMascota) => {
    const resultadoTelefono = await Swal.fire({
      title: 'Verificar acceso',
      text: 'Ingresa el teléfono completo asociado a la mascota.',
      input: 'tel',
      inputPlaceholder: '+52 3312345678',
      showCancelButton: true,
      confirmButtonText: 'Verificar',
      cancelButtonText: 'Cancelar',
    });

    if (!resultadoTelefono.isConfirmed || !resultadoTelefono.value) {
      return;
    }

    try {
      const respuesta = await fetch(`/api/mascotas/${idMascota}/verificar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ telefono_dueno: String(resultadoTelefono.value).trim() }),
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'No fue posible verificar el acceso.');
      }

      mostrarPerfilMascota(datos);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Acceso denegado',
        text: error.message,
      });
    }
  };

  const buscarMascotasPorNombre = async (textoBusqueda) => {
    if (!textoBusqueda) {
      limpiarResultadosBusqueda();
      return;
    }

    const respuesta = await fetch(`/api/mascotas/buscar?q=${encodeURIComponent(textoBusqueda)}`);
    const datos = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(datos.mensaje || 'No fue posible buscar mascotas.');
    }

    const mascotas = Array.isArray(datos.mascotas) ? datos.mascotas : [];

    if (totalResultadosBusqueda) {
      totalResultadosBusqueda.textContent = `${mascotas.length} resultados`;
    }

    if (!contenedorResultadosBusqueda) {
      return;
    }

    contenedorResultadosBusqueda.innerHTML = mascotas.length
      ? mascotas.map((mascota) => `
        <div class="col-12 col-md-6">
          <button type="button" class="btn text-start w-100 tarjeta-suave resultado-card p-3" data-id-mascota="${mascota.id}">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div>
                <div class="fw-bold fs-5">${mascota.nombre || 'Sin nombre'}</div>
                <div class="texto-secundario">Raza: ${mascota.raza || 'Sin raza'}</div>
              </div>
              <span class="badge text-bg-light border">${mascota.esta_perdida ? 'Perdida' : 'Encontrada'}</span>
            </div>
            <div class="mt-3 texto-secundario">
              Teléfono: ${mascota.telefono_dueno || ''}
            </div>
          </button>
        </div>
      `).join('')
      : '<div class="col-12"><div class="alert alert-light border mb-0">No se encontraron mascotas con ese nombre.</div></div>';

    contenedorResultadosBusqueda.querySelectorAll('[data-id-mascota]').forEach((boton) => {
      boton.addEventListener('click', () => solicitarVerificacionMascota(boton.dataset.idMascota));
    });
  };

  window.redgatosUI = {
    mostrarVista,
    establecerCoordenadas,
    mostrarPerfilMascota,
    actualizarNavegacionAuth,
  };

  botonesVista.forEach((boton) => {
    boton.addEventListener('click', (evento) => {
      if (boton.tagName === 'A') {
        evento.preventDefault();
      }

      mostrarVista(boton.dataset.vista);
    });
  });

  if (formularioMascota) {
    formularioMascota.addEventListener('submit', async (evento) => {
      evento.preventDefault();

      const formData = new FormData(formularioMascota);
      const latitud = Number(formData.get('latitud'));
      const longitud = Number(formData.get('longitud'));
      const estaPerdida = document.getElementById('esta_perdida').checked;
      const lada = String(formData.get('lada') || '+52').trim();
      const telefono = String(formData.get('telefono_dueno') || '').trim();
      const telefonoCompleto = telefono ? `${lada} ${telefono}` : '';

      if (Number.isNaN(latitud) || Number.isNaN(longitud)) {
        Swal.fire({
          icon: 'error',
          title: 'Ubicación incompleta',
          text: 'Selecciona un punto en el mapa para obtener las coordenadas.',
        });
        return;
      }

      const payload = {
        nombre: String(formData.get('nombre') || '').trim(),
        especie: String(formData.get('especie') || '').trim(),
        raza: String(formData.get('raza') || '').trim(),
        descripcion: String(formData.get('descripcion') || '').trim(),
        telefono_dueno: telefonoCompleto,
        direccion_dueno: String(formData.get('direccion_dueno') || '').trim(),
        latitud,
        longitud,
        esta_perdida,
        idioma_registro: obtenerIdiomaUsuario(),
      };

      try {
        const respuesta = await fetch('/api/mascotas', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No fue posible registrar la mascota.');
        }

        formularioMascota.reset();
        const etiquetaCoordenadas = document.getElementById('coordenadasSeleccionadas');
        if (etiquetaCoordenadas) {
          etiquetaCoordenadas.textContent = 'Sin coordenadas seleccionadas';
        }

        mostrarPerfilMascota(datos);
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error al registrar',
          text: error.message,
        });
      }
    });
  }

  if (formularioBusquedaNombre) {
    formularioBusquedaNombre.addEventListener('submit', async (evento) => {
      evento.preventDefault();

      try {
        const textoBusqueda = String(document.getElementById('busquedaNombre')?.value || '').trim();
        await buscarMascotasPorNombre(textoBusqueda);
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error en la búsqueda',
          text: error.message,
        });
      }
    });
  }

  if (formularioLogin) {
    formularioLogin.addEventListener('submit', async (evento) => {
      evento.preventDefault();

      const correo = String(document.getElementById('correo')?.value || '').trim();
      const contrasena = String(document.getElementById('contrasena')?.value || '').trim();

      try {
        const respuesta = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ correo, contrasena }),
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No fue posible iniciar sesión.');
        }

        localStorage.setItem('redgatos_token', datos.token);
        actualizarNavegacionAuth();

        await Swal.fire({
          icon: 'success',
          title: 'Bienvenido',
          text: `Sesión iniciada para ${datos.usuario?.correo || correo}.`,
        });

        mostrarVista('admin');
        await cargarMascotasAdmin();
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'Error de acceso',
          text: error.message,
        });
      }
    });
  }

  if (btnCambiarEstadoMascota) {
    btnCambiarEstadoMascota.addEventListener('click', async () => {
      const mascotaActual = estadoAplicacion.mascotaActual;

      if (!mascotaActual?.id || !mascotaActual?.telefono_dueno) {
        Swal.fire({
          icon: 'error',
          title: 'Sin perfil activo',
          text: 'No hay una mascota cargada para cambiar su estado.',
        });
        return;
      }

      const nuevoEstado = !Boolean(mascotaActual.esta_perdida);

      try {
        const respuesta = await fetch(`/api/mascotas/${mascotaActual.id}/estado`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            telefono_dueno: mascotaActual.telefono_dueno,
            esta_perdida: nuevoEstado,
          }),
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
          throw new Error(datos.mensaje || 'No fue posible cambiar el estado.');
        }

        mostrarPerfilMascota(datos);
        Swal.fire({
          icon: 'success',
          title: 'Estado actualizado',
          text: datos.mensaje || 'El estado se actualizó correctamente.',
        });
      } catch (error) {
        Swal.fire({
          icon: 'error',
          title: 'No se pudo cambiar el estado',
          text: error.message,
        });
      }
    });
  }

  if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener('click', () => {
      localStorage.removeItem('redgatos_token');
      actualizarNavegacionAuth();
      Swal.fire({
        icon: 'success',
        title: 'Sesión cerrada',
        text: 'La sesión de administrador se cerró correctamente.',
      });
      mostrarVista('inicio');
    });
  }

  actualizarNavegacionAuth();
  mostrarVista('inicio');
  limpiarResultadosBusqueda();
});
document.addEventListener('DOMContentLoaded', () => {
  const formularioMascota = document.getElementById('formularioMascota');
  const formularioRegistroUsuario = document.getElementById('formularioRegistroUsuario');
  const formularioBusquedaNombre = document.getElementById('formularioBusquedaNombre');
  const formularioLogin = document.getElementById('formularioLogin');
  const botonesVista = document.querySelectorAll('[data-vista]');
  
  const btnNavLogin = document.getElementById('btnNavLogin');
  const menuUsuarioLogueado = document.getElementById('menuUsuarioLogueado');
  const textoNombreUsuario = document.getElementById('textoNombreUsuario');
  const itemMenuAdmin = document.getElementById('itemMenuAdmin');
  const btnCerrarSesionGlobal = document.getElementById('btnCerrarSesionGlobal');
  
  const contenedorResultadosBusqueda = document.getElementById('contenedorResultadosBusqueda');
  const contenedorMisMascotas = document.getElementById('contenedorMisMascotas');
  const totalResultadosBusqueda = document.getElementById('totalResultadosBusqueda');
  const btnCambiarEstadoMascota = document.getElementById('btnCambiarEstadoMascota');
  const btnGenerarCartelBusqueda = document.getElementById('btnGenerarCartelBusqueda');
  const tablaAdminMascotas = document.getElementById('tablaAdminMascotas');

  const estadoAplicacion = {
    mascotaActual: null,
    qrPerfilActual: '',
  };

  const perfilPublicoInicial = new URLSearchParams(window.location.search).get('perfil');

  const normalizarMascota = (entrada) => {
    if (!entrada) {
      return null;
    }

    if (typeof entrada === 'string') {
      try {
        return JSON.parse(entrada);
      } catch (error) {
        return null;
      }
    }

    return entrada;
  };

  const obtenerIdiomaUsuario = () => String(navigator.language || navigator.userLanguage || 'es');
  const obtenerToken = () => localStorage.getItem('petmap_token') || '';
  const obtenerUsuarioGuardado = () => String(localStorage.getItem('petmap_usuario') || '').trim();

  const actualizarNavegacionAuth = () => {
    const hayToken = Boolean(obtenerToken());
    const usuarioGuardado = obtenerUsuarioGuardado();
    const esAdmin = usuarioGuardado === 'admin@redgatos.com' || usuarioGuardado.includes('admin');

    if (btnNavLogin) btnNavLogin.classList.toggle('d-none', hayToken);
    if (menuUsuarioLogueado) menuUsuarioLogueado.classList.toggle('d-none', !hayToken);
    if (textoNombreUsuario) textoNombreUsuario.textContent = usuarioGuardado || 'Mi Cuenta';
    if (itemMenuAdmin) itemMenuAdmin.classList.toggle('d-none', !esAdmin);
  };

  const redirigirLoginPorTokenInvalido = () => {
    localStorage.removeItem('petmap_token');
    localStorage.removeItem('petmap_usuario');
    actualizarNavegacionAuth();
    mostrarVista('login');
  };

  const mostrarVista = (vista) => {
    const navbarCollapse = document.getElementById('navbarContent');
    if (navbarCollapse && navbarCollapse.classList.contains('show')) {
      bootstrap.Collapse.getInstance(navbarCollapse)?.hide();
    }

    const secciones = {
      inicio: document.getElementById('vista-inicio'),
      registro: document.getElementById('vista-registro'),
      'registro-usuario': document.getElementById('vista-registro-usuario'),
      busqueda: document.getElementById('vista-busqueda'),
      'buscar-lista': document.getElementById('vista-buscar-lista'),
      login: document.getElementById('vista-login'),
      'mis-mascotas': document.getElementById('vista-mis-mascotas'),
      admin: document.getElementById('vista-admin'),
      'registro-exitoso': document.getElementById('vista-registro-exitoso'),
      'perfil-publico': document.getElementById('vista-perfil-publico'),
      'perfil-privado': document.getElementById('vista-perfil-privado'),
      'boletin-contacto': document.getElementById('vista-boletin-contacto'),
    };

    Object.entries(secciones).forEach(([nombreVista, seccion]) => {
      if (seccion) seccion.classList.toggle('activa', nombreVista === vista);
    });

    document.querySelectorAll('[data-vista]').forEach((boton) => {
      if (!boton.classList.contains('dropdown-item')) {
        boton.classList.toggle('activa', boton.dataset.vista === vista);
      }
    });

    setTimeout(() => {
      if (vista === 'registro') window.petmapMapas?.redimensionarMapaRegistro?.();
      if (vista === 'busqueda') {
        if (window.petmapMapas) {
          window.petmapMapas.cargarMascotasPerdidas();
          window.petmapMapas.redimensionarMapaBusqueda();
        }
      }
    }, 150);

    if (vista === 'admin') cargarMascotasAdmin();
    if (vista === 'mis-mascotas') cargarMisMascotas();
  };

  const establecerCoordenadas = (latitud, longitud) => {
    const inputLatitud = document.getElementById('latitud');
    const inputLongitud = document.getElementById('longitud');
    const etiqueta = document.getElementById('coordenadasSeleccionadas');
    if (inputLatitud) inputLatitud.value = String(latitud);
    if (inputLongitud) inputLongitud.value = String(longitud);
    if (etiqueta) etiqueta.textContent = `${Number(latitud).toFixed(5)}, ${Number(longitud).toFixed(5)}`;
  };

  const cargarMascotasAdmin = async () => {
    const token = obtenerToken();
    if (!token) return redirigirLoginPorTokenInvalido();

    try {
      const respuesta = await fetch('/api/mascotas/buscar?q=', { headers: { Authorization: `Bearer ${token}` }});
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        if (respuesta.status === 401 || respuesta.status === 403) redirigirLoginPorTokenInvalido();
        throw new Error(datos.mensaje || 'Error al cargar panel.');
      }

      const mascotas = Array.isArray(datos.mascotas) ? datos.mascotas : [];
      tablaAdminMascotas.innerHTML = mascotas.length
        ? mascotas.map((m) => `
          <tr>
            <td class="fw-bold">${m.nombre || 'N/A'}</td>
            <td>${m.especie || ''}</td>
            <td><span class="badge ${m.esta_perdida ? 'bg-danger' : 'bg-success'}">${m.esta_perdida ? 'Perdida' : 'A Salvo'}</span></td>
            <td>${m.telefono_dueno || ''}</td>
            <td class="text-end">
              <button class="btn btn-outline-danger btn-sm" onclick="borrarMascotaAdmin('${m.id}')">Borrar</button>
            </td>
          </tr>
        `).join('')
        : '<tr><td colspan="5" class="text-center text-muted py-4">No hay mascotas.</td></tr>';
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error Admin', text: error.message });
    }
  };

  const cargarMisMascotas = async () => {
    const token = obtenerToken();
    if (!token) return redirigirLoginPorTokenInvalido();

    try {
      const respuesta = await fetch('/api/mascotas/mis-mascotas', { headers: { Authorization: `Bearer ${token}` }});
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        if (respuesta.status === 401 || respuesta.status === 403) redirigirLoginPorTokenInvalido();
        throw new Error(datos.mensaje || 'Error al cargar.');
      }

      const mascotas = Array.isArray(datos.mascotas) ? datos.mascotas : [];
      contenedorMisMascotas.innerHTML = mascotas.length
        ? mascotas.map((m) => `
          <div class="col-12 col-md-6 col-xl-4">
            <div class="tarjeta-suave p-4 h-100 d-flex flex-column gap-3 shadow-sm border-0">
              <div class="d-flex justify-content-between align-items-start">
                <h3 class="h5 fw-bold text-dark mb-0">${m.nombre} <small class="text-muted d-block fw-normal fs-6">${m.especie}</small></h3>
                <span class="badge ${m.esta_perdida ? 'bg-danger' : 'bg-success'}">${m.esta_perdida ? 'Perdida' : 'A Salvo'}</span>
              </div>
              <p class="text-muted small mb-0 flex-grow-1">${m.descripcion || 'Sin descripción'}</p>
              <div class="d-flex gap-2 mt-3 pt-3 border-top">
                <button class="btn btn-sm btn-outline-primary flex-grow-1 fw-bold" type="button" data-accion="perfil" data-mascota="${encodeURIComponent(JSON.stringify(m))}">Ir al Perfil</button>
                <button class="btn btn-sm btn-outline-dark flex-grow-1 fw-bold" data-accion="cambiar-estado" data-id-mascota="${m.id}" data-telefono-dueno="${m.telefono_dueno}" data-estado-actual="${m.esta_perdida}">Estado</button>
                <button class="btn btn-sm btn-outline-danger fw-bold" data-accion="eliminar" data-id-mascota="${m.id}">Borrar</button>
              </div>
            </div>
          </div>
        `).join('')
        : '<div class="col-12 text-center text-muted p-5 bg-white rounded-4 border">No tienes mascotas registradas.</div>';
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
  };

  const borrarMascotaAdmin = async (idMascota) => {
    const token = obtenerToken();
    if (!token) return redirigirLoginPorTokenInvalido();

    const conf = await Swal.fire({ title: '¿Borrar mascota?', text: 'No se puede deshacer.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Borrar' });
    if (!conf.isConfirmed) return;

    try {
      const resp = await fetch(`/api/mascotas/${idMascota}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }});
      if (!resp.ok) throw new Error('No fue posible borrar.');
      Swal.fire('Eliminada', '', 'success');
      cargarMascotasAdmin();
      cargarMisMascotas();
    } catch (e) {
      Swal.fire('Error', e.message, 'error');
    }
  };
  window.borrarMascotaAdmin = borrarMascotaAdmin;

  const renderFotoMascota = (elemento, fotoUrl) => {
    if (!elemento) {
      return;
    }

    if (fotoUrl) {
      elemento.src = fotoUrl;
      elemento.classList.remove('d-none');
      return;
    }

    elemento.removeAttribute('src');
    elemento.classList.add('d-none');
  };

  const cargarPerfilPublicoPorId = async (idMascota) => {
    if (!idMascota) {
      return;
    }

    try {
      const respuesta = await fetch(`/api/mascotas/${encodeURIComponent(idMascota)}/publico`);
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'No fue posible cargar el perfil público.');
      }

      mostrarPerfilPublico(datos.mascota);
      mostrarVista('perfil-publico');
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Perfil no disponible',
        text: error.message,
      });
    }
  };

  const inyectarCartelImpresion = (mascota) => {
    const foto = document.getElementById('cartelFotoMascota');
    const nombre = document.getElementById('cartelNombreMascota');
    const telefono = document.getElementById('cartelTelefonoMascota');

    renderFotoMascota(foto, mascota?.foto_url || '');

    if (nombre) {
      nombre.textContent = mascota?.nombre || 'Nombre';
    }

    if (telefono) {
      telefono.textContent = mascota?.telefono_dueno || 'Sin teléfono';
    }
  };

  const mostrarRegistroExitoso = (respuesta) => {
    const mascota = normalizarMascota(respuesta?.mascota || respuesta);
    const foto = document.getElementById('fotoMascotaRegistroExitoso');
    const nombre = document.getElementById('nombreMascotaRegistroExitoso');
    const qr = document.getElementById('qrMascotaRegistroExitoso');
    const botonIrPerfil = document.getElementById('btnIrPerfilMascotaRegistroExitoso');

    estadoAplicacion.mascotaActual = mascota;
    estadoAplicacion.qrPerfilActual = respuesta?.qr_perfil || respuesta?.url_perfil || '';

    renderFotoMascota(foto, mascota?.foto_url || respuesta?.foto_url || '');

    if (nombre) {
      nombre.textContent = mascota?.nombre || 'Nombre';
    }

    if (qr) {
      qr.src = estadoAplicacion.qrPerfilActual || '';
      qr.alt = `QR de ${mascota?.nombre || 'la mascota'}`;
    }

    if (botonDescargarQR) {
      botonDescargarQR.onclick = () => {
        const enlace = document.createElement('a');
        enlace.href = estadoAplicacion.qrPerfilActual || '';
        enlace.download = `${String(mascota?.nombre || 'qr').replace(/\s+/g, '_')}.png`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
      };
    }

    if (botonIrPerfil) {
      botonIrPerfil.onclick = () => {
        mostrarPerfilPrivado(mascota);
        mostrarVista('perfil-privado');
      };
    }
  };

  const mostrarPerfilPublico = (entradaMascota) => {
    const mascota = normalizarMascota(entradaMascota);
    const foto = document.getElementById('fotoMascotaPublico');
    const nombre = document.getElementById('nombreMascotaPublico');
    const descripcion = document.getElementById('descripcionMascotaPublico');
    const alerta = document.getElementById('alertaMascotaPerdidaPublico');
    const botonVerContacto = document.getElementById('btnContactarDuenoPublico');

    estadoAplicacion.mascotaActual = mascota;

    renderFotoMascota(foto, mascota?.foto_url || '');

    if (nombre) {
      nombre.textContent = mascota?.nombre || 'Nombre';
    }

    if (descripcion) {
      descripcion.textContent = mascota?.descripcion || 'Sin descripción';
    }

    if (alerta) {
      alerta.classList.toggle('d-none', !mascota?.esta_perdida);
    }

    if (botonVerContacto) {
      botonVerContacto.classList.toggle('d-none', !mascota?.esta_perdida);
      botonVerContacto.onclick = () => {
        if (mascota) {
          mostrarBoletinContacto(mascota);
          mostrarVista('boletin-contacto');
        }
      };
    }
  };

  const mostrarPerfilPrivado = (entradaMascota) => {
    const mascota = normalizarMascota(entradaMascota);
    const foto = document.getElementById('fotoMascotaPrivado');
    const nombre = document.getElementById('nombreMascotaPrivado');
    const descripcion = document.getElementById('descripcionMascotaPrivado');
    const telefono = document.getElementById('telefonoMascotaPrivado');
    const direccion = document.getElementById('direccionMascotaPrivado');
    const estado = document.getElementById('estadoMascotaPrivado');

    estadoAplicacion.mascotaActual = mascota;

    renderFotoMascota(foto, mascota?.foto_url || '');

    if (nombre) {
      nombre.textContent = mascota?.nombre || 'Nombre';
    }

    if (descripcion) {
      descripcion.textContent = mascota?.descripcion || 'Sin descripción';
    }

    if (telefono) {
      telefono.textContent = mascota?.telefono_dueno || 'Sin teléfono';
    }

    if (direccion) {
      direccion.textContent = mascota?.direccion_dueno || 'Sin dirección';
    }

    if (estado) {
      estado.textContent = `Estado actual: ${mascota?.esta_perdida ? 'Perdida' : 'Encontrada'}`;
    }

    if (btnCambiarEstadoMascota) {
      btnCambiarEstadoMascota.dataset.idMascota = mascota?.id || '';
      btnCambiarEstadoMascota.dataset.estadoActual = String(Boolean(mascota?.esta_perdida));
      btnCambiarEstadoMascota.textContent = mascota?.esta_perdida ? 'Marcar como encontrada' : 'Marcar como perdida';
      btnCambiarEstadoMascota.onclick = async () => {
        if (!mascota?.id) {
          return;
        }

        const nuevoEstado = !Boolean(mascota.esta_perdida);

        if (nuevoEstado) {
          await Swal.fire({
            icon: 'warning',
            title: 'Tus datos de contacto se harán públicos',
            text: 'Al marcarla como perdida, teléfono y dirección serán visibles solo en el perfil público.',
            confirmButtonText: 'Entendido',
          });
        }

        try {
          const respuesta = await fetch(`/api/mascotas/${mascota.id}/estado`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${obtenerToken()}`,
            },
            body: JSON.stringify({
              telefono_dueno: mascota.telefono_dueno,
              esta_perdida: nuevoEstado,
            }),
          });

          const datos = await respuesta.json();

          if (!respuesta.ok) {
            throw new Error(datos.mensaje || 'No fue posible actualizar el estado.');
          }

          mostrarPerfilPrivado(datos.mascota);
          Swal.fire({
            icon: 'success',
            title: 'Estado actualizado',
            timer: 1400,
            showConfirmButton: false,
          });
        } catch (error) {
          Swal.fire({
            icon: 'error',
            title: 'No se pudo actualizar',
            text: error.message,
          });
        }
      };
    }

    if (btnGenerarCartelBusqueda) {
      btnGenerarCartelBusqueda.onclick = () => {
        inyectarCartelImpresion(mascota);
        window.print();
      };
    }
  };

  const mostrarBoletinContacto = (respuesta) => {
    const mascota = normalizarMascota(respuesta?.mascota || respuesta);
    const foto = document.getElementById('fotoMascotaBoletin');
    const nombre = document.getElementById('nombreMascotaBoletin');
    const descripcion = document.getElementById('descripcionMascotaBoletin');
    const telefono = document.getElementById('telefonoMascotaBoletin');
    const direccion = document.getElementById('direccionMascotaBoletin');

    estadoAplicacion.mascotaActual = mascota;

    renderFotoMascota(foto, mascota?.foto_url || respuesta?.foto_url || '');

    if (nombre) {
      nombre.textContent = mascota?.nombre || 'Nombre';
    }

    if (descripcion) {
      descripcion.textContent = mascota?.descripcion || 'Sin descripción';
    }

    if (telefono) {
      telefono.textContent = mascota?.telefono_dueno || 'Sin teléfono';
    }

    if (direccion) {
      direccion.textContent = mascota?.direccion_dueno || 'Sin dirección';
    }
  };

  const mostrarPerfilMascota = (entradaMascota) => {
    mostrarPerfilPrivado(entradaMascota);
  };

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

      mostrarBoletinContacto(datos);
      mostrarVista('boletin-contacto');
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Acceso denegado',
        text: error.message,
      });
    }
  };

  const abrirPerfilDesdeMapa = async (idMascota) => {
    await solicitarVerificacionMascota(idMascota);
  };

  const abrirPerfilPublico = async (entradaMascota) => {
    const mascota = normalizarMascota(entradaMascota);

    if (mascota?.id) {
      mostrarPerfilPublico(mascota);
      mostrarVista('perfil-publico');
      return;
    }

    if (typeof entradaMascota === 'string' && entradaMascota.trim()) {
      await cargarPerfilPublicoPorId(entradaMascota.trim());
    }
  };

  const buscarMascotasPorNombre = async (textoBusqueda) => {
    if (!textoBusqueda) {
      if (contenedorResultadosBusqueda) contenedorResultadosBusqueda.innerHTML = '';
      if (totalResultadosBusqueda) totalResultadosBusqueda.textContent = '0 resultados';
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
          </button>
        </div>
      `).join('')
      : '<div class="col-12"><div class="alert alert-light border mb-0">No se encontraron mascotas con ese nombre.</div></div>';

    contenedorResultadosBusqueda.querySelectorAll('[data-id-mascota]').forEach((boton) => {
      boton.addEventListener('click', () => cargarPerfilPublicoPorId(boton.dataset.idMascota));
    });
  };

  window.petmapUI = {
    mostrarVista,
    establecerCoordenadas,
    mostrarPerfilMascota,
    mostrarPerfilPublico,
    mostrarPerfilPrivado,
    mostrarRegistroExitoso,
    mostrarBoletinContacto,
    actualizarNavegacionAuth,
    abrirPerfilDesdeMapa,
  };

  window.abrirPerfilPublico = abrirPerfilPublico;

  botonesVista.forEach((boton) => {
    boton.addEventListener('click', (evento) => {
      if (boton.tagName === 'A') {
        evento.preventDefault();
      }

      mostrarVista(boton.dataset.vista);
    });
  });

  if (formularioMascota) {
    formularioMascota.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = obtenerToken();
      if (!token) return redirigirLoginPorTokenInvalido();

      const formData = new FormData(formularioMascota);
      const latitud = Number(formData.get('latitud'));
      const longitud = Number(formData.get('longitud'));

      if (!latitud || !longitud) return Swal.fire('Error', 'Marca un punto en el mapa.', 'error');

      formData.set('telefono_dueno', formData.get('telefono_dueno') ? `${formData.get('lada')} ${formData.get('telefono_dueno')}` : '');
      formData.set('latitud', String(latitud));
      formData.set('longitud', String(longitud));
      formData.set('esta_perdida', String(document.getElementById('esta_perdida').checked));
      formData.set('idioma_registro', obtenerIdiomaUsuario());

      try {
        const respuesta = await fetch('/api/mascotas', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const datos = await respuesta.json();
        if (!respuesta.ok) throw new Error(datos.mensaje);

        formularioMascota.reset();
        Swal.fire({ icon: 'success', title: '¡Mascota Guardada!', timer: 1500, showConfirmButton: false });
        mostrarRegistroExitoso(datos);
        mostrarVista('registro-exitoso');
      } catch (error) { Swal.fire('Error', error.message, 'error'); }
    });
  }

  if (formularioRegistroUsuario) {
    formularioRegistroUsuario.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const respuesta = await fetch('/api/auth/registro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            nombre: formularioRegistroUsuario.nombre.value, 
            correo: formularioRegistroUsuario.correo.value, 
            contrasena: formularioRegistroUsuario.contrasena.value 
          }),
        });
        if (!respuesta.ok) throw new Error((await respuesta.json()).mensaje);
        formularioRegistroUsuario.reset();
        Swal.fire({ icon: 'success', title: '¡Cuenta Creada!', text: 'Por favor inicia sesión.' });
        mostrarVista('login');
      } catch (error) { Swal.fire({ icon: 'error', title: 'Error', text: error.message }); }
    });
  }

  if (formularioLogin) {
    formularioLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const respuesta = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ correo: formularioLogin.correo.value, contrasena: formularioLogin.contrasena.value }),
        });
        const datos = await respuesta.json();
        if (!respuesta.ok) throw new Error(datos.mensaje);

        localStorage.setItem('petmap_token', datos.token);
        localStorage.setItem('petmap_usuario', datos.usuario?.correo);
        actualizarNavegacionAuth();
        formularioLogin.reset();

        Swal.fire({ icon: 'success', title: 'Bienvenido', timer: 1500, showConfirmButton: false });
        
        if (['admin', 'superadmin'].includes(datos.usuario?.rol)) mostrarVista('admin');
        else mostrarVista('mis-mascotas');

      } catch (error) { Swal.fire({ icon: 'error', title: 'Acceso fallido', text: error.message }); }
    });
  }

  if (formularioBusquedaNombre) {
    formularioBusquedaNombre.addEventListener('submit', async (e) => {
      e.preventDefault();
      const query = document.getElementById('busquedaNombre').value;
      if(!query) return;

      const resp = await fetch(`/api/mascotas/buscar?q=${encodeURIComponent(query)}`);
      const datos = await resp.json();
      document.getElementById('totalResultadosBusqueda').textContent = `${datos.mascotas?.length || 0} resultados`;
      
      const cr = document.getElementById('contenedorResultadosBusqueda');
      cr.innerHTML = datos.mascotas?.length ? datos.mascotas.map(m => `
        <div class="col-12 col-md-6">
          <div class="tarjeta-suave p-3 h-100 shadow-sm border-0 d-flex flex-column">
            <h4 class="h5 fw-bold">${m.nombre}</h4>
            <p class="text-muted small mb-3 flex-grow-1">${m.raza || m.especie}</p>
            <button class="btn btn-outline-dark btn-sm w-100 fw-bold" onclick="window.abrirPerfilPublico('${encodeURIComponent(JSON.stringify(m))}')">Ayudar</button>
          </div>
        </div>
      `).join('') : '<p class="text-muted text-center w-100 py-3">No hay coincidencias</p>';
    });
  }

  if (contenedorMisMascotas) {
    contenedorMisMascotas.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-accion]');
      if (!btn) return;
      const id = btn.dataset.idMascota;

      if (btn.dataset.accion === 'perfil' && btn.dataset.mascota) {
        mostrarPerfilPrivado(JSON.parse(decodeURIComponent(btn.dataset.mascota)));
        mostrarVista('perfil-privado');
        return;
      }
      
      if (btn.dataset.accion === 'eliminar') borrarMascotaAdmin(id);
      if (btn.dataset.accion === 'cambiar-estado') {
        const resp = await fetch(`/api/mascotas/${id}/estado`, { 
          method: 'PUT', 
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${obtenerToken()}` },
          body: JSON.stringify({ telefono_dueno: btn.dataset.telefonoDueno, esta_perdida: btn.dataset.estadoActual !== 'true' })
        });
        if(resp.ok) cargarMisMascotas();
      }
    });
  }

  actualizarNavegacionAuth();
  if (perfilPublicoInicial) {
    cargarPerfilPublicoPorId(perfilPublicoInicial);
  } else {
    mostrarVista('inicio');
  }
});
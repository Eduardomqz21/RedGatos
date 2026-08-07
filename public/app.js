document.addEventListener('DOMContentLoaded', () => {
  const formularioMascota = document.getElementById('formularioMascota');
  const formularioRegistroUsuario = document.getElementById('formularioRegistroUsuario');
  const formularioLogin = document.getElementById('formularioLogin');
  const formularioMemorial = document.getElementById('formularioMemorial');
  const botonesVista = document.querySelectorAll('[data-vista]');
  
  const btnNavLogin = document.getElementById('btnNavLogin');
  const menuUsuarioLogueado = document.getElementById('menuUsuarioLogueado');
  const textoNombreUsuario = document.getElementById('textoNombreUsuario');
  const itemMenuAdmin = document.getElementById('itemMenuAdmin');
  const btnCerrarSesionGlobal = document.getElementById('btnCerrarSesionGlobal');
  
  const formularioAdminUsuario = document.getElementById('formularioAdminUsuario');
  const tablaAdminUsuarios = document.getElementById('tablaAdminUsuarios');
  const tituloFormularioAdminUsuario = document.getElementById('tituloFormularioAdminUsuario');
  const botonGuardarUsuarioAdmin = document.getElementById('botonGuardarUsuarioAdmin');
  const btnCancelarEdicionUsuario = document.getElementById('btnCancelarEdicionUsuario');
  
  const contenedorMisMascotas = document.getElementById('contenedorMisMascotas');
  const contenedorEspacioMemorial = document.getElementById('espacioMemorialMap');
  
  const btnCambiarEstadoMascota = document.getElementById('btnCambiarEstadoMascota');
  const btnGenerarCartelBusqueda = document.getElementById('btnGenerarCartelBusqueda');
  const tablaAdminMascotas = document.getElementById('tablaAdminMascotas');
  
  const colFormularioRegistro = document.getElementById('colFormularioRegistro');
  const contenedorMapaRegistro = document.getElementById('contenedorMapaRegistro');
  const chkEstaPerdida = document.getElementById('esta_perdida');
  const modalMapaEstadoEl = document.getElementById('modalMapaEstado');
  const btnConfirmarPerdida = document.getElementById('btnConfirmarPerdida');

  const estadoAplicacion = {
    usuario: null,
    mascotaActual: null,
    qrPerfilActual: '',
    usuarioAdminEditandoId: null,
  };

  const perfilPublicoInicial = new URLSearchParams(window.location.search).get('perfil');

  const normalizarMascota = (entrada) => {
    if (!entrada) return null;
    if (typeof entrada === 'string') {
      try { return JSON.parse(entrada); } catch (error) { return null; }
    }
    return entrada;
  };

  const obtenerIdiomaUsuario = () => String(navigator.language || navigator.userLanguage || 'es');

  const escaparHtml = (texto) => {
    return String(texto || '').replace(/[&<>"']/g, (match) => {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return map[match];
    }).replace(/\n/g, '<br>');
  };

  const convertirBooleano = (valor) => {
    if (typeof valor === 'boolean') return valor;
    if (typeof valor === 'string') return valor.toLowerCase() === 'true';
    return Boolean(valor);
  };

  const obtenerNumeroNullable = (valor) => {
    if (valor === '' || valor == null) return null;
    const numero = Number(valor);
    return Number.isNaN(numero) ? null : numero;
  };

  const alternarBotonCarga = (boton, estaCargando, textoPorDefecto = 'Guardar') => {
    if (!boton) return;
    if (estaCargando) {
      boton.disabled = true;
      boton.dataset.textoOriginal = boton.textContent;
      boton.textContent = 'Procesando...';
    } else {
      boton.disabled = false;
      boton.textContent = boton.dataset.textoOriginal || textoPorDefecto;
    }
  };

  const generarCURM = (nombre, especie, fechaNacimiento) => {
    const inicialNombre = String(nombre || 'XX').toUpperCase().substring(0, 2).padEnd(2, 'X');
    const inicialEspecie = String(especie || 'X').toUpperCase().charAt(0);
    const fechaBase = fechaNacimiento ? new Date(fechaNacimiento) : new Date();
    const fechaValida = Number.isNaN(fechaBase.getTime()) ? new Date() : fechaBase;
    const ddmmyy = `${String(fechaValida.getDate()).padStart(2, '0')}${String(fechaValida.getMonth() + 1).padStart(2, '0')}${String(fechaValida.getFullYear()).substring(2, 4)}`;
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${inicialEspecie}-${inicialNombre}-${ddmmyy}-${random}`;
  };

  // UX-001: Corrección de condición de carrera al imprimir
  const imprimirPlantilla = (html) => {
    const zonaImpresion = document.getElementById('zona-impresion');
    if (!zonaImpresion) return;
    zonaImpresion.innerHTML = html;
    
    const imagenes = Array.from(zonaImpresion.getElementsByTagName('img'));
    if (imagenes.length === 0) {
      window.print();
      return;
    }

    let imagenesCargadas = 0;
    const intentarImprimir = () => {
      imagenesCargadas++;
      if (imagenesCargadas === imagenes.length) {
        setTimeout(() => window.print(), 100);
      }
    };

    imagenes.forEach(img => {
      if (img.complete) intentarImprimir();
      else {
        img.onload = intentarImprimir;
        img.onerror = intentarImprimir;
      }
    });
  };

  window.addEventListener('afterprint', () => {
    const zonaImpresion = document.getElementById('zona-impresion');
    if (zonaImpresion) zonaImpresion.innerHTML = '';
  });

  const descargarArchivoDesdeUrl = (url, nombreArchivo) => {
    if (!url) return;
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivo;
    enlace.rel = 'noopener';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
  };

  const imprimirQrMascota = (titulo, qrUrl, nombreMascota) => {
    if (!qrUrl) return;
    const html = `
      <div style="text-align:center;font-family:Arial,sans-serif;padding:40px;border:5px solid #8ec9c1;border-radius:20px;max-width:400px;margin:40px auto;background:#fff;">
        <h1 style="color:#315a55;margin-bottom:5px;">PetMap</h1>
        <h2 style="color:#555;margin-top:0;font-size:1.2rem;">Perfil Digital de <br><strong style="font-size:2rem;color:#000;">${escaparHtml(nombreMascota) || 'Mascota'}</strong></h2>
        <img src="${escaparHtml(qrUrl)}" alt="QR" style="width:100%;max-width:300px;border-radius:10px;margin:20px 0;" />
        <p style="color:#777;font-weight:bold;">Escanea para ver información</p>
      </div>
    `;
    imprimirPlantilla(html);
  };

  const imprimirCredencialMascota = (mascota, esInvitado = false) => {
    const fotoSrc = mascota.foto_url ? escaparHtml(mascota.foto_url) : 'https://via.placeholder.com/150?text=Foto';
    const curm = generarCURM(mascota.nombre, mascota.especie, mascota.fecha_nacimiento);
    const tituloDueno = esInvitado ? 'Dueño' : 'Contacto';
    const nombreDueno = esInvitado ? mascota.dueno : 'Ver en Perfil Público';
    const telefono = mascota.telefono || mascota.telefono_dueno || 'Sin registrar';
    const fechaNacimiento = mascota.fecha_nacimiento || 'Sin registrar';

    const html = `
      <div class="credencial-wrapper">
        <div class="credencial-bg-huellas"></div>
        <div class="credencial-contenido">
          <img src="${fotoSrc}" class="credencial-foto" alt="Foto">
          <div class="credencial-datos">
            <div class="credencial-titulo">${escaparHtml(mascota.nombre || 'Mascota')}</div>
            <div class="credencial-item"><strong>ESPECIE:</strong> ${escaparHtml(mascota.especie || 'Sin especie')}</div>
            <div class="credencial-item"><strong>RAZA:</strong> ${escaparHtml(mascota.raza || 'Mestizo')}</div>
            <div class="credencial-item"><strong>NACIMIENTO:</strong> ${escaparHtml(fechaNacimiento)}</div>
            <div class="credencial-item"><strong>CURM:</strong> ${escaparHtml(curm)}</div>
            <div class="credencial-item"><strong>${tituloDueno}:</strong> ${escaparHtml(nombreDueno || 'Sin registrar')}</div>
            <div class="credencial-item"><strong>TEL:</strong> ${escaparHtml(telefono)}</div>
            <div class="credencial-barcode">*${escaparHtml(curm)}*</div>
          </div>
        </div>
      </div>
    `;
    imprimirPlantilla(html);
  };

  // SEC-002: Verificación de sesión real en backend
  const verificarSesionBackend = async () => {
    try {
      const resp = await fetch('/api/auth/me');
      if (resp.ok) {
        const data = await resp.json();
        estadoAplicacion.usuario = data.usuario;
      } else {
        estadoAplicacion.usuario = null;
      }
    } catch(e) {
      estadoAplicacion.usuario = null;
    }
    actualizarNavegacionAuth();
  };

  const actualizarNavegacionAuth = () => {
    const haySesionActiva = Boolean(estadoAplicacion.usuario);
    const esAdmin = haySesionActiva && ['admin', 'superadmin'].includes(estadoAplicacion.usuario.rol);

    if (btnNavLogin) btnNavLogin.classList.toggle('d-none', haySesionActiva);
    if (menuUsuarioLogueado) menuUsuarioLogueado.classList.toggle('d-none', !haySesionActiva);
    if (textoNombreUsuario) textoNombreUsuario.textContent = estadoAplicacion.usuario?.nombre || 'Mi Cuenta';
    if (itemMenuAdmin) itemMenuAdmin.classList.toggle('d-none', !esAdmin);
  };

  const redirigirLoginPorSesionInvalida = () => {
    estadoAplicacion.usuario = null;
    actualizarNavegacionAuth();
    mostrarVista('login');
  };

  const mostrarVista = (vista, empujarEstado = true) => {
    const navbarCollapse = document.getElementById('navbarContent');
    if (navbarCollapse && navbarCollapse.classList.contains('show')) {
      bootstrap.Collapse.getInstance(navbarCollapse)?.hide();
    }

    const vistasValidas = ['inicio', 'registro', 'registro-usuario', 'busqueda', 'login', 'mis-mascotas', 'admin', 'registro-exitoso', 'perfil-publico', 'perfil-privado', 'boletin-contacto', 'memorial'];
    
    const vistasProtegidas = ['mis-mascotas', 'admin', 'registro-exitoso', 'perfil-privado', 'boletin-contacto', 'registro'];
    if (vistasProtegidas.includes(vista) && !estadoAplicacion.usuario) {
        return redirigirLoginPorSesionInvalida();
    }

    if(!vistasValidas.includes(vista)) vista = 'inicio';

    document.querySelectorAll('.estado-vista').forEach(s => s.classList.remove('activa'));
    const seccionActiva = document.getElementById(`vista-${vista}`);
    if (seccionActiva) seccionActiva.classList.add('activa');

    document.querySelectorAll('[data-vista]').forEach((boton) => {
      if (!boton.classList.contains('dropdown-item')) {
        boton.classList.toggle('activa', boton.dataset.vista === vista);
      }
    });

    if (empujarEstado) {
      const rutaActual = window.location.pathname.split('/').filter(Boolean)[0] || 'inicio';
      if (rutaActual !== vista) {
        window.history.pushState({ vista }, '', `/${vista === 'inicio' ? '' : vista}`);
      }
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => {
      if (vista === 'registro') sincronizarMapaRegistro();
      if (vista === 'busqueda') {
        window.petmapMapas?.inicializarMapaBusqueda?.();
        window.petmapMapas?.cargarMascotasPerdidas?.();
      }
    }, 300);

    if (vista === 'admin') { cargarMascotasAdmin(); cargarUsuariosAdmin(); }
    if (vista === 'mis-mascotas') cargarMisMascotas();
    if (vista === 'memorial') cargarMemoriales();
  };

  window.addEventListener('popstate', (e) => {
    const segmentoURL = window.location.pathname.split('/').filter(Boolean)[0];
    mostrarVista(e.state?.vista || segmentoURL || 'inicio', false);
  });

  const establecerCoordenadas = (latitud, longitud) => {
    const inputLatitud = document.getElementById('latitud');
    const inputLongitud = document.getElementById('longitud');
    if (inputLatitud) inputLatitud.value = String(latitud);
    if (inputLongitud) inputLongitud.value = String(longitud);
  };

  const sincronizarMapaRegistro = () => {
    if (!contenedorMapaRegistro || !chkEstaPerdida || !colFormularioRegistro) return;
    if (chkEstaPerdida.checked) {
      contenedorMapaRegistro.classList.remove('d-none');
      colFormularioRegistro.className = 'col-12 col-xl-5 transicion-panel';
      contenedorMapaRegistro.className = 'col-12 col-xl-7 transicion-panel slide-in-right';
      setTimeout(() => window.petmapMapas?.inicializarMapaRegistro?.(), 450);
      return;
    }
    colFormularioRegistro.className = 'col-12 col-lg-8 col-xl-6 mx-auto transicion-panel';
    contenedorMapaRegistro.className = 'd-none transicion-panel';
    window.petmapMapas?.limpiarMapaRegistro?.();
  };

  // ==========================================
  // LÓGICA MEMORIAL
  // ==========================================
  const cargarMemoriales = async () => {
    if (!contenedorEspacioMemorial) return;
    try {
      const resp = await fetch('/api/memorial');
      const data = await resp.json();
      renderizarEspacioMemorial(data.memoriales || []);
    } catch(e) {
      console.error('Error cargando memoriales', e);
    }
  };

  const renderizarEspacioMemorial = (memoriales) => {
    contenedorEspacioMemorial.innerHTML = '';
    memoriales.forEach((m) => {
      const size = Math.floor(Math.random() * (120 - 70 + 1)) + 70; 
      const top = Math.random() * 80; 
      const left = Math.random() * 85; 
      const delay = Math.random() * 5; 
      
      const img = document.createElement('img');
      img.src = escaparHtml(m.foto_url);
      img.className = 'foto-flotante';
      img.style.width = `${size}px`;
      img.style.height = `${size}px`;
      img.style.top = `${top}%`;
      img.style.left = `${left}%`;
      img.style.animationDelay = `${delay}s`;
      img.alt = escaparHtml(m.nombre);
      
      img.onclick = () => abrirModalMemorial(m);
      contenedorEspacioMemorial.appendChild(img);
    });
  };

  const abrirModalMemorial = (m) => {
    document.getElementById('modalMemFoto').src = escaparHtml(m.foto_url);
    document.getElementById('modalMemNombre').textContent = escaparHtml(m.nombre);
    document.getElementById('modalMemFechas').textContent = `${m.fecha_nacimiento ? m.fecha_nacimiento + ' - ' : 'Hasta '}${m.fecha_fallecimiento}`;
    document.getElementById('modalMemMensaje').textContent = escaparHtml(m.mensaje);
    document.getElementById('modalMemContador').textContent = m.contador_veladoras;
    
    const btnVeladora = document.getElementById('btnEncenderVeladora');
    btnVeladora.onclick = () => encenderVeladora(m.id, btnVeladora);
    
    const modal = new bootstrap.Modal(document.getElementById('modalMemorialInfo'));
    modal.show();
  };

  const encenderVeladora = async (id, botonElement) => {
    try {
      botonElement.innerHTML = '✨ Encendiendo...';
      const resp = await fetch(`/api/memorial/${id}/veladora`, { method: 'POST' });
      if(!resp.ok) throw new Error('Error al encender');
      const data = await resp.json();
      
      document.getElementById('modalMemContador').textContent = data.veladoras;
      botonElement.innerHTML = '🕯️ Veladora Encendida';
      botonElement.classList.add('veladora-activa');
      
      crearParticulaChispa(botonElement);
    } catch(e) {
      botonElement.innerHTML = '🕯️ Intentar de nuevo';
    }
  };

  const crearParticulaChispa = (elemento) => {
    const rect = elemento.getBoundingClientRect();
    const chispa = document.createElement('div');
    chispa.className = 'chispa-animacion';
    chispa.style.left = `${rect.left + rect.width / 2}px`;
    chispa.style.top = `${rect.top}px`;
    document.body.appendChild(chispa);
    setTimeout(() => chispa.remove(), 1000);
  };

  if (formularioMemorial) {
    formularioMemorial.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btnSubmitMemorial');
      alternarBotonCarga(btn, true, 'Registrar Homenaje');
      
      try {
        const formData = new FormData(formularioMemorial);
        const resp = await fetch('/api/memorial', { method: 'POST', body: formData });
        if(!resp.ok) throw new Error('Error al registrar memorial');
        
        Swal.fire({ icon: 'success', title: 'Homenaje creado', text: 'Tu mascota ahora descansa aquí.', background: '#1a1c20', color: '#fff' });
        bootstrap.Modal.getInstance(document.getElementById('modalCrearMemorial'))?.hide();
        formularioMemorial.reset();
        cargarMemoriales();
      } catch(e) {
        Swal.fire({ icon: 'error', title: 'Error', text: e.message });
      } finally {
        alternarBotonCarga(btn, false, 'Registrar Homenaje');
      }
    });
  }

  // ==========================================
  // LÓGICA CORE (Admin, Mascotas, etc.)
  // ==========================================
  const ejecutarPeticionEstado = async (id, telefono, direccion, estaPerdida, latitud, longitud, callbackExito) => {
    try {
      const payload = { telefono_dueno: telefono, direccion_dueno: direccion, esta_perdida: estaPerdida };
      if (latitud != null && longitud != null) { payload.latitud = latitud; payload.longitud = longitud; }

      const respuesta = await fetch(`/api/mascotas/${id}/estado`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload),
      });

      const datos = await respuesta.json();
      if (!respuesta.ok) {
        if (respuesta.status === 401 || respuesta.status === 403) return redirigirLoginPorSesionInvalida();
        throw new Error(datos.mensaje || 'No fue posible actualizar el estado.');
      }

      if (callbackExito) callbackExito(datos.mascota);
      Swal.fire({ icon: 'success', title: 'Estado actualizado', timer: 1400, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'No se pudo actualizar', text: error.message });
    }
  };

  const procesarCambioEstado = async (mascota, estadoActual, callbackExito) => {
    const nuevoEstado = !Boolean(estadoActual);
    if (!mascota?.id) return;

    if (nuevoEstado && modalMapaEstadoEl) {
      const modal = bootstrap.Modal.getOrCreateInstance(modalMapaEstadoEl);
      const telGuardado = String(mascota.telefono_dueno || '');
      const partesTel = telGuardado.split(' ');
      const telefonoEstado = document.getElementById('telefonoEstado');

      if (partesTel.length > 1 && partesTel[0].includes('+')) {
        if (telefonoEstado) telefonoEstado.value = partesTel.slice(1).join('').substring(0, 10);
      } else if (telefonoEstado) {
        telefonoEstado.value = telGuardado.substring(0, 10);
      }

      document.getElementById('direccionEstado').value = mascota.direccion_dueno || '';
      window.petmapMapas?.limpiarMapaEstado?.();
      modal.show();

      setTimeout(() => window.petmapMapas?.inicializarMapaEstado?.(), 350);

      if (btnConfirmarPerdida) {
        btnConfirmarPerdida.onclick = async () => {
          const latitud = obtenerNumeroNullable(document.getElementById('latitudEstado')?.value);
          const longitud = obtenerNumeroNullable(document.getElementById('longitudEstado')?.value);
          const telefono = String(document.getElementById('telefonoEstado')?.value || '').trim();
          const direccion = String(document.getElementById('direccionEstado')?.value || '').trim();

          if (!telefono || !direccion) return Swal.fire('Faltan datos', 'El teléfono y la dirección son obligatorios.', 'warning');
          if (!/^\d{10}$/.test(telefono)) return Swal.fire('Teléfono inválido', 'El número debe contener exactamente 10 dígitos numéricos.', 'warning');
          if (latitud == null || longitud == null) return Swal.fire('Error', 'Selecciona la zona en el mapa.', 'error');

          alternarBotonCarga(btnConfirmarPerdida, true);
          const telefonoFinal = `+52 ${telefono}`;
          await ejecutarPeticionEstado(mascota.id, telefonoFinal, direccion, true, latitud, longitud, callbackExito);
          alternarBotonCarga(btnConfirmarPerdida, false, 'Reportar Extravío');
          modal.hide();
        };
      }
      return;
    }
    await ejecutarPeticionEstado(mascota.id, mascota.telefono_dueno, mascota.direccion_dueno, false, null, null, callbackExito);
  };

  const cargarMascotasAdmin = async () => {
    try {
      const respuesta = await fetch('/api/mascotas/buscar?q=', { credentials: 'include' });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.mensaje || 'Error al cargar panel.');

      const mascotas = Array.isArray(datos.mascotas) ? datos.mascotas : [];
      tablaAdminMascotas.innerHTML = '';
      
      if (mascotas.length === 0) {
          tablaAdminMascotas.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No hay mascotas.</td></tr>';
          return;
      }

      const fragment = document.createDocumentFragment();
      mascotas.forEach(m => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td class="fw-bold">${escaparHtml(m.nombre) || 'N/A'}</td>
            <td>${escaparHtml(m.especie) || ''}</td>
            <td><span class="badge ${m.esta_perdida ? 'bg-danger' : 'bg-success'}">${m.esta_perdida ? 'Perdida' : 'A Salvo'}</span></td>
            <td>${escaparHtml(m.telefono_dueno) || ''}</td>
            <td class="text-end">
              <button class="btn btn-outline-danger btn-sm" onclick="borrarMascotaAdmin('${m.id}')">Borrar</button>
            </td>
          `;
          fragment.appendChild(tr);
      });
      tablaAdminMascotas.appendChild(fragment);
    } catch (error) {
      console.log('Admin:', error);
    }
  };

  const cargarUsuariosAdmin = async () => {
    try {
      const respuesta = await fetch('/api/usuarios?limit=100', { credentials: 'include' });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error('Error al cargar usuarios.');

      const usuarios = Array.isArray(datos.usuarios) ? datos.usuarios : [];
      if (!tablaAdminUsuarios) return;
      tablaAdminUsuarios.innerHTML = '';

      if (usuarios.length === 0) {
          tablaAdminUsuarios.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No hay usuarios registrados.</td></tr>';
          return;
      }

      const fragment = document.createDocumentFragment();
      usuarios.forEach(usuario => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td class="fw-bold">${escaparHtml(usuario.nombre) || 'Sin nombre'}</td>
            <td>${escaparHtml(usuario.correo) || ''}</td>
            <td><span class="badge ${usuario.rol === 'superadmin' ? 'bg-dark' : 'bg-primary'} text-uppercase">${escaparHtml(usuario.rol) || 'admin'}</span></td>
            <td class="text-end">
              <div class="d-flex justify-content-end gap-2 flex-wrap">
                <button class="btn btn-outline-primary btn-sm" type="button" data-accion-usuario="editar" data-usuario="${encodeURIComponent(JSON.stringify(usuario))}">Editar</button>
                <button class="btn btn-outline-danger btn-sm" type="button" data-accion-usuario="eliminar" data-id-usuario="${usuario.id}">Eliminar</button>
              </div>
            </td>
          `;
          fragment.appendChild(tr);
      });
      tablaAdminUsuarios.appendChild(fragment);
    } catch (error) {}
  };

  const resetearFormularioAdminUsuario = () => {
    estadoAplicacion.usuarioAdminEditandoId = null;
    if (formularioAdminUsuario) { formularioAdminUsuario.reset(); formularioAdminUsuario.dataset.enviando = 'false'; }
    if (tituloFormularioAdminUsuario) tituloFormularioAdminUsuario.textContent = 'Crear usuario';
    if (botonGuardarUsuarioAdmin) botonGuardarUsuarioAdmin.textContent = 'Crear usuario';
    if (btnCancelarEdicionUsuario) btnCancelarEdicionUsuario.classList.add('d-none');
  };

  const prepararEdicionUsuarioAdmin = (usuario) => {
    if (!formularioAdminUsuario || !usuario) return;
    estadoAplicacion.usuarioAdminEditandoId = usuario.id;
    formularioAdminUsuario.nombre.value = usuario.nombre || '';
    formularioAdminUsuario.correo.value = usuario.correo || '';
    formularioAdminUsuario.contrasena.value = '';
    formularioAdminUsuario.rol.value = usuario.rol || 'admin';
    if (tituloFormularioAdminUsuario) tituloFormularioAdminUsuario.textContent = 'Editar usuario';
    if (botonGuardarUsuarioAdmin) botonGuardarUsuarioAdmin.textContent = 'Actualizar usuario';
    if (btnCancelarEdicionUsuario) btnCancelarEdicionUsuario.classList.remove('d-none');
  };

  const guardarUsuarioAdmin = async (evento) => {
    evento.preventDefault();
    if (!formularioAdminUsuario || formularioAdminUsuario.dataset.enviando === 'true') return;

    const payload = {
      nombre: String(formularioAdminUsuario.nombre.value || '').trim(),
      correo: String(formularioAdminUsuario.correo.value || '').trim(),
      rol: String(formularioAdminUsuario.rol.value || 'admin').trim(),
    };

    const contrasena = String(formularioAdminUsuario.contrasena.value || '').trim();
    if (!estadoAplicacion.usuarioAdminEditandoId || contrasena) payload.contrasena = contrasena;

    formularioAdminUsuario.dataset.enviando = 'true';
    alternarBotonCarga(botonGuardarUsuarioAdmin, true);
    
    try {
      const esEdicion = Boolean(estadoAplicacion.usuarioAdminEditandoId);
      const respuesta = await fetch(
        esEdicion ? `/api/usuarios/${estadoAplicacion.usuarioAdminEditandoId}` : '/api/usuarios',
        { method: esEdicion ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) }
      );
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No fue posible guardar el usuario.');

      formularioAdminUsuario.reset();
      resetearFormularioAdminUsuario();
      Swal.fire({ icon: 'success', title: datos.mensaje || 'Usuario guardado', timer: 1200, showConfirmButton: false });
      cargarUsuariosAdmin();
    } catch (error) { Swal.fire({ icon: 'error', title: 'Error', text: error.message }); } 
    finally { formularioAdminUsuario.dataset.enviando = 'false'; alternarBotonCarga(botonGuardarUsuarioAdmin, false, 'Crear usuario'); }
  };

  const eliminarUsuarioAdmin = async (idUsuario) => {
    const conf = await Swal.fire({ title: '¿Eliminar?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar' });
    if (!conf.isConfirmed) return;
    try {
      const respuesta = await fetch(`/api/usuarios/${idUsuario}`, { method: 'DELETE', credentials: 'include' });
      if (!respuesta.ok) throw new Error('No fue posible eliminar el usuario.');
      Swal.fire({ icon: 'success', title: 'Eliminado', timer: 1100, showConfirmButton: false });
      cargarUsuariosAdmin();
    } catch (error) { Swal.fire('Error', error.message, 'error'); }
  };

  if (tablaAdminUsuarios) {
    tablaAdminUsuarios.addEventListener('click', (evento) => {
      const boton = evento.target.closest('[data-accion-usuario]');
      if (!boton) return;
      if (boton.dataset.accionUsuario === 'editar') prepararEdicionUsuarioAdmin(JSON.parse(decodeURIComponent(boton.dataset.usuario)));
      if (boton.dataset.accionUsuario === 'eliminar') eliminarUsuarioAdmin(boton.dataset.idUsuario);
    });
  }
  if (formularioAdminUsuario) formularioAdminUsuario.addEventListener('submit', guardarUsuarioAdmin);
  if (btnCancelarEdicionUsuario) btnCancelarEdicionUsuario.addEventListener('click', resetearFormularioAdminUsuario);

  const cargarMisMascotas = async () => {
    try {
      const respuesta = await fetch('/api/mascotas/mis-mascotas', { credentials: 'include' });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error('Error al cargar.');

      const mascotas = Array.isArray(datos.mascotas) ? datos.mascotas : [];
      contenedorMisMascotas.innerHTML = '';
      
      if (mascotas.length === 0) {
          contenedorMisMascotas.innerHTML = '<div class="col-12 text-center p-5 bg-white rounded-4 border">No tienes mascotas registradas.</div>';
          return;
      }

      const fragment = document.createDocumentFragment();
      mascotas.forEach(m => {
          const div = document.createElement('div');
          div.className = 'col-12 col-md-6 col-xl-4';
          div.innerHTML = `
            <div class="tarjeta-suave p-4 h-100 d-flex flex-column gap-3 shadow-sm border-0">
              <div class="d-flex justify-content-between align-items-start">
                <h3 class="h5 fw-bold text-dark mb-0">${escaparHtml(m.nombre)} <small class="text-muted d-block fw-normal fs-6">${escaparHtml(m.especie)}</small></h3>
                <span class="badge ${m.esta_perdida ? 'bg-danger' : 'bg-success'}">${m.esta_perdida ? 'Perdida' : 'A Salvo'}</span>
              </div>
              <p class="text-muted small mb-0 flex-grow-1">${escaparHtml(m.descripcion || 'Sin descripción')}</p>
              <div class="d-flex gap-2 mt-3 pt-3 border-top">
                <button class="btn btn-sm btn-outline-primary flex-grow-1 fw-bold" type="button" data-accion="perfil" data-mascota="${encodeURIComponent(JSON.stringify(m))}">Ir al Perfil</button>
                <button class="btn btn-sm btn-outline-dark flex-grow-1 fw-bold" data-accion="cambiar-estado" data-id-mascota="${m.id}" data-telefono-dueno="${escaparHtml(m.telefono_dueno)}" data-estado-actual="${m.esta_perdida}">Estado</button>
                <button class="btn btn-sm btn-outline-danger fw-bold" data-accion="eliminar" data-id-mascota="${m.id}">Borrar</button>
              </div>
            </div>
          `;
          fragment.appendChild(div);
      });
      contenedorMisMascotas.appendChild(fragment);
    } catch (error) {}
  };

  const borrarMascotaAdmin = async (idMascota) => {
    const conf = await Swal.fire({ title: '¿Borrar mascota?', icon: 'warning', showCancelButton: true });
    if (!conf.isConfirmed) return;
    try {
      const resp = await fetch(`/api/mascotas/${idMascota}`, { method: 'DELETE', credentials: 'include' });
      if (!resp.ok) throw new Error('No fue posible borrar.');
      Swal.fire('Eliminada', '', 'success');
      cargarMascotasAdmin();
      cargarMisMascotas();
    } catch (e) {}
  };
  window.borrarMascotaAdmin = borrarMascotaAdmin;

  const renderFotoMascota = (elemento, fotoUrl) => {
    if (!elemento) return;
    if (fotoUrl) { elemento.src = escaparHtml(fotoUrl); elemento.classList.remove('d-none'); return; }
    elemento.removeAttribute('src');
    elemento.classList.add('d-none');
  };

  const cargarPerfilPublicoPorId = async (idMascota) => {
    if (!idMascota) return;
    try {
      const respuesta = await fetch(`/api/mascotas/${encodeURIComponent(idMascota)}/publico`);
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.mensaje || 'No fue posible cargar el perfil público.');
      mostrarPerfilPublico(datos.mascota);
      mostrarVista('perfil-publico');
    } catch (error) { Swal.fire('Error', error.message, 'error'); }
  };

  const mostrarRegistroExitoso = (respuesta) => {
    const mascota = normalizarMascota(respuesta?.mascota || respuesta);
    estadoAplicacion.mascotaActual = mascota;
    estadoAplicacion.qrPerfilActual = respuesta?.qr_perfil || respuesta?.url_perfil || '';
    renderFotoMascota(document.getElementById('fotoMascotaRegistroExitoso'), mascota?.foto_url || respuesta?.foto_url || '');
    if (document.getElementById('nombreMascotaRegistroExitoso')) document.getElementById('nombreMascotaRegistroExitoso').textContent = mascota?.nombre || 'Nombre';
    const qr = document.getElementById('qrMascotaRegistroExitoso');
    if (qr) { qr.src = escaparHtml(estadoAplicacion.qrPerfilActual || ''); qr.alt = `QR de ${escaparHtml(mascota?.nombre)}`; }

    const botonDescargarQR = document.getElementById('btnDescargarQRMascotaRegistroExitoso');
    if (botonDescargarQR) botonDescargarQR.onclick = () => descargarArchivoDesdeUrl(estadoAplicacion.qrPerfilActual, `${String(mascota?.nombre).replace(/\s+/g, '_')}.png`);
    const botonImprimirQR = document.getElementById('btnImprimirQRMascotaRegistroExitoso');
    if (botonImprimirQR) botonImprimirQR.onclick = () => imprimirQrMascota('QR de registro', estadoAplicacion.qrPerfilActual, mascota?.nombre);
    
    const botonIrPerfil = document.getElementById('btnIrPerfilMascotaRegistroExitoso');
    if (botonIrPerfil) {
      botonIrPerfil.onclick = () => { mostrarPerfilPrivado(mascota); mostrarVista('perfil-privado'); };
    }
  };

  const mostrarPerfilPublico = (entradaMascota) => {
    const mascota = normalizarMascota(entradaMascota);
    estadoAplicacion.mascotaActual = mascota;
    renderFotoMascota(document.getElementById('fotoMascotaPublico'), mascota?.foto_url || entradaMascota?.foto_url || '');
    if (document.getElementById('nombreMascotaPublico')) document.getElementById('nombreMascotaPublico').textContent = mascota?.nombre || 'Nombre';
    if (document.getElementById('descripcionMascotaPublico')) document.getElementById('descripcionMascotaPublico').innerHTML = escaparHtml(mascota?.descripcion || 'Sin descripción');
    
    const alerta = document.getElementById('alertaMascotaPerdidaPublico');
    if (alerta) alerta.classList.toggle('d-none', !mascota?.esta_perdida);
    
    const botonVerContacto = document.getElementById('btnContactarDuenoPublico');
    if (botonVerContacto) {
      botonVerContacto.classList.toggle('d-none', !mascota?.esta_perdida);
      botonVerContacto.onclick = () => { if (mascota) { mostrarBoletinContacto(mascota); mostrarVista('boletin-contacto'); } };
    }
  };

  const mostrarPerfilPrivado = (entradaMascota) => {
    const mascota = normalizarMascota(entradaMascota);
    estadoAplicacion.mascotaActual = mascota;
    estadoAplicacion.qrPerfilActual = mascota?.qr_perfil || mascota?.url_perfil || '';
    renderFotoMascota(document.getElementById('fotoMascotaPrivado'), mascota?.foto_url || entradaMascota?.foto_url || '');
    renderFotoMascota(document.getElementById('qrMascotaPrivado'), estadoAplicacion.qrPerfilActual);

    if (document.getElementById('nombreMascotaPrivado')) document.getElementById('nombreMascotaPrivado').textContent = mascota?.nombre || 'Nombre';
    if (document.getElementById('descripcionMascotaPrivado')) document.getElementById('descripcionMascotaPrivado').innerHTML = escaparHtml(mascota?.descripcion || 'Sin descripción');
    if (document.getElementById('telefonoMascotaPrivado')) document.getElementById('telefonoMascotaPrivado').textContent = mascota?.telefono_dueno || 'Sin teléfono';
    if (document.getElementById('direccionMascotaPrivado')) document.getElementById('direccionMascotaPrivado').textContent = mascota?.direccion_dueno || 'Sin dirección';
    if (document.getElementById('estadoMascotaPrivado')) document.getElementById('estadoMascotaPrivado').textContent = `Estado actual: ${mascota?.esta_perdida ? 'Perdida' : 'Encontrada'}`;

    if (btnCambiarEstadoMascota) {
      btnCambiarEstadoMascota.textContent = mascota?.esta_perdida ? 'Marcar como encontrada' : 'Marcar como perdida';
      btnCambiarEstadoMascota.onclick = () => procesarCambioEstado(mascota, mascota.esta_perdida, (mAct) => mostrarPerfilPrivado(mAct));
    }

    if (btnGenerarCartelBusqueda) {
      btnGenerarCartelBusqueda.onclick = () => {
        const fotoSrc = mascota?.foto_url ? escaparHtml(mascota.foto_url) : 'https://via.placeholder.com/400?text=Mascota';
        imprimirPlantilla(`
          <div class="cartel-impresion">
            <div class="cartel-header">¡SE BUSCA!</div>
            <h1 style="text-align:center;font-size:4rem;margin:10px 0;color:#2e4a45;">${escaparHtml(mascota?.nombre)}</h1>
            <div style="display:flex;gap:20px;margin-top:20px;">
              <div style="flex:1;"><img src="${fotoSrc}" style="width:100%;border-radius:10px;border:4px solid #c94c4c;object-fit:cover;" /></div>
              <div style="flex:1;font-size:1.4rem;line-height:1.6;">
                <p><strong>Especie/Raza:</strong> ${escaparHtml(mascota?.especie)} ${mascota?.raza ? '- ' + escaparHtml(mascota.raza) : ''}</p>
                <p><strong>Señas particulares:</strong> ${escaparHtml(mascota?.descripcion || '')}</p>
                <div style="background:#fff3f3;padding:15px;border-left:5px solid #c94c4c;margin-top:20px;">
                  <p style="margin:0;color:#c94c4c;font-weight:bold;font-size:1.2rem;">Por favor, si la ves, comunícate al:</p>
                  <p style="margin:5px 0 0 0;font-size:2.2rem;font-weight:900;">📞 ${escaparHtml(mascota?.telefono_dueno)}</p>
                </div>
              </div>
            </div>
          </div>
        `);
      };
    }

    if (document.getElementById('btnImprimirCredencial')) document.getElementById('btnImprimirCredencial').onclick = () => imprimirCredencialMascota(mascota, false);
    if (document.getElementById('btnDescargarQRMascotaPrivada')) document.getElementById('btnDescargarQRMascotaPrivada').onclick = () => descargarArchivoDesdeUrl(estadoAplicacion.qrPerfilActual, `QR_${mascota.nombre}.png`);
    if (document.getElementById('btnImprimirQRMascotaPrivada')) document.getElementById('btnImprimirQRMascotaPrivada').onclick = () => imprimirQrMascota('QR de mascota', estadoAplicacion.qrPerfilActual, mascota.nombre);
    if (document.getElementById('btnDescargarFotoMascotaPrivada')) document.getElementById('btnDescargarFotoMascotaPrivada').onclick = () => descargarArchivoDesdeUrl(mascota.foto_url, `Foto_${mascota.nombre}.jpg`);
  };

  const mostrarBoletinContacto = (respuesta) => {
    const mascota = normalizarMascota(respuesta?.mascota || respuesta);
    estadoAplicacion.mascotaActual = mascota;
    renderFotoMascota(document.getElementById('fotoMascotaBoletin'), mascota?.foto_url || respuesta?.foto_url || '');
    if (document.getElementById('nombreMascotaBoletin')) document.getElementById('nombreMascotaBoletin').textContent = mascota?.nombre || 'Nombre';
    if (document.getElementById('descripcionMascotaBoletin')) document.getElementById('descripcionMascotaBoletin').innerHTML = escaparHtml(mascota?.descripcion || 'Sin descripción');
    if (document.getElementById('telefonoMascotaBoletin')) document.getElementById('telefonoMascotaBoletin').textContent = mascota?.telefono_dueno || 'Sin teléfono';
    if (document.getElementById('direccionMascotaBoletin')) document.getElementById('direccionMascotaBoletin').textContent = mascota?.direccion_dueno || 'Sin dirección';
  };

  const solicitarVerificacionMascota = async (idMascota) => {
    const res = await Swal.fire({ title: 'Verificar', text: 'Ingresa el teléfono asociado.', input: 'tel', showCancelButton: true });
    if (!res.isConfirmed || !res.value) return;
    try {
      const resp = await fetch(`/api/mascotas/${idMascota}/verificar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telefono_dueno: String(res.value).trim() })
      });
      const datos = await resp.json();
      if (!resp.ok) throw new Error(datos.mensaje);
      mostrarBoletinContacto(datos);
      mostrarVista('boletin-contacto');
    } catch (error) { Swal.fire('Denegado', error.message, 'error'); }
  };

  const abrirPerfilDesdeMapa = async (idMascota) => { await solicitarVerificacionMascota(idMascota); };

  const abrirPerfilPublico = async (entradaMascota) => {
    const mascota = normalizarMascota(entradaMascota);
    if (mascota?.id) { mostrarPerfilPublico(mascota); mostrarVista('perfil-publico'); return; }
    if (typeof entradaMascota === 'string' && entradaMascota.trim()) { await cargarPerfilPublicoPorId(entradaMascota.trim()); }
  };

  window.petmapUI = { mostrarVista, establecerCoordenadas, mostrarPerfilPublico, mostrarPerfilPrivado, mostrarRegistroExitoso, mostrarBoletinContacto, actualizarNavegacionAuth, abrirPerfilDesdeMapa };
  window.abrirPerfilPublico = abrirPerfilPublico;

  botonesVista.forEach((boton) => {
    boton.addEventListener('click', (evento) => {
      if (boton.tagName === 'A') evento.preventDefault();
      mostrarVista(boton.dataset.vista);
    });
  });

  if (formularioMascota) {
    formularioMascota.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (formularioMascota.dataset.enviando === 'true') return;
      const botonGuardar = document.getElementById('btnSubmitMascota');
      const formData = new FormData(formularioMascota);
      const estaPerdida = Boolean(chkEstaPerdida?.checked);
      const latitud = obtenerNumeroNullable(formData.get('latitud'));
      const longitud = obtenerNumeroNullable(formData.get('longitud'));
      const telefono = String(formData.get('telefono_dueno') || '').trim();
      const direccion = String(formData.get('direccion_dueno') || '').trim();

      if (estaPerdida && (latitud == null || longitud == null)) return Swal.fire('Error', 'Marca en el mapa.', 'error');
      if (estaPerdida && (!telefono || !direccion)) return Swal.fire('Error', 'Teléfono y dirección obligatorios.', 'error');

      formularioMascota.dataset.enviando = 'true';
      alternarBotonCarga(botonGuardar, true, 'Guardar Mascota');

      if (!estaPerdida) { formData.delete('latitud'); formData.delete('longitud'); }
      formData.set('telefono_dueno', formData.get('telefono_dueno') ? `${formData.get('lada')} ${formData.get('telefono_dueno')}` : '');
      formData.delete('lada');
      if (latitud != null && longitud != null) { formData.set('latitud', String(latitud)); formData.set('longitud', String(longitud)); }
      formData.set('esta_perdida', String(estaPerdida));
      formData.set('idioma_registro', obtenerIdiomaUsuario());

      try {
        const respuesta = await fetch('/api/mascotas', { method: 'POST', credentials: 'include', body: formData });
        const datos = await respuesta.json();
        if (!respuesta.ok) throw new Error(datos.mensaje);

        formularioMascota.reset();
        sincronizarMapaRegistro();
        Swal.fire({ icon: 'success', title: '¡Guardada!', timer: 1500, showConfirmButton: false });
        mostrarRegistroExitoso(datos);
        mostrarVista('registro-exitoso');
      } catch (error) { Swal.fire('Error', error.message, 'error'); } 
      finally { formularioMascota.dataset.enviando = 'false'; alternarBotonCarga(botonGuardar, false, 'Guardar Mascota'); }
    });
  }

  if (formularioRegistroUsuario) {
    formularioRegistroUsuario.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (formularioRegistroUsuario.dataset.enviando === 'true') return;
      formularioRegistroUsuario.dataset.enviando = 'true';
      const botonRegistro = document.getElementById('btnSubmitRegistroUsuario');
      alternarBotonCarga(botonRegistro, true, 'Registrarme');
      try {
        const respuesta = await fetch('/api/auth/registro', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: formularioRegistroUsuario.nombre.value, correo: formularioRegistroUsuario.correo.value, contrasena: formularioRegistroUsuario.contrasena.value }),
        });
        const datos = await respuesta.json();
        if (!respuesta.ok) throw new Error(datos.mensaje);
        formularioRegistroUsuario.reset();
        Swal.fire({ icon: 'success', title: '¡Cuenta Creada!' });
        mostrarVista('login');
      } catch (error) { Swal.fire('Error', error.message, 'error'); } 
      finally { formularioRegistroUsuario.dataset.enviando = 'false'; alternarBotonCarga(botonRegistro, false, 'Registrarme'); }
    });
  }

  if (formularioLogin) {
    formularioLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (formularioLogin.dataset.enviando === 'true') return;
      formularioLogin.dataset.enviando = 'true';
      const botonLogin = document.getElementById('btnSubmitLogin');
      alternarBotonCarga(botonLogin, true, 'Iniciar Sesión');
      try {
        const respuesta = await fetch('/api/auth/login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ correo: formularioLogin.correo.value, contrasena: formularioLogin.contrasena.value }),
        });
        const datos = await respuesta.json();
        if (!respuesta.ok) throw new Error(datos.mensaje);

        estadoAplicacion.usuario = datos.usuario;
        actualizarNavegacionAuth();
        formularioLogin.reset();
        Swal.fire({ icon: 'success', title: 'Bienvenido', timer: 1500, showConfirmButton: false });
        
        if (['admin', 'superadmin'].includes(datos.usuario?.rol)) mostrarVista('admin');
        else mostrarVista('mis-mascotas');
      } catch (error) { Swal.fire('Acceso fallido', error.message, 'error'); } 
      finally { formularioLogin.dataset.enviando = 'false'; alternarBotonCarga(botonLogin, false, 'Iniciar Sesión'); }
    });
  }

  if (contenedorMisMascotas) {
    contenedorMisMascotas.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-accion]');
      if (!btn) return;
      const id = btn.dataset.idMascota;
      if (btn.dataset.accion === 'perfil') mostrarPerfilPrivado(JSON.parse(decodeURIComponent(btn.dataset.mascota))), mostrarVista('perfil-privado');
      if (btn.dataset.accion === 'eliminar') borrarMascotaAdmin(id);
      if (btn.dataset.accion === 'cambiar-estado') procesarCambioEstado({ id, telefono_dueno: btn.dataset.telefonoDueno }, btn.dataset.estadoActual === 'true', () => cargarMisMascotas());
    });
  }

  if (chkEstaPerdida) chkEstaPerdida.addEventListener('change', sincronizarMapaRegistro);
  const filtroAdminMascotas = document.getElementById('filtroAdminMascotas');
  if (filtroAdminMascotas) {
    filtroAdminMascotas.addEventListener('keyup', (e) => {
      const texto = e.target.value.toLowerCase();
      const filas = tablaAdminMascotas?.getElementsByTagName('tr') || [];
      Array.from(filas).forEach((fila) => {
        fila.style.display = (fila.cells[0]?.textContent.toLowerCase() || '').includes(texto) ? '' : 'none';
      });
    });
  }

  const formCredencialInvitado = document.getElementById('formCredencialInvitado');
  if (formCredencialInvitado) {
    formCredencialInvitado.addEventListener('submit', (e) => {
      e.preventDefault();
      const archivoFoto = document.getElementById('invFoto')?.files?.[0] || null;
      const mostrarCredencial = (fotoUrl = '') => {
        const mascotaInvitada = {
          nombre: document.getElementById('invNombre')?.value, especie: document.getElementById('invEspecie')?.value, raza: document.getElementById('invRaza')?.value,
          fecha_nacimiento: document.getElementById('invFechaNac')?.value, dueno: document.getElementById('invDueno')?.value, telefono: document.getElementById('invTelefono')?.value, foto_url: fotoUrl,
        };
        bootstrap.Modal.getInstance(document.getElementById('modalCredencialInvitado'))?.hide();
        formCredencialInvitado.reset();
        imprimirCredencialMascota(mascotaInvitada, true);
      };
      if (archivoFoto) {
        const lector = new FileReader();
        lector.onload = () => mostrarCredencial(String(lector.result || ''));
        lector.readAsDataURL(archivoFoto);
      } else mostrarCredencial();
    });
  }

  if (btnCerrarSesionGlobal) {
    btnCerrarSesionGlobal.addEventListener('click', async () => {
      try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch(e) {}
      estadoAplicacion.usuario = null;
      actualizarNavegacionAuth();
      resetearFormularioAdminUsuario();
      await Swal.fire({ icon: 'success', title: 'Sesión cerrada', timer: 900, showConfirmButton: false });
      mostrarVista('inicio');
    });
  }

  // Flujo Inicial
  verificarSesionBackend().then(() => {
    const rutaIniciada = window.location.pathname.split('/').filter(Boolean)[0];
    if (perfilPublicoInicial) {
      cargarPerfilPublicoPorId(perfilPublicoInicial);
    } else if (rutaIniciada) {
      mostrarVista(rutaIniciada, false);
    } else {
      mostrarVista('inicio', false);
    }
  });

});
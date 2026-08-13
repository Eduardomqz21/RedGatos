'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const DOM = {
    formMascota: document.getElementById('formularioMascota'),
    formRegistro: document.getElementById('formularioRegistroUsuario'),
    formLogin: document.getElementById('formularioLogin'),
    formRecuperar: document.getElementById('formularioRecuperar'),
    formReset: document.getElementById('formularioReset'),
    formMemorial: document.getElementById('formularioMemorial'),
    btnNavLogin: document.getElementById('btnNavLogin'),
    menuLogueado: document.getElementById('menuUsuarioLogueado'),
    txtNombre: document.getElementById('textoNombreUsuario'),
    itemAdmin: document.getElementById('itemMenuAdmin'),
    btnCerrarSesion: document.getElementById('btnCerrarSesionGlobal'),
    formAdminUsuario: document.getElementById('formularioAdminUsuario'),
    tablaAdminUsuarios: document.getElementById('tablaAdminUsuarios'),
    btnGuardarAdmin: document.getElementById('botonGuardarUsuarioAdmin'),
    btnCancelarEdicion: document.getElementById('btnCancelarEdicionUsuario'),
    contenedorMisMascotas: document.getElementById('contenedorMisMascotas'),
    espacioMemorial: document.getElementById('espacioMemorialMap'),
    botonesVista: document.querySelectorAll('[data-vista]'),
    tablaAdminMascotas: document.getElementById('tablaAdminMascotas'),
    colFormularioRegistro: document.getElementById('colFormularioRegistro'),
    contenedorMapaRegistro: document.getElementById('contenedorMapaRegistro'),
    chkEstaPerdida: document.getElementById('esta_perdida'),
    modalMapaEstado: document.getElementById('modalMapaEstado'),
    btnConfirmarPerdida: document.getElementById('btnConfirmarPerdida')
  };

  const estado = {
    usuario: null,
    mascotaActual: null,
    qrPerfilActual: '',
    usuarioAdminEditandoId: null,
  };

  const perfilInicial = new URLSearchParams(window.location.search).get('perfil');
  const tokenResetUrl = new URLSearchParams(window.location.search).get('token');

  const escaparHtml = (texto) => String(texto || '').replace(/[&<>"']/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match])).replace(/\n/g, '<br>');
  const obtenerNum = (valor) => (valor === '' || valor == null) ? null : (Number.isNaN(Number(valor)) ? null : Number(valor));

  const alternarBotonCarga = (boton, cargando, texto = 'Procesando...') => {
    if (!boton) return;
    if (cargando) {
      boton.dataset.textoOriginal = boton.textContent;
      boton.disabled = true;
      boton.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${texto}`;
    } else {
      boton.disabled = false;
      boton.textContent = boton.dataset.textoOriginal || texto;
    }
  };

  /* =================================================================================
     VALIDACIONES INLINE Y GESTIÓN DE ERRORES (AUTENTICACIÓN)
  ================================================================================= */
  const svgOjoCerrado = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
  const svgOjoAbierto = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;

  const alternarVisibilidadPass = (input, btn) => {
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    btn.innerHTML = isPassword ? svgOjoCerrado : svgOjoAbierto;
    btn.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
  };

  const configurarTogglesPass = () => {
    document.querySelectorAll('.btn-toggle-password').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const input = e.currentTarget.parentElement.querySelector('input');
        if(input) alternarVisibilidadPass(input, e.currentTarget);
      });
    });
  };

  const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const reglasPass = [
    { rule: 'len', exp: /.{8,}/ },
    { rule: 'upper', exp: /[A-Z]/ },
    { rule: 'lower', exp: /[a-z]/ },
    { rule: 'num', exp: /\d/ },
    { rule: 'spec', exp: /[@$!%*?&]/ }
  ];

  const marcarInput = (input, valido, mensaje) => {
    if (valido) {
      input.classList.remove('is-invalid');
      input.classList.add('is-valid');
      input.removeAttribute('aria-invalid');
    } else {
      input.classList.remove('is-valid');
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
      const errorDiv = input.parentElement.querySelector('.invalid-feedback');
      if (errorDiv && mensaje) errorDiv.textContent = mensaje;
    }
  };

  const limpiarValidaciones = (form) => {
    form.querySelectorAll('.is-invalid, .is-valid').forEach(el => {
      el.classList.remove('is-invalid', 'is-valid');
      el.removeAttribute('aria-invalid');
    });
  };

  const mostrarAlertaGlobalFormulario = (contenedorId, mensaje, tipo = 'error') => {
    const alerta = document.getElementById(contenedorId);
    if (!alerta) return;
    alerta.className = `alerta-formulario ${tipo === 'exito' ? 'exito' : ''}`;
    alerta.textContent = mensaje;
    alerta.classList.remove('d-none');
  };

  const ocultarAlertaGlobalFormulario = (contenedorId) => {
    const alerta = document.getElementById(contenedorId);
    if (alerta) alerta.classList.add('d-none');
  };

  const validarRequisitosPassword = (input, reqContainerId) => {
    const val = input.value;
    const reqList = document.getElementById(reqContainerId);
    if(!reqList) return false;
    
    let todasValidas = true;
    reglasPass.forEach(r => {
      const item = reqList.querySelector(`[data-rule="${r.rule}"]`);
      if(!item) return;
      const cumple = r.exp.test(val);
      if(cumple) {
        item.className = 'req-item valid';
        item.innerHTML = `<span class="req-icon">✓</span> ${item.textContent.substring(2)}`;
      } else {
        item.className = `req-item ${val.length > 0 ? 'invalid' : 'neutral'}`;
        item.innerHTML = `<span class="req-icon">✕</span> ${item.textContent.substring(2)}`;
        todasValidas = false;
      }
    });
    return todasValidas;
  };

  const validarConfirmacionPassword = (passInput, confInput, msgDivId) => {
    const msg = document.getElementById(msgDivId);
    if (confInput.value.length === 0) {
      confInput.classList.remove('is-valid', 'is-invalid');
      if(msg) msg.textContent = '';
      return false;
    }
    const coinciden = passInput.value === confInput.value;
    if (coinciden) {
      confInput.classList.remove('is-invalid');
      confInput.classList.add('is-valid');
      if(msg) { msg.className = 'invalid-feedback d-block text-success'; msg.textContent = '✓ Las contraseñas coinciden'; }
    } else {
      confInput.classList.remove('is-valid');
      confInput.classList.add('is-invalid');
      if(msg) { msg.className = 'invalid-feedback d-block'; msg.textContent = '✕ Las contraseñas no coinciden'; }
    }
    return coinciden;
  };

  const adjuntarEventosFormularioAuth = () => {
    // Registro
    const regPass = document.getElementById('registroContrasena');
    const regConf = document.getElementById('registroConfirmar');
    if (regPass) {
      regPass.addEventListener('input', () => {
        const valida = validarRequisitosPassword(regPass, 'req-registro');
        regConf.disabled = !valida;
        if(regConf.value) validarConfirmacionPassword(regPass, regConf, 'msgConfirmacion');
      });
    }
    if (regConf) {
      regConf.addEventListener('input', () => validarConfirmacionPassword(regPass, regConf, 'msgConfirmacion'));
    }

    // Reset
    const resetPass = document.getElementById('resetContrasena');
    const resetConf = document.getElementById('resetConfirmar');
    if (resetPass) {
      resetPass.addEventListener('input', () => {
        const valida = validarRequisitosPassword(resetPass, 'req-reset');
        resetConf.disabled = !valida;
        if(resetConf.value) validarConfirmacionPassword(resetPass, resetConf, 'msgConfirmacionReset');
      });
    }
    if (resetConf) {
      resetConf.addEventListener('input', () => validarConfirmacionPassword(resetPass, resetConf, 'msgConfirmacionReset'));
    }
    
    // Configurar ojitos
    configurarTogglesPass();
  };
  
  adjuntarEventosFormularioAuth();

  /* =================================================================================
     SISTEMA PRINCIPAL (Mascotas, UX de vistas, Redirecciones)
  ================================================================================= */
  const generarCURM = (nombre, especie, fecha) => {
    const f = fecha ? new Date(fecha) : new Date();
    const valida = Number.isNaN(f.getTime()) ? new Date() : f;
    const ddmmyy = `${String(valida.getDate()).padStart(2, '0')}${String(valida.getMonth() + 1).padStart(2, '0')}${String(valida.getFullYear()).substring(2, 4)}`;
    return `${String(especie || 'X').charAt(0).toUpperCase()}-${String(nombre || 'XX').substring(0, 2).toUpperCase()}-${ddmmyy}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
  };

  const imprimirPlantilla = (html) => {
    const zona = document.getElementById('zona-impresion');
    if (!zona) return;
    zona.innerHTML = html;
    
    const imagenes = Array.from(zona.getElementsByTagName('img'));
    if (imagenes.length === 0) return window.print();

    let cargadas = 0;
    const intentar = () => { if (++cargadas === imagenes.length) setTimeout(() => window.print(), 100); };
    imagenes.forEach(img => { if (img.complete) intentar(); else { img.onload = intentar; img.onerror = intentar; } });
  };
  window.addEventListener('afterprint', () => { document.getElementById('zona-impresion').innerHTML = ''; });

  const descargarUrl = (url, nombre) => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url; a.download = nombre; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  };

  const imprimirCredencialMascota = (m) => {
    const curm = generarCURM(m.nombre, m.especie, m.fecha_nacimiento);
    const fechaLimpia = m.fecha_nacimiento ? m.fecha_nacimiento.split('T')[0] : 'Desconocida';
    const nombreDueno = estado.usuario ? estado.usuario.nombre : 'Dueño';

    imprimirPlantilla(`
      <div class="credencial-wrapper">
        <div class="credencial-bg-huellas"></div>
        <div class="credencial-contenido">
          <img src="${m.foto_url ? escaparHtml(m.foto_url) : 'https://via.placeholder.com/150?text=Foto'}" class="credencial-foto" alt="Foto">
          <div class="credencial-datos">
            <div class="credencial-titulo">${escaparHtml(m.nombre)}</div>
            <div class="credencial-item"><strong>ESPECIE:</strong> ${escaparHtml(m.especie)}</div>
            <div class="credencial-item"><strong>RAZA:</strong> ${escaparHtml(m.raza || 'Mestizo')}</div>
            <div class="credencial-item"><strong>NACIMIENTO:</strong> ${escaparHtml(fechaLimpia)}</div>
            <div class="credencial-item"><strong>CURM:</strong> ${curm}</div>
            <div class="credencial-item"><strong>DUEÑO:</strong> ${escaparHtml(nombreDueno)}</div>
            <div class="credencial-item"><strong>TEL:</strong> ${escaparHtml(m.telefono_dueno || 'Sin registrar')}</div>
            <div class="credencial-barcode">*${curm}*</div>
          </div>
        </div>
      </div>
    `);
  };

  const verificarSesion = async () => {
    try {
      const resp = await fetch('/api/auth/me', { credentials: 'include' });
      estado.usuario = resp.ok ? (await resp.json()).usuario : null;
    } catch { estado.usuario = null; }
    const auth = !!estado.usuario;
    DOM.btnNavLogin?.classList.toggle('d-none', auth);
    DOM.menuLogueado?.classList.toggle('d-none', !auth);
    if (DOM.txtNombre) DOM.txtNombre.textContent = estado.usuario?.nombre || 'Mi Cuenta';
    DOM.itemAdmin?.classList.toggle('d-none', !(auth && ['admin', 'superadmin'].includes(estado.usuario.rol)));
  };

  const redirigirLogin = () => { 
    estado.usuario = null; 
    DOM.btnNavLogin?.classList.remove('d-none');
    DOM.menuLogueado?.classList.add('d-none');
    if (DOM.txtNombre) DOM.txtNombre.textContent = 'Mi Cuenta';
    DOM.itemAdmin?.classList.add('d-none');
    mostrarVista('login'); 
  };

  const procesarPeticion = async (url, opciones = {}, callback) => {
    try {
      opciones.credentials = opciones.credentials || 'include';
      const resp = await fetch(url, opciones);
      const datos = await resp.json();
      if (!resp.ok) {
        if ([401, 403].includes(resp.status)) return redirigirLogin();
        throw new Error(datos.mensaje || 'Error en la petición');
      }
      if (callback) callback(datos);
    } catch (e) { 
      Swal.fire('Error', e.message, 'error'); 
    }
  };

  // Función Fetch especializada para AUTH, no levanta SweetAlerts automáticos.
  const authFetch = async (url, body, btn, cargandoTexto) => {
    alternarBotonCarga(btn, true, cargandoTexto);
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await resp.json();
      return { ok: resp.ok, status: resp.status, data };
    } catch (error) {
      return { ok: false, status: 500, data: { mensaje: 'Ocurrió un error inesperado al conectar con el servidor.' } };
    } finally {
      alternarBotonCarga(btn, false);
    }
  };

  const mostrarVista = (vista, empujar = true) => {
    const collapse = document.getElementById('navbarContent');
    if (collapse?.classList.contains('show')) bootstrap.Collapse.getInstance(collapse)?.hide();

    const seguras = ['mis-mascotas', 'admin', 'registro-exitoso', 'perfil-privado', 'boletin-contacto', 'registro'];
    if (seguras.includes(vista) && !estado.usuario) return redirigirLogin();

    if ((vista === 'perfil-privado' || vista === 'registro-exitoso') && !estado.mascotaActual) {
      return mostrarVista('mis-mascotas', false);
    }

    document.querySelectorAll('.estado-vista').forEach(s => s.classList.remove('activa'));
    const sec = document.getElementById(`vista-${vista}`) || document.getElementById('vista-inicio');
    sec.classList.add('activa');

    DOM.botonesVista.forEach(b => { if (!b.classList.contains('dropdown-item')) b.classList.toggle('activa', b.dataset.vista === vista); });

    if (empujar && window.location.pathname.replace(/^\/+/, '') !== vista) {
      window.history.pushState({ vista }, '', `/${vista === 'inicio' ? '' : vista}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Limpiezas preventivas al cambiar de vista
    ocultarAlertaGlobalFormulario('loginAlerta');
    ocultarAlertaGlobalFormulario('registroAlerta');
    ocultarAlertaGlobalFormulario('recuperarAlerta');
    ocultarAlertaGlobalFormulario('resetAlerta');

    setTimeout(() => {
      if (vista === 'registro') sincronizarMapaRegistro();
      if (vista === 'busqueda' && window.petmapMapas) {
        window.petmapMapas.inicializarMapaBusqueda();
        window.petmapMapas.cargarMascotasPerdidas();
      }
    }, 300);

    if (vista === 'admin') { cargarMascotasAdmin(); cargarUsuariosAdmin(); cargarMemorialAdmin(); }
    if (vista === 'mis-mascotas') cargarMisMascotas();
    if (vista === 'memorial') cargarMemoriales();
  };

  DOM.botonesVista.forEach(boton => {
    boton.addEventListener('click', (e) => {
      e.preventDefault();
      mostrarVista(boton.dataset.vista);
    });
  });

  window.addEventListener('popstate', (e) => {
    let ruta = e.state?.vista || window.location.pathname.replace(/^\/+/, '');
    if (ruta === 'index.html' || ruta === '') ruta = 'inicio';
    // No perder token si está en url
    if(tokenResetUrl && ruta === 'inicio') ruta = 'reset-password';
    mostrarVista(ruta, false);
  });

  // Delegación de eventos global
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-borrar-mascota')) {
      window.borrarMascotaAdmin(e.target.dataset.id);
    } else if (e.target.classList.contains('btn-borrar-usuario')) {
      window.eliminarUsuario(e.target.dataset.id);
    } else if (e.target.classList.contains('btn-borrar-memorial')) {
      window.borrarMemorialAdmin(e.target.dataset.id);
    } else if (e.target.classList.contains('btn-abrir-perfil')) {
      window.petmapUI.abrirPrivado(e.target.dataset.mascota);
    } else if (e.target.classList.contains('btn-preparar-estado')) {
      const t = e.target;
      window.petmapUI.prepararEstado(t.dataset.id, t.dataset.perdida, t.dataset.tel, t.dataset.dir);
    } else if (e.target.classList.contains('btn-abrir-publico')) {
      window.abrirPerfilPublico(decodeURIComponent(e.target.dataset.mascota));
    }
  });

  const sincronizarMapaRegistro = () => {
    if (!DOM.contenedorMapaRegistro || !DOM.chkEstaPerdida || !DOM.colFormularioRegistro) return;
    if (DOM.chkEstaPerdida.checked) {
      DOM.contenedorMapaRegistro.classList.remove('d-none');
      DOM.colFormularioRegistro.className = 'col-12 col-xl-5 transicion-panel';
      DOM.contenedorMapaRegistro.className = 'col-12 col-xl-7 transicion-panel slide-in-right';
      setTimeout(() => window.petmapMapas?.inicializarMapaRegistro?.(), 450);
    } else {
      DOM.colFormularioRegistro.className = 'col-12 col-lg-8 col-xl-6 mx-auto transicion-panel';
      DOM.contenedorMapaRegistro.className = 'd-none transicion-panel';
      window.petmapMapas?.limpiarMapaRegistro?.();
    }
  };

  /* =================================================================================
     MEMORIAL Y MASCOTAS (Lógica Mantenida Exactamente Igual)
  ================================================================================= */
  const encenderVeladora = async (id, btn) => {
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      btn.innerHTML = 'Encendiendo...';
      const resp = await fetch(`/api/memorial/${id}/veladora`, { method: 'POST', credentials: 'include' });
      if (!resp.ok) throw new Error();
      const d = await resp.json();
      document.getElementById('modalMemContador').textContent = d.veladoras;
      btn.innerHTML = 'Veladora Encendida';
      btn.classList.add('veladora-activa');
      const rect = btn.getBoundingClientRect();
      const chispa = document.createElement('div');
      chispa.className = 'chispa-animacion';
      chispa.style.left = `${rect.left + rect.width / 2}px`;
      chispa.style.top = `${rect.top}px`;
      document.body.appendChild(chispa);
      setTimeout(() => chispa.remove(), 1000);
    } catch (e) {
      btn.innerHTML = 'Intentar de nuevo';
      btn.disabled = false;
    }
  };

  const cargarMemoriales = () => procesarPeticion('/api/memorial', {}, (d) => {
    if (!DOM.espacioMemorial) return;
    DOM.espacioMemorial.innerHTML = '';
    d.memoriales.forEach(m => {
      const size = Math.floor(Math.random() * 50) + 70;
      const top = Math.random() * 80;
      const left = Math.random() * 85;
      const delay = Math.random() * 5;
      const img = document.createElement('img');
      img.src = m.foto_url;
      img.className = 'foto-flotante';
      img.style.width = `${size}px`;
      img.style.height = `${size}px`;
      img.style.top = `${top}%`;
      img.style.left = `${left}%`;
      img.style.animationDelay = `${delay}s`;
      img.alt = escaparHtml(m.nombre);
      img.onclick = () => {
        document.getElementById('modalMemFoto').src = m.foto_url;
        document.getElementById('modalMemNombre').textContent = m.nombre;
        document.getElementById('modalMemFechas').textContent = `Partió el ${m.fecha_fallecimiento ? m.fecha_fallecimiento.split('T')[0] : ''}`;
        document.getElementById('modalMemMensaje').textContent = `"${m.mensaje}"`;
        document.getElementById('modalMemContador').textContent = m.contador_veladoras;
        const btn = document.getElementById('btnEncenderVeladora');
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.className = 'btn btn-veladora fs-5 w-100 mb-2'; 
        newBtn.innerHTML = 'Encender veladora';
        newBtn.disabled = false;
        newBtn.classList.remove('veladora-activa');
        newBtn.onclick = () => encenderVeladora(m.id, newBtn);
        new bootstrap.Modal(document.getElementById('modalMemorialInfo')).show();
      };
      DOM.espacioMemorial.appendChild(img);
    });
  });

  DOM.formMemorial?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitMemorial');
    alternarBotonCarga(btn, true, 'Guardar Homenaje');
    const formData = new FormData(DOM.formMemorial);
    procesarPeticion('/api/memorial', { method: 'POST', body: formData }, (d) => {
      DOM.formMemorial.reset();
      bootstrap.Modal.getInstance(document.getElementById('modalCrearMemorial'))?.hide();
      Swal.fire('Homenaje Creado', 'Tu mascota ahora descansa aquí.', 'success');
      cargarMemoriales();
    });
    alternarBotonCarga(btn, false);
  });

  const cargarMisMascotas = () => procesarPeticion('/api/mascotas/mis-mascotas', { credentials: 'include' }, (datos) => {
    DOM.contenedorMisMascotas.innerHTML = datos.mascotas.length === 0 ? '<div class="col-12 text-center p-5 bg-white rounded-4 border">No tienes mascotas registradas.</div>' : '';
    const frag = document.createDocumentFragment();
    datos.mascotas.forEach(m => {
      const div = document.createElement('div');
      div.className = 'col-12 col-md-6 col-xl-4';
      div.innerHTML = `
        <div class="tarjeta-suave p-4 h-100 d-flex flex-column gap-3 shadow-sm border-0">
          <div class="d-flex justify-content-between">
            <h3 class="h5 fw-bold mb-0">${escaparHtml(m.nombre)} <small class="text-muted d-block fw-normal fs-6">${escaparHtml(m.especie)}</small></h3>
            <span class="badge ${m.esta_perdida ? 'bg-danger' : 'bg-success'}">${m.esta_perdida ? 'Perdida' : 'A Salvo'}</span>
          </div>
          <p class="text-muted small mb-0 flex-grow-1">${escaparHtml(m.descripcion || 'Sin descripción')}</p>
          <div class="d-flex gap-2 mt-3 pt-3 border-top">
            <button class="btn btn-sm btn-outline-primary flex-grow-1 fw-bold btn-abrir-perfil" data-mascota="${encodeURIComponent(JSON.stringify(m))}">Perfil / ID</button>
            <button class="btn btn-sm btn-outline-dark flex-grow-1 fw-bold btn-preparar-estado" data-id="${m.id}" data-perdida="${m.esta_perdida}" data-tel="${escaparHtml(m.telefono_dueno)}" data-dir="${escaparHtml(m.direccion_dueno)}">Estado</button>
            <button class="btn btn-sm btn-outline-danger fw-bold btn-borrar-mascota" data-id="${m.id}">Borrar</button>
          </div>
        </div>`;
      frag.appendChild(div);
    });
    DOM.contenedorMisMascotas.appendChild(frag);
  });

  // Bloques de Admin (se omiten refactorizaciones innecesarias para mantener funcionalidad original intacta)
  const cargarMascotasAdmin = async () => {
    try {
      const resp = await fetch('/api/mascotas/admin/todas', { credentials: 'include' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const datos = await resp.json();
      const tabla = document.getElementById('tablaAdminMascotas');
      if (!tabla) return;
      tabla.innerHTML = '';
      if (!datos.mascotas || datos.mascotas.length === 0) {
        tabla.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No hay mascotas registradas.</td></tr>';
        return;
      }
      datos.mascotas.forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="fw-bold">${escaparHtml(m.nombre)}</td><td>${escaparHtml(m.especie)}</td><td><span class="badge ${m.esta_perdida ? 'bg-danger' : 'bg-success'}">${m.esta_perdida ? 'Perdida' : 'A Salvo'}</span></td><td>${escaparHtml(m.telefono_dueno || 'Sin contacto')}</td><td class="text-end"><button class="btn btn-outline-danger btn-sm btn-borrar-mascota" data-id="${m.id}">Eliminar</button></td>`;
        tabla.appendChild(tr);
      });
    } catch (e) { Swal.fire('Error', 'No se pudieron cargar las mascotas.', 'error'); }
  };

  const cargarUsuariosAdmin = async () => {
    try {
      const resp = await fetch('/api/usuarios?limit=100', { credentials: 'include' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const datos = await resp.json();
      if (!DOM.tablaAdminUsuarios) return;
      DOM.tablaAdminUsuarios.innerHTML = '';
      if (!datos.usuarios || datos.usuarios.length === 0) {
        DOM.tablaAdminUsuarios.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No hay usuarios.</td></tr>';
        return;
      }
      datos.usuarios.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="fw-bold">${escaparHtml(u.nombre)}</td><td>${escaparHtml(u.correo)}</td><td><span class="badge ${u.rol === 'superadmin' ? 'bg-dark' : 'bg-primary'}">${escaparHtml(u.rol)}</span></td><td class="text-end"><button class="btn btn-outline-danger btn-sm btn-borrar-usuario" data-id="${u.id}">Eliminar</button></td>`;
        DOM.tablaAdminUsuarios.appendChild(tr);
      });
    } catch (e) { Swal.fire('Error', 'No se pudieron cargar los usuarios.', 'error'); }
  };

  const cargarMemorialAdmin = async () => {
    try {
      const resp = await fetch('/api/memorial', { credentials: 'include' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const datos = await resp.json();
      const tabla = document.getElementById('tablaAdminMemorial');
      if (!tabla) return;
      tabla.innerHTML = '';
      if (!datos.memoriales || datos.memoriales.length === 0) {
        tabla.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No hay homenajes registrados.</td></tr>';
        return;
      }
      datos.memoriales.forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="fw-bold">${escaparHtml(m.nombre)}</td><td>${escaparHtml(m.especie)}</td><td>${m.fecha_fallecimiento ? m.fecha_fallecimiento.split('T')[0] : ''}</td><td><small class="text-muted d-inline-block text-truncate" style="max-width: 150px;">${escaparHtml(m.mensaje)}</small></td><td class="text-end"><button class="btn btn-outline-danger btn-sm btn-borrar-memorial" data-id="${m.id}">Eliminar</button></td>`;
        tabla.appendChild(tr);
      });
    } catch (e) { Swal.fire('Error', 'No se pudieron cargar los homenajes.', 'error'); }
  };

  const aplicarFiltroTabla = (inputId, tablaId) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('keyup', (e) => {
      const texto = e.target.value.toLowerCase();
      const filas = document.getElementById(tablaId)?.getElementsByTagName('tr') || [];
      Array.from(filas).forEach(fila => {
        fila.style.display = fila.textContent.toLowerCase().includes(texto) ? '' : 'none';
      });
    });
  };
  aplicarFiltroTabla('filtroAdminUsuarios', 'tablaAdminUsuarios');
  aplicarFiltroTabla('filtroAdminMascotas', 'tablaAdminMascotas');
  aplicarFiltroTabla('filtroAdminMemorial', 'tablaAdminMemorial');

  window.borrarMascotaAdmin = async (id) => {
    const confirm = await Swal.fire({ title: '¿Borrar esta mascota?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, borrar', cancelButtonText: 'Cancelar' });
    if (confirm.isConfirmed) {
      try {
        const resp = await fetch(`/api/mascotas/${id}`, { method: 'DELETE', credentials: 'include' });
        if (!resp.ok) throw new Error('No se pudo borrar la mascota');
        Swal.fire('Eliminada', '', 'success');
        if(document.getElementById('vista-admin').classList.contains('activa')) cargarMascotasAdmin();
        if(document.getElementById('vista-mis-mascotas').classList.contains('activa')) cargarMisMascotas();
      } catch (e) { Swal.fire('Error', e.message, 'error'); }
    }
  };

  window.eliminarUsuario = async (id) => {
    const confirm = await Swal.fire({ title: '¿Eliminar usuario y datos?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, borrar', cancelButtonText: 'Cancelar' });
    if (confirm.isConfirmed) {
      try {
        const resp = await fetch(`/api/usuarios/${id}`, { method: 'DELETE', credentials: 'include' });
        if (!resp.ok) throw new Error('No se pudo borrar el usuario');
        Swal.fire('Eliminado', '', 'success');
        cargarUsuariosAdmin(); cargarMascotasAdmin();
      } catch (e) { Swal.fire('Error', e.message, 'error'); }
    }
  };

  window.borrarMemorialAdmin = async (id) => {
    const confirm = await Swal.fire({ title: '¿Borrar permanentemente?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, borrar', cancelButtonText: 'Cancelar' });
    if (confirm.isConfirmed) {
      try {
        const resp = await fetch(`/api/memorial/${id}`, { method: 'DELETE', credentials: 'include' }); 
        if (!resp.ok) throw new Error('No se pudo borrar el homenaje');
        Swal.fire('Eliminado', '', 'success');
        cargarMemorialAdmin(); cargarMemoriales();
      } catch (e) { Swal.fire('Error', e.message, 'error'); }
    }
  };

  /* =================================================================================
     EVENTOS DE AUTENTICACIÓN (LOGIN, REGISTRO, RECOVERY) MEJORADOS Y SIN SWAL
  ================================================================================= */
  
  DOM.formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarAlertaGlobalFormulario('loginAlerta');
    limpiarValidaciones(DOM.formLogin);

    const correo = DOM.formLogin.correo;
    const contrasena = DOM.formLogin.contrasena;
    let tieneError = false;

    if (!correo.value || !regexCorreo.test(correo.value)) {
      marcarInput(correo, false, 'Ingresa un correo electrónico válido.');
      tieneError = true;
    } else { marcarInput(correo, true); }

    if (!contrasena.value) {
      marcarInput(contrasena, false, 'Ingresa tu contraseña.');
      tieneError = true;
    } else { marcarInput(contrasena, true); }

    if (tieneError) return;

    const btn = document.getElementById('btnSubmitLogin');
    const response = await authFetch('/api/auth/login', { correo: correo.value, contrasena: contrasena.value }, btn, 'Verificando...');

    if (!response.ok) {
      if (response.status === 401) {
        mostrarAlertaGlobalFormulario('loginAlerta', 'El correo o la contraseña no son correctos.');
        // No borramos los inputs, permitimos que el usuario reintente rápidamente.
        marcarInput(correo, false, null);
        marcarInput(contrasena, false, null);
      } else if (response.status === 429) {
        mostrarAlertaGlobalFormulario('loginAlerta', 'Demasiados intentos fallidos. Intenta más tarde.');
      } else {
        mostrarAlertaGlobalFormulario('loginAlerta', response.data.mensaje || 'Error interno al intentar iniciar sesión.');
      }
      return;
    }

    // Login Exitoso
    estado.usuario = response.data.usuario; 
    verificarSesion(); 
    DOM.formLogin.reset();
    limpiarValidaciones(DOM.formLogin);
    mostrarVista(['admin', 'superadmin'].includes(response.data.usuario.rol) ? 'admin' : 'mis-mascotas');
  });

  DOM.btnCerrarSesion?.addEventListener('click', async () => {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch(e) {}
    redirigirLogin();
    Swal.fire({ title: 'Sesión Cerrada', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
  });

  DOM.formRegistro?.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarAlertaGlobalFormulario('registroAlerta');
    limpiarValidaciones(DOM.formRegistro);

    const form = DOM.formRegistro;
    let tieneError = false;

    if (!form.nombre.value || form.nombre.value.length < 2) {
      marcarInput(form.nombre, false, 'Ingresa tu nombre completo.');
      tieneError = true;
    } else { marcarInput(form.nombre, true); }

    if (!form.correo.value || !regexCorreo.test(form.correo.value)) {
      marcarInput(form.correo, false, 'Ingresa un correo electrónico válido.');
      tieneError = true;
    } else { marcarInput(form.correo, true); }

    const passValida = validarRequisitosPassword(form.contrasena, 'req-registro');
    if (!passValida) {
      marcarInput(form.contrasena, false, null);
      tieneError = true;
    } else { marcarInput(form.contrasena, true); }

    const confValida = validarConfirmacionPassword(form.contrasena, form.confirmar, 'msgConfirmacion');
    if (!confValida) {
      marcarInput(form.confirmar, false, null); // el div ya se encarga del msg
      tieneError = true;
    }

    if (tieneError) return;

    const btn = document.getElementById('btnSubmitRegistroUsuario');
    const response = await authFetch('/api/auth/registro', {
      nombre: form.nombre.value,
      correo: form.correo.value,
      contrasena: form.contrasena.value
    }, btn, 'Creando cuenta...');

    if (!response.ok) {
      if (response.status === 409) {
        mostrarAlertaGlobalFormulario('registroAlerta', 'Este correo ya está asociado a otra cuenta.');
        marcarInput(form.correo, false, null);
      } else {
        mostrarAlertaGlobalFormulario('registroAlerta', response.data.mensaje || 'Hubo un error al procesar el registro.');
      }
      return;
    }

    // Registro exitoso, ocultamos formulario y mostramos vista de éxito inline
    document.getElementById('vistaFormularioRegistro').classList.add('d-none');
    document.getElementById('vistaExitoRegistro').classList.remove('d-none');
    DOM.formRegistro.reset();
    limpiarValidaciones(DOM.formRegistro);
    document.querySelectorAll('.req-item').forEach(el => el.className = 'req-item neutral');
  });

  DOM.formRecuperar?.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarAlertaGlobalFormulario('recuperarAlerta');
    limpiarValidaciones(DOM.formRecuperar);

    const correo = DOM.formRecuperar.correo;
    if (!correo.value || !regexCorreo.test(correo.value)) {
      marcarInput(correo, false, 'Ingresa un correo electrónico válido.');
      return;
    }
    marcarInput(correo, true);

    const btn = document.getElementById('btnSubmitRecuperar');
    const response = await authFetch('/api/auth/recuperar', { correo: correo.value }, btn, 'Enviando...');

    if (!response.ok) {
      mostrarAlertaGlobalFormulario('recuperarAlerta', response.data.mensaje || 'No se pudo enviar la solicitud.');
      return;
    }

    mostrarAlertaGlobalFormulario('recuperarAlerta', 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. (Revisa la consola del backend para pruebas)', 'exito');
    DOM.formRecuperar.reset();
  });

  DOM.formReset?.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarAlertaGlobalFormulario('resetAlerta');
    limpiarValidaciones(DOM.formReset);

    const form = DOM.formReset;
    let tieneError = false;

    if(!form.token.value) {
      mostrarAlertaGlobalFormulario('resetAlerta', 'Enlace inválido o caducado.');
      return;
    }

    const passValida = validarRequisitosPassword(form.contrasena, 'req-reset');
    if (!passValida) {
      marcarInput(form.contrasena, false, null);
      tieneError = true;
    } else { marcarInput(form.contrasena, true); }

    const confValida = validarConfirmacionPassword(form.contrasena, form.confirmar, 'msgConfirmacionReset');
    if (!confValida) {
      marcarInput(form.confirmar, false, null);
      tieneError = true;
    }

    if (tieneError) return;

    const btn = document.getElementById('btnSubmitReset');
    const response = await authFetch('/api/auth/resetear', {
      token: form.token.value,
      nuevaContrasena: form.contrasena.value
    }, btn, 'Actualizando...');

    if (!response.ok) {
      mostrarAlertaGlobalFormulario('resetAlerta', response.data.mensaje || 'No se pudo actualizar la contraseña. El enlace pudo expirar.');
      return;
    }

    DOM.formReset.reset();
    limpiarValidaciones(DOM.formReset);
    mostrarVista('login');
    mostrarAlertaGlobalFormulario('loginAlerta', 'Tu contraseña se actualizó correctamente. Ahora puedes iniciar sesión.', 'exito');
    
    // Limpiamos token URL para no atrapar al usuario
    window.history.pushState({}, document.title, "/");
  });

  /* =================================================================================
     EVENTOS DE CREACIÓN DE MASCOTAS
  ================================================================================= */
  DOM.formMascota?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitMascota');
    const formData = new FormData(DOM.formMascota);
    const perdida = DOM.chkEstaPerdida.checked;
    const lat = obtenerNum(formData.get('latitud'));
    const lon = obtenerNum(formData.get('longitud'));

    if (perdida && (lat == null || lon == null)) return Swal.fire('Falta ubicación', 'Por favor, marca en el mapa la zona del extravío.', 'warning');
    if (perdida && (!formData.get('telefono_dueno') || !formData.get('direccion_dueno'))) return Swal.fire('Campos requeridos', 'Teléfono y dirección son obligatorios si está perdida.', 'warning');

    alternarBotonCarga(btn, true, 'Guardando Mascota...');
    if (!perdida) { formData.delete('latitud'); formData.delete('longitud'); }
    formData.set('telefono_dueno', formData.get('telefono_dueno') ? `${formData.get('lada')} ${formData.get('telefono_dueno')}` : '');
    formData.delete('lada');
    formData.set('esta_perdida', String(perdida));

    procesarPeticion('/api/mascotas', { method: 'POST', body: formData }, (d) => {
      DOM.formMascota.reset(); sincronizarMapaRegistro();
      estado.mascotaActual = { ...d.mascota, qr_perfil: d.qr_perfil, url_perfil: d.url_perfil, foto_url: d.foto_url || d.mascota.foto_url }; 
      
      document.getElementById('fotoMascotaRegistroExitoso').src = estado.mascotaActual.foto_url || '';
      document.getElementById('qrMascotaRegistroExitoso').src = d.qr_perfil;
      document.getElementById('btnDescargarQRMascotaRegistroExitoso').onclick = () => descargarUrl(d.qr_perfil, 'qr.png');
      
      document.getElementById('btnIrPerfilMascotaRegistroExitoso').onclick = () => {
        window.petmapUI.abrirPrivado(encodeURIComponent(JSON.stringify(estado.mascotaActual)));
      };
      
      mostrarVista('registro-exitoso');
    });
    alternarBotonCarga(btn, false);
  });

  /* UI COMPARTIDA DE MASCOTAS */
  window.petmapUI = {
    establecerCoordenadas: (lat, lng) => {
      if (document.getElementById('latitud')) document.getElementById('latitud').value = lat;
      if (document.getElementById('longitud')) document.getElementById('longitud').value = lng;
    },
    abrirPrivado: (mEncoded) => {
      const m = JSON.parse(decodeURIComponent(mEncoded));
      estado.mascotaActual = m;
      document.getElementById('nombreMascotaPrivado').textContent = m.nombre;
      document.getElementById('descripcionMascotaPrivado').innerHTML = escaparHtml(m.descripcion || 'Sin descripción');
      
      const foto = document.getElementById('fotoMascotaPrivado');
      foto.src = m.foto_url || '';
      m.foto_url ? foto.classList.remove('d-none') : foto.classList.add('d-none');
      
      document.getElementById('qrMascotaPrivado').src = m.qr_perfil || '';
      document.getElementById('qrMascotaPrivado').classList.remove('d-none');
      document.getElementById('telefonoMascotaPrivado').textContent = m.telefono_dueno || 'Sin Teléfono';
      document.getElementById('direccionMascotaPrivado').textContent = m.direccion_dueno || 'Sin Dirección';
      
      document.getElementById('estadoMascotaPrivado').textContent = `Estado actual: ${m.esta_perdida ? 'Perdida' : 'A Salvo'}`;
      document.getElementById('estadoMascotaPrivado').className = `mini-etiqueta mb-3 fs-6 ${m.esta_perdida ? 'bg-danger text-white' : 'bg-success text-white'}`;
      
      const btnEstado = document.getElementById('btnCambiarEstadoMascota');
      btnEstado.textContent = m.esta_perdida ? 'Marcar como A Salvo' : 'Reportar Extravío';
      btnEstado.className = m.esta_perdida ? 'btn btn-success fw-bold px-4 py-3 rounded-pill' : 'btn btn-warning fw-bold px-4 py-3 rounded-pill';
      btnEstado.onclick = () => window.petmapUI.prepararEstado(m.id, m.esta_perdida, m.telefono_dueno, m.direccion_dueno);
      
      document.getElementById('btnImprimirCredencial').onclick = () => imprimirCredencialMascota(m);
      document.getElementById('btnDescargarQRMascotaPrivada').onclick = () => descargarUrl(m.qr_perfil, 'qr.png');
      
      document.getElementById('btnGenerarCartelBusqueda').onclick = () => {
        imprimirPlantilla(`
          <div class="cartel-impresion">
            <div class="cartel-header">¡SE BUSCA!</div>
            <h1 style="text-align:center;font-size:4rem;margin:10px 0;color:#2e4a45;">${escaparHtml(m.nombre)}</h1>
            <div style="display:flex;gap:20px;margin-top:20px;">
              <div style="flex:1;"><img src="${m.foto_url || ''}" style="width:100%;border-radius:10px;border:4px solid #c94c4c;object-fit:cover;" /></div>
              <div style="flex:1;font-size:1.4rem;line-height:1.6;">
                <p><strong>Especie/Raza:</strong> ${escaparHtml(m.especie)} ${m.raza ? '- ' + escaparHtml(m.raza) : ''}</p>
                <p><strong>Señas particulares:</strong> ${escaparHtml(m.descripcion || '')}</p>
                <div style="background:#fff3f3;padding:15px;border-left:5px solid #c94c4c;margin-top:20px;">
                  <p style="margin:0;color:#c94c4c;font-weight:bold;font-size:1.2rem;">Por favor, si la ves, comunícate al:</p>
                  <p style="margin:5px 0 0 0;font-size:2.2rem;font-weight:900;">Tel. ${escaparHtml(m.telefono_dueno)}</p>
                </div>
              </div>
            </div>
          </div>
        `);
      };
      
      mostrarVista('perfil-privado');
    },
    prepararEstado: (id, esPerdida, tel, dir) => {
      if (esPerdida === 'true' || esPerdida === true) {
        procesarPeticion(`/api/mascotas/${id}/estado`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ esta_perdida: false, telefono_dueno: tel, direccion_dueno: dir }) }, () => { Swal.fire('¡Mascota A Salvo!', '', 'success'); cargarMisMascotas(); if(estado.mascotaActual && estado.mascotaActual.id === id) { estado.mascotaActual.esta_perdida = false; window.petmapUI.abrirPrivado(encodeURIComponent(JSON.stringify(estado.mascotaActual))); } });
      } else {
        const modal = new bootstrap.Modal(DOM.modalMapaEstado);
        DOM.modalMapaEstado.querySelector('#telefonoEstado').value = tel.replace(/\D/g, '').slice(-10);
        DOM.modalMapaEstado.querySelector('#direccionEstado').value = dir;
        modal.show();
        setTimeout(() => window.petmapMapas?.inicializarMapaEstado?.(), 400);
        
        DOM.btnConfirmarPerdida.onclick = () => {
          const lat = obtenerNum(document.getElementById('latitudEstado').value);
          const lon = obtenerNum(document.getElementById('longitudEstado').value);
          const t = DOM.modalMapaEstado.querySelector('#telefonoEstado').value;
          const d = DOM.modalMapaEstado.querySelector('#direccionEstado').value;
          if (!lat || !lon) return Swal.fire('Falta marcar ubicación', 'Toca el mapa para indicar dónde se vio por última vez.', 'warning');
          procesarPeticion(`/api/mascotas/${id}/estado`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ esta_perdida: true, latitud: lat, longitud: lon, telefono_dueno: '+52 ' + t, direccion_dueno: d }) }, () => { modal.hide(); Swal.fire('Alerta enviada', '', 'success'); cargarMisMascotas(); if(estado.mascotaActual && estado.mascotaActual.id === id) { estado.mascotaActual.esta_perdida = true; window.petmapUI.abrirPrivado(encodeURIComponent(JSON.stringify(estado.mascotaActual))); } });
        };
      }
    }
  };

  window.abrirPerfilPublico = (mEncoded) => {
    const m = JSON.parse(mEncoded);
    document.getElementById('nombreMascotaPublico').textContent = m.nombre;
    document.getElementById('descripcionMascotaPublico').innerHTML = escaparHtml(m.descripcion);
    const foto = document.getElementById('fotoMascotaPublico');
    foto.src = m.foto_url || '';
    m.foto_url ? foto.classList.remove('d-none') : foto.classList.add('d-none');
    document.getElementById('alertaMascotaPerdidaPublico').classList.toggle('d-none', !m.esta_perdida);
    mostrarVista('perfil-publico');
  };

  DOM.chkEstaPerdida?.addEventListener('change', sincronizarMapaRegistro);
  
  verificarSesion().then(() => {
    if (perfilInicial) {
      procesarPeticion(`/api/mascotas/${perfilInicial}/publico`, {}, (d) => window.abrirPerfilPublico(JSON.stringify(d.mascota)));
    } else if (tokenResetUrl) {
      document.getElementById('resetToken').value = tokenResetUrl;
      mostrarVista('reset-password', false);
    } else {
      let rutaInicial = window.location.pathname.replace(/^\/+/, '');
      if (rutaInicial === 'index.html' || rutaInicial === '') rutaInicial = 'inicio';
      mostrarVista(rutaInicial, false);
    }
  });
});
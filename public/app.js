'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const DOM = {
    formMascota: document.getElementById('formularioMascota'),
    formRegistro: document.getElementById('formularioRegistroUsuario'),
    formLogin: document.getElementById('formularioLogin'),
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

  const escaparHtml = (texto) => String(texto || '').replace(/[&<>"']/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match])).replace(/\n/g, '<br>');
  const obtenerNum = (valor) => (valor === '' || valor == null) ? null : (Number.isNaN(Number(valor)) ? null : Number(valor));

  const alternarBotonCarga = (boton, cargando, texto = 'Guardar') => {
    if (!boton) return;
    boton.disabled = cargando;
    if (cargando) {
      boton.dataset.textoOriginal = boton.textContent;
      boton.textContent = 'Procesando...';
    } else {
      boton.textContent = boton.dataset.textoOriginal || texto;
    }
  };

  const formatearFecha = (fechaISO) => {
    if (!fechaISO) return '';
    return fechaISO.split('T')[0];
  };

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

  const redirigirLogin = () => { estado.usuario = null; verificarSesion(); mostrarVista('login'); };

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

    if (empujar && window.location.pathname.replace('/', '') !== vista) {
      window.history.pushState({ vista }, '', `/${vista === 'inicio' ? '' : vista}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });

    console.log(`[UI] Vista activa cambiada a: --> ${vista} <--`);

    setTimeout(() => {
      if (vista === 'registro') sincronizarMapaRegistro();
      if (vista === 'busqueda' && window.petmapMapas) {
        window.petmapMapas.inicializarMapaBusqueda();
        window.petmapMapas.cargarMascotasPerdidas();
      }
    }, 300);

    if (vista === 'admin') { 
      console.log('[UI] Solicitando carga de datos para Panel Admin...');
      cargarMascotasAdmin(); 
      cargarUsuariosAdmin(); 
      cargarMemorialAdmin(); 
    }
    if (vista === 'mis-mascotas') cargarMisMascotas();
    if (vista === 'memorial') cargarMemoriales();
  };

  window.addEventListener('popstate', (e) => mostrarVista(e.state?.vista || window.location.pathname.replace('/', '') || 'inicio', false));

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

  const procesarPeticion = async (url, opciones = {}, callback) => {
    try {
      opciones.credentials = opciones.credentials || 'include';
      console.log(`[FETCH] Realizando petición a: ${url}`);
      const resp = await fetch(url, opciones);
      const datos = await resp.json();
      console.log(`[FETCH] Respuesta de ${url}: Status`, resp.status);
      if (!resp.ok) {
        if ([401, 403].includes(resp.status)) return redirigirLogin();
        throw new Error(datos.mensaje || 'Error en la petición');
      }
      if (callback) callback(datos);
    } catch (e) { 
      console.error(`[FETCH ERROR en ${url}]:`, e);
      Swal.fire('Error', e.message, 'error'); 
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
      img.alt = m.nombre;
      
      img.onclick = () => {
        document.getElementById('modalMemFoto').src = m.foto_url;
        document.getElementById('modalMemNombre').textContent = m.nombre;
        document.getElementById('modalMemFechas').textContent = `Partió el ${m.fecha_fallecimiento ? m.fecha_fallecimiento.split('T')[0] : ''}`;
        document.getElementById('modalMemMensaje').textContent = `"${m.mensaje}"`;
        document.getElementById('modalMemContador').textContent = m.contador_veladoras;
        
        const btn = document.getElementById('btnEncenderVeladora');
        btn.onclick = () => encenderVeladora(m.id, btn);
        btn.className = 'btn btn-veladora fs-5 w-100 mb-2'; 
        btn.innerHTML = 'Encender veladora';
        
        new bootstrap.Modal(document.getElementById('modalMemorialInfo')).show();
      };
      DOM.espacioMemorial.appendChild(img);
    });
  });

  const encenderVeladora = async (id, btn) => {
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
    }
  };

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
            <button class="btn btn-sm btn-outline-primary flex-grow-1 fw-bold" onclick="window.petmapUI.abrirPrivado('${encodeURIComponent(JSON.stringify(m))}')">Perfil / ID</button>
            <button class="btn btn-sm btn-outline-dark flex-grow-1 fw-bold" onclick="window.petmapUI.prepararEstado('${m.id}', '${m.esta_perdida}', '${escaparHtml(m.telefono_dueno)}', '${escaparHtml(m.direccion_dueno)}')">Estado</button>
            <button class="btn btn-sm btn-outline-danger fw-bold" onclick="window.borrarMascotaAdmin('${m.id}')">Borrar</button>
          </div>
        </div>`;
      frag.appendChild(div);
    });
    DOM.contenedorMisMascotas.appendChild(frag);
  });

  const cargarMascotasAdmin = () => procesarPeticion('/api/mascotas/admin/todas', { credentials: 'include' }, (datos) => {
    const tabla = document.getElementById('tablaAdminMascotas');
    if (!tabla) return;
    tabla.innerHTML = datos.mascotas && datos.mascotas.length ? '' : '<tr><td colspan="5" class="text-center text-muted py-4">No hay mascotas registradas.</td></tr>';
    if(datos.mascotas) {
      datos.mascotas.forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="fw-bold">${escaparHtml(m.nombre)}</td><td>${escaparHtml(m.especie)}</td><td><span class="badge ${m.esta_perdida ? 'bg-danger' : 'bg-success'}">${m.esta_perdida ? 'Perdida' : 'A Salvo'}</span></td><td>${escaparHtml(m.telefono_dueno || 'Sin contacto')}</td><td class="text-end"><button class="btn btn-outline-danger btn-sm" onclick="window.borrarMascotaAdmin('${m.id}')">Eliminar</button></td>`;
        tabla.appendChild(tr);
      });
    }
  });

  const cargarUsuariosAdmin = () => procesarPeticion('/api/usuarios?limit=100', { credentials: 'include' }, (datos) => {
    if (!DOM.tablaAdminUsuarios) return;
    DOM.tablaAdminUsuarios.innerHTML = datos.usuarios.length ? '' : '<tr><td colspan="4" class="text-center text-muted py-4">No hay usuarios.</td></tr>';
    datos.usuarios.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="fw-bold">${escaparHtml(u.nombre)}</td><td>${escaparHtml(u.correo)}</td><td><span class="badge ${u.rol === 'superadmin' ? 'bg-dark' : 'bg-primary'}">${escaparHtml(u.rol)}</span></td><td class="text-end"><button class="btn btn-outline-danger btn-sm" onclick="window.eliminarUsuario('${u.id}')">Eliminar</button></td>`;
      DOM.tablaAdminUsuarios.appendChild(tr);
    });
  });

  const cargarMemorialAdmin = () => procesarPeticion('/api/memorial', { credentials: 'include' }, (datos) => {
    const tabla = document.getElementById('tablaAdminMemorial');
    if (!tabla) return;
    tabla.innerHTML = datos.memoriales && datos.memoriales.length ? '' : '<tr><td colspan="5" class="text-center text-muted py-4">No hay homenajes registrados.</td></tr>';
    if(datos.memoriales) {
      datos.memoriales.forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="fw-bold">${escaparHtml(m.nombre)}</td><td>${escaparHtml(m.especie)}</td><td>${m.fecha_fallecimiento ? m.fecha_fallecimiento.split('T')[0] : ''}</td><td><small class="text-muted d-inline-block text-truncate" style="max-width: 150px;">${escaparHtml(m.mensaje)}</small></td><td class="text-end"><button class="btn btn-outline-danger btn-sm" onclick="window.borrarMemorialAdmin('${m.id}')">Eliminar</button></td>`;
        tabla.appendChild(tr);
      });
    }
  });

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
    if ((await Swal.fire({ title: '¿Borrar esta mascota de la base de datos?', icon: 'warning', showCancelButton: true })).isConfirmed) {
      await fetch(`/api/mascotas/${id}`, { method: 'DELETE', credentials: 'include' });
      Swal.fire('Eliminada', '', 'success');
      if(document.getElementById('vista-admin').classList.contains('activa')) cargarMascotasAdmin();
      if(document.getElementById('vista-mis-mascotas').classList.contains('activa')) cargarMisMascotas();
    }
  };

  window.eliminarUsuario = async (id) => {
    if ((await Swal.fire({ title: '¿Eliminar usuario y todos sus datos?', icon: 'warning', showCancelButton: true })).isConfirmed) {
      await fetch(`/api/usuarios/${id}`, { method: 'DELETE', credentials: 'include' });
      Swal.fire('Eliminado', '', 'success');
      cargarUsuariosAdmin();
      cargarMascotasAdmin();
    }
  };

  window.borrarMemorialAdmin = async (id) => {
    if ((await Swal.fire({ title: '¿Borrar permanentemente este homenaje?', icon: 'warning', showCancelButton: true })).isConfirmed) {
      await fetch(`/api/memorial/${id}`, { method: 'DELETE', credentials: 'include' }); 
      Swal.fire('Eliminado', '', 'success');
      cargarMemorialAdmin();
      cargarMemoriales();
    }
  };

  DOM.formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitLogin');
    alternarBotonCarga(btn, true, 'Iniciar Sesión');
    procesarPeticion('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ correo: DOM.formLogin.correo.value, contrasena: DOM.formLogin.contrasena.value }) }, (d) => {
      estado.usuario = d.usuario; verificarSesion(); DOM.formLogin.reset();
      mostrarVista(['admin', 'superadmin'].includes(d.usuario.rol) ? 'admin' : 'mis-mascotas');
    });
    alternarBotonCarga(btn, false);
  });

  DOM.formMascota?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitMascota');
    const formData = new FormData(DOM.formMascota);
    const perdida = DOM.chkEstaPerdida.checked;
    const lat = obtenerNum(formData.get('latitud'));
    const lon = obtenerNum(formData.get('longitud'));

    if (perdida && (lat == null || lon == null)) return Swal.fire('Error', 'Marca en el mapa.', 'error');
    if (perdida && (!formData.get('telefono_dueno') || !formData.get('direccion_dueno'))) return Swal.fire('Error', 'Teléfono y dirección obligatorios.', 'error');

    alternarBotonCarga(btn, true, 'Guardar Mascota');
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
      
      const btnEstado = document.getElementById('btnCambiarEstadoMascota');
      btnEstado.textContent = m.esta_perdida ? 'Marcar como A Salvo' : 'Reportar Extravío';
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
        procesarPeticion(`/api/mascotas/${id}/estado`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ esta_perdida: false, telefono_dueno: tel, direccion_dueno: dir }) }, () => { Swal.fire('¡Mascota A Salvo!', '', 'success'); cargarMisMascotas(); });
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
          if (!lat || !lon) return Swal.fire('Error', 'Marca el mapa', 'error');
          procesarPeticion(`/api/mascotas/${id}/estado`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ esta_perdida: true, latitud: lat, longitud: lon, telefono_dueno: '+52 ' + t, direccion_dueno: d }) }, () => { modal.hide(); Swal.fire('Alerta enviada', '', 'success'); cargarMisMascotas(); });
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
    } else {
      mostrarVista(window.location.pathname.replace('/', '') || 'inicio', false);
    }
  });
});
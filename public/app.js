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
    qrImpresionActual: '' // <--- VARIABLE PARA QR INDEPENDIENTE
  };

  const perfilInicial = new URLSearchParams(window.location.search).get('perfil');
  const tokenResetUrl = new URLSearchParams(window.location.search).get('token');

  const escaparHtml = (texto) => String(texto || '').replace(/[&<>"']/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[match])).replace(/\n/g, '<br>');
  const obtenerNum = (valor) => (valor === '' || valor == null) ? null : (Number.isNaN(Number(valor)) ? null : Number(valor));

  const alternarBotonCarga = (boton, cargando, texto = 'Procesando...') => {
    if (!boton) return;
    if (cargando) {
      boton.dataset.htmlOriginal = boton.innerHTML;
      boton.disabled = true;
      boton.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${texto}`;
    } else {
      boton.disabled = false;
      boton.innerHTML = boton.dataset.htmlOriginal || texto;
    }
  };

  /* =================================================================================
     SISTEMA PROFESIONAL DE PLANTILLAS INTERCAMBIABLES Y SELECTORES
  ================================================================================= */
  const CONFIG_PLANTILLAS = {
    credencial: 'especial-miembro',
    cartel: 'clasico'
  };

  // LÓGICA DE CAPTURA DE MAPA ESTÁTICO (Espera la carga de Tiles y captura un Canvas)
  const capturarMapaEstatico = async (lat, lng) => {
      return new Promise((resolve) => {
          const mapDiv = document.getElementById('mapa-oculto-captura');
          if (!mapDiv) return resolve(null);
          mapDiv.innerHTML = ''; 
          
          const map = L.map(mapDiv, { 
              zoomControl: false, attributionControl: false, fadeAnimation: false, zoomAnimation: false
          }).setView([lat, lng], 15);
          
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { 
              maxZoom: 19, crossOrigin: true 
          }).addTo(map);

          // SOLO DIBUJAMOS EL CÍRCULO DE LA ZONA (Eliminado el marcador central para evitar confusión)
          L.circle([lat, lng], { radius: 350, color: '#c94c4c', fillColor: '#c94c4c', fillOpacity: 0.25, weight: 4 }).addTo(map);

          // Damos 1.2 segundos para asegurar renderizado de tiles de red antes del snapshot
          setTimeout(async () => {
              try {
                  const canvas = await html2canvas(mapDiv, { useCORS: true, allowTaint: false, scale: 2, logging: false });
                  map.remove();
                  resolve(canvas.toDataURL('image/jpeg', 0.85));
              } catch (e) {
                  console.error('Error capturando mapa:', e);
                  map.remove();
                  resolve(null);
              }
          }, 1200); 
      });
  };

  document.getElementById('btnConfirmarImpresionQR')?.addEventListener('click', () => {
      if (!estado.qrImpresionActual) return;
      const size = document.getElementById('selectTamanoQR').value;
      const zona = document.getElementById('zona-impresion');
      if (!zona) return;
      
      zona.innerHTML = `
          <style>
              @media print {
                  @page { size: auto; margin: 15mm; }
                  body > :not(#zona-impresion) { display: none !important; }
                  #zona-impresion { display: flex !important; justify-content: center; align-items: flex-start; height: 100vh; padding-top: 20mm; width: 100%; margin: 0; padding: 0; }
              }
              .qr-print-container { text-align: center; font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; margin-top: 20px;}
              .qr-print-img { width: ${size}; height: ${size}; image-rendering: pixelated; object-fit: contain; }
              .qr-print-text { font-size: 16pt; font-weight: 900; color: #2e4a45; margin-top: 4mm; letter-spacing: 1px; }
          </style>
          <div class="qr-print-container">
              <img src="${estado.qrImpresionActual}" class="qr-print-img" />
              <div class="qr-print-text">PETMAP</div>
          </div>
      `;
      bootstrap.Modal.getInstance(document.getElementById('modalImprimirQR'))?.hide();
      setTimeout(() => window.print(), 350);
  });

  const generarBarcodeSVG = (texto, color = '#e7ddd2') => {
    const patterns = {
      '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
      '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
      '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
      'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
      'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
      'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
      'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
      'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
      'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
      '-': '010000101', '.': '110000100', ' ': '011000100', '*': '010010100'
    };
    const str = `*${String(texto).toUpperCase().replace(/[\*\s]+/g, '')}*`;
    let x = 0;
    let rects = '';
    for (let i = 0; i < str.length; i++) {
      const p = patterns[str[i]] || patterns['*'];
      for (let j = 0; j < 9; j++) {
        const isBar = j % 2 === 0;
        const w = p[j] === '1' ? 3 : 1;
        if (isBar) rects += `<rect x="${x}" y="0" width="${w}" height="25" fill="${color}"/>`;
        x += w;
      }
      x += 1.5;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x} 25" style="width:100%;height:22px;max-width:180px;display:block;margin:auto;">${rects}</svg>`;
  };

  const listarPlantillas = (tipo) => {
    return tipo === 'credencial' 
      ? [
          { 
            id: 'especial-miembro', 
            nombre: 'Premium (2 Caras)', 
            descripcion: 'Diseño oficial PetMap con QR trasero.', 
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="#f59e0b" viewBox="0 0 16 16"><path d="m8 0 1.669.864 1.858.282.842 1.68 1.337 1.32L13.4 6l.306 1.854-1.337 1.32-.842 1.68-1.858.282L8 12l-1.669-.864-1.858-.282-.842-1.68-1.337-1.32L2.6 6l-.306-1.854 1.337-1.32.842-1.68 1.858-.282L8 0z"/><path d="M4 11.794V16l4-1 4 1v-4.206l-2.018.306L8 13.126 6.018 12.1 4 11.794z"/></svg>` 
          },
          { 
            id: 'clasica', 
            nombre: 'Clásica (1 Cara)', 
            descripcion: 'Tarjeta de identificación sencilla.', 
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="#2563eb" viewBox="0 0 16 16"><path d="M2 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2zm4.5 0a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm5 2.755C12.146 12.825 10.223 12 8 12s-4.146.826-5 1.755V14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-.245z"/></svg>` 
          }
        ]
      : [
          { 
            id: 'clasico', 
            nombre: 'Cartel de Búsqueda Clásico', 
            descripcion: 'Diseño vertical con mapa estático integrado.', 
            icon: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="#dc2626" viewBox="0 0 16 16"><path d="M11.46 14.572a1 1 0 0 0 .586-.293l4.243-4.243a1 1 0 0 0 .293-.586V4.54a1 1 0 0 0-.293-.586L12.046.293A1 1 0 0 0 11.46 0H4.54a1 1 0 0 0-.586.293L.293 4.54A1 1 0 0 0 0 5.126v6.914a1 1 0 0 0 .293.586l4.243 4.243a1 1 0 0 0 .586.293h6.914zM8 4c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995A.905.905 0 0 1 8 4zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/></svg>` 
          }
        ];
  };

  const abrirSelectorPlantilla = (tipo, mascota) => {
      const plantillas = listarPlantillas(tipo);
      const contenedor = document.getElementById(tipo === 'credencial' ? 'contenedorPlantillasCredencial' : 'contenedorPlantillasCartel');
      contenedor.innerHTML = '';

      plantillas.forEach(p => {
          const div = document.createElement('div');
          div.className = 'col-12';
          div.innerHTML = `
            <div class="card border border-2 rounded-3 h-100 p-3 card-plantilla-hover" data-id="${p.id}" style="cursor: pointer; transition: all 0.2s;">
              <div class="d-flex align-items-center">
                <div class="fs-1 me-3 d-flex align-items-center">${p.icon}</div>
                <div>
                  <h6 class="fw-bold mb-1">${p.nombre}</h6>
                  <p class="small text-muted mb-0">${p.descripcion}</p>
                </div>
              </div>
            </div>
          `;
          
          div.querySelector('.card').onclick = () => {
              const modalId = tipo === 'credencial' ? 'modalSeleccionarCredencial' : 'modalSeleccionarCartel';
              bootstrap.Modal.getInstance(document.getElementById(modalId))?.hide();
              
              if (tipo === 'credencial') ejecutarImpresionCredencial(p.id, mascota);
              else ejecutarImpresionCartel(p.id, mascota);
          };
          contenedor.appendChild(div);
      });

      const modalId = tipo === 'credencial' ? 'modalSeleccionarCredencial' : 'modalSeleccionarCartel';
      new bootstrap.Modal(document.getElementById(modalId)).show();
  };

  const ejecutarImpresionCredencial = (idPlantilla, m) => {
      const curm = generarCURM(m.nombre, m.especie, m.fecha_nacimiento);
      const fechaLimpia = m.fecha_nacimiento ? m.fecha_nacimiento.split('T')[0] : 'Desconocida';
      const nombreDueno = estado.usuario ? estado.usuario.nombre : 'Dueño';

      const barcodeColor = idPlantilla === 'clasica' ? '#2e4a45' : '#e7ddd2';
      const barcodeTexto = idPlantilla === 'clasica' ? curm : 'PETMAP';
      const barcodeSvg = generarBarcodeSVG(barcodeTexto, barcodeColor);

      const datosVariables = {
          ...m,
          curm: curm,
          fecha_nacimiento: fechaLimpia,
          nombre_dueno: nombreDueno,
          telefono: m.telefono_dueno || 'Sin registrar',
          foto: m.foto_url || 'https://via.placeholder.com/150?text=Foto',
          qr_perfil: m.qr_perfil || '',
          raza: m.raza || 'Mestizo',
          estado_texto: m.esta_perdida ? 'PERDIDA' : 'A SALVO',
          estado_color: m.esta_perdida ? '#c94c4c' : '#2a7d4f',
          barcode_svg: barcodeSvg
      };
      imprimirPlantilla('credencial', idPlantilla, datosVariables);
  };

  const ejecutarImpresionCartel = async (idPlantilla, m) => {
      const btn = document.getElementById('btnGenerarCartelBusqueda');
      alternarBotonCarga(btn, true, 'Generando Mapa...');
      
      let mapaBase64 = null;
      let mapaFallo = false;
      
      if (m.latitud && m.longitud) {
          mapaBase64 = await capturarMapaEstatico(m.latitud, m.longitud);
          if (!mapaBase64) mapaFallo = true;
      }

      const datosCartel = {
          ...m,
          foto: m.foto_url || '',
          telefono: m.telefono_dueno || 'Sin registrar',
          raza: m.raza || 'Mestizo',
          descripcion: m.descripcion || 'Sin descripción',
          qr: m.qr_perfil || '',
          no_perdida: !m.esta_perdida,
          fecha_extravio: new Date().toLocaleDateString('es-ES'),
          mapa_extravio: mapaBase64,
          mapa_fallo: mapaFallo
      };
      alternarBotonCarga(btn, false, 'Generar Cartel de Búsqueda');
      imprimirPlantilla('cartel', idPlantilla, datosCartel);
  };

  const procesarPlantilla = (html, datos) => {
      // 1. Procesar condicionales (ej. {{#if esta_perdida}}...{{/if}})
      let procesado = html.replace(/{{#if\s+([a-zA-Z0-9_]+)}}(.*?){{\/if}}/gs, (match, prop, content) => {
          return datos[prop] ? content : '';
      });

      // 2. Reemplazar variables seguras
      procesado = procesado.replace(/{{([a-zA-Z0-9_]+)}}/g, (match, prop) => {
          let valor = datos[prop];
          if (valor === undefined || valor === null) return '';
          
          // Tratamiento especializado para rutas de imágenes y SVG de código de barras
          if (['qr', 'qr_perfil', 'foto', 'foto_url', 'mapa_extravio', 'barcode_svg'].includes(prop)) {
             return String(valor);
          }

          // Texto general estricto contra HTML
          return escaparHtml(String(valor));
      });
      return procesado;
  };

  const cargarArchivosPlantilla = async (tipo, id) => {
     try {
         const ruta = `/templates/${tipo === 'credencial' ? 'credenciales' : 'carteles'}/${id}`;
         const [htmlRes, cssRes, metaRes] = await Promise.all([
             fetch(`${ruta}/template.html`),
             fetch(`${ruta}/template.css`),
             fetch(`${ruta}/metadata.json`).catch(() => ({ ok: false }))
         ]);
         
         if (!htmlRes.ok || !cssRes.ok) {
             throw new Error(`Archivos no encontrados en: ${ruta}. Verifica que la ruta exista en el servidor.`);
         }
         
         const html = await htmlRes.text();
         const css = await cssRes.text();
         const metadata = metaRes.ok ? await metaRes.json() : {};
         return { html, css, metadata, id, tipo };
     } catch (e) {
         console.warn(`No se pudo cargar la plantilla "${id}":`, e);
         Swal.fire('Error de Plantilla', `Ruta fallida: ${e.message}`, 'error');
         return null;
     }
  };

  const cargarPlantilla = async (tipo, id) => {
      let plantilla = await cargarArchivosPlantilla(tipo, id);
      if (!plantilla) { // Fallback de seguridad
          const fallbackId = CONFIG_PLANTILLAS[tipo];
          if (id !== fallbackId) {
              console.log(`Fallback activado: Cargando plantilla predeterminada -> ${fallbackId}`);
              plantilla = await cargarArchivosPlantilla(tipo, fallbackId);
          }
      }
      return plantilla;
  };

  const renderizarPlantilla = async (opciones) => {
      const { tipo, plantilla: idPlantilla, datos } = opciones;
      const plantilla = await cargarPlantilla(tipo, idPlantilla);
      
      if (!plantilla) throw new Error(`No se pudo cargar la estructura base para la plantilla: ${idPlantilla}`);

      const htmlFinal = procesarPlantilla(plantilla.html, datos);
      const styleId = `style-plantilla-${tipo}-${plantilla.id}`;
      
      // Aisla y previene conflictos de @page eliminando estilos de otras plantillas previas
      document.querySelectorAll('style[id^="style-plantilla-"]').forEach(s => {
          if (s.id !== styleId) s.remove();
      });

      if (!document.getElementById(styleId)) {
          const style = document.createElement('style');
          style.id = styleId;
          style.innerHTML = plantilla.css;
          document.head.appendChild(style);
      }

      // El contenedor wrapper aisla completamente el diseño
      return `<div class="plantilla-wrapper plantilla-${tipo}-${plantilla.id}">${htmlFinal}</div>`;
  };

  const imprimirPlantilla = async (tipo, idPlantilla, datos) => {
    const zona = document.getElementById('zona-impresion');
    if (!zona) return;
    
    try {
        const html = await renderizarPlantilla({ tipo, plantilla: idPlantilla, datos });
        if (!html) throw new Error("El motor de renderizado devolvió un resultado vacío.");
        
        zona.innerHTML = html;
        
        const imagenes = Array.from(zona.getElementsByTagName('img'));
        if (imagenes.length === 0) {
            setTimeout(() => window.print(), 100);
            return;
        }

        let cargadas = 0;
        const intentar = () => { 
            if (++cargadas === imagenes.length) {
                // Darle tiempo al navegador para renderizar las imagenes en la vista de impresión
                setTimeout(() => window.print(), 350); 
            }
        };
        imagenes.forEach(img => { 
            if (img.complete) {
                intentar(); 
            } else { 
                img.onload = intentar; 
                img.onerror = intentar; 
            } 
        });
    } catch (error) {
        console.error("Error Crítico del motor de plantillas:", error);
        Swal.fire('Fallo de Renderizado', error.message, 'error');
    }
  };

  /* =================================================================================
     VALIDACIONES INLINE Y GESTIÓN DE ERRORES (AUTENTICACIÓN)
  ================================================================================= */
  const svgOjoCerrado = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
  const svgOjoAbierto = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;

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
        item.innerHTML = `<span class="req-icon">${window.PETMAP_ICONOS ? window.PETMAP_ICONOS.check(14) : ''}</span> ${item.textContent.substring(2)}`;
      } else {
        item.className = `req-item ${val.length > 0 ? 'invalid' : 'neutral'}`;
        item.innerHTML = `<span class="req-icon">${window.PETMAP_ICONOS ? window.PETMAP_ICONOS.error(14) : ''}</span> ${item.textContent.substring(2)}`;
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
      if(msg) { msg.className = 'invalid-feedback d-block text-success'; msg.innerHTML = `${window.PETMAP_ICONOS ? window.PETMAP_ICONOS.check(14, '#198754', 'me-1') : ''} Las contraseñas coinciden`; }
    } else {
      confInput.classList.remove('is-valid');
      confInput.classList.add('is-invalid');
      if(msg) { msg.className = 'invalid-feedback d-block'; msg.innerHTML = `${window.PETMAP_ICONOS ? window.PETMAP_ICONOS.error(14, '#dc3545', 'me-1') : ''} Las contraseñas no coinciden`; }
    }
    return coinciden;
  };

  const adjuntarEventosFormularioAuth = () => {
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

  window.addEventListener('afterprint', () => { document.getElementById('zona-impresion').innerHTML = ''; });

  const descargarUrl = (url, nombre) => {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url; a.download = nombre; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
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

    const seguras = ['mi-perfil', 'mis-mascotas', 'admin', 'registro-exitoso', 'perfil-privado', 'boletin-contacto', 'registro'];
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
    if (vista === 'mi-perfil' && estado.usuario) {
      document.getElementById('perfilNombre').value = estado.usuario.nombre || '';
      document.getElementById('perfilCorreo').value = estado.usuario.correo || '';
      document.getElementById('perfilContrasena').value = '';
    }
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
    if(tokenResetUrl && ruta === 'inicio') ruta = 'reset-password';
    mostrarVista(ruta, false);
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.classList.contains('btn-borrar-mascota')) {
      window.borrarMascotaAdmin(btn.dataset.id);
    } else if (btn.classList.contains('btn-borrar-usuario')) {
      window.eliminarUsuario(btn.dataset.id);
    } else if (btn.classList.contains('btn-borrar-memorial')) {
      window.borrarMemorialAdmin(btn.dataset.id);
    } else if (btn.classList.contains('btn-abrir-perfil')) {
      window.petmapUI.abrirPrivado(btn.dataset.mascota);
    } else if (btn.classList.contains('btn-preparar-estado')) {
      window.petmapUI.prepararEstado(btn.dataset.id, btn.dataset.perdida, btn.dataset.tel, btn.dataset.dir);
    } else if (btn.classList.contains('btn-abrir-publico')) {
      window.abrirPerfilPublico(decodeURIComponent(btn.dataset.mascota));
    } else if (btn.classList.contains('btn-cambiar-estado-admin')) {
      window.cambiarEstadoMascotaAdmin(btn.dataset.id, btn.dataset.perdida);
    } else if (btn.classList.contains('btn-editar-usuario-admin')) {
      window.cargarEdicionUsuarioAdmin(decodeURIComponent(btn.dataset.usuario));
    } else if (btn.classList.contains('btn-editar-mascota-admin')) {
      window.editarMascotaAdminModal(btn.dataset.mascota);
    } else if (btn.classList.contains('btn-editar-memorial-admin')) {
      window.editarMemorialAdminModal(btn.dataset.memorial);
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
     MEMORIAL Y MASCOTAS
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
    
    // Inyectar CSS dinámico para el memorial
    if(!document.getElementById('memorialRadicalStyles')) {
      const st = document.createElement('style');
      st.id = 'memorialRadicalStyles';
      st.innerHTML = `
        .contenedor-homenaje {
          position: absolute;
          border-radius: 50%;
          cursor: pointer;
          transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          animation: float-radical 8s ease-in-out infinite alternate;
          box-shadow: 0 0 20px rgba(255, 215, 0, 0.4), inset 0 0 15px rgba(255, 255, 255, 0.6);
        }
        .contenedor-homenaje::before {
          content: '';
          position: absolute;
          top: -15px; left: -15px; right: -15px; bottom: -15px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,215,0,0.5) 0%, rgba(255,255,255,0) 70%);
          z-index: -1;
          animation: pulse-aura 4s ease-in-out infinite alternate;
        }
        .contenedor-homenaje:hover {
          transform: scale(1.3) translateY(-10px);
          z-index: 100;
          box-shadow: 0 0 40px rgba(255, 215, 0, 0.8), inset 0 0 20px rgba(255, 255, 255, 0.8);
        }
        .contenedor-homenaje img {
          width: 100%; height: 100%;
          object-fit: cover;
          border-radius: 50%;
          border: 3px solid rgba(255, 215, 0, 0.7);
        }
        .etiqueta-homenaje {
          position: absolute;
          bottom: -35px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.8);
          color: #fff;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.9rem;
          white-space: nowrap;
          opacity: 0;
          transition: opacity 0.3s;
          pointer-events: none;
        }
        .contenedor-homenaje:hover .etiqueta-homenaje {
          opacity: 1;
        }
        @keyframes float-radical {
          0% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-35px) rotate(5deg); }
          100% { transform: translateY(20px) rotate(-5deg); }
        }
        @keyframes pulse-aura {
          0% { transform: scale(0.9); opacity: 0.4; }
          100% { transform: scale(1.4); opacity: 0.9; }
        }
        .particula-luz {
          position: absolute;
          background: white;
          border-radius: 50%;
          pointer-events: none;
          box-shadow: 0 0 12px 3px rgba(255,255,255,0.9);
          animation: float-up linear infinite;
        }
        @keyframes float-up {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-100vh) scale(0); opacity: 0; }
        }
      `;
      document.head.appendChild(st);
    }

    // Partículas de luz de fondo
    for(let i=0; i<40; i++) {
      const p = document.createElement('div');
      p.className = 'particula-luz';
      p.style.width = Math.random() * 4 + 2 + 'px';
      p.style.height = p.style.width;
      p.style.left = Math.random() * 100 + '%';
      p.style.top = Math.random() * 100 + 50 + '%';
      p.style.animationDuration = (Math.random() * 15 + 8) + 's';
      p.style.animationDelay = (Math.random() * 10) + 's';
      DOM.espacioMemorial.appendChild(p);
    }

    d.memoriales.forEach(m => {
      const size = Math.floor(Math.random() * 60) + 80;
      const top = Math.random() * 70 + 10;
      const left = Math.random() * 80 + 10;
      const delay = Math.random() * 8;
      
      const wrapper = document.createElement('div');
      wrapper.className = 'contenedor-homenaje';
      wrapper.style.width = `${size}px`;
      wrapper.style.height = `${size}px`;
      wrapper.style.top = `${top}%`;
      wrapper.style.left = `${left}%`;
      wrapper.style.animationDelay = `${delay}s`;
      
      const img = document.createElement('img');
      img.src = m.foto_url;
      img.alt = escaparHtml(m.nombre);
      
      const label = document.createElement('div');
      label.className = 'etiqueta-homenaje fw-bold';
      label.innerHTML = (window.PETMAP_ICONOS ? window.PETMAP_ICONOS.flor(14, '#ffd700', 'me-1') : '') + escaparHtml(m.nombre);

      wrapper.appendChild(img);
      wrapper.appendChild(label);
      
      wrapper.onclick = () => {
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
      DOM.espacioMemorial.appendChild(wrapper);
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
    DOM.contenedorMisMascotas.innerHTML = datos.mascotas.length === 0 ? '<div class="col-12 text-center p-5 bg-white rounded-4 border"><div class="text-secondary mb-3">' + (window.PETMAP_ICONOS ? window.PETMAP_ICONOS.mascota(48, '#adb5bd', '') : '') + '</div><h4 class="fw-bold">No tienes mascotas registradas.</h4><p class="text-muted">Agrega tu primera mascota para comenzar.</p></div>' : '';
    const frag = document.createDocumentFragment();
    datos.mascotas.forEach(m => {
      const div = document.createElement('div');
      div.className = 'col-12 col-md-6 col-xl-4';
      
      const esPerdida = m.esta_perdida;
      const iconoEstado = esPerdida ? (window.PETMAP_ICONOS ? window.PETMAP_ICONOS.alerta(14, '#ffffff', 'me-1') : '') : (window.PETMAP_ICONOS ? window.PETMAP_ICONOS.check(14, '#ffffff', 'me-1') : '');
      const badgeClase = esPerdida ? 'bg-danger' : 'bg-success';
      const textoEstado = esPerdida ? 'Perdida' : 'A Salvo';
      const fotoHtml = m.foto_url 
        ? `<img src="${m.foto_url}" alt="${escaparHtml(m.nombre)}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">` 
        : `<div class="w-100 h-100 d-flex justify-content-center align-items-center bg-light">
             ${window.PETMAP_ICONOS ? window.PETMAP_ICONOS.mascota(64, '#adb5bd', '') : ''}
           </div>`;

      div.innerHTML = `
        <div class="tarjeta-suave p-0 h-100 d-flex flex-column shadow-sm border-0 overflow-hidden position-relative" style="border-radius: 1rem;">
          <!-- Contenedor de Imagen -->
          <div class="position-relative overflow-hidden" style="height: 220px; background-color: #f8f9fa;">
            ${fotoHtml}
            <!-- Badge de Estado -->
            <div class="position-absolute top-0 end-0 p-3" style="z-index: 2;">
              <span class="badge ${badgeClase} shadow fs-6 rounded-pill px-3 py-2 border border-white border-2">
                ${iconoEstado} ${textoEstado}
              </span>
            </div>
            <!-- Gradiente y Título Superpuesto -->
            <div class="position-absolute bottom-0 start-0 w-100 p-3 pt-5 text-white" style="background: linear-gradient(to top, rgba(0,0,0,0.85), transparent); z-index: 2;">
              <h3 class="h4 fw-bold mb-0 text-white" style="text-shadow: 1px 1px 4px rgba(0,0,0,0.6);">${escaparHtml(m.nombre)}</h3>
              <p class="mb-0 fw-semibold text-white-50" style="text-shadow: 1px 1px 4px rgba(0,0,0,0.6); font-size: 0.95rem;">
                ${escaparHtml(m.especie)} ${m.raza ? `&bull; ${escaparHtml(m.raza)}` : ''}
              </p>
            </div>
          </div>
          
          <!-- Contenido Inferior -->
          <div class="p-4 d-flex flex-column flex-grow-1 bg-white">
            <p class="text-secondary small mb-4 flex-grow-1" style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.6;">
              ${escaparHtml(m.descripcion || 'Sin descripción')}
            </p>
            
            <!-- Botonera -->
            <div class="row g-2 mt-auto">
              <div class="col-6">
                <button class="btn btn-primary w-100 fw-bold d-inline-flex align-items-center justify-content-center btn-abrir-perfil rounded-3 shadow-sm py-2" data-mascota="${encodeURIComponent(JSON.stringify(m))}">
                  ${window.PETMAP_ICONOS ? window.PETMAP_ICONOS.credencial(18, 'currentColor', 'me-2') : ''} Perfil / ID
                </button>
              </div>
              <div class="col-6">
                <button class="btn btn-dark w-100 fw-bold d-inline-flex align-items-center justify-content-center btn-preparar-estado rounded-3 shadow-sm py-2" data-id="${m.id}" data-perdida="${m.esta_perdida}" data-tel="${escaparHtml(m.telefono_dueno)}" data-dir="${escaparHtml(m.direccion_dueno)}">
                  ${window.PETMAP_ICONOS ? window.PETMAP_ICONOS.estado(18, 'currentColor', 'me-2') : ''} Estado
                </button>
              </div>
              <div class="col-12 mt-2">
                <button class="btn btn-outline-danger w-100 fw-bold d-inline-flex align-items-center justify-content-center btn-borrar-mascota rounded-3 py-2" data-id="${m.id}">
                  ${window.PETMAP_ICONOS ? window.PETMAP_ICONOS.basura(16, 'currentColor', 'me-2') : ''} Eliminar Mascota
                </button>
              </div>
            </div>
          </div>
        </div>`;
      frag.appendChild(div);
    });
    DOM.contenedorMisMascotas.appendChild(frag);
  });

  const cargarMascotasAdmin = async () => {
    try {
      const resp = await fetch('/api/mascotas/admin/todas', { credentials: 'include' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const datos = await resp.json();
      const tabla = document.getElementById('tablaAdminMascotas');
      if (!tabla) return;
      tabla.innerHTML = '';
      const mascotas = datos.mascotas || [];
      
      if (document.getElementById('kpiTotalMascotas')) document.getElementById('kpiTotalMascotas').textContent = mascotas.length;
      if (document.getElementById('badgeCountMascotas')) document.getElementById('badgeCountMascotas').textContent = mascotas.length;

      if (mascotas.length === 0) {
        tabla.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No hay mascotas registradas.</td></tr>';
        return;
      }
      mascotas.forEach(m => {
        const tr = document.createElement('tr');
        const fotoImg = m.foto_url ? `<img src="${m.foto_url}" class="rounded-circle me-2" style="width:36px;height:36px;object-fit:cover;"/>` : `<div class="rounded-circle bg-secondary bg-opacity-10 d-inline-flex align-items-center justify-content-center me-2" style="width:36px;height:36px;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="text-secondary" viewBox="0 0 16 16"><path d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z"/></svg></div>`;
        tr.innerHTML = `
          <td class="ps-4 fw-bold align-middle">${fotoImg} ${escaparHtml(m.nombre)}</td>
          <td class="align-middle"><span class="badge bg-light text-dark border">${escaparHtml(m.especie)}</span> <small class="text-muted ms-1">${escaparHtml(m.raza || '')}</small></td>
          <td class="align-middle"><span class="badge ${m.esta_perdida ? 'bg-danger' : 'bg-success'}">${m.esta_perdida ? (window.PETMAP_ICONOS ? window.PETMAP_ICONOS.alerta(12, '#ffffff', 'me-1') : '') + 'Perdida' : (window.PETMAP_ICONOS ? window.PETMAP_ICONOS.check(12, '#ffffff', 'me-1') : '') + 'A Salvo'}</span></td>
          <td class="align-middle small">${escaparHtml(m.telefono_dueno || 'Sin contacto')}</td>
          <td class="text-end pe-4 align-middle">
            <button class="btn btn-outline-primary btn-sm me-1 btn-editar-mascota-admin d-inline-flex align-items-center" data-mascota="${encodeURIComponent(JSON.stringify(m))}" title="Editar Datos"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="me-1" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg> Editar</button>
            <button class="btn btn-outline-warning btn-sm fw-bold me-1 btn-cambiar-estado-admin d-inline-flex align-items-center" data-id="${m.id}" data-perdida="${m.esta_perdida}" title="Cambiar Estado"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="me-1" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/></svg> Estado</button>
            <button class="btn btn-outline-danger btn-sm btn-borrar-mascota d-inline-flex align-items-center" data-id="${m.id}" title="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="me-1" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg> Eliminar</button>
          </td>`;
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
      const usuarios = datos.usuarios || [];
      const totalCount = datos.total !== undefined ? datos.total : usuarios.length;

      if (document.getElementById('kpiTotalUsuarios')) document.getElementById('kpiTotalUsuarios').textContent = totalCount;
      if (document.getElementById('badgeCountUsuarios')) document.getElementById('badgeCountUsuarios').textContent = totalCount;

      if (usuarios.length === 0) {
        DOM.tablaAdminUsuarios.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No hay usuarios.</td></tr>';
        return;
      }
      usuarios.forEach(u => {
        const tr = document.createElement('tr');
        const badgeColor = u.rol === 'superadmin' ? 'bg-dark' : (u.rol === 'admin' ? 'bg-primary' : 'bg-secondary bg-opacity-75');
        tr.innerHTML = `
          <td class="ps-4 fw-bold align-middle"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="me-2 text-secondary" viewBox="0 0 16 16"><path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"/><path fill-rule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 0 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z"/></svg> ${escaparHtml(u.nombre)}</td>
          <td class="align-middle small">${escaparHtml(u.correo)}</td>
          <td class="align-middle"><span class="badge ${badgeColor}">${escaparHtml(u.rol)}</span></td>
          <td class="text-end pe-4 align-middle">
            <button class="btn btn-outline-primary btn-sm me-1 btn-editar-usuario-admin d-inline-flex align-items-center" data-usuario="${encodeURIComponent(JSON.stringify(u))}" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="me-1" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg> Editar</button>
            <button class="btn btn-outline-danger btn-sm btn-borrar-usuario d-inline-flex align-items-center" data-id="${u.id}" title="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="me-1" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg> Eliminar</button>
          </td>`;
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
      const memoriales = datos.memoriales || [];

      if (document.getElementById('kpiTotalMemorial')) document.getElementById('kpiTotalMemorial').textContent = memoriales.length;
      if (document.getElementById('badgeCountMemorial')) document.getElementById('badgeCountMemorial').textContent = memoriales.length;

      if (memoriales.length === 0) {
        tabla.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No hay homenajes registrados.</td></tr>';
        return;
      }
      memoriales.forEach(m => {
        const tr = document.createElement('tr');
        const fotoImg = m.foto_url ? `<img src="${m.foto_url}" class="rounded-circle me-2" style="width:36px;height:36px;object-fit:cover;"/>` : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="me-2 text-warning" viewBox="0 0 16 16"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l.451-.081.97-.268zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>`;
        tr.innerHTML = `
          <td class="ps-4 fw-bold align-middle">${fotoImg} ${escaparHtml(m.nombre)}</td>
          <td class="align-middle"><span class="badge bg-light text-dark border">${escaparHtml(m.especie)}</span></td>
          <td class="align-middle small">${m.fecha_fallecimiento ? m.fecha_fallecimiento.split('T')[0] : 'N/A'}</td>
          <td class="align-middle"><small class="text-muted d-inline-block text-truncate" style="max-width: 200px;">"${escaparHtml(m.mensaje)}"</small></td>
          <td class="text-end pe-4 align-middle">
            <button class="btn btn-outline-primary btn-sm me-1 btn-editar-memorial-admin d-inline-flex align-items-center" data-memorial="${encodeURIComponent(JSON.stringify(m))}" title="Editar Homenaje"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="me-1" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg> Editar</button>
            <button class="btn btn-outline-danger btn-sm btn-borrar-memorial d-inline-flex align-items-center" data-id="${m.id}" title="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="me-1" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg> Eliminar</button>
          </td>`;
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

  window.cambiarEstadoMascotaAdmin = async (id, perdidaActual) => {
    const esPerdida = perdidaActual === 'true' || perdidaActual === true;
    try {
      const resp = await fetch(`/api/mascotas/${id}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ esta_perdida: !esPerdida })
      });
      if (!resp.ok) throw new Error('Error al actualizar el estado de la mascota.');
      Swal.fire({ title: 'Estado de mascota actualizado', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 1500 });
      cargarMascotasAdmin();
    } catch (e) {
      Swal.fire('Error', e.message, 'error');
    }
  };

  window.editarMascotaAdminModal = async (mJson) => {
    const m = JSON.parse(decodeURIComponent(mJson));
    const { value: formValues } = await Swal.fire({
      title: `Editar Mascota: ${m.nombre}`,
      html: `
        <div class="text-start">
          <label class="form-label small fw-bold mb-1">Nombre</label>
          <input id="swal-nombre-mascota" class="swal2-input mt-0 mb-3 w-100" value="${escaparHtml(m.nombre)}" placeholder="Nombre">
          <label class="form-label small fw-bold mb-1">Especie</label>
          <input id="swal-especie-mascota" class="swal2-input mt-0 mb-3 w-100" value="${escaparHtml(m.especie)}" placeholder="Especie">
          <label class="form-label small fw-bold mb-1">Raza</label>
          <input id="swal-raza-mascota" class="swal2-input mt-0 mb-3 w-100" value="${escaparHtml(m.raza || '')}" placeholder="Raza">
          <label class="form-label small fw-bold mb-1">Descripción</label>
          <textarea id="swal-desc-mascota" class="swal2-textarea mt-0 w-100" rows="3" placeholder="Descripción">${escaparHtml(m.descripcion || '')}</textarea>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Guardar Cambios',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        return {
          nombre: document.getElementById('swal-nombre-mascota').value,
          especie: document.getElementById('swal-especie-mascota').value,
          raza: document.getElementById('swal-raza-mascota').value,
          descripcion: document.getElementById('swal-desc-mascota').value
        };
      }
    });

    if (formValues) {
      try {
        const resp = await fetch(`/api/mascotas/${m.id}/datos`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(formValues)
        });
        let data = {};
        try { data = await resp.json(); } catch(err) {}
        if (!resp.ok) throw new Error(data.mensaje || `Error del servidor (${resp.status}). Si el servidor Node no se ha reiniciado, por favor reinícialo para activar las rutas de edición.`);
        Swal.fire('Actualizada', 'La información de la mascota ha sido modificada.', 'success');
        cargarMascotasAdmin();
      } catch (e) {
        Swal.fire('Error', e.message, 'error');
      }
    }
  };

  window.editarMemorialAdminModal = async (mJson) => {
    const m = JSON.parse(decodeURIComponent(mJson));
    const { value: formValues } = await Swal.fire({
      title: `Editar Homenaje: ${m.nombre}`,
      html: `
        <div class="text-start">
          <label class="form-label small fw-bold mb-1">Nombre</label>
          <input id="swal-nombre-mem" class="swal2-input mt-0 mb-3 w-100" value="${escaparHtml(m.nombre)}" placeholder="Nombre">
          <label class="form-label small fw-bold mb-1">Especie</label>
          <input id="swal-especie-mem" class="swal2-input mt-0 mb-3 w-100" value="${escaparHtml(m.especie)}" placeholder="Especie">
          <label class="form-label small fw-bold mb-1">Mensaje de despedida</label>
          <textarea id="swal-mensaje-mem" class="swal2-textarea mt-0 w-100" rows="3" placeholder="Mensaje">${escaparHtml(m.mensaje || '')}</textarea>
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Guardar Cambios',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        return {
          nombre: document.getElementById('swal-nombre-mem').value,
          especie: document.getElementById('swal-especie-mem').value,
          mensaje: document.getElementById('swal-mensaje-mem').value
        };
      }
    });

    if (formValues) {
      try {
        const resp = await fetch(`/api/memorial/${m.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(formValues)
        });
        let data = {};
        try { data = await resp.json(); } catch(err) {}
        if (!resp.ok) throw new Error(data.mensaje || `Error del servidor (${resp.status}). Si el servidor Node no se ha reiniciado, por favor reinícialo para activar las rutas de edición.`);
        Swal.fire('Actualizado', 'El homenaje fue modificado correctamente.', 'success');
        cargarMemorialAdmin();
      } catch (e) {
        Swal.fire('Error', e.message, 'error');
      }
    }
  };

  window.cargarEdicionUsuarioAdmin = (uJson) => {
    const u = JSON.parse(uJson);
    estado.usuarioAdminEditandoId = u.id;
    document.getElementById('adminUserNombre').value = u.nombre;
    document.getElementById('adminUserCorreo').value = u.correo;
    document.getElementById('adminUserPassword').value = '';
    document.getElementById('adminUserRol').value = u.rol;
    document.getElementById('tituloFormUsuarioAdmin').textContent = 'Editar usuario';
    document.getElementById('btnGuardarUsuarioAdmin').textContent = 'Guardar Cambios';
    document.getElementById('btnCancelarEdicionUsuarioAdmin').classList.remove('d-none');
  };

  document.getElementById('btnCancelarEdicionUsuarioAdmin')?.addEventListener('click', () => {
    estado.usuarioAdminEditandoId = null;
    document.getElementById('formUsuarioAdmin')?.reset();
    document.getElementById('tituloFormUsuarioAdmin').textContent = 'Crear Nuevo Usuario';
    document.getElementById('btnGuardarUsuarioAdmin').textContent = 'Guardar Usuario';
    document.getElementById('btnCancelarEdicionUsuarioAdmin').classList.add('d-none');
  });

  document.getElementById('btnRefrescarAdmin')?.addEventListener('click', () => {
    cargarUsuariosAdmin();
    cargarMascotasAdmin();
    cargarMemorialAdmin();
    Swal.fire({ title: 'Métricas Actualizadas', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 1200 });
  });

  document.getElementById('formUsuarioAdmin')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnGuardarUsuarioAdmin');
    const nombre = document.getElementById('adminUserNombre').value;
    const correo = document.getElementById('adminUserCorreo').value;
    const contrasena = document.getElementById('adminUserPassword').value;
    const rol = document.getElementById('adminUserRol').value;

    const payload = { nombre, correo, rol };
    if (contrasena) payload.contrasena = contrasena;

    alternarBotonCarga(btn, true, 'Guardando...');

    const esEdicion = !!estado.usuarioAdminEditandoId;
    const url = esEdicion ? `/api/usuarios/${estado.usuarioAdminEditandoId}` : '/api/usuarios';
    const method = esEdicion ? 'PUT' : 'POST';

    try {
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.mensaje || 'Error al guardar usuario');

      Swal.fire('Éxito', esEdicion ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.', 'success');
      document.getElementById('btnCancelarEdicionUsuarioAdmin')?.click();
      cargarUsuariosAdmin();
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      alternarBotonCarga(btn, false);
    }
  });

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

  document.getElementById('formMiPerfil')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnGuardarPerfil');
    const nombre = document.getElementById('perfilNombre').value;
    const correo = document.getElementById('perfilCorreo').value;
    const contrasena = document.getElementById('perfilContrasena').value;

    alternarBotonCarga(btn, true, 'Guardando...');
    try {
      const resp = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nombre, correo, contrasena })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.mensaje || 'Error al actualizar perfil');

      estado.usuario = data.usuario; // Update global state
      verificarSesion(); // Update navbar name
      Swal.fire({ title: 'Perfil Actualizado', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
      document.getElementById('perfilContrasena').value = '';
    } catch (e) {
      Swal.fire('Error', e.message, 'error');
    } finally {
      alternarBotonCarga(btn, false);
    }
  });

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
        marcarInput(correo, false, null);
        marcarInput(contrasena, false, null);
      } else if (response.status === 429) {
        mostrarAlertaGlobalFormulario('loginAlerta', 'Demasiados intentos fallidos. Intenta más tarde.');
      } else {
        mostrarAlertaGlobalFormulario('loginAlerta', response.data.mensaje || 'Error interno al intentar iniciar sesión.');
      }
      return;
    }

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
      marcarInput(form.confirmar, false, null);
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

    mostrarAlertaGlobalFormulario('recuperarAlerta', 'Si el correo está registrado, recibirás un enlace para restablecer tu contraseña.', 'exito');
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
    window.history.pushState({}, document.title, "/");
  });

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
      
      // 1. CREDENCIAL (Abre modal de selección)
      document.getElementById('btnImprimirCredencial').onclick = () => {
          abrirSelectorPlantilla('credencial', m);
      };
      
      // 2. IMPRESIÓN Y GUARDADO DE QR
      document.getElementById('btnImprimirQRMascotaPrivada').onclick = () => {
          estado.qrImpresionActual = m.qr_perfil;
          new bootstrap.Modal(document.getElementById('modalImprimirQR')).show();
      };
      document.getElementById('btnDescargarQRMascotaPrivada').onclick = () => descargarUrl(m.qr_perfil, 'qr.png');
      
      // 3. CARTEL DINÁMICO (Abre modal de selección)
      document.getElementById('btnGenerarCartelBusqueda').onclick = () => {
          abrirSelectorPlantilla('cartel', m);
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
    const m = typeof mEncoded === 'string' ? JSON.parse(mEncoded) : mEncoded;
    document.getElementById('nombreMascotaPublico').textContent = m.nombre;
    document.getElementById('descripcionMascotaPublico').innerHTML = escaparHtml(m.descripcion || 'Sin descripción');
    const foto = document.getElementById('fotoMascotaPublico');
    foto.src = m.foto_url || '';
    m.foto_url ? foto.classList.remove('d-none') : foto.classList.add('d-none');
    
    const esPerdida = m.esta_perdida === true || m.esta_perdida === 'true';
    document.getElementById('alertaMascotaPerdidaPublico').classList.toggle('d-none', !esPerdida);

    const secContacto = document.getElementById('seccionContactoDuenoPublico');
    const secMapa = document.getElementById('contenedorMapaPerfilPublico');

    if (esPerdida) {
      if (secContacto) {
        secContacto.classList.remove('d-none');
        const tel = m.telefono_dueno || 'No proporcionado';
        const dir = m.direccion_dueno || 'Zona de búsqueda registrada';
        const numLimpio = String(tel).replace(/\D/g, '');
        const msgWA = encodeURIComponent(`Hola, vi el reporte de ${m.nombre} en PetMap y tengo información.`);

        document.getElementById('telefonoDuenoPublico').textContent = tel;
        document.getElementById('direccionDuenoPublico').textContent = dir;

        const btnWA = document.getElementById('btnWhatsappDuenoPublico');
        const btnLlamar = document.getElementById('btnLlamarDuenoPublico');

        if (numLimpio) {
          btnWA.href = `https://wa.me/52${numLimpio}?text=${msgWA}`;
          btnWA.classList.remove('d-none');
          btnLlamar.href = `tel:${numLimpio}`;
          btnLlamar.classList.remove('d-none');
        } else {
          btnWA.classList.add('d-none');
          btnLlamar.classList.add('d-none');
        }
      }

      if (secMapa && m.latitud != null && m.longitud != null) {
        secMapa.classList.remove('d-none');
        setTimeout(() => {
          window.petmapMapas?.mostrarMapaPerfilPublico?.(m.latitud, m.longitud);
        }, 300);
      } else if (secMapa) {
        secMapa.classList.add('d-none');
      }
    } else {
      secContacto?.classList.add('d-none');
      secMapa?.classList.add('d-none');
    }

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
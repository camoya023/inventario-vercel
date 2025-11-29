// =========================================================================
// MÓDULO DE FORMULARIO DE CLIENTE - VERCEL
// =========================================================================

// Variables globales
let esEdicionCliente = false;
let clienteIdActual = null;
let direccionesData = [];
let contactosData = [];

// =========================================================================
// INICIALIZACIÓN DEL FORMULARIO
// =========================================================================

function inicializarFormularioNuevoCliente() {
  console.log('[FormularioCliente] Inicializando formulario - NUEVO CLIENTE');

  esEdicionCliente = false;
  clienteIdActual = null;
  direccionesData = [];
  contactosData = [];

  const titulo = document.getElementById('titulo-form-cliente');
  if (titulo) titulo.textContent = 'Nuevo Cliente';

  limpiarFormularioCliente();
  configurarEventListenersFormulario();

  console.log('[FormularioCliente] Formulario nuevo cliente inicializado');
}

async function inicializarFormularioEditarCliente(clienteId, clienteNombre) {
  console.log('[FormularioCliente] Inicializando formulario - EDITAR CLIENTE');
  console.log('[FormularioCliente] Cliente ID:', clienteId);

  esEdicionCliente = true;
  clienteIdActual = clienteId;
  direccionesData = [];
  contactosData = [];

  const titulo = document.getElementById('titulo-form-cliente');
  if (titulo) titulo.textContent = `Editar Cliente: ${clienteNombre || ''}`;

  configurarEventListenersFormulario();

  try {
    mostrarCargandoFormulario(true);
    await cargarDatosCliente(clienteId);
    mostrarCargandoFormulario(false);
    console.log('[FormularioCliente] Datos del cliente cargados');
  } catch (error) {
    mostrarCargandoFormulario(false);
    console.error('[FormularioCliente] Error cargando datos:', error);
    showNotification(error.message || 'Error al cargar datos del cliente', 'error');
  }
}

// =========================================================================
// CONFIGURACIÓN DE EVENT LISTENERS
// =========================================================================

function configurarEventListenersFormulario() {
  console.log('[FormularioCliente] Configurando event listeners...');

  // Botón Cancelar
  const btnCancelar = document.getElementById('btn-cancelar-cliente');
  if (btnCancelar) {
    btnCancelar.addEventListener('click', function() {
      console.log('[FormularioCliente] Cancelar clickeado');
      cargarVistaClientes();
    });
  }

  // Formulario Submit
  const form = document.getElementById('form-cliente');
  if (form) {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      console.log('[FormularioCliente] Submit del formulario');
      guardarCliente();
    });
  }

  // Botón toggle detalles
  const btnToggle = document.getElementById('btn-toggle-detalles-cliente');
  const seccionDetalles = document.getElementById('seccion-detalles-expandibles-cliente');
  if (btnToggle && seccionDetalles) {
    btnToggle.addEventListener('click', function() {
      const isExpanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', String(!isExpanded));
      seccionDetalles.classList.toggle('collapsed', isExpanded);

      // Cambiar ícono principal (plus/minus)
      const mainIcon = this.querySelector('i.fa-plus-circle, i.fa-minus-circle');
      if (mainIcon) {
        mainIcon.classList.toggle('fa-plus-circle', isExpanded);
        mainIcon.classList.toggle('fa-minus-circle', !isExpanded);
      }

      // Cambiar chevron
      const chevronIcon = this.querySelector('i.fa-chevron-down, i.fa-chevron-up');
      if (chevronIcon) {
        chevronIcon.classList.toggle('fa-chevron-down', isExpanded);
        chevronIcon.classList.toggle('fa-chevron-up', !isExpanded);
      }
    });
  }

  // Event listeners de direcciones
  configurarEventListenersDirecciones();

  // Event listeners de contactos
  configurarEventListenersContactos();

  console.log('[FormularioCliente] Event listeners configurados');
}

// =========================================================================
// DIRECCIONES - Event Listeners
// =========================================================================

function configurarEventListenersDirecciones() {
  console.log('[FormularioCliente] Configurando event listeners de direcciones...');

  // Botón añadir dirección
  const btnAbrirModal = document.getElementById('btn-abrir-modal-nueva-direccion');
  console.log('[FormularioCliente] Botón añadir dirección encontrado:', btnAbrirModal ? 'SÍ' : 'NO');

  if (btnAbrirModal) {
    btnAbrirModal.addEventListener('click', function() {
      console.log('[FormularioCliente] Click en botón añadir dirección');
      abrirModalDireccion();
    });
  }

  // Botón guardar dirección
  const btnGuardar = document.getElementById('btn-guardar-modal-direccion');
  if (btnGuardar) {
    btnGuardar.addEventListener('click', function() {
      guardarDireccion();
    });
  }

  // Botones cancelar modal
  const btnCancelar = document.getElementById('btn-cancelar-modal-direccion');
  const btnCerrar = document.getElementById('btn-cerrar-modal-direccion');
  if (btnCancelar) {
    btnCancelar.addEventListener('click', function() {
      cerrarModalDireccion();
    });
  }
  if (btnCerrar) {
    btnCerrar.addEventListener('click', function() {
      cerrarModalDireccion();
    });
  }
}

function abrirModalDireccion(index = null) {
  console.log('[FormularioCliente] Abriendo modal de dirección...');

  try {
    const modal = document.getElementById('modal-direccion-cliente');
    const titulo = document.getElementById('modal-direccion-titulo');
    const form = document.getElementById('form-direccion-cliente');

    console.log('[FormularioCliente] Modal encontrado:', modal ? 'SÍ' : 'NO');
    console.log('[FormularioCliente] Form encontrado:', form ? 'SÍ' : 'NO');

    if (!modal || !form) {
      console.error('[FormularioCliente] ❌ No se pudo abrir modal - elementos no encontrados');
      return;
    }

    // Limpiar formulario
    console.log('[FormularioCliente] Limpiando formulario...');
    form.reset();

    console.log('[FormularioCliente] Limpiando errores...');
    limpiarErroresDireccion();

    if (index !== null && direccionesData[index]) {
      // Modo edición
      console.log('[FormularioCliente] Modo edición - índice:', index);
      if (titulo) titulo.textContent = 'Editar Dirección';
      const dir = direccionesData[index];

      document.getElementById('input-index-direccion').value = index;
      document.getElementById('input-nombre-referencia-direccion').value = dir.nombre_referencia_direccion || '';
      document.getElementById('input-direccion-completa').value = dir.direccion_completa || '';
      document.getElementById('input-barrio-direccion').value = dir.barrio || '';
      document.getElementById('input-ciudad-direccion').value = dir.ciudad_municipio || '';
      document.getElementById('textarea-indicaciones-direccion').value = dir.indicaciones_adicionales || '';
      document.getElementById('checkbox-predeterminada-envio').checked = dir.es_direccion_envio_predeterminada || false;
      document.getElementById('checkbox-predeterminada-facturacion').checked = dir.es_direccion_facturacion_predeterminada || false;
    } else {
      // Modo creación
      console.log('[FormularioCliente] Modo creación');
      if (titulo) titulo.textContent = 'Añadir Nueva Dirección';
      document.getElementById('input-index-direccion').value = '';
    }

    console.log('[FormularioCliente] ✅ Mostrando modal...');
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    console.log('[FormularioCliente] Display aplicado:', modal.style.display);
    console.log('[FormularioCliente] Computed display:', window.getComputedStyle(modal).display);
    console.log('[FormularioCliente] z-index:', window.getComputedStyle(modal).zIndex);

  } catch (error) {
    console.error('[FormularioCliente] ❌ Error al abrir modal:', error);
  }
}

function cerrarModalDireccion() {
  const modal = document.getElementById('modal-direccion-cliente');
  if (modal) {
    modal.style.display = 'none';
  }
}

function guardarDireccion() {
  if (!validarFormularioDireccion()) {
    return;
  }

  const indexInput = document.getElementById('input-index-direccion');
  const index = indexInput.value !== '' ? parseInt(indexInput.value) : null;

  const direccion = {
    nombre_referencia_direccion: document.getElementById('input-nombre-referencia-direccion').value.trim() || null,
    direccion_completa: document.getElementById('input-direccion-completa').value.trim(),
    barrio: document.getElementById('input-barrio-direccion').value.trim(),
    ciudad_municipio: document.getElementById('input-ciudad-direccion').value.trim(),
    indicaciones_adicionales: document.getElementById('textarea-indicaciones-direccion').value.trim() || null,
    es_direccion_envio_predeterminada: document.getElementById('checkbox-predeterminada-envio').checked,
    es_direccion_facturacion_predeterminada: document.getElementById('checkbox-predeterminada-facturacion').checked,
    activa: true
  };

  if (index !== null) {
    // Editar existente
    direccionesData[index] = direccion;
  } else {
    // Agregar nueva
    direccionesData.push(direccion);
  }

  renderizarListaDirecciones();
  cerrarModalDireccion();
  showNotification('Dirección guardada', 'success');
}

function validarFormularioDireccion() {
  limpiarErroresDireccion();

  let esValido = true;

  const direccionCompleta = document.getElementById('input-direccion-completa').value.trim();
  if (!direccionCompleta) {
    mostrarErrorCampoDireccion('direccion-completa', 'La dirección completa es requerida');
    esValido = false;
  }

  const barrio = document.getElementById('input-barrio-direccion').value.trim();
  if (!barrio) {
    mostrarErrorCampoDireccion('barrio-direccion', 'El barrio es requerido');
    esValido = false;
  }

  const ciudad = document.getElementById('input-ciudad-direccion').value.trim();
  if (!ciudad) {
    mostrarErrorCampoDireccion('ciudad-direccion', 'La ciudad es requerida');
    esValido = false;
  }

  return esValido;
}

function limpiarErroresDireccion() {
  const form = document.getElementById('form-direccion-cliente');
  if (form) {
    form.querySelectorAll('.validation-message').forEach(el => el.textContent = '');
    form.querySelectorAll('.form-input').forEach(el => el.classList.remove('form-input-error'));
  }
}

function mostrarErrorCampoDireccion(nombreCampo, mensaje) {
  const errorElement = document.getElementById(`error-${nombreCampo}`);
  const inputElement = document.getElementById(`input-${nombreCampo}`) ||
                       document.getElementById(`textarea-${nombreCampo}`);

  if (errorElement) errorElement.textContent = mensaje;
  if (inputElement) inputElement.classList.add('form-input-error');
}

function renderizarListaDirecciones() {
  const lista = document.getElementById('lista-direcciones-cliente');
  if (!lista) return;

  if (direccionesData.length === 0) {
    lista.innerHTML = '<p class="empty-list-message">No hay direcciones añadidas.</p>';
    return;
  }

  const html = direccionesData.map((dir, index) => {
    const badges = [];
    if (dir.es_direccion_envio_predeterminada) {
      badges.push('<span class="badge-direccion badge-envio">Envío</span>');
    }
    if (dir.es_direccion_facturacion_predeterminada) {
      badges.push('<span class="badge-direccion badge-facturacion">Facturación</span>');
    }

    return `
      <div class="sub-item-card">
        <div class="sub-item-card-header">
          <div class="sub-item-card-title">
            ${escapeHtml(dir.nombre_referencia_direccion || 'Sin nombre')}
            ${badges.join(' ')}
          </div>
          <div class="sub-item-card-actions">
            <button type="button" class="button-icon button-icon-warning" onclick="editarDireccion(${index})" title="Editar">
              <i class="fas fa-pencil-alt"></i>
            </button>
            <button type="button" class="button-icon button-icon-danger" onclick="eliminarDireccion(${index})" title="Eliminar">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>
        <div class="sub-item-card-body">
          <strong>${escapeHtml(dir.direccion_completa)}</strong><br>
          ${escapeHtml(dir.barrio)}, ${escapeHtml(dir.ciudad_municipio)}
          ${dir.indicaciones_adicionales ? '<br><small>' + escapeHtml(dir.indicaciones_adicionales) + '</small>' : ''}
        </div>
      </div>
    `;
  }).join('');

  lista.innerHTML = html;
}

function editarDireccion(index) {
  abrirModalDireccion(index);
}

function eliminarDireccion(index) {
  if (confirm('¿Estás seguro de que quieres eliminar esta dirección?')) {
    direccionesData.splice(index, 1);
    renderizarListaDirecciones();
    showNotification('Dirección eliminada', 'success');
  }
}

// =========================================================================
// CONTACTOS - Event Listeners
// =========================================================================

function configurarEventListenersContactos() {
  console.log('[FormularioCliente] Configurando event listeners de contactos...');

  // Botón añadir contacto
  const btnAbrirModal = document.getElementById('btn-abrir-modal-nuevo-contacto');
  console.log('[FormularioCliente] Botón añadir contacto encontrado:', btnAbrirModal ? 'SÍ' : 'NO');

  if (btnAbrirModal) {
    btnAbrirModal.addEventListener('click', function() {
      console.log('[FormularioCliente] Click en botón añadir contacto');
      abrirModalContacto();
    });
  }

  // Botón guardar contacto
  const btnGuardar = document.getElementById('btn-guardar-modal-contacto');
  if (btnGuardar) {
    btnGuardar.addEventListener('click', function() {
      guardarContacto();
    });
  }

  // Botones cancelar modal
  const btnCancelar = document.getElementById('btn-cancelar-modal-contacto');
  const btnCerrar = document.getElementById('btn-cerrar-modal-contacto');
  if (btnCancelar) {
    btnCancelar.addEventListener('click', function() {
      cerrarModalContacto();
    });
  }
  if (btnCerrar) {
    btnCerrar.addEventListener('click', function() {
      cerrarModalContacto();
    });
  }
}

function abrirModalContacto(index = null) {
  console.log('[FormularioCliente] Abriendo modal de contacto...');

  try {
    const modal = document.getElementById('modal-contacto-cliente');
    const titulo = document.getElementById('modal-contacto-titulo');
    const form = document.getElementById('form-contacto-cliente');

    console.log('[FormularioCliente] Modal contacto encontrado:', modal ? 'SÍ' : 'NO');
    console.log('[FormularioCliente] Form contacto encontrado:', form ? 'SÍ' : 'NO');

    if (!modal || !form) {
      console.error('[FormularioCliente] ❌ No se pudo abrir modal contacto - elementos no encontrados');
      return;
    }

    // Limpiar formulario
    console.log('[FormularioCliente] Limpiando formulario contacto...');
    form.reset();

    console.log('[FormularioCliente] Limpiando errores contacto...');
    limpiarErroresContacto();

    if (index !== null && contactosData[index]) {
      // Modo edición
      console.log('[FormularioCliente] Modo edición contacto - índice:', index);
      if (titulo) titulo.textContent = 'Editar Contacto';
      const cont = contactosData[index];

      document.getElementById('input-index-contacto').value = index;
      document.getElementById('input-nombre-contacto').value = cont.nombre_contacto || '';
      document.getElementById('input-rol-contacto').value = cont.rol_o_parentesco || '';
      document.getElementById('input-telefono-contacto').value = cont.numero_telefono || '';
      document.getElementById('input-email-contacto').value = cont.email || '';
      document.getElementById('input-tipo-contacto').value = cont.tipo_contacto || '';
      document.getElementById('textarea-notas-contacto').value = cont.notas || '';
    } else {
      // Modo creación
      console.log('[FormularioCliente] Modo creación contacto');
      if (titulo) titulo.textContent = 'Añadir Nuevo Contacto';
      document.getElementById('input-index-contacto').value = '';
    }

    console.log('[FormularioCliente] ✅ Mostrando modal contacto...');
    modal.style.display = 'flex';
    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    console.log('[FormularioCliente] Display aplicado contacto:', modal.style.display);
    console.log('[FormularioCliente] Computed display contacto:', window.getComputedStyle(modal).display);

  } catch (error) {
    console.error('[FormularioCliente] ❌ Error al abrir modal contacto:', error);
  }
}

function cerrarModalContacto() {
  const modal = document.getElementById('modal-contacto-cliente');
  if (modal) {
    modal.style.display = 'none';
  }
}

function guardarContacto() {
  if (!validarFormularioContacto()) {
    return;
  }

  const indexInput = document.getElementById('input-index-contacto');
  const index = indexInput.value !== '' ? parseInt(indexInput.value) : null;

  const contacto = {
    nombre_contacto: document.getElementById('input-nombre-contacto').value.trim(),
    rol_o_parentesco: document.getElementById('input-rol-contacto').value.trim() || null,
    numero_telefono: document.getElementById('input-telefono-contacto').value.trim() || null,
    email: document.getElementById('input-email-contacto').value.trim() || null,
    tipo_contacto: document.getElementById('input-tipo-contacto').value.trim() || null,
    notas: document.getElementById('textarea-notas-contacto').value.trim() || null
  };

  if (index !== null) {
    // Editar existente
    contactosData[index] = contacto;
  } else {
    // Agregar nuevo
    contactosData.push(contacto);
  }

  renderizarListaContactos();
  cerrarModalContacto();
  showNotification('Contacto guardado', 'success');
}

function validarFormularioContacto() {
  limpiarErroresContacto();

  let esValido = true;

  const nombre = document.getElementById('input-nombre-contacto').value.trim();
  if (!nombre) {
    mostrarErrorCampoContacto('nombre-contacto', 'El nombre del contacto es requerido');
    esValido = false;
  }

  return esValido;
}

function limpiarErroresContacto() {
  const form = document.getElementById('form-contacto-cliente');
  if (form) {
    form.querySelectorAll('.validation-message').forEach(el => el.textContent = '');
    form.querySelectorAll('.form-input').forEach(el => el.classList.remove('form-input-error'));
  }
}

function mostrarErrorCampoContacto(nombreCampo, mensaje) {
  const errorElement = document.getElementById(`error-${nombreCampo}`);
  const inputElement = document.getElementById(`input-${nombreCampo}`) ||
                       document.getElementById(`textarea-${nombreCampo}`);

  if (errorElement) errorElement.textContent = mensaje;
  if (inputElement) inputElement.classList.add('form-input-error');
}

function renderizarListaContactos() {
  const lista = document.getElementById('lista-contactos-adicionales-cliente');
  if (!lista) return;

  if (contactosData.length === 0) {
    lista.innerHTML = '<p class="empty-list-message">No hay contactos adicionales añadidos.</p>';
    return;
  }

  const html = contactosData.map((cont, index) => {
    return `
      <div class="sub-item-card">
        <div class="sub-item-card-header">
          <div class="sub-item-card-title">
            ${escapeHtml(cont.nombre_contacto)}
            ${cont.rol_o_parentesco ? ' - ' + escapeHtml(cont.rol_o_parentesco) : ''}
          </div>
          <div class="sub-item-card-actions">
            <button type="button" class="button-icon button-icon-warning" onclick="editarContacto(${index})" title="Editar">
              <i class="fas fa-pencil-alt"></i>
            </button>
            <button type="button" class="button-icon button-icon-danger" onclick="eliminarContacto(${index})" title="Eliminar">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </div>
        <div class="sub-item-card-body">
          ${cont.numero_telefono ? '<strong>📞 ' + escapeHtml(cont.numero_telefono) + '</strong><br>' : ''}
          ${cont.email ? '<small>✉️ ' + escapeHtml(cont.email) + '</small><br>' : ''}
          ${cont.tipo_contacto ? '<small>' + escapeHtml(cont.tipo_contacto) + '</small><br>' : ''}
          ${cont.notas ? '<small style="color: #666;">' + escapeHtml(cont.notas) + '</small>' : ''}
        </div>
      </div>
    `;
  }).join('');

  lista.innerHTML = html;
}

function editarContacto(index) {
  abrirModalContacto(index);
}

function eliminarContacto(index) {
  if (confirm('¿Estás seguro de que quieres eliminar este contacto?')) {
    contactosData.splice(index, 1);
    renderizarListaContactos();
    showNotification('Contacto eliminado', 'success');
  }
}

// =========================================================================
// CARGAR DATOS DEL CLIENTE (MODO EDICIÓN)
// =========================================================================

async function cargarDatosCliente(clienteId) {
  console.log('[FormularioCliente] Cargando datos del cliente:', clienteId);

  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Cliente de Supabase no inicializado');
  }

  // Obtener datos del cliente con relaciones
  const { data, error } = await client
    .from('clientes')
    .select(`
      *,
      direcciones_cliente(*),
      contactos_adicionales_cliente(*)
    `)
    .eq('id', clienteId)
    .single();

  if (error) {
    console.error('[FormularioCliente] Error al obtener cliente:', error);
    throw new Error(error.message || 'Error al obtener datos del cliente');
  }

  if (!data) {
    throw new Error('Cliente no encontrado');
  }

  console.log('[FormularioCliente] Datos obtenidos:', data);

  // Llenar formulario
  document.getElementById('input-id-cliente').value = data.id || '';
  document.getElementById('input-codigo-cliente').value = data.codigo_cliente || '';
  document.getElementById('select-estado-cliente').value = data.estado || 'Activo';
  document.getElementById('input-nombres-cliente').value = data.nombres || '';
  document.getElementById('input-apellidos-cliente').value = data.apellidos || '';
  document.getElementById('input-razon-social-cliente').value = data.razon_social || '';
  document.getElementById('input-telefono-principal-cliente').value = data.telefono_principal || '';
  document.getElementById('textarea-notas-internas-cliente').value = data.notas_internas || '';

  // Cargar direcciones
  direccionesData = data.direcciones_cliente || [];
  renderizarListaDirecciones();

  // Cargar contactos
  contactosData = data.contactos_adicionales_cliente || [];
  renderizarListaContactos();
}

// =========================================================================
// VALIDACIÓN Y GUARDADO
// =========================================================================

function validarFormularioCliente() {
  console.log('[FormularioCliente] Validando formulario...');

  let esValido = true;

  // Limpiar errores previos
  document.querySelectorAll('.validation-message').forEach(el => el.textContent = '');
  document.querySelectorAll('.form-input, .form-input-select').forEach(el => el.classList.remove('form-input-error'));

  // Validar Nombres (requerido)
  const nombres = document.getElementById('input-nombres-cliente').value.trim();
  if (!nombres) {
    mostrarErrorCampo('nombres-cliente', 'El nombre es requerido');
    esValido = false;
  }

  // Validar Teléfono (requerido)
  const telefono = document.getElementById('input-telefono-principal-cliente').value.trim();
  if (!telefono) {
    mostrarErrorCampo('telefono-principal-cliente', 'El teléfono principal es requerido');
    esValido = false;
  }

  // Validar que tenga al menos uno: apellidos o razón social
  const apellidos = document.getElementById('input-apellidos-cliente').value.trim();
  const razonSocial = document.getElementById('input-razon-social-cliente').value.trim();

  if (!apellidos && !razonSocial) {
    mostrarErrorCampo('apellidos-cliente', 'Debe ingresar apellidos o razón social');
    mostrarErrorCampo('razon-social-cliente', 'Debe ingresar apellidos o razón social');
    esValido = false;
  }

  console.log('[FormularioCliente] Validación:', esValido ? 'VÁLIDO' : 'INVÁLIDO');
  return esValido;
}

async function guardarCliente() {
  console.log('[FormularioCliente] Iniciando guardado...');

  // Validar formulario
  if (!validarFormularioCliente()) {
    showNotification('Por favor, completa todos los campos requeridos', 'warning');
    return;
  }

  try {
    mostrarCargandoBoton(true);

    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    // Recopilar datos del formulario
    const datosPrincipales = {
      codigo_cliente: document.getElementById('input-codigo-cliente').value.trim() || null,
      estado: document.getElementById('select-estado-cliente').value,
      nombres: document.getElementById('input-nombres-cliente').value.trim(),
      apellidos: document.getElementById('input-apellidos-cliente').value.trim() || null,
      razon_social: document.getElementById('input-razon-social-cliente').value.trim() || null,
      telefono_principal: document.getElementById('input-telefono-principal-cliente').value.trim(),
      notas_internas: document.getElementById('textarea-notas-internas-cliente').value.trim() || null
    };

    console.log('[FormularioCliente] Datos a guardar:', datosPrincipales);
    console.log('[FormularioCliente] Direcciones:', direccionesData.length);
    console.log('[FormularioCliente] Contactos:', contactosData.length);
    console.log('[FormularioCliente] Es edición:', esEdicionCliente);
    console.log('[FormularioCliente] Cliente ID:', clienteIdActual);

    // Preparar payload para RPC
    const payload = {
      p_cliente_data: datosPrincipales,
      p_direcciones_data: direccionesData,
      p_contactos_data: contactosData,
      p_es_edicion: esEdicionCliente,
      p_cliente_id_existente: esEdicionCliente ? clienteIdActual : null
    };

    console.log('[FormularioCliente] Llamando a RPC fn_guardar_cliente_completo...');

    // Llamar a RPC
    const { data, error } = await client.rpc('fn_guardar_cliente_completo', payload);

    if (error) {
      console.error('[FormularioCliente] Error en RPC:', error);
      throw new Error(error.message || 'Error al guardar el cliente');
    }

    console.log('[FormularioCliente] Respuesta de RPC:', data);

    // Verificar respuesta
    if (data && data.success === false) {
      console.error('[FormularioCliente] RPC rechazó la operación:', data.mensaje);
      throw new Error(data.mensaje || 'Error al guardar el cliente');
    }

    if (data && data.success === true) {
      console.log('[FormularioCliente] ✓ Cliente guardado exitosamente');
      const mensajeExito = data.mensaje || (esEdicionCliente ? 'Cliente actualizado exitosamente' : 'Cliente creado exitosamente');
      showNotification(mensajeExito, 'success');

      // Volver a la lista
      setTimeout(() => {
        cargarVistaClientes();
      }, 1500);
    } else {
      throw new Error('Respuesta inesperada del servidor');
    }

  } catch (error) {
    console.error('[FormularioCliente] Error al guardar:', error);
    showNotification(error.message || 'Error al guardar el cliente', 'error');
  } finally {
    mostrarCargandoBoton(false);
  }
}

// =========================================================================
// FUNCIONES AUXILIARES
// =========================================================================

function limpiarFormularioCliente() {
  console.log('[FormularioCliente] Limpiando formulario...');

  document.getElementById('input-id-cliente').value = '';
  document.getElementById('input-codigo-cliente').value = '';
  document.getElementById('select-estado-cliente').value = 'Activo';
  document.getElementById('input-nombres-cliente').value = '';
  document.getElementById('input-apellidos-cliente').value = '';
  document.getElementById('input-razon-social-cliente').value = '';
  document.getElementById('input-telefono-principal-cliente').value = '';
  document.getElementById('textarea-notas-internas-cliente').value = '';

  direccionesData = [];
  contactosData = [];

  renderizarListaDirecciones();
  renderizarListaContactos();

  // Limpiar mensajes de error
  document.querySelectorAll('.validation-message').forEach(el => el.textContent = '');
  document.querySelectorAll('.form-input, .form-input-select').forEach(el => el.classList.remove('form-input-error'));
}

function mostrarErrorCampo(nombreCampo, mensaje) {
  const errorElement = document.getElementById(`error-${nombreCampo}`);
  const inputElement = document.getElementById(`input-${nombreCampo}`) ||
                       document.getElementById(`select-${nombreCampo}`) ||
                       document.getElementById(`textarea-${nombreCampo}`);

  if (errorElement) errorElement.textContent = mensaje;
  if (inputElement) inputElement.classList.add('form-input-error');
}

function mostrarCargandoFormulario(mostrar) {
  const container = document.querySelector('.form-container-cliente');
  if (!container) return;

  if (mostrar) {
    container.style.opacity = '0.6';
    container.style.pointerEvents = 'none';
  } else {
    container.style.opacity = '1';
    container.style.pointerEvents = 'auto';
  }
}

function mostrarCargandoBoton(mostrar) {
  const btnGuardar = document.getElementById('btn-guardar-cliente');
  if (!btnGuardar) return;

  if (mostrar) {
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
  } else {
    btnGuardar.disabled = false;
    btnGuardar.innerHTML = 'Guardar Cliente';
  }
}

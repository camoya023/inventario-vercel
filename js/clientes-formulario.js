// =========================================================================
// MÓDULO DE FORMULARIO DE CLIENTE - VERCEL
// =========================================================================

// Variables globales
let esEdicionCliente = false;
let clienteIdActual = null;

// =========================================================================
// INICIALIZACIÓN DEL FORMULARIO
// =========================================================================

/**
 * Inicializa el formulario de cliente en modo CREACIÓN
 */
function inicializarFormularioNuevoCliente() {
  console.log('[FormularioCliente] Inicializando formulario - NUEVO CLIENTE');

  esEdicionCliente = false;
  clienteIdActual = null;

  // Cambiar título
  const titulo = document.getElementById('titulo-form-cliente');
  if (titulo) titulo.textContent = 'Nuevo Cliente';

  // Limpiar formulario
  limpiarFormularioCliente();

  // Configurar event listeners
  configurarEventListenersFormulario();

  console.log('[FormularioCliente] Formulario nuevo cliente inicializado');
}

/**
 * Inicializa el formulario de cliente en modo EDICIÓN
 */
async function inicializarFormularioEditarCliente(clienteId, clienteNombre) {
  console.log('[FormularioCliente] Inicializando formulario - EDITAR CLIENTE');
  console.log('[FormularioCliente] Cliente ID:', clienteId);

  esEdicionCliente = true;
  clienteIdActual = clienteId;

  // Cambiar título
  const titulo = document.getElementById('titulo-form-cliente');
  if (titulo) titulo.textContent = `Editar Cliente: ${clienteNombre || ''}`;

  // Configurar event listeners
  configurarEventListenersFormulario();

  // Cargar datos del cliente
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

  console.log('[FormularioCliente] Event listeners configurados');
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

  // Obtener datos del cliente
  const { data, error } = await client
    .from('clientes')
    .select('*')
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

  // Llenar el formulario
  document.getElementById('input-id-cliente').value = data.id || '';
  document.getElementById('input-codigo-cliente').value = data.codigo_cliente || '';
  document.getElementById('select-estado-cliente').value = data.estado || 'Activo';
  document.getElementById('input-nombres-cliente').value = data.nombres || '';
  document.getElementById('input-apellidos-cliente').value = data.apellidos || '';
  document.getElementById('input-razon-social-cliente').value = data.razon_social || '';
  document.getElementById('input-telefono-principal-cliente').value = data.telefono_principal || '';
  document.getElementById('textarea-notas-internas-cliente').value = data.notas_internas || '';
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
    console.log('[FormularioCliente] Es edición:', esEdicionCliente);
    console.log('[FormularioCliente] Cliente ID:', clienteIdActual);

    // Preparar payload para RPC
    const payload = {
      p_cliente_data: datosPrincipales,
      p_direcciones_data: [],
      p_contactos_data: [],
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

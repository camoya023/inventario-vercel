// =========================================================================
// MÓDULO DE VISTA DE DETALLE DE CLIENTE - VERCEL
// =========================================================================

console.log('🔵 [ClienteDetalle] Módulo cargado - Versión con logs debug');

// Variable global para almacenar el ID del cliente actual
let clienteIdActualDetalle = null;

// =========================================================================
// INICIALIZACIÓN DE LA VISTA DE DETALLE
// =========================================================================

/**
 * Inicializa la vista de detalle del cliente
 * @param {string} clienteId - ID del cliente a mostrar
 */
async function inicializarVistaDetalleCliente(clienteId) {
  console.log('[ClienteDetalle] Inicializando vista de detalle para cliente:', clienteId);

  clienteIdActualDetalle = clienteId;

  // Esperar un momento para que el DOM esté completamente listo
  await new Promise(resolve => setTimeout(resolve, 50));

  // Configurar event listeners
  configurarEventListenersDetalleCliente();

  // Configurar tabs
  configurarTabs();

  // Cargar datos del cliente
  await cargarDatosDetalleCliente(clienteId);

  console.log('[ClienteDetalle] Vista de detalle inicializada');
}

// =========================================================================
// CONFIGURACIÓN DE EVENT LISTENERS
// =========================================================================

function configurarEventListenersDetalleCliente() {
  console.log('[ClienteDetalle] Configurando event listeners...');

  // Botón Volver
  const btnVolver = document.getElementById('btn-volver-a-lista-clientes');
  console.log('[ClienteDetalle] Botón Volver encontrado:', !!btnVolver);
  if (btnVolver) {
    btnVolver.addEventListener('click', function() {
      console.log('[ClienteDetalle] Click en Volver - Cargando lista de clientes');
      cargarVistaClientes();
    });
  } else {
    console.error('[ClienteDetalle] ⚠️ Botón Volver NO encontrado en el DOM');
  }

  // Botón Editar
  const btnEditar = document.getElementById('btn-editar-cliente-desde-detalle');
  console.log('[ClienteDetalle] Botón Editar encontrado:', !!btnEditar);
  if (btnEditar) {
    btnEditar.addEventListener('click', function() {
      console.log('[ClienteDetalle] Click en Editar cliente:', clienteIdActualDetalle);
      const nombreElement = document.getElementById('detalle-cliente-nombre');
      const clienteNombre = nombreElement ? nombreElement.textContent.replace('Cliente: ', '') : '';
      cargarFormularioEditarCliente(clienteIdActualDetalle, clienteNombre);
    });
  } else {
    console.error('[ClienteDetalle] ⚠️ Botón Editar NO encontrado en el DOM');
  }

  console.log('[ClienteDetalle] Event listeners configurados');
}

function configurarTabs() {
  const tabItems = document.querySelectorAll('.tab-item a');

  tabItems.forEach(tabLink => {
    tabLink.addEventListener('click', function(e) {
      e.preventDefault();

      const targetTabId = this.getAttribute('data-tab');

      // Remover clase activa de todos los tabs
      document.querySelectorAll('.tab-item').forEach(item => item.classList.remove('is-active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('is-active'));

      // Agregar clase activa al tab clickeado
      this.parentElement.classList.add('is-active');

      // Mostrar el contenido correspondiente
      const targetContent = document.getElementById(targetTabId);
      if (targetContent) {
        targetContent.classList.add('is-active');
      }
    });
  });
}

// =========================================================================
// CARGA DE DATOS DEL CLIENTE
// =========================================================================

async function cargarDatosDetalleCliente(clienteId) {
  console.log('[ClienteDetalle] Cargando datos del cliente:', clienteId);

  const nombreElement = document.getElementById('detalle-cliente-nombre');
  const estadoBadge = document.getElementById('detalle-cliente-estado-badge');

  // Mostrar estado de carga
  if (nombreElement) nombreElement.textContent = 'Cargando...';
  if (estadoBadge) {
    estadoBadge.textContent = 'Cargando...';
    estadoBadge.className = 'badge badge-secondary';
  }

  try {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    // Obtener datos del cliente con relaciones
    const { data: cliente, error } = await client
      .from('clientes')
      .select(`
        *,
        direcciones_cliente(*),
        contactos_adicionales_cliente(*)
      `)
      .eq('id', clienteId)
      .single();

    if (error) {
      console.error('[ClienteDetalle] Error al obtener cliente:', error);
      throw new Error(error.message || 'Error al obtener datos del cliente');
    }

    if (!cliente) {
      throw new Error('Cliente no encontrado');
    }

    console.log('[ClienteDetalle] Datos obtenidos:', cliente);

    // Obtener KPIs del cliente
    const kpis = await obtenerKPIsCliente(clienteId);
    cliente.kpis = kpis;

    // Obtener historial
    const historial = await obtenerHistorialCliente(clienteId);
    cliente.historial = historial;

    // Renderizar datos
    renderizarDatosCliente(cliente);

    console.log('[ClienteDetalle] Datos renderizados exitosamente');

  } catch (error) {
    console.error('[ClienteDetalle] Error al cargar datos:', error);

    if (nombreElement) nombreElement.textContent = 'Error al cargar cliente';
    if (estadoBadge) {
      estadoBadge.textContent = 'Error';
      estadoBadge.className = 'badge badge-danger';
    }

    showNotification(error.message || 'Error al cargar los detalles del cliente', 'error');
  }
}

async function obtenerKPIsCliente(clienteId) {
  try {
    console.log('[ClienteDetalle] Obteniendo KPIs para cliente:', clienteId);
    const client = getSupabaseClient();

    // Llamar a la misma función RPC que usa Apps Script
    const { data, error } = await client
      .rpc('fn_obtener_kpis_cliente', {
        p_cliente_id: clienteId
      });

    if (error) {
      console.error('[ClienteDetalle] Error en RPC fn_obtener_kpis_cliente:', error);
      return {
        ultima_compra_fecha: null,
        ultimo_costo_envio: null,
        total_comprado: 0
      };
    }

    console.log('[ClienteDetalle] ✓ KPIs obtenidos:', data);

    return data || {
      ultima_compra_fecha: null,
      ultimo_costo_envio: null,
      total_comprado: 0
    };

  } catch (error) {
    console.error('[ClienteDetalle] Error obteniendo KPIs:', error);
    return {
      ultima_compra_fecha: null,
      ultimo_costo_envio: null,
      total_comprado: 0
    };
  }
}

async function obtenerHistorialCliente(clienteId) {
  try {
    console.log('[ClienteDetalle] Obteniendo historial para cliente:', clienteId);
    const client = getSupabaseClient();

    // Llamar a la misma función RPC que usa Apps Script
    const { data, error } = await client
      .rpc('fn_obtener_historial_actividad_cliente', {
        p_cliente_id: clienteId
      });

    if (error) {
      console.error('[ClienteDetalle] Error en RPC fn_obtener_historial_actividad_cliente:', error);
      return [];
    }

    console.log('[ClienteDetalle] ✓ Historial obtenido:', data?.length || 0, 'eventos');
    console.log('[ClienteDetalle] Datos del historial:', data);
    return data || [];

  } catch (error) {
    console.error('[ClienteDetalle] Error obteniendo historial:', error);
    return [];
  }
}

// =========================================================================
// RENDERIZADO DE DATOS
// =========================================================================

function renderizarDatosCliente(cliente) {
  // Renderizar encabezado
  const nombreElement = document.getElementById('detalle-cliente-nombre');
  if (nombreElement) {
    const nombreCompleto = `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim();
    nombreElement.textContent = `Cliente: ${nombreCompleto || cliente.razon_social || 'Sin nombre'}`;
  }

  const estadoBadge = document.getElementById('detalle-cliente-estado-badge');
  if (estadoBadge) {
    const estado = cliente.estado || 'Desconocido';
    estadoBadge.textContent = estado;
    estadoBadge.className = `badge ${
      estado === 'Activo' ? 'badge-success' :
      estado === 'Inactivo' ? 'badge-danger' :
      'badge-secondary'
    }`;
  }

  // Renderizar KPIs
  const codigoElement = document.getElementById('detalle-cliente-codigo');
  if (codigoElement) {
    codigoElement.textContent = cliente.codigo_cliente || '-';
  }

  const ultimaCompraElement = document.getElementById('detalle-cliente-ultima-compra');
  if (ultimaCompraElement) {
    if (cliente.kpis?.ultima_compra_fecha) {
      const fecha = new Date(cliente.kpis.ultima_compra_fecha);
      ultimaCompraElement.textContent = fecha.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      });
    } else {
      ultimaCompraElement.textContent = 'Sin compras';
    }
  }

  const ultimoEnvioElement = document.getElementById('detalle-cliente-ultimo-envio');
  if (ultimoEnvioElement) {
    if (typeof cliente.kpis?.ultimo_costo_envio === 'number') {
      ultimoEnvioElement.textContent = cliente.kpis.ultimo_costo_envio.toLocaleString('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
    } else {
      ultimoEnvioElement.textContent = 'N/A';
    }
  }

  const totalCompradoElement = document.getElementById('detalle-cliente-total-comprado');
  if (totalCompradoElement) {
    if (typeof cliente.kpis?.total_comprado === 'number') {
      totalCompradoElement.textContent = cliente.kpis.total_comprado.toLocaleString('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });
    } else {
      totalCompradoElement.textContent = '$0';
    }
  }

  // Renderizar información general
  renderizarInformacionGeneral(cliente);

  // Renderizar direcciones
  renderizarDirecciones(cliente.direcciones_cliente || []);

  // Renderizar contactos
  renderizarContactos(cliente.contactos_adicionales_cliente || []);

  // Renderizar historial
  renderizarHistorial(cliente.historial || []);
}

function renderizarInformacionGeneral(cliente) {
  const elementos = {
    'detalle-info-nombre-completo': `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim() || 'No especificado',
    'detalle-info-telefono': cliente.telefono_principal || 'No especificado',
    'detalle-info-razon-social': cliente.razon_social || 'No especificado',
    'detalle-info-fecha-creacion': formatearFechaCreacion(cliente.fecha_creacion),
    'detalle-info-notas': cliente.notas_internas || 'Sin notas'
  };

  Object.keys(elementos).forEach(id => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = elementos[id];
    }
  });
}

function formatearFechaCreacion(fechaCreacion) {
  if (!fechaCreacion) return 'No disponible';

  try {
    const fecha = new Date(fechaCreacion);
    return fecha.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    return 'Fecha inválida';
  }
}

function renderizarDirecciones(direcciones) {
  const listaDirecciones = document.getElementById('detalle-lista-direcciones');
  if (!listaDirecciones) return;

  if (!direcciones || direcciones.length === 0) {
    listaDirecciones.innerHTML = '<p class="empty-list-message">No hay direcciones registradas.</p>';
    return;
  }

  const htmlDirecciones = direcciones.map(direccion => {
    const esActiva = direccion.activa !== false;
    const claseInactiva = esActiva ? '' : ' direccion-inactiva';

    return `
      <div class="sub-item-display${claseInactiva}">
        <strong>${escapeHtml(direccion.nombre_referencia_direccion || 'Sin nombre')}</strong>
        ${!esActiva ? '<span style="color: #dc3545; font-weight: bold;"> (INACTIVA)</span>' : ''}
        <br>
        ${escapeHtml(direccion.direccion_completa || '-')}
        <br>
        <small>
          ${escapeHtml(direccion.barrio || '-')}, ${escapeHtml(direccion.ciudad_municipio || '-')}
          ${direccion.indicaciones_adicionales ? '<br>' + escapeHtml(direccion.indicaciones_adicionales) : ''}
        </small>
        ${direccion.es_direccion_envio_predeterminada ? '<br><span style="color: #28a745;">✓ Dirección de envío predeterminada</span>' : ''}
        ${direccion.es_direccion_facturacion_predeterminada ? '<br><span style="color: #17a2b8;">✓ Dirección de facturación predeterminada</span>' : ''}
      </div>
    `;
  }).join('');

  listaDirecciones.innerHTML = htmlDirecciones;
}

function renderizarContactos(contactos) {
  const listaContactos = document.getElementById('detalle-lista-contactos');
  if (!listaContactos) return;

  if (!contactos || contactos.length === 0) {
    listaContactos.innerHTML = '<p class="empty-list-message">No hay contactos adicionales registrados.</p>';
    return;
  }

  const htmlContactos = contactos.map(contacto => {
    return `
      <div class="sub-item-display">
        <strong>${escapeHtml(contacto.nombre_contacto || 'Sin nombre')}</strong>
        ${contacto.rol_o_parentesco ? ` - ${escapeHtml(contacto.rol_o_parentesco)}` : ''}
        <br>
        ${contacto.numero_telefono ? `<span class="telefono-contacto"><strong>📞 ${escapeHtml(contacto.numero_telefono)}</strong></span><br>` : ''}
        ${contacto.email ? `<small>✉️ ${escapeHtml(contacto.email)}</small><br>` : ''}
        ${contacto.tipo_contacto ? `<small>${escapeHtml(contacto.tipo_contacto)}</small><br>` : ''}
        ${contacto.notas ? `<small style="color: #666;">${escapeHtml(contacto.notas)}</small>` : ''}
      </div>
    `;
  }).join('');

  listaContactos.innerHTML = htmlContactos;
}

function renderizarHistorial(historial) {
  const historialContainer = document.getElementById('detalle-historial-actividad');
  if (!historialContainer) return;

  if (!historial || historial.length === 0) {
    historialContainer.innerHTML = '<p class="empty-list-message">No hay actividad registrada para este cliente.</p>';
    return;
  }

  const htmlTabla = `
    <table class="data-table-default">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Tipo</th>
          <th>Descripción / Detalles</th>
          <th>Monto</th>
        </tr>
      </thead>
      <tbody>
        ${historial.map(evento => `
          <tr>
            <td>${formatearFecha(evento.fecha_evento)}</td>
            <td>${escapeHtml(evento.tipo_evento || '-')}</td>
            <td>
              ${escapeHtml(evento.descripcion || '-')}
              ${evento.tipo_envio ? '<br><small>📦 ' + escapeHtml(evento.tipo_envio) + '</small>' : ''}
            </td>
            <td>${formatearMoneda(evento.monto)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  historialContainer.innerHTML = htmlTabla;
}

// =========================================================================
// FUNCIONES AUXILIARES
// =========================================================================

function formatearFecha(fecha) {
  if (!fecha) return '-';
  try {
    return new Date(fecha).toLocaleDateString('es-CO');
  } catch (error) {
    return '-';
  }
}

function formatearMoneda(valor) {
  if (valor == null) return '-';
  try {
    return parseFloat(valor).toLocaleString('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  } catch (error) {
    return '-';
  }
}

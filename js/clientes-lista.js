// =========================================================================
// MÓDULO DE LISTA DE CLIENTES - VERCEL
// =========================================================================

// Variables globales del módulo
let clientes_currentPage = 1;
const clientes_rowsPerPage = 10;
let clientes_currentSearchTerm = "";
let clientes_currentFilterEstado = "Activo";
let clientes_isLoading = false;

// =========================================================================
// FUNCIONES PARA OBTENER LISTA DE CLIENTES USANDO SUPABASE RPC
// =========================================================================

/**
 * Obtiene una lista paginada y filtrada de clientes usando Supabase RPC.
 */
async function obtenerListaClientesConSupabase(opciones) {
  try {
    console.log('[Clientes] ===== OBTENIENDO LISTA DE CLIENTES =====');
    console.log('[Clientes] Opciones:', opciones);

    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    const pagina = opciones.pagina || 1;
    const filasPorPagina = opciones.filasPorPagina || 10;
    const terminoBusqueda = opciones.terminoBusqueda || '';
    const filtroEstado = opciones.filtroEstado || '';
    const offset = (pagina - 1) * filasPorPagina;

    const rpcParams = {
      p_limite: filasPorPagina,
      p_offset: offset,
      p_termino_busqueda: terminoBusqueda || null,
      p_filtro_estado: (filtroEstado && filtroEstado !== "Todos" && filtroEstado !== "") ? filtroEstado : null,
      p_orden: "codigo_cliente.desc"
    };

    console.log('[Clientes] Llamando a RPC fn_obtener_clientes_con_resumen...');
    const { data: clientes, error: errorClientes } = await client
      .rpc('fn_obtener_clientes_con_resumen', rpcParams);

    if (errorClientes) {
      console.error('[Clientes] ✗ Error en RPC obtener clientes:', errorClientes);
      throw new Error(errorClientes.message || 'Error al obtener clientes');
    }

    console.log('[Clientes] ✓ Clientes obtenidos:', clientes?.length || 0);

    // Obtener el conteo total
    const countParams = {
      p_termino_busqueda: terminoBusqueda || null,
      p_filtro_estado: (filtroEstado && filtroEstado !== "Todos" && filtroEstado !== "") ? filtroEstado : null
    };

    console.log('[Clientes] Llamando a RPC fn_contar_clientes_con_filtros...');
    const { data: totalClientes, error: errorConteo } = await client
      .rpc('fn_contar_clientes_con_filtros', countParams);

    if (errorConteo) {
      console.warn('[Clientes] ⚠ Error al obtener conteo:', errorConteo);
      const totalFallback = clientes?.length || 0;
      const totalPaginas = Math.ceil(totalFallback / filasPorPagina);

      return {
        clientes: clientes || [],
        totalClientes: totalFallback,
        paginaActual: pagina,
        totalPaginas: totalPaginas,
        filasPorPagina: filasPorPagina,
        error: null
      };
    }

    console.log('[Clientes] ✓ Total de clientes:', totalClientes);

    const totalPaginas = Math.ceil((totalClientes || 0) / filasPorPagina);

    return {
      clientes: clientes || [],
      totalClientes: totalClientes || 0,
      paginaActual: pagina,
      totalPaginas: totalPaginas,
      filasPorPagina: filasPorPagina,
      error: null
    };

  } catch (error) {
    console.error('[Clientes] ✗ Excepción al obtener lista de clientes:', error);
    return {
      clientes: [],
      totalClientes: 0,
      paginaActual: opciones.pagina || 1,
      totalPaginas: 0,
      error: error.message || 'Error desconocido'
    };
  }
}

// =========================================================================
// FUNCIÓN PARA ELIMINAR CLIENTE (LÓGICAMENTE) CON SUPABASE
// =========================================================================

async function eliminarClienteConSupabase(clienteId) {
  try {
    console.log('[Clientes] ===== ELIMINANDO CLIENTE (LÓGICAMENTE) =====');
    console.log('[Clientes] Cliente ID:', clienteId);

    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    console.log('[Clientes] Llamando a RPC fn_eliminar_logicamente_cliente...');
    const { data, error } = await client
      .rpc('fn_eliminar_logicamente_cliente', {
        p_cliente_id: clienteId
      });

    if (error) {
      console.error('[Clientes] ✗ Error de Supabase en RPC:', error);
      throw new Error(error.message || 'Error de comunicación con la base de datos');
    }

    console.log('[Clientes] Respuesta de RPC:', data);

    // Validación de permisos
    if (data && data.success === false) {
      console.log('[Clientes] ❌ La función RPC rechazó la operación:', data.mensaje);

      const esErrorPermisosRPC =
        data.codigo_error === 'PERMISO_DENEGADO' ||
        data.mensaje?.toLowerCase().includes('no tienes permisos');

      if (esErrorPermisosRPC) {
        console.log('[Clientes] ✅ Validación de permisos funcionó');
        throw new Error(data.mensaje);
      }

      throw new Error(data.mensaje || 'La operación fue rechazada por el servidor');
    }

    // Operación exitosa
    if (data && data.success === true) {
      console.log('[Clientes] ✓ Cliente eliminado exitosamente');

      if (data.ya_inactivo) {
        console.log('[Clientes] ℹ El cliente ya estaba inactivo');
      }
      if (data.tiene_ventas) {
        console.log('[Clientes] ℹ El cliente tiene ventas asociadas');
      }

      return {
        success: true,
        mensaje: data.mensaje || 'Cliente desactivado exitosamente',
        cliente_id: data.cliente_id,
        cliente_codigo: data.cliente_codigo,
        cliente_nombre: data.cliente_nombre
      };
    }

    console.error('[Clientes] ✗ Respuesta inesperada de RPC:', data);
    throw new Error('Respuesta inesperada del servidor');

  } catch (error) {
    console.error('[Clientes] ✗ Excepción al eliminar cliente:', error);
    throw error;
  }
}

// =========================================================================
// INICIALIZACIÓN DE LA VISTA DE CLIENTES
// =========================================================================

/**
 * Inicializa la vista de lista de clientes
 * Debe ser llamada después de cargar el HTML de la vista
 */
function inicializarVistaClientes() {
  console.log('[Clientes] Inicializando vista de lista de clientes...');

  // 1. Botón para colapsar/expandir filtros
  const toggleButton = document.getElementById("btn-toggle-filtros-clientes");
  const collapsibleContent = document.getElementById("filtros-clientes-content");

  if (toggleButton && collapsibleContent) {
    toggleButton.addEventListener("click", function () {
      const isCurrentlyExpanded = toggleButton.getAttribute("aria-expanded") === "true";
      collapsibleContent.classList.toggle("collapsed", isCurrentlyExpanded);
      toggleButton.setAttribute("aria-expanded", String(!isCurrentlyExpanded));

      const icon = toggleButton.querySelector("i.fas.fa-chevron-down, i.fas.fa-chevron-up");
      if (icon) {
        icon.classList.toggle("fa-chevron-down", !isCurrentlyExpanded);
        icon.classList.toggle("fa-chevron-up", isCurrentlyExpanded);
      }
    });
  }

  // 2. Botón "+ Nuevo Cliente"
  const btnNuevoCliente = document.getElementById("btn-abrir-modal-nuevo-cliente");
  if (btnNuevoCliente) {
    btnNuevoCliente.addEventListener("click", function () {
      console.log('[Clientes] Botón "+ Nuevo Cliente" clickeado.');
      cargarFormularioNuevoCliente();
    });
  }

  // 3. Campo de Búsqueda
  const inputBuscar = document.getElementById('input-buscar-clientes');
  if (inputBuscar) {
    let searchTimeoutClientes;

    inputBuscar.addEventListener('input', function() {
      clearTimeout(searchTimeoutClientes);

      const terminoActual = this.value.trim();

      if (terminoActual.length === 0 || terminoActual.length >= 3) {
        searchTimeoutClientes = setTimeout(() => {
          console.log('[Clientes] Ejecutando búsqueda:', terminoActual);

          if (clientes_currentSearchTerm !== terminoActual) {
            clientes_currentSearchTerm = terminoActual;
            clientes_currentPage = 1;
            fetchAndRenderClientes();
          }
        }, 500);
      }
    });
  }

  // 4. Filtro por Estado
  const filtroEstado = document.getElementById("filtro-estado-cliente");
  if (filtroEstado) {
    filtroEstado.addEventListener("change", function () {
      clientes_currentFilterEstado = this.value;
      clientes_currentPage = 1;
      fetchAndRenderClientes();
    });
  }

  // 5. Botones Importar/Exportar
  const btnImportar = document.getElementById("btn-importar-clientes");
  if (btnImportar) {
    btnImportar.addEventListener("click", function () {
      console.log('[Clientes] Importar clickeado');
      alert("Funcionalidad: Importar Clientes.");
    });
  }

  const btnExportar = document.getElementById("btn-exportar-clientes");
  if (btnExportar) {
    btnExportar.addEventListener("click", function () {
      console.log('[Clientes] Exportar clickeado');
      alert("Funcionalidad: Exportar Clientes.");
    });
  }

  // 6. Acciones en la Tabla (delegación de eventos)
  const tbodyClientes = document.getElementById("tbody-clientes");
  if (tbodyClientes) {
    tbodyClientes.addEventListener("click", function (event) {
      const target = event.target;
      const actionButton = target.closest(".button-icon");
      if (!actionButton) return;

      const filaCliente = actionButton.closest("tr");
      const clienteId = filaCliente ? filaCliente.dataset.clienteId : null;
      const clienteNombre = filaCliente ? filaCliente.dataset.clienteNombre : null;

      if (!clienteId) {
        console.warn('[Clientes] No se pudo obtener el ID del cliente');
        return;
      }

      if (actionButton.classList.contains("btn-ver-cliente")) {
        console.log('[Clientes] Ver detalle ID:', clienteId);
        cargarVistaDetalleCliente(clienteId);
      } else if (actionButton.classList.contains("btn-editar-cliente")) {
        console.log('[Clientes] Editar ID:', clienteId);
        cargarFormularioEditarCliente(clienteId, clienteNombre);
      } else if (actionButton.classList.contains("btn-eliminar-cliente")) {
        if (actionButton.disabled || actionButton.hasAttribute('disabled')) {
          console.log('[Clientes] Cliente ya está inactivo');
          showNotification('Este cliente ya está inactivo', 'info');
          return;
        }

        console.log('[Clientes] Eliminar ID:', clienteId);
        const nombreCliente = clienteNombre || 'este cliente';

        mostrarModalConfirmacion(
          `¿Estás seguro de que quieres desactivar a ${nombreCliente}? Esta acción cambiará su estado a "Inactivo".`,
          function () {
            eliminarClienteConSupabase(clienteId)
              .then(function(resultado) {
                console.log('[Clientes] ✓ Cliente eliminado:', resultado);
                showNotification(resultado.mensaje || 'Cliente desactivado exitosamente', 'success');
                fetchAndRenderClientes();
              })
              .catch(function(error) {
                console.error('[Clientes] ✗ Error al eliminar:', error);
                showNotification(error.message || 'Error al procesar la solicitud', 'error');
              });
          },
          "Confirmar Desactivación"
        );
      }
    });
  }

  // 7. Paginación
  const btnPrevPage = document.getElementById("btn-prev-page-clientes");
  const btnNextPage = document.getElementById("btn-next-page-clientes");

  if (btnPrevPage) {
    btnPrevPage.addEventListener("click", function () {
      if (!this.disabled && clientes_currentPage > 1) {
        clientes_currentPage--;
        console.log('[Paginación] Página anterior:', clientes_currentPage);
        fetchAndRenderClientes();
      }
    });
  }

  if (btnNextPage) {
    btnNextPage.addEventListener("click", function () {
      if (!this.disabled) {
        clientes_currentPage++;
        console.log('[Paginación] Página siguiente:', clientes_currentPage);
        fetchAndRenderClientes();
      }
    });
  }

  // 8. Cargar datos iniciales
  clientes_currentPage = 1;
  clientes_currentSearchTerm = inputBuscar ? inputBuscar.value : "";
  clientes_currentFilterEstado = filtroEstado ? filtroEstado.value : "Activo";
  fetchAndRenderClientes();

  console.log('[Clientes] Vista de clientes inicializada correctamente');
}

// =========================================================================
// FUNCIONES DE RENDERIZADO
// =========================================================================

function fetchAndRenderClientes() {
  console.log('[Clientes] --- Cargando clientes ---');
  console.log('[Clientes] Página:', clientes_currentPage, 'isLoading:', clientes_isLoading);

  if (clientes_isLoading) {
    console.log('[Clientes] Ya se están cargando clientes...');
    return;
  }
  clientes_isLoading = true;

  const tbody = document.getElementById("tbody-clientes");
  const pageInfo = document.getElementById("page-info-clientes");
  const btnPrev = document.getElementById("btn-prev-page-clientes");
  const btnNext = document.getElementById("btn-next-page-clientes");

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:20px; font-style:italic;"><i class="fas fa-spinner fa-spin"></i> Cargando clientes...</td></tr>`;
  }
  if (pageInfo) pageInfo.textContent = "Cargando...";
  if (btnPrev) btnPrev.disabled = true;
  if (btnNext) btnNext.disabled = true;

  const opciones = {
    pagina: clientes_currentPage,
    filasPorPagina: clientes_rowsPerPage,
    terminoBusqueda: clientes_currentSearchTerm,
    filtroEstado: clientes_currentFilterEstado,
  };

  obtenerListaClientesConSupabase(opciones)
    .then(function(respuesta) {
      clientes_isLoading = false;
      console.log('[Clientes] ✓ Respuesta recibida:', respuesta);

      if (respuesta.error) {
        if (tbody)
          tbody.innerHTML = `<tr><td colspan="7" class="text-center error-message" style="padding:20px; color: red;">Error: ${respuesta.error}</td></tr>`;
        console.error('[Clientes] Error:', respuesta.error);
        return;
      }

      renderizarTablaClientes(respuesta.clientes || []);
      actualizarControlesPaginacionClientes(
        respuesta.paginaActual || 1,
        respuesta.totalPaginas || 1,
        respuesta.totalClientes || 0
      );
    })
    .catch(function(error) {
      clientes_isLoading = false;
      console.error('[Clientes] ✗ Error:', error);
      if (tbody)
        tbody.innerHTML = `<tr><td colspan="7" class="text-center error-message" style="padding:20px; color: red;">Error al cargar datos: ${error.message || 'Error desconocido'}</td></tr>`;
    });
}

function renderizarTablaClientes(clientes) {
  const tbody = document.getElementById("tbody-clientes");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!clientes || clientes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding:20px;">No se encontraron clientes que coincidan con los criterios.</td></tr>';
    return;
  }

  clientes.forEach((cliente) => {
    const tr = document.createElement("tr");
    tr.dataset.clienteId = cliente.id;
    tr.dataset.clienteNombre = (cliente.nombres || "") + " " + (cliente.apellidos || cliente.razon_social || "");

    const estaInactivo = cliente.estado === 'Inactivo';

    const botonesAccion = `
      <button class="button-icon button-icon-info btn-ver-cliente" title="Ver Detalle">
        <i class="fas fa-eye"></i>
      </button>
      <button class="button-icon button-icon-warning btn-editar-cliente" title="Editar">
        <i class="fas fa-pencil-alt"></i>
      </button>
      <button class="button-icon button-icon-danger btn-eliminar-cliente"
              title="${estaInactivo ? 'Cliente ya está inactivo' : 'Eliminar (Lógico)'}"
              ${estaInactivo ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
        <i class="fas fa-trash-alt"></i>
      </button>`;

    tr.innerHTML = `
      <td>${escapeHtml(cliente.codigo_cliente || "-")}</td>
      <td>${escapeHtml((cliente.nombres || "") + " " + (cliente.apellidos || cliente.razon_social || ""))}</td>
      <td>${escapeHtml(cliente.telefono_principal || "-")}</td>
      <td><span class="badge ${cliente.estado === "Activo" ? "badge-success" : cliente.estado === "Inactivo" ? "badge-danger" : "badge-secondary"}">${escapeHtml(cliente.estado || "Desconocido")}</span></td>
      <td>${escapeHtml(cliente.ultima_fecha_compra ? new Date(cliente.ultima_fecha_compra).toLocaleDateString() : "-")}</td>
      <td class="text-right">${cliente.ultimo_costo_domicilio ? parseFloat(cliente.ultimo_costo_domicilio).toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 0 }) : "-"}</td>
      <td class="column-actions text-center">${botonesAccion}</td>
    `;
    tbody.appendChild(tr);
  });
}

function actualizarControlesPaginacionClientes(paginaActual, totalPaginas, totalClientes) {
  const pageInfo = document.getElementById("page-info-clientes");
  const btnPrev = document.getElementById("btn-prev-page-clientes");
  const btnNext = document.getElementById("btn-next-page-clientes");

  if (pageInfo) {
    pageInfo.textContent = `Página ${paginaActual} de ${totalPaginas} (${totalClientes} clientes)`;
  }

  if (btnPrev) {
    btnPrev.disabled = paginaActual <= 1;
  }

  if (btnNext) {
    btnNext.disabled = paginaActual >= totalPaginas;
  }

  console.log('[Clientes] Paginación actualizada:', { paginaActual, totalPaginas, totalClientes });
}

// =========================================================================
// FUNCIONES AUXILIARES
// =========================================================================

function escapeHtml(text) {
  if (text == null) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

function mostrarModalConfirmacion(mensaje, callbackConfirmar, titulo = "Confirmar Acción") {
  console.log('[mostrarModalConfirmacion] Iniciando con:', { mensaje, titulo });

  // Usar el modal genérico del home
  const modal = document.getElementById('modal-confirmacion-generica');
  const tituloElement = document.getElementById('modal-confirmacion-generica-titulo');
  const mensajeElement = document.getElementById('modal-confirmacion-generica-mensaje');
  const btnAceptar = document.getElementById('btn-aceptar-modal-confirmacion-generica');
  const btnCancelar = document.getElementById('btn-cancelar-modal-confirmacion-generica');
  const btnCerrar = document.getElementById('btn-cerrar-modal-confirmacion-generica-x');

  console.log('[mostrarModalConfirmacion] Modal encontrado:', !!modal);
  console.log('[mostrarModalConfirmacion] Elementos:', {
    titulo: !!tituloElement,
    mensaje: !!mensajeElement,
    btnAceptar: !!btnAceptar,
    btnCancelar: !!btnCancelar,
    btnCerrar: !!btnCerrar
  });

  if (!modal) {
    console.warn('[mostrarModalConfirmacion] Modal no encontrado, usando confirm() nativo');
    // Fallback si no existe el modal
    if (confirm(mensaje)) {
      callbackConfirmar();
    }
    return;
  }

  // Configurar modal
  if (tituloElement) tituloElement.textContent = titulo;
  if (mensajeElement) mensajeElement.textContent = mensaje;

  // Mostrar modal - REPLICANDO EXACTAMENTE LA LÓGICA DE APPS SCRIPT
  console.log('[mostrarModalConfirmacion] Mostrando modal...');

  // Forzar TODOS los estilos necesarios (como en Apps Script)
  modal.style.display = 'flex';
  modal.style.visibility = 'visible';
  modal.style.opacity = '1';
  modal.style.zIndex = '9999';
  modal.classList.add('is-visible');

  console.log('[mostrarModalConfirmacion] Estilos aplicados:', {
    display: modal.style.display,
    visibility: modal.style.visibility,
    opacity: modal.style.opacity,
    zIndex: modal.style.zIndex,
    hasClass: modal.classList.contains('is-visible')
  });

  // Handler para confirmar
  const handlerConfirmar = function() {
    // Ocultar modal con todos los estilos (como en Apps Script)
    modal.style.display = 'none';
    modal.style.visibility = 'hidden';
    modal.style.opacity = '0';
    modal.classList.remove('is-visible');

    callbackConfirmar();
    limpiarHandlers();
  };

  // Handler para cancelar
  const handlerCancelar = function() {
    // Ocultar modal con todos los estilos (como en Apps Script)
    modal.style.display = 'none';
    modal.style.visibility = 'hidden';
    modal.style.opacity = '0';
    modal.classList.remove('is-visible');

    limpiarHandlers();
  };

  // Función para limpiar handlers
  function limpiarHandlers() {
    if (btnAceptar) btnAceptar.removeEventListener('click', handlerConfirmar);
    if (btnCancelar) btnCancelar.removeEventListener('click', handlerCancelar);
    if (btnCerrar) btnCerrar.removeEventListener('click', handlerCancelar);
  }

  // Asignar handlers
  if (btnAceptar) btnAceptar.addEventListener('click', handlerConfirmar);
  if (btnCancelar) btnCancelar.addEventListener('click', handlerCancelar);
  if (btnCerrar) btnCerrar.addEventListener('click', handlerCancelar);
}

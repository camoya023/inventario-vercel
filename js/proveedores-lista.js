// =========================================================================
// MÓDULO DE PROVEEDORES - INVENTRACK VERCEL
// =========================================================================

// Variables globales del módulo
let proveedorIdActual = null;
let proveedores_isLoading = false;
let proveedores_currentPage = 1;
const proveedores_rowsPerPage = 10;
let proveedores_currentSearchTerm = "";
let proveedores_currentFilterEstado = "";

// =========================================================================
// FUNCIONES PARA OBTENER LISTA DE PROVEEDORES
// =========================================================================

/**
 * Obtiene una lista paginada y filtrada de proveedores usando Supabase.
 */
async function obtenerListaProveedoresConSupabase(opciones) {
  try {
    console.log('[Proveedores] ===== OBTENIENDO LISTA DE PROVEEDORES =====');
    console.log('[Proveedores] Opciones:', opciones);

    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    const pagina = opciones.pagina || 1;
    const filasPorPagina = opciones.filasPorPagina || 10;
    const terminoBusqueda = opciones.terminoBusqueda || '';
    const filtroEstado = opciones.filtroEstado || '';
    const offset = (pagina - 1) * filasPorPagina;

    // Construir consulta a la vista
    let query = client
      .from('vista_proveedores_con_saldos')
      .select('*')
      .order('nombre_empresa', { ascending: true })
      .range(offset, offset + filasPorPagina - 1);

    // Filtro por término de búsqueda
    if (terminoBusqueda && terminoBusqueda.trim() !== '') {
      query = query.or(`nombre_empresa.ilike.%${terminoBusqueda}%,codigo_proveedor.ilike.%${terminoBusqueda}%`);
    }

    // Filtro por estado
    if (filtroEstado === 'Activo') {
      query = query.eq('activo', true);
    } else if (filtroEstado === 'Inactivo') {
      query = query.eq('activo', false);
    }

    console.log('[Proveedores] Ejecutando consulta a vista_proveedores_con_saldos...');

    const { data: proveedores, error: errorProveedores } = await query;

    if (errorProveedores) {
      console.error('[Proveedores] ✗ Error al obtener proveedores:', errorProveedores);
      throw new Error(errorProveedores.message || 'Error al obtener proveedores');
    }

    console.log('[Proveedores] ✓ Proveedores obtenidos:', proveedores?.length || 0);

    // Obtener el conteo total usando la función RPC
    const filtroEstadoBoolean = filtroEstado === 'Activo' ? true : (filtroEstado === 'Inactivo' ? false : null);

    const countParams = {
      p_termino_busqueda: terminoBusqueda || null,
      p_filtro_estado: filtroEstadoBoolean
    };

    console.log('[Proveedores] Llamando a RPC fn_contar_proveedores...');
    const { data: totalRegistros, error: errorConteo } = await client
      .rpc('fn_contar_proveedores', countParams);

    if (errorConteo) {
      console.warn('[Proveedores] ⚠ Error al obtener conteo, usando longitud de datos:', errorConteo);
      const totalFallback = proveedores?.length || 0;
      const totalPaginas = Math.ceil(totalFallback / filasPorPagina);

      return {
        proveedores: proveedores || [],
        totalRegistros: totalFallback,
        paginaActual: pagina,
        totalPaginas: totalPaginas,
        filasPorPagina: filasPorPagina,
        error: null
      };
    }

    console.log('[Proveedores] ✓ Total de proveedores:', totalRegistros);

    const totalPaginas = Math.ceil((totalRegistros || 0) / filasPorPagina);

    return {
      proveedores: proveedores || [],
      totalRegistros: totalRegistros || 0,
      paginaActual: pagina,
      totalPaginas: totalPaginas,
      filasPorPagina: filasPorPagina,
      error: null
    };

  } catch (error) {
    console.error('[Proveedores] ✗ Excepción al obtener lista de proveedores:', error);
    return {
      proveedores: [],
      totalRegistros: 0,
      paginaActual: opciones.pagina || 1,
      totalPaginas: 0,
      error: error.message || 'Error desconocido'
    };
  }
}

// =========================================================================
// FUNCIONES CRUD DE PROVEEDORES
// =========================================================================

/**
 * Obtiene el detalle completo de un proveedor por ID
 */
async function obtenerDetalleProveedorConSupabase(proveedorId) {
  try {
    console.log('[Proveedores] Obteniendo detalle del proveedor:', proveedorId);

    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    // Obtener datos del proveedor
    const { data: proveedor, error: errorProveedor } = await client
      .from('proveedores')
      .select(`
        *,
        contactos_proveedor (*),
        proveedores_productos (
          *,
          productos (*)
        )
      `)
      .eq('id', proveedorId)
      .single();

    if (errorProveedor) {
      throw new Error(errorProveedor.message || 'Error al obtener proveedor');
    }

    console.log('[Proveedores] ✓ Detalle obtenido');
    return { exito: true, datos: proveedor };

  } catch (error) {
    console.error('[Proveedores] ✗ Error:', error);
    return { exito: false, mensaje: error.message };
  }
}

/**
 * Crea un nuevo proveedor usando la función RPC
 */
async function crearNuevoProveedorConSupabase(proveedorData) {
  try {
    console.log('[Proveedores] Creando nuevo proveedor con RPC:', proveedorData);

    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    // Llamar a la función RPC fn_guardar_proveedor_completo
    const { data, error } = await client.rpc('fn_guardar_proveedor_completo', {
      p_proveedor_data: proveedorData,
      p_contactos_data: [], // Sin contactos en la creación inicial
      p_es_edicion: false,
      p_proveedor_id_existente: null
    });

    if (error) {
      console.error('[Proveedores] Error RPC:', error);
      throw new Error(error.message || 'Error al crear proveedor');
    }

    console.log('[Proveedores] ✓ Respuesta RPC:', data);

    if (data && data.success) {
      return {
        exito: true,
        mensaje: data.mensaje || 'Proveedor creado exitosamente',
        datos: { id: data.proveedor_id }
      };
    } else {
      throw new Error(data?.mensaje || 'Error desconocido al crear proveedor');
    }

  } catch (error) {
    console.error('[Proveedores] ✗ Error:', error);
    return { exito: false, mensaje: error.message };
  }
}

/**
 * Actualiza un proveedor existente usando la función RPC
 */
async function actualizarProveedorConSupabase(proveedorData) {
  try {
    console.log('[Proveedores] Actualizando proveedor con RPC:', proveedorData.id);

    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    const proveedorId = proveedorData.id;
    delete proveedorData.id; // Eliminar el ID de los datos a enviar

    // Llamar a la función RPC fn_guardar_proveedor_completo
    const { data, error } = await client.rpc('fn_guardar_proveedor_completo', {
      p_proveedor_data: proveedorData,
      p_contactos_data: [], // Sin contactos (se gestionan por separado)
      p_es_edicion: true,
      p_proveedor_id_existente: proveedorId
    });

    if (error) {
      console.error('[Proveedores] Error RPC:', error);
      throw new Error(error.message || 'Error al actualizar proveedor');
    }

    console.log('[Proveedores] ✓ Respuesta RPC:', data);

    if (data && data.success) {
      return {
        exito: true,
        mensaje: data.mensaje || 'Proveedor actualizado exitosamente',
        datos: { id: data.proveedor_id }
      };
    } else {
      throw new Error(data?.mensaje || 'Error desconocido al actualizar proveedor');
    }

  } catch (error) {
    console.error('[Proveedores] ✗ Error:', error);
    return { exito: false, mensaje: error.message };
  }
}

/**
 * Desactiva un proveedor (eliminación lógica) usando la función RPC
 */
async function desactivarProveedorConSupabase(proveedorId) {
  try {
    console.log('[Proveedores] Desactivando proveedor con RPC:', proveedorId);

    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    // Llamar a la función RPC fn_eliminar_logicamente_proveedor
    const { data, error } = await client.rpc('fn_eliminar_logicamente_proveedor', {
      p_proveedor_id: proveedorId
    });

    if (error) {
      console.error('[Proveedores] Error RPC:', error);
      throw new Error(error.message || 'Error al desactivar proveedor');
    }

    console.log('[Proveedores] ✓ Respuesta RPC:', data);

    if (data && data.success) {
      return {
        exito: true,
        mensaje: data.mensaje || 'Proveedor desactivado exitosamente'
      };
    } else {
      throw new Error(data?.mensaje || 'Error desconocido al desactivar proveedor');
    }

  } catch (error) {
    console.error('[Proveedores] ✗ Error:', error);
    return { exito: false, mensaje: error.message };
  }
}

// =========================================================================
// FUNCIONES CRUD DE CONTACTOS
// =========================================================================

/**
 * Obtiene el detalle de un contacto
 */
async function obtenerDetalleContactoConSupabase(contactoId) {
  try {
    console.log('[Contactos] Obteniendo detalle del contacto:', contactoId);

    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    const { data, error } = await client
      .from('contactos_proveedor')
      .select('*')
      .eq('id', contactoId)
      .single();

    if (error) {
      throw new Error(error.message || 'Error al obtener contacto');
    }

    console.log('[Contactos] ✓ Detalle obtenido');
    return { exito: true, datos: data };

  } catch (error) {
    console.error('[Contactos] ✗ Error:', error);
    return { exito: false, mensaje: error.message };
  }
}

/**
 * Crea un nuevo contacto usando RPC
 */
async function crearNuevoContactoConSupabase(contactoData) {
  try {
    console.log('[Contactos] Creando nuevo contacto:', contactoData);

    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    // Usar función RPC en lugar de INSERT directo
    const { data, error } = await client
      .rpc('fn_crear_contacto_proveedor', {
        p_contacto_data: contactoData
      });

    if (error) {
      throw new Error(error.message || 'Error al crear contacto');
    }

    // La función RPC retorna un objeto con 'exito', 'mensaje' y 'datos'
    if (!data.exito) {
      throw new Error(data.mensaje || 'Error al crear contacto');
    }

    console.log('[Contactos] ✓ Contacto creado');
    return { exito: true, mensaje: data.mensaje, datos: data.datos };

  } catch (error) {
    console.error('[Contactos] ✗ Error:', error);
    return { exito: false, mensaje: error.message };
  }
}

/**
 * Actualiza un contacto existente usando RPC
 */
async function actualizarContactoConSupabase(contactoData) {
  try {
    console.log('[Contactos] Actualizando contacto:', contactoData.id);

    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    // Usar función RPC en lugar de UPDATE directo
    // No necesitamos eliminar el ID, la función RPC lo espera en el objeto
    const { data, error } = await client
      .rpc('fn_actualizar_contacto_proveedor', {
        p_contacto_data: contactoData
      });

    if (error) {
      throw new Error(error.message || 'Error al actualizar contacto');
    }

    // La función RPC retorna un objeto con 'exito', 'mensaje' y 'datos'
    if (!data.exito) {
      throw new Error(data.mensaje || 'Error al actualizar contacto');
    }

    console.log('[Contactos] ✓ Contacto actualizado');
    return { exito: true, mensaje: data.mensaje, datos: data.datos };

  } catch (error) {
    console.error('[Contactos] ✗ Error:', error);
    return { exito: false, mensaje: error.message };
  }
}

/**
 * Elimina un contacto usando RPC
 */
async function eliminarContactoConSupabase(contactoId) {
  try {
    console.log('[Contactos] Eliminando contacto:', contactoId);

    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    // Usar función RPC en lugar de DELETE directo
    const { data, error } = await client
      .rpc('fn_eliminar_contacto_proveedor', {
        p_contacto_id: contactoId
      });

    if (error) {
      throw new Error(error.message || 'Error al eliminar contacto');
    }

    // La función RPC retorna un objeto con 'exito' y 'mensaje'
    if (!data.exito) {
      throw new Error(data.mensaje || 'Error al eliminar contacto');
    }

    console.log('[Contactos] ✓ Contacto eliminado');
    return { exito: true, mensaje: data.mensaje };

  } catch (error) {
    console.error('[Contactos] ✗ Error:', error);
    return { exito: false, mensaje: error.message };
  }
}

// =========================================================================
// FUNCIONES DE BÚSQUEDA DINÁMICA DE PRODUCTOS
// =========================================================================

/**
 * Verifica si el usuario tiene un permiso específico
 */
async function verificarPermisoUsuario(permisoId) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    const { data, error } = await client
      .rpc('fn_verificar_permiso_usuario', {
        p_permiso_id: permisoId
      });

    if (error) {
      console.error('[Permisos] Error al verificar permiso:', error);
      return false;
    }

    return data === true;

  } catch (error) {
    console.error('[Permisos] Excepción al verificar permiso:', error);
    return false;
  }
}

/**
 * Busca productos dinámicamente en Supabase usando RLS.
 */
async function buscarProductosDinamicamente(terminoBusqueda) {
  try {
    console.log('[Productos] Buscando productos con término:', terminoBusqueda);

    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    if (!terminoBusqueda || terminoBusqueda.trim().length < 2) {
      return { productos: [], sinPermisos: false };
    }

    const termino = terminoBusqueda.trim();

    // Verificar permisos antes de buscar
    const tienePermisoVerCatalogo = await verificarPermisoUsuario(1); // 1 = ver_catalogo

    if (!tienePermisoVerCatalogo) {
      console.warn('[Productos] ⚠️ Usuario sin permiso para ver catálogo (permiso_id = 1)');
      return { productos: [], sinPermisos: true };
    }

    // Construir consulta a productos activos
    let query = client
      .from('productos')
      .select('id_producto, sku, nombre_producto, costo_promedio, stock_actual')
      .eq('activo', true)
      .order('nombre_producto', { ascending: true })
      .limit(20);

    query = query.or(`nombre_producto.ilike.%${termino}%,sku.ilike.%${termino}%`);

    console.log('[Productos] Ejecutando consulta de búsqueda...');

    const { data: productos, error } = await query;

    if (error) {
      console.error('[Productos] ✗ Error al buscar productos:', error);
      throw new Error(error.message || 'Error al buscar productos');
    }

    console.log('[Productos] ✓ Productos encontrados:', productos?.length || 0);
    return { productos: productos || [], sinPermisos: false };

  } catch (error) {
    console.error('[Productos] ✗ Excepción al buscar productos:', error);
    throw error;
  }
}

// =========================================================================
// FUNCIONES DE RENDERIZADO Y UI
// =========================================================================

/**
 * Función auxiliar para mostrar una vista de página específica de proveedores
 */
function mostrarVistaProveedor(vistaId) {
  const vistas = document.querySelectorAll(".page-view");
  vistas.forEach((vista) => {
    vista.classList.remove("is-active");
  });

  const vistaActiva = document.getElementById(vistaId);
  if (vistaActiva) {
    vistaActiva.classList.add("is-active");
  }
}

/**
 * Función principal para obtener y renderizar la lista de proveedores.
 */
function fetchAndRenderProveedores() {
  if (proveedores_isLoading) {
    console.log("[Proveedores] Ya se están cargando proveedores, espera por favor...");
    return;
  }
  proveedores_isLoading = true;

  const tbody = document.getElementById("tbody-proveedores");
  const btnPrev = document.getElementById("btn-prev-page-proveedores");
  const btnNext = document.getElementById("btn-next-page-proveedores");

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding:20px; font-style:italic;"><i class="fas fa-spinner fa-spin"></i> Cargando proveedores...</td></tr>`;
  }
  if (btnPrev) btnPrev.disabled = true;
  if (btnNext) btnNext.disabled = true;

  const opciones = {
    pagina: proveedores_currentPage,
    filasPorPagina: proveedores_rowsPerPage,
    terminoBusqueda: proveedores_currentSearchTerm,
    filtroEstado: proveedores_currentFilterEstado
  };

  console.log('[Proveedores] Llamando a obtenerListaProveedoresConSupabase con opciones:', opciones);

  obtenerListaProveedoresConSupabase(opciones)
    .then(function(respuesta) {
      proveedores_isLoading = false;
      console.log('[Proveedores] ✓ Respuesta de Supabase:', respuesta);

      if (respuesta.error) {
        if (tbody)
          tbody.innerHTML = `<tr><td colspan="8" class="text-center error-message" style="padding:20px;">Error: ${respuesta.error}</td></tr>`;
        console.error('[Proveedores] Error al obtener lista de proveedores:', respuesta.error);
        return;
      }

      console.log('[Proveedores] Llamando a renderizarTablaProveedores...');
      renderizarTablaProveedores(respuesta.proveedores || []);

      console.log('[Proveedores] Llamando a actualizarControlesPaginacion...');
      actualizarControlesPaginacion(
        respuesta.paginaActual || 1,
        respuesta.totalPaginas || 1,
        respuesta.totalRegistros || 0
      );
      console.log('[Proveedores] ✅ Renderizado completado');
    })
    .catch(function(error) {
      proveedores_isLoading = false;
      console.error('[Proveedores] ✗ Error al llamar a obtenerListaProveedoresConSupabase:', error);
      if (tbody)
        tbody.innerHTML = `<tr><td colspan="8" class="text-center error-message" style="padding:20px;">Error al cargar datos: ${error.message || 'Error desconocido'}</td></tr>`;
    });
}

/**
 * Pinta las filas de la tabla con los datos de los proveedores.
 */
function renderizarTablaProveedores(proveedores) {
  const tbody = document.getElementById("tbody-proveedores");
  tbody.innerHTML = "";
  if (proveedores.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding:20px;">No se encontraron proveedores.</td></tr>`;
    return;
  }

  const formatoMoneda = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
  });
  let filasHtml = "";

  proveedores.forEach((proveedor) => {
    const estadoBadge = proveedor.activo
      ? '<span class="badge badge-success">Activo</span>'
      : '<span class="badge badge-danger">Inactivo</span>';

    const deleteButtonState = !proveedor.activo
      ? 'disabled style="opacity: 0.5; cursor: not-allowed;"'
      : '';
    const deleteButtonTitle = !proveedor.activo
      ? 'Proveedor ya está inactivo'
      : 'Eliminar (Lógico)';

    filasHtml += `
      <tr data-id="${proveedor.id}">
        <td>${proveedor.codigo_proveedor || "N/A"}</td>
        <td>${proveedor.nombre_empresa || "N/A"}</td>
        <td>${proveedor.telefono_principal || "N/A"}</td>
        <td>${proveedor.ciudad || "N/A"}</td>
        <td class="text-right">${formatoMoneda.format(
          proveedor.saldo_pendiente || 0
        )}</td>
        <td class="text-right">${formatoMoneda.format(
          proveedor.credito_disponible || 0
        )}</td>
        <td>${estadoBadge}</td>
        <td class="column-actions text-center">
            <button class="button-icon button-icon-info" title="Ver Detalle"><i class="fas fa-eye"></i></button>
            <button class="button-icon button-icon-warning" title="Editar"><i class="fas fa-pencil-alt"></i></button>
            <button class="button-icon button-icon-danger" title="${deleteButtonTitle}" ${deleteButtonState}>
                <i class="fas fa-trash-alt"></i>
            </button>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = filasHtml;
}

/**
 * Actualiza el texto y el estado de los botones de paginación.
 */
function actualizarControlesPaginacion(pagina, totalPaginas, totalRegistros) {
  console.log('[actualizarControlesPaginacion] Parámetros recibidos:', { pagina, totalPaginas, totalRegistros });

  proveedores_currentPage = pagina;
  const textoProveedores = totalRegistros === 1 ? "proveedor" : "proveedores";

  const pageInfoElement = document.getElementById("page-info-proveedores");
  console.log('[actualizarControlesPaginacion] Elemento page-info encontrado:', !!pageInfoElement);

  if (pageInfoElement) {
    const nuevoTexto = `Página ${pagina} de ${totalPaginas} (Total: ${totalRegistros} ${textoProveedores})`;
    console.log('[actualizarControlesPaginacion] Estableciendo texto:', nuevoTexto);
    pageInfoElement.textContent = nuevoTexto;
  } else {
    console.error('[actualizarControlesPaginacion] ❌ Elemento page-info-proveedores NO encontrado en el DOM');
  }

  const btnPrev = document.getElementById("btn-prev-page-proveedores");
  const btnNext = document.getElementById("btn-next-page-proveedores");

  if (btnPrev) btnPrev.disabled = pagina <= 1;
  if (btnNext) btnNext.disabled = pagina >= totalPaginas;

  console.log('[actualizarControlesPaginacion] ✅ Paginación actualizada');
}

/**
 * Recibe un objeto con los detalles de un proveedor y los muestra en la vista de detalle.
 */
function pintarDetalleProveedor(proveedor) {
  proveedorIdActual = proveedor.id;
  const formatoMoneda = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
  });

  // Calcular saldo total pendiente
  let saldoTotalPendiente = 0;
  if (proveedor.facturas_compra && proveedor.facturas_compra.length > 0) {
    saldoTotalPendiente = proveedor.facturas_compra.reduce((total, factura) => {
      if (factura.estado !== "Pagada" && factura.estado !== "Anulada") {
        return total + (factura.saldo_pendiente || 0);
      }
      return total;
    }, 0);
  }

  // Poblar el resumen financiero
  document.getElementById("detalle-proveedor-nombre").textContent =
    proveedor.nombre_empresa || "N/A";
  document.getElementById("detalle-proveedor-codigo").textContent =
    proveedor.codigo_proveedor || "N/A";
  document.getElementById("detalle-proveedor-saldo").textContent =
    formatoMoneda.format(saldoTotalPendiente);
  document.getElementById("detalle-proveedor-limite").textContent =
    formatoMoneda.format(proveedor.limite_credito || 0);
  document.getElementById("detalle-proveedor-dias").textContent = `${
    proveedor.dias_credito || 0
  } días`;
  document.getElementById("detalle-proveedor-estado").innerHTML =
    proveedor.activo
      ? '<span class="badge badge-success">Activo</span>'
      : '<span class="badge badge-danger">Inactivo</span>';

  // Poblar la pestaña de Información General
  const infoGeneralDiv = document.getElementById("tab-info-general");
  infoGeneralDiv.innerHTML = `
    <h4>Información General del Proveedor</h4>
    <p><strong>Teléfono Principal:</strong> ${proveedor.telefono_principal || "No especificado"}</p>
    <p><strong>Dirección:</strong> ${proveedor.direccion || "No especificada"}</p>
    <p><strong>Ciudad:</strong> ${proveedor.ciudad || "No especificada"}</p>
    <p><strong>Email:</strong> ${proveedor.email_principal || "No especificado"}</p>
    <p><strong>Condiciones de Pago:</strong> ${proveedor.condiciones_pago || "No especificadas"}</p>
  `;

  // Poblar la pestaña de Contactos
  const contactosDiv = document.getElementById("tab-contactos");
  let contactosHtml = "<h4>Contactos Asociados</h4>";

  if (proveedor.contactos_proveedor && proveedor.contactos_proveedor.length > 0) {
    contactosHtml += `
      <div class="table-wrapper">
        <table class="data-table-default">
          <thead>
            <tr>
              <th>Nombre Completo</th>
              <th>Cargo</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th class="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${proveedor.contactos_proveedor.map(contacto => `
              <tr data-contacto-id="${contacto.id}">
                <td>${contacto.nombre_completo || "N/A"}</td>
                <td>${contacto.cargo || "N/A"}</td>
                <td>${contacto.email || "N/A"}</td>
                <td>${contacto.telefono || "N/A"}</td>
                <td class="column-actions text-center">
                  <button class="button-icon button-icon-warning" title="Editar Contacto"><i class="fas fa-pencil-alt"></i></button>
                  <button class="button-icon button-icon-danger" title="Eliminar Contacto"><i class="fas fa-trash-alt"></i></button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  } else {
    contactosHtml += "<p>Este proveedor no tiene contactos registrados.</p>";
  }
  contactosDiv.innerHTML = contactosHtml;

  // Poblar la pestaña de Productos Suministrados
  const productosDiv = document.getElementById("tab-productos");
  let productosHtml = "<h4>Productos Suministrados</h4>";

  if (proveedor.proveedores_productos && proveedor.proveedores_productos.length > 0) {
    productosHtml += `
      <div class="table-wrapper">
        <table class="data-table-default">
          <thead>
            <tr>
              <th>Código Producto</th>
              <th>Descripción del Producto</th>
              <th>SKU del Proveedor</th>
              <th class="text-right">Precio de Costo</th>
              <th class="text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${proveedor.proveedores_productos.map(item => {
              const producto = item.productos;
              if (!producto) return "";

              return `
                <tr data-producto-id="${producto.id_producto}">
                  <td>${producto.sku || "N/A"}</td>
                  <td>${producto.nombre_producto || "N/A"}</td>
                  <td>${item.sku_proveedor || "N/A"}</td>
                  <td class="text-right">${formatoMoneda.format(item.precio_costo || 0)}</td>
                  <td class="column-actions text-center">
                    <button class="button-icon button-icon-warning" title="Editar Precio de Costo"><i class="fas fa-pencil-alt"></i></button>
                    <button class="button-icon button-icon-danger" title="Desvincular Producto"><i class="fas fa-unlink"></i></button>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  } else {
    productosHtml += "<p>Este proveedor no tiene productos asociados.</p>";
  }
  productosDiv.innerHTML = productosHtml;

  // Placeholder para pestañas restantes
  document.getElementById("tab-cuentas-por-pagar").innerHTML =
    "<h4>Facturas de Compra</h4><p><i>Funcionalidad pendiente de implementar.</i></p>";
  document.getElementById("tab-pagos").innerHTML =
    "<h4>Historial de Pagos</h4><p><i>Funcionalidad pendiente de implementar.</i></p>";

  mostrarVistaProveedor("vista-detalle-proveedor");
}

/**
 * Recarga los detalles del proveedor actual.
 */
async function recargarDetallesProveedor() {
  if (!proveedorIdActual) return;

  console.log(`Recargando detalles para el proveedor ID: ${proveedorIdActual}`);

  document.getElementById("vista-detalle-proveedor").style.opacity = "0.5";

  const resultado = await obtenerDetalleProveedorConSupabase(proveedorIdActual);

  if (resultado.exito) {
    pintarDetalleProveedor(resultado.datos);
  } else {
    toastr.error('Error al recargar detalles: ' + resultado.mensaje, 'Error');
  }

  document.getElementById("vista-detalle-proveedor").style.opacity = "1";
}

/**
 * Abre el modal de proveedor en modo "Edición"
 */
async function abrirModalParaEditar(proveedorId) {
  console.log(`[Proveedores] Abriendo modal para editar proveedor: ${proveedorId}`);

  const resultado = await obtenerDetalleProveedorConSupabase(proveedorId);

  if (resultado.exito) {
    const proveedor = resultado.datos;
    const modal = document.getElementById("modal-nuevo-proveedor");
    const form = document.getElementById("form-nuevo-proveedor");

    modal.querySelector(".modal-title").textContent = "Editar Proveedor";
    modal.querySelector("#btn-guardar-nuevo-proveedor").textContent = "Guardar Cambios";

    document.getElementById("proveedor-nombre").value = proveedor.nombre_empresa || "";
    document.getElementById("proveedor-telefono").value = proveedor.telefono_principal || "";
    document.getElementById("proveedor-email").value = proveedor.email_principal || "";
    document.getElementById("proveedor-estado-form").value = proveedor.activo;
    document.getElementById("proveedor-direccion").value = proveedor.direccion || "";
    document.getElementById("proveedor-ciudad").value = proveedor.ciudad || "";
    document.getElementById("proveedor-condiciones-pago").value = proveedor.condiciones_pago || "";
    document.getElementById("proveedor-dias-credito").value = proveedor.dias_credito || 0;
    document.getElementById("proveedor-limite-credito").value = proveedor.limite_credito || 0;
    document.getElementById("proveedor-notas").value = proveedor.notas || "";

    form.dataset.editId = proveedor.id;
    modal.classList.add("is-visible");
  } else {
    toastr.error(resultado.mensaje, 'Error');
  }
}

/**
 * Abre el modal de contacto en modo edición
 */
async function abrirModalContactoParaEditar(contactoId) {
  const resultado = await obtenerDetalleContactoConSupabase(contactoId);

  if (resultado.exito && resultado.datos) {
    const contacto = resultado.datos;
    const modal = document.getElementById("modal-nuevo-contacto");
    const form = document.getElementById("form-nuevo-contacto");

    document.getElementById("contacto-nombre").value = contacto.nombre_completo || "";
    document.getElementById("contacto-cargo").value = contacto.cargo || "";
    document.getElementById("contacto-email").value = contacto.email || "";
    document.getElementById("contacto-telefono").value = contacto.telefono || "";

    modal.querySelector(".modal-title").textContent = "Editar Contacto";
    form.dataset.editId = contacto.id;

    modal.classList.add("is-visible");
  } else {
    toastr.error('Error al cargar los datos del contacto: ' + resultado.mensaje, 'Error');
  }
}

/**
 * Configura el autocompletado de productos para el modal de asociación.
 */
function configurarAutocompletadoProductos() {
  const inputBusqueda = document.getElementById('asociar-producto-busqueda');
  const dropdown = document.getElementById('asociar-producto-dropdown');
  const loadingIndicator = document.getElementById('asociar-producto-loading');
  const hiddenInput = document.getElementById('asociar-producto-id-seleccionado');
  const selectedInfo = document.getElementById('asociar-producto-selected-info');
  const selectedText = document.getElementById('asociar-producto-selected-text');
  const clearBtn = document.getElementById('asociar-producto-clear-btn');

  if (!inputBusqueda || !dropdown) {
    console.warn('[Autocompletado] No se encontraron elementos necesarios');
    return;
  }

  let debounceTimer = null;
  let productoSeleccionado = null;

  const limpiarSeleccion = () => {
    productoSeleccionado = null;
    inputBusqueda.value = '';
    hiddenInput.value = '';
    selectedInfo.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'none';
    dropdown.style.display = 'none';
    inputBusqueda.focus();
    console.log('[Autocompletado] Selección limpiada');
  };

  if (clearBtn) {
    clearBtn.addEventListener('click', limpiarSeleccion);
  }

  inputBusqueda.addEventListener('input', function() {
    const termino = this.value.trim();

    if (clearBtn) {
      clearBtn.style.display = this.value.length > 0 ? 'block' : 'none';
    }

    if (productoSeleccionado) {
      productoSeleccionado = null;
      hiddenInput.value = '';
      selectedInfo.style.display = 'none';
    }

    if (termino.length < 2) {
      dropdown.style.display = 'none';
      loadingIndicator.style.display = 'none';
      return;
    }

    clearTimeout(debounceTimer);
    loadingIndicator.style.display = 'block';
    dropdown.style.display = 'none';

    debounceTimer = setTimeout(async () => {
      try {
        const resultado = await buscarProductosDinamicamente(termino);
        const productos = resultado.productos;
        const sinPermisos = resultado.sinPermisos;

        loadingIndicator.style.display = 'none';

        if (sinPermisos) {
          dropdown.innerHTML = `
            <div style="padding: 16px; text-align: center;">
              <i class="fas fa-lock" style="font-size: 32px; color: #dc3545; margin-bottom: 8px;"></i>
              <div style="color: #dc3545; font-weight: 500; margin-bottom: 4px; font-size: 14px;">
                Sin permisos para ver productos
              </div>
              <div style="color: #666; font-size: 13px; line-height: 1.4;">
                No tienes permisos para ver el catálogo de productos.<br>
                Contacta al administrador para solicitar acceso.
              </div>
            </div>
          `;
          dropdown.style.display = 'block';
          return;
        }

        if (productos.length === 0) {
          dropdown.innerHTML = `
            <div style="padding: 16px; text-align: center;">
              <i class="fas fa-search" style="font-size: 28px; color: #999; margin-bottom: 8px;"></i>
              <div style="color: #666; font-weight: 500; margin-bottom: 4px; font-size: 14px;">
                No se encontraron productos
              </div>
              <div style="color: #999; font-size: 13px;">
                Intenta con otro término de búsqueda
              </div>
            </div>
          `;
          dropdown.style.display = 'block';
          return;
        }

        const formatoMoneda = new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP'
        });

        dropdown.innerHTML = productos.map(producto => `
          <div class="autocomplete-item"
               data-producto-id="${producto.id_producto}"
               data-producto-sku="${producto.sku || 'N/A'}"
               data-producto-nombre="${producto.nombre_producto}"
               style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee; transition: background-color 0.2s;"
               onmouseover="this.style.backgroundColor='#f5f5f5'"
               onmouseout="this.style.backgroundColor='white'">
            <div style="font-weight: 500; color: #333;">${producto.nombre_producto}</div>
            <div style="font-size: 12px; color: #666; margin-top: 4px;">
              <span style="background: #e9ecef; padding: 2px 6px; border-radius: 3px; margin-right: 8px;">
                SKU: ${producto.sku || 'N/A'}
              </span>
              <span>Stock: ${producto.stock_actual || 0}</span>
              <span style="margin-left: 8px;">Costo Promedio: ${formatoMoneda.format(producto.costo_promedio || 0)}</span>
            </div>
          </div>
        `).join('');

        dropdown.style.display = 'block';

      } catch (error) {
        console.error('[Autocompletado] Error en búsqueda:', error);
        loadingIndicator.style.display = 'none';
        dropdown.innerHTML = `<div style="padding: 12px; text-align: center; color: #dc3545;">
          <i class="fas fa-exclamation-triangle"></i> Error al buscar: ${error.message}
        </div>`;
        dropdown.style.display = 'block';
      }
    }, 400);
  });

  dropdown.addEventListener('click', function(event) {
    const item = event.target.closest('.autocomplete-item');
    if (!item) return;

    const productoId = item.dataset.productoId;
    const productoSku = item.dataset.productoSku;
    const productoNombre = item.dataset.productoNombre;

    productoSeleccionado = {
      id: productoId,
      sku: productoSku,
      nombre: productoNombre
    };

    inputBusqueda.value = `${productoSku} - ${productoNombre}`;
    hiddenInput.value = productoId;
    selectedText.textContent = `Producto seleccionado: ${productoSku} - ${productoNombre}`;
    selectedInfo.style.display = 'block';

    if (clearBtn) clearBtn.style.display = 'block';

    dropdown.style.display = 'none';

    console.log('[Autocompletado] Producto seleccionado:', productoSeleccionado);
  });

  document.addEventListener('click', function(event) {
    if (!inputBusqueda.contains(event.target) && !dropdown.contains(event.target)) {
      dropdown.style.display = 'none';
    }
  });

  // Limpiar al abrir el modal
  inputBusqueda.value = '';
  hiddenInput.value = '';
  selectedInfo.style.display = 'none';
  dropdown.style.display = 'none';
  loadingIndicator.style.display = 'none';
  if (clearBtn) clearBtn.style.display = 'none';
  productoSeleccionado = null;
}

// =========================================================================
// CONFIGURACIÓN DE LISTENERS Y EVENTOS
// =========================================================================

/**
 * Configura todos los event listeners y la interactividad de la página de proveedores.
 */
function configurarPaginaProveedoresYListeners() {
  console.log("Configurando listeners para la página de proveedores...");

  // Elementos de la Vista Principal (Lista)
  const inputBusqueda = document.getElementById("input-buscar-proveedores");
  const toggleFiltrosBtn = document.getElementById("btn-toggle-filtros-proveedores");
  const filtrosContent = document.getElementById("filtros-proveedores-content");
  const tablaBody = document.getElementById("tbody-proveedores");
  const btnAbrirModalNuevo = document.getElementById("btn-abrir-modal-nuevo-proveedor");

  // Elementos de la Vista de Detalle
  const btnVolverLista = document.getElementById("btn-volver-a-lista");
  const btnEditarDetalle = document.getElementById("btn-editar-proveedor-detalle");
  const tabContainer = document.querySelector(".tab-container");
  const btnAbrirModalContacto = document.getElementById("accion-anadir-contacto");
  const btnAbrirModalAsociar = document.getElementById("accion-asociar-producto");

  // Elementos de Modales
  const modalProveedor = document.getElementById("modal-nuevo-proveedor");
  const formProveedor = document.getElementById("form-nuevo-proveedor");
  const modalContacto = document.getElementById("modal-nuevo-contacto");
  const formContacto = document.getElementById("form-nuevo-contacto");
  const modalAsociar = document.getElementById("modal-asociar-producto");
  const formAsociar = document.getElementById("form-asociar-producto");

  // ===== BÚSQUEDA =====
  if (inputBusqueda) {
    let debounceTimer;
    inputBusqueda.addEventListener("input", function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        proveedores_currentSearchTerm = this.value;
        proveedores_currentPage = 1;
        fetchAndRenderProveedores();
      }, 400);
    });
  }

  // ===== TOGGLE FILTROS =====
  if (toggleFiltrosBtn && filtrosContent) {
    toggleFiltrosBtn.addEventListener("click", () => {
      filtrosContent.classList.toggle("is-collapsed");

      const isCollapsed = filtrosContent.classList.contains("is-collapsed");
      toggleFiltrosBtn.setAttribute("aria-expanded", !isCollapsed);

      const chevronIcon = toggleFiltrosBtn.querySelector("i:last-child");
      if (chevronIcon) {
        if (isCollapsed) {
          chevronIcon.className = "fas fa-chevron-down";
        } else {
          chevronIcon.className = "fas fa-chevron-up";
        }
      }
    });
  }

  // ===== TABLA: VER, EDITAR, BORRAR =====
  if (tablaBody) {
    tablaBody.addEventListener("click", async (event) => {
      const botonVer = event.target.closest(".button-icon-info");
      const botonEditar = event.target.closest(".button-icon-warning");
      const botonBorrar = event.target.closest(".button-icon-danger");

      if (botonVer) {
        const id = botonVer.closest("tr").dataset.id;
        if (!id) return;

        botonVer.disabled = true;
        botonVer.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const resultado = await obtenerDetalleProveedorConSupabase(id);

        botonVer.disabled = false;
        botonVer.innerHTML = '<i class="fas fa-eye"></i>';

        if (resultado.exito) {
          pintarDetalleProveedor(resultado.datos);
        } else {
          toastr.error(resultado.mensaje, 'Error');
        }
      }

      if (botonEditar) {
        const id = botonEditar.closest("tr").dataset.id;
        if (id) abrirModalParaEditar(id);
      }

      if (botonBorrar) {
        if (botonBorrar.disabled || botonBorrar.hasAttribute('disabled')) {
          console.log('[Proveedores] Botón de eliminar está deshabilitado (proveedor ya inactivo)');
          toastr.info('Este proveedor ya está inactivo', 'Información');
          return;
        }

        const fila = botonBorrar.closest("tr");
        const proveedorId = fila.dataset.id;
        const nombreProveedor = fila.cells[1].textContent;

        mostrarModalConfirmacion(
          `¿Estás seguro de que deseas eliminar al proveedor "${nombreProveedor}"? Esta acción lo marcará como inactivo, pero se podrá recuperar.`,
          async () => {
            botonBorrar.disabled = true;
            botonBorrar.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

            const resultado = await desactivarProveedorConSupabase(proveedorId);

            if (resultado.exito) {
              toastr.success(resultado.mensaje, 'Éxito');
              fetchAndRenderProveedores();
            } else {
              toastr.error(resultado.mensaje, 'Error');
              botonBorrar.disabled = false;
              botonBorrar.innerHTML = '<i class="fas fa-trash-alt"></i>';
            }
          },
          'Eliminar Proveedor'
        );
      }
    });
  }

  // ===== VOLVER A LISTA =====
  if (btnVolverLista) {
    btnVolverLista.addEventListener("click", (e) => {
      e.preventDefault();
      mostrarVistaProveedor("vista-lista-proveedores");
    });
  }

  // ===== EDITAR DESDE DETALLE =====
  if (btnEditarDetalle) {
    btnEditarDetalle.addEventListener("click", () => {
      if (proveedorIdActual) abrirModalParaEditar(proveedorIdActual);
    });
  }

  // ===== PESTAÑAS =====
  const contenedorContactos = document.getElementById("tab-contactos");
  if (contenedorContactos) {
    contenedorContactos.addEventListener("click", async (event) => {
      const botonEditar = event.target.closest(".button-icon-warning");
      if (botonEditar) {
        const contactoId = botonEditar.closest("tr").dataset.contactoId;
        console.log(`Se hizo clic en "Editar Contacto". ID capturado: ${contactoId}`);
        if (contactoId) {
          abrirModalContactoParaEditar(contactoId);
        }
      }

      const botonBorrar = event.target.closest(".button-icon-danger");
      if (botonBorrar) {
        const fila = botonBorrar.closest("tr");
        const contactoId = fila.dataset.contactoId;
        const nombreContacto = fila.cells[0].textContent;

        console.log(`Se hizo clic en "Eliminar Contacto". ID capturado: ${contactoId}`);

        if (!contactoId || contactoId === 'undefined' || contactoId === 'null') {
          toastr.error('Error: No se pudo identificar el contacto. Por favor, recarga la página e intenta nuevamente.', 'Error');
          console.error('ERROR CRÍTICO: contactoId inválido detectado en frontend');
          return;
        }

        mostrarModalConfirmacion(
          `¿Estás seguro de que deseas eliminar al contacto "${nombreContacto}"? Esta acción no se puede deshacer.`,
          async () => {
            const resultado = await eliminarContactoConSupabase(contactoId);

            if (resultado.exito) {
              toastr.success(resultado.mensaje, 'Éxito');
              recargarDetallesProveedor();
            } else {
              toastr.error(resultado.mensaje, 'Error');
            }
          },
          'Eliminar Contacto'
        );
      }
    });
  }

  // ===== PESTAÑA PRODUCTOS =====
  const contenedorProductos = document.getElementById("tab-productos");
  if (contenedorProductos) {
    contenedorProductos.addEventListener("click", async (event) => {
      const botonEditar = event.target.closest("button.button-icon-warning");
      const botonDesvincular = event.target.closest("button.button-icon-danger");

      if (botonDesvincular) {
        const fila = botonDesvincular.closest("tr");
        const id_producto = fila.dataset.productoId;
        const nombre_producto = fila.cells[1].textContent;

        if (!id_producto) {
          toastr.error("Error: No se pudo obtener el ID del producto de la fila.", "Error");
          return;
        }

        mostrarModalConfirmacion(
          `¿Estás seguro de que deseas desvincular el producto "${nombre_producto}" de este proveedor?\n\nEsta acción eliminará la asociación entre el producto y el proveedor.`,
          async () => {
            console.log('[Desvincular Producto] Iniciando desvinculación...');
            console.log('[Desvincular Producto] Proveedor ID:', proveedorIdActual);
            console.log('[Desvincular Producto] Producto ID:', id_producto);

            try {
              const client = getSupabaseClient();
              if (!client) {
                toastr.error('Cliente de Supabase no inicializado', 'Error');
                return;
              }

              const { data, error } = await client.rpc(
                'fn_desvincular_producto_proveedor',
                {
                  p_id_proveedor: proveedorIdActual,
                  p_id_producto: id_producto
                }
              );

              if (error) {
                console.error('[Desvincular Producto] ✗ Error de Supabase:', error);
                toastr.error(
                  'Error al conectar con el servidor. Por favor, intenta nuevamente.',
                  'Error de conexión'
                );
                return;
              }

              console.log('[Desvincular Producto] Respuesta de RPC:', data);

              if (data && data.success) {
                console.log('[Desvincular Producto] ✓ Desvinculación exitosa');
                toastr.success(data.mensaje, 'Éxito');
                recargarDetallesProveedor();
              } else {
                console.error('[Desvincular Producto] ✗ Error de negocio:', data);

                if (data.codigo_error === 'PERMISO_DENEGADO') {
                  toastr.error(
                    data.mensaje,
                    'Permiso denegado',
                    { timeOut: 5000, closeButton: true }
                  );
                } else if (data.codigo_error === 'ASOCIACION_NO_EXISTE') {
                  toastr.warning(data.mensaje, 'Asociación no encontrada');
                } else if (data.codigo_error === 'PRODUCTO_NO_VALIDO' || data.codigo_error === 'PROVEEDOR_NO_VALIDO') {
                  toastr.error(data.mensaje, 'Datos inválidos');
                } else {
                  toastr.error(
                    data.mensaje || 'Error al desvincular el producto',
                    'Error'
                  );
                }
              }

            } catch (error) {
              console.error('[Desvincular Producto] ✗ Excepción:', error);
              toastr.error(
                'Error inesperado al desvincular. Por favor, contacta al administrador.',
                'Error'
              );
            }
          },
          'Desvincular Producto'
        );
      }

      if (botonEditar) {
        const fila = botonEditar.closest("tr");
        const id_producto = fila.dataset.productoId;
        const nombre_producto = fila.cells[1].textContent;
        const sku_proveedor_actual = fila.cells[2].textContent;
        const precio_actual_texto = fila.cells[3].textContent
          .replace(/[^0-9,-]+/g, "")
          .replace(",", ".");
        const precio_actual = parseFloat(precio_actual_texto);

        document.getElementById("asociacion-nombre-producto").textContent = nombre_producto;
        document.getElementById("asociacion-editar-precio").value = precio_actual;
        document.getElementById("asociacion-editar-sku").value =
          sku_proveedor_actual === "N/A" ? "" : sku_proveedor_actual;

        const form = document.getElementById("form-editar-asociacion");
        form.dataset.idProducto = id_producto;

        document.getElementById("modal-editar-asociacion").classList.add("is-visible");
      }
    });

    // Listener para el formulario de EDICIÓN de asociación
    const formEditarAsociacion = document.getElementById("form-editar-asociacion");
    if (formEditarAsociacion) {
      formEditarAsociacion.addEventListener("submit", async (event) => {
        event.preventDefault();

        console.log('[Editar Asociación] Iniciando actualización...');

        const precioCosto = parseFloat(document.getElementById("asociacion-editar-precio").value);
        const skuProveedor = document.getElementById("asociacion-editar-sku").value.trim() || null;
        const idProducto = formEditarAsociacion.dataset.idProducto;

        if (!precioCosto || precioCosto <= 0) {
          toastr.warning("Por favor, ingresa un precio de costo válido.", "Precio requerido");
          return;
        }

        if (!idProducto || !proveedorIdActual) {
          toastr.error("Error: Datos incompletos para actualizar la asociación.", "Error");
          return;
        }

        const guardarBtn = document.getElementById("btn-guardar-cambios-asociacion");
        const textoOriginal = guardarBtn ? guardarBtn.textContent : "Guardar Cambios";
        if (guardarBtn) {
          guardarBtn.disabled = true;
          guardarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        }

        try {
          const client = getSupabaseClient();
          if (!client) {
            toastr.error('Cliente de Supabase no inicializado', 'Error');
            return;
          }

          console.log('[Editar Asociación] Llamando a RPC fn_actualizar_asociacion_producto_proveedor...');
          console.log('[Editar Asociación] Parámetros:', {
            p_id_proveedor: proveedorIdActual,
            p_id_producto: idProducto,
            p_precio_costo: precioCosto,
            p_sku_proveedor: skuProveedor
          });

          const { data, error } = await client.rpc(
            'fn_actualizar_asociacion_producto_proveedor',
            {
              p_id_proveedor: proveedorIdActual,
              p_id_producto: idProducto,
              p_precio_costo: precioCosto,
              p_sku_proveedor: skuProveedor
            }
          );

          if (error) {
            console.error('[Editar Asociación] ✗ Error de Supabase:', error);
            toastr.error(
              'Error al conectar con el servidor. Por favor, intenta nuevamente.',
              'Error de conexión'
            );
            return;
          }

          console.log('[Editar Asociación] Respuesta de RPC:', data);

          if (data && data.success) {
            console.log('[Editar Asociación] ✓ Actualización exitosa');
            toastr.success(data.mensaje, 'Éxito');

            document.getElementById("modal-editar-asociacion").classList.remove("is-visible");
            recargarDetallesProveedor();

          } else {
            console.error('[Editar Asociación] ✗ Error de negocio:', data);

            if (data.codigo_error === 'PERMISO_DENEGADO') {
              toastr.error(
                data.mensaje,
                'Permiso denegado',
                { timeOut: 5000, closeButton: true }
              );
            } else if (data.codigo_error === 'ASOCIACION_NO_EXISTE') {
              toastr.error(data.mensaje, 'Asociación no encontrada');
            } else if (data.codigo_error === 'PRECIO_INVALIDO') {
              toastr.warning(data.mensaje, 'Precio inválido');
            } else if (data.codigo_error === 'PRODUCTO_NO_VALIDO' || data.codigo_error === 'PROVEEDOR_NO_VALIDO') {
              toastr.error(data.mensaje, 'Datos inválidos');
            } else {
              toastr.error(
                data.mensaje || 'Error al actualizar la asociación',
                'Error'
              );
            }
          }

        } catch (error) {
          console.error('[Editar Asociación] ✗ Excepción:', error);
          toastr.error(
            'Error inesperado. Por favor, contacta al administrador.',
            'Error'
          );
        } finally {
          if (guardarBtn) {
            guardarBtn.disabled = false;
            guardarBtn.innerHTML = textoOriginal;
          }
        }
      });
    }

    // Listeners para cerrar el modal de edición
    const modalEditarAsociacion = document.getElementById("modal-editar-asociacion");
    const cerrarModalEditar = () =>
      modalEditarAsociacion.classList.remove("is-visible");
    document
      .getElementById("btn-cerrar-modal-editar-asociacion")
      .addEventListener("click", cerrarModalEditar);
    document
      .getElementById("btn-cancelar-editar-asociacion")
      .addEventListener("click", cerrarModalEditar);
  }

  // ===== NAVEGACIÓN DE PESTAÑAS =====
  if (tabContainer) {
    const tabNav = tabContainer.querySelector(".tab-nav");
    if (tabNav) {
      tabNav.addEventListener("click", function (event) {
        const clickedLink = event.target.closest("a.tab-link");
        if (!clickedLink) return;
        event.preventDefault();

        const currentActiveLink = tabNav.querySelector(".is-active");
        if (currentActiveLink) currentActiveLink.classList.remove("is-active");

        const currentActivePane = tabContainer.querySelector(".tab-pane.is-active");
        if (currentActivePane) currentActivePane.classList.remove("is-active");

        clickedLink.classList.add("is-active");
        const targetPane = document.querySelector(clickedLink.getAttribute("href"));
        if (targetPane) targetPane.classList.add("is-active");
      });
    }
  }

  // ===== MODAL PRINCIPAL: CREAR/EDITAR PROVEEDOR =====
  if (modalProveedor) {
    btnAbrirModalNuevo.addEventListener("click", () => {
      delete formProveedor.dataset.editId;
      formProveedor.reset();
      modalProveedor.querySelector(".modal-title").textContent = "Nuevo Proveedor";
      modalProveedor.querySelector("#btn-guardar-nuevo-proveedor").textContent = "Guardar Proveedor";
      document.getElementById("proveedor-estado-form").value = "true";
      modalProveedor.classList.add("is-visible");
    });

    formProveedor.addEventListener("submit", async (event) => {
      event.preventDefault();
      const guardarBtn = document.getElementById("btn-guardar-nuevo-proveedor");
      guardarBtn.disabled = true;

      const proveedorData = {
        nombre_empresa: document.getElementById("proveedor-nombre").value,
        telefono_principal: document.getElementById("proveedor-telefono").value,
        email_principal: document.getElementById("proveedor-email").value,
        direccion: document.getElementById("proveedor-direccion").value,
        ciudad: document.getElementById("proveedor-ciudad").value,
        condiciones_pago: document.getElementById("proveedor-condiciones-pago").value,
        dias_credito: parseInt(document.getElementById("proveedor-dias-credito").value, 10),
        limite_credito: parseFloat(document.getElementById("proveedor-limite-credito").value),
        notas: document.getElementById("proveedor-notas").value,
        activo: document.getElementById("proveedor-estado-form").value === "true",
      };

      const editId = formProveedor.dataset.editId;

      if (editId) {
        // Modo edición
        proveedorData.id = editId;
        guardarBtn.textContent = "Actualizando...";
        console.log('[Proveedores] Actualizando proveedor ID:', editId);

        const resultado = await actualizarProveedorConSupabase(proveedorData);

        guardarBtn.disabled = false;
        guardarBtn.textContent = "Guardar Cambios";

        if (resultado.exito) {
          console.log('[Proveedores] ✅ Proveedor actualizado exitosamente');
          toastr.success(resultado.mensaje, 'Éxito');
          modalProveedor.classList.remove("is-visible");
          mostrarVistaProveedor("vista-lista-proveedores");
          fetchAndRenderProveedores();
        } else {
          console.error('[Proveedores] ❌ Error al actualizar:', resultado.mensaje);
          toastr.error(resultado.mensaje, 'Error');
        }
      } else {
        // Modo creación
        guardarBtn.textContent = "Guardando...";
        console.log('[Proveedores] Creando nuevo proveedor...');

        const resultado = await crearNuevoProveedorConSupabase(proveedorData);

        guardarBtn.disabled = false;
        guardarBtn.textContent = "Guardar Proveedor";

        if (resultado.exito) {
          console.log('[Proveedores] ✅ Proveedor creado exitosamente');
          toastr.success(resultado.mensaje, 'Éxito');
          modalProveedor.classList.remove("is-visible");
          fetchAndRenderProveedores();
        } else {
          console.error('[Proveedores] ❌ Error al crear:', resultado.mensaje);
          toastr.error(resultado.mensaje, 'Error');
        }
      }
    });

    const cerrarModal = () => modalProveedor.classList.remove("is-visible");
    modalProveedor
      .querySelector(".modal-close-button")
      .addEventListener("click", cerrarModal);
    modalProveedor
      .querySelector(".button-secondary")
      .addEventListener("click", cerrarModal);
  }

  // ===== MODAL DE CONTACTO =====
  if (modalContacto && btnAbrirModalContacto) {
    btnAbrirModalContacto.addEventListener("click", (e) => {
      e.preventDefault();

      formContacto.reset();

      const tituloModal = modalContacto.querySelector(".modal-title");
      if (tituloModal) {
        tituloModal.textContent = "Añadir Nuevo Contacto";
      }

      delete formContacto.dataset.editId;

      modalContacto.classList.add("is-visible");
    });

    if (formContacto) {
      formContacto.addEventListener("submit", async (event) => {
        event.preventDefault();

        const guardarBtn = document.getElementById("btn-guardar-nuevo-contacto");
        const editId = formContacto.dataset.editId;

        const textoOriginalBoton = editId ? "Guardar Cambios" : "Guardar Contacto";

        guardarBtn.disabled = true;

        const contactoData = {
          nombre_completo: document.getElementById("contacto-nombre").value,
          cargo: document.getElementById("contacto-cargo").value,
          email: document.getElementById("contacto-email").value,
          telefono: document.getElementById("contacto-telefono").value,
        };

        if (editId) {
          // Modo edición
          guardarBtn.textContent = "Actualizando...";
          contactoData.id = editId;

          const resultado = await actualizarContactoConSupabase(contactoData);

          guardarBtn.disabled = false;
          guardarBtn.textContent = textoOriginalBoton;

          if (resultado.exito) {
            toastr.success(resultado.mensaje, 'Éxito');
            document.getElementById("modal-nuevo-contacto").classList.remove("is-visible");
            recargarDetallesProveedor();
          } else {
            toastr.error(resultado.mensaje, 'Error');
          }
        } else {
          // Modo creación
          guardarBtn.textContent = "Guardando...";
          if (!proveedorIdActual) {
            alert("Error: No se ha seleccionado un proveedor.");
            guardarBtn.disabled = false;
            return;
          }
          contactoData.id_proveedor = proveedorIdActual;

          const resultado = await crearNuevoContactoConSupabase(contactoData);

          guardarBtn.disabled = false;
          guardarBtn.textContent = textoOriginalBoton;

          if (resultado.exito) {
            toastr.success(resultado.mensaje, 'Éxito');
            document.getElementById("modal-nuevo-contacto").classList.remove("is-visible");
            recargarDetallesProveedor();
          } else {
            toastr.error(resultado.mensaje, 'Error');
          }
        }
      });
    }

    const cerrarModal = () => modalContacto.classList.remove("is-visible");
    modalContacto
      .querySelector(".modal-close-button")
      .addEventListener("click", cerrarModal);
    modalContacto
      .querySelector(".button-secondary")
      .addEventListener("click", cerrarModal);
  }

  // ===== MODAL DE ASOCIAR PRODUCTO =====
  if (modalAsociar && btnAbrirModalAsociar) {
    btnAbrirModalAsociar.addEventListener("click", (e) => {
      e.preventDefault();
      console.log('[Proveedores] Abriendo modal de asociar producto');

      formAsociar.reset();
      document.getElementById('asociar-producto-id-seleccionado').value = '';
      document.getElementById('asociar-producto-selected-info').style.display = 'none';

      modalAsociar.classList.add("is-visible");

      configurarAutocompletadoProductos();
    });

    const cerrarModalAsociar = () =>
      modalAsociar.classList.remove("is-visible");
    document
      .getElementById("btn-cerrar-modal-asociar-producto")
      .addEventListener("click", cerrarModalAsociar);
    document
      .getElementById("btn-cancelar-asociar-producto")
      .addEventListener("click", cerrarModalAsociar);

    document
      .getElementById("form-asociar-producto")
      .addEventListener("submit", async (event) => {
        event.preventDefault();

        const productoIdSeleccionado = document.getElementById("asociar-producto-id-seleccionado").value;

        if (!productoIdSeleccionado) {
          toastr.warning("Por favor, selecciona un producto de la lista de búsqueda.", "Producto requerido");
          return;
        }

        const precioCosto = parseFloat(document.getElementById("asociar-producto-precio").value);
        if (!precioCosto || precioCosto <= 0) {
          toastr.warning("Por favor, ingresa un precio de costo válido.", "Precio requerido");
          return;
        }

        const skuProveedor = document.getElementById("asociar-producto-sku").value.trim() || null;

        console.log('[Asociar Producto] Iniciando asociación...');
        console.log('[Asociar Producto] Proveedor ID:', proveedorIdActual);
        console.log('[Asociar Producto] Producto ID:', productoIdSeleccionado);
        console.log('[Asociar Producto] Precio:', precioCosto);

        const guardarBtn = document.getElementById("btn-guardar-asociacion");
        const textoOriginal = guardarBtn.textContent;
        guardarBtn.disabled = true;
        guardarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        try {
          const client = getSupabaseClient();
          if (!client) {
            toastr.error('Cliente de Supabase no inicializado', 'Error');
            return;
          }

          const { data, error } = await client.rpc('fn_asociar_producto_proveedor', {
            p_id_proveedor: proveedorIdActual,
            p_id_producto: productoIdSeleccionado,
            p_precio_costo: precioCosto,
            p_sku_proveedor: skuProveedor
          });

          if (error) {
            console.error('[Asociar Producto] ✗ Error de Supabase:', error);
            toastr.error('Error al conectar con el servidor. Por favor, intenta nuevamente.', 'Error de conexión');
            return;
          }

          console.log('[Asociar Producto] Respuesta de RPC:', data);

          if (data && data.success) {
            console.log('[Asociar Producto] ✓ Asociación exitosa');
            toastr.success(data.mensaje, 'Éxito');

            cerrarModalAsociar();
            recargarDetallesProveedor();

          } else {
            console.error('[Asociar Producto] ✗ Error de negocio:', data);

            if (data.codigo_error === 'PERMISO_DENEGADO') {
              toastr.error(data.mensaje, 'Permiso denegado', {
                timeOut: 5000,
                closeButton: true
              });
            } else if (data.codigo_error === 'DUPLICADO') {
              toastr.warning(data.mensaje, 'Producto ya asociado');
            } else if (data.codigo_error === 'PRODUCTO_NO_VALIDO' || data.codigo_error === 'PROVEEDOR_NO_VALIDO') {
              toastr.error(data.mensaje, 'Datos inválidos');
            } else {
              toastr.error(data.mensaje || 'Error al asociar el producto', 'Error');
            }
          }

        } catch (error) {
          console.error('[Asociar Producto] ✗ Excepción:', error);
          toastr.error('Error inesperado. Por favor, contacta al administrador.', 'Error');
        } finally {
          guardarBtn.disabled = false;
          guardarBtn.innerHTML = textoOriginal;
        }
      });

    const cerrarModal = () => modalAsociar.classList.remove("is-visible");
    modalAsociar
      .querySelector(".modal-close-button")
      .addEventListener("click", cerrarModal);
    modalAsociar
      .querySelector(".button-secondary")
      .addEventListener("click", cerrarModal);
  }

  // ===== PAGINACIÓN =====
  const btnPrev = document.getElementById("btn-prev-page-proveedores");
  const btnNext = document.getElementById("btn-next-page-proveedores");

  if (btnPrev) {
    btnPrev.addEventListener("click", () => {
      if (proveedores_currentPage > 1) {
        proveedores_currentPage--;
        fetchAndRenderProveedores();
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener("click", () => {
      proveedores_currentPage++;
      fetchAndRenderProveedores();
    });
  }

  // ===== FILTRO POR ESTADO =====
  const filtroEstado = document.getElementById("filtro-estado-proveedor");
  if (filtroEstado) {
    filtroEstado.addEventListener("change", function () {
      proveedores_currentFilterEstado = this.value;
      proveedores_currentPage = 1;
      fetchAndRenderProveedores();
    });
  }

  // ===== CARGA INICIAL =====
  proveedores_currentPage = 1;

  if (filtroEstado) {
    filtroEstado.value = "Activo";
    proveedores_currentFilterEstado = "Activo";
  }

  fetchAndRenderProveedores();
}

// =========================================================================
// EXPORTAR FUNCIONES SI ES NECESARIO
// =========================================================================

// Si estás usando módulos ES6, puedes exportar estas funciones
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = {
    configurarPaginaProveedoresYListeners,
    fetchAndRenderProveedores
  };
}

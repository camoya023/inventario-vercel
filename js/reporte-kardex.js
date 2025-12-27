/**
 * =========================================================================
 * MÓDULO DE KARDEX / HISTORIAL DE MOVIMIENTOS
 * Reporte detallado de movimientos de inventario con análisis financiero
 * =========================================================================
 */

// ========================================
// VARIABLES GLOBALES
// ========================================
// 🚨 BANDERA DE MÓDULO ACTIVO (evita colisiones con otros módulos)
let kardexModuloActivo = false;

let datosKardexActuales = []; // Array para almacenar los resultados actuales
let datosKPIsActuales = null; // Objeto para almacenar los KPIs

// Estado de paginación
const estadoPaginacion = {
    paginaActual: 1,
    filasPorPagina: 20,
    totalRegistros: 0,
    totalPaginas: 1
};

// ========================================
// FUNCIÓN PRINCIPAL DE CARGA
// ========================================
/**
 * Función principal que carga la vista del reporte Kardex
 * Se llama desde home.js al hacer click en el menú
 */
async function cargarPaginaReporteKardex() {
    console.log('[Kardex] ===== INICIALIZANDO MÓDULO DE KARDEX =====');

    // 🚨 CRÍTICO: Desactivar otros módulos antes de activar este
    if (typeof desactivarTodosLosModulos === 'function') {
        desactivarTodosLosModulos();
    }

    // 🚨 ACTIVAR BANDERA DE MÓDULO
    kardexModuloActivo = true;

    try {
        const workArea = document.querySelector('.work-area');
        if (!workArea) {
            throw new Error('No se encontró el área de trabajo');
        }

        // Mostrar indicador de carga
        workArea.innerHTML = '<div class="loading-spinner-container"><div class="loading-spinner"></div><p>Cargando reporte Kardex...</p></div>';

        // Cargar HTML de la vista
        const response = await fetch('/views/reporte-kardex.html');
        if (!response.ok) throw new Error('Error al cargar la vista de Kardex');

        const html = await response.text();
        workArea.innerHTML = html;

        // Cargar CSS específico si no está cargado
        cargarCSSKardex();

        // Inicializar vista
        await inicializarVistaKardex();
        console.log('[Kardex] ✅ Módulo inicializado correctamente');
    } catch (error) {
        console.error('[Kardex] ❌ Error al inicializar:', error);
        showNotification('Error al cargar módulo de Kardex: ' + error.message, 'error');
    }
}

/**
 * Carga el CSS específico del módulo Kardex si no está cargado
 */
function cargarCSSKardex() {
    const cssId = 'kardex-css';
    if (!document.getElementById(cssId)) {
        const link = document.createElement('link');
        link.id = cssId;
        link.rel = 'stylesheet';
        link.href = '/css/reporte-kardex.css';
        document.head.appendChild(link);
        console.log('[Kardex] CSS específico cargado');
    }
}

/**
 * Inicializa la vista del reporte Kardex
 */
async function inicializarVistaKardex() {
    console.log("[Kardex] Inicializando vista...");

    try {
        // 1. Configurar fechas por defecto (últimos 30 días)
        configurarFechasPorDefecto();

        // 2. Configurar event listeners
        configurarEventListenersKardex();

        // 3. Inicializar autocomplete de productos (Tom Select)
        await inicializarAutocompleteProductos();

        // 4. Cargar lista de tipos de movimiento
        await cargarTiposMovimientoEnFiltro();

        // 5. Cargar lista de usuarios para el filtro
        await cargarUsuariosEnFiltro();

        // 6. Ejecutar búsqueda automática con fechas por defecto
        await ejecutarBusquedaKardex();

        console.log("[Kardex] Vista inicializada correctamente");

    } catch (error) {
        console.error('[Kardex] Error al inicializar vista:', error);
        showNotification('Error al inicializar el módulo de Kardex. Recarga la página.', 'error');
    }
}

// ========================================
// CONFIGURACIÓN INICIAL
// ========================================

/**
 * Configura los inputs de fecha con valores por defecto
 * Fecha Desde: Hace 7 días (última semana)
 * Fecha Hasta: Hoy
 */
function configurarFechasPorDefecto() {
    const fechaDesde = document.getElementById('fecha-desde');
    const fechaHasta = document.getElementById('fecha-hasta');

    if (fechaDesde && fechaHasta) {
        // Usar funciones de utils.js - Últimos 7 días por defecto
        fechaDesde.value = window.getDateDaysAgo(7);
        fechaHasta.value = window.getTodayISO();
        console.log('[Kardex] Fechas por defecto configuradas:', fechaDesde.value, '-', fechaHasta.value);
    }
}

/**
 * Limpia todos los filtros y restablece la vista al estado inicial
 */
async function limpiarFiltrosKardex() {
    try {
        console.log('[Kardex] Limpiando filtros...');

        // 1. LIMPIAR TOM SELECT (Acceso robusto al elemento DOM)
        const selectProducto = document.getElementById('filtro-producto-kardex');

        // Verificar si Tom Select está inicializado en ese elemento
        if (selectProducto && selectProducto.tomselect) {
            selectProducto.tomselect.clear(); // Borra la selección visual y el valor
            console.log('[Kardex] Tom Select limpiado correctamente');
        } else if (selectProducto) {
            // Fallback por si acaso no cargó la librería aún
            selectProducto.value = '';
            console.warn('[Kardex] Tom Select no inicializado, usando fallback');
        }

        // 2. Limpiar input hidden del ID del producto
        const filtroProductoId = document.getElementById('filtro-producto-id-kardex');
        if (filtroProductoId) filtroProductoId.value = '';

        // 3. Resetear selects a "Todos" (valor vacío)
        const selectTipo = document.getElementById('filtro-tipo-movimiento');
        const selectUsuario = document.getElementById('filtro-usuario-kardex');

        if (selectTipo) selectTipo.value = '';
        if (selectUsuario) selectUsuario.value = '';

        // 4. Restablecer fechas al valor por defecto (últimos 7 días)
        configurarFechasPorDefecto();

        // 5. Ejecutar búsqueda automáticamente para refrescar la tabla
        console.log('[Kardex] Filtros limpios. Recargando tabla...');
        await ejecutarBusquedaKardex();

        console.log('[Kardex] Filtros limpiados y búsqueda ejecutada');

    } catch (error) {
        console.error('[Kardex] Error al limpiar filtros:', error);
        showNotification('Error al limpiar filtros', 'error');
    }
}

/**
 * Configura todos los event listeners del módulo
 */
function configurarEventListenersKardex() {
    console.log("[Kardex] Configurando event listeners...");

    // Botón de Búsqueda
    const btnBuscar = document.getElementById('btn-buscar-kardex');
    if (btnBuscar) {
        btnBuscar.addEventListener('click', ejecutarBusquedaKardex);
    }

    // Botón de Limpiar Filtros
    const btnLimpiar = document.getElementById('btn-limpiar-kardex');
    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', limpiarFiltrosKardex);
    }

    // Botón de Exportar CSV
    const btnExportar = document.getElementById('btn-exportar-csv-kardex');
    if (btnExportar) {
        btnExportar.addEventListener('click', exportarKardexCSV);
    }

    // Toggle de Filtros Colapsables
    const btnToggleFiltros = document.getElementById('btn-toggle-filtros-kardex');
    const filtrosContent = document.getElementById('filtros-kardex-content');
    if (btnToggleFiltros && filtrosContent) {
        btnToggleFiltros.addEventListener('click', () => {
            const isExpanded = btnToggleFiltros.getAttribute('aria-expanded') === 'true';
            btnToggleFiltros.setAttribute('aria-expanded', !isExpanded);
            filtrosContent.classList.toggle('collapsed');
        });
    }

    // Búsqueda con Enter en los filtros
    const filtroProducto = document.getElementById('filtro-producto-kardex');
    if (filtroProducto) {
        filtroProducto.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                ejecutarBusquedaKardex();
            }
        });
    }

    // Botones de Paginación
    const btnPrevPage = document.getElementById('btn-prev-page-kardex');
    const btnNextPage = document.getElementById('btn-next-page-kardex');

    if (btnPrevPage) {
        btnPrevPage.addEventListener('click', () => {
            if (estadoPaginacion.paginaActual > 1) {
                estadoPaginacion.paginaActual--;
                renderizarTablaPaginada();
            }
        });
    }

    if (btnNextPage) {
        btnNextPage.addEventListener('click', () => {
            if (estadoPaginacion.paginaActual < estadoPaginacion.totalPaginas) {
                estadoPaginacion.paginaActual++;
                renderizarTablaPaginada();
            }
        });
    }

    console.log("[Kardex] Event listeners configurados");
}

// ========================================
// AUTOCOMPLETE DE PRODUCTOS (TOM SELECT)
// ========================================

let tomSelectProducto = null; // Instancia global de Tom Select

/**
 * Inicializa el autocomplete de productos usando Tom Select
 */
async function inicializarAutocompleteProductos() {
    console.log('[Kardex] Inicializando autocomplete de productos...');

    try {
        // Obtener todos los productos activos
        const { data: productos, error } = await supabaseClient
            .from('productos')
            .select('id_producto, nombre_producto, sku')
            .eq('activo', true)
            .order('nombre_producto');

        if (error) {
            console.error('[Kardex] Error al cargar productos:', error);
            return;
        }

        console.log('[Kardex] Productos cargados para autocomplete:', productos?.length || 0);

        // Preparar opciones para Tom Select
        const opciones = productos.map(p => ({
            value: p.id_producto,
            text: `${p.nombre_producto} ${p.sku ? '(' + p.sku + ')' : ''}`,
            nombre: p.nombre_producto,
            sku: p.sku
        }));

        // Inicializar Tom Select
        const inputProducto = document.getElementById('filtro-producto-kardex');
        if (inputProducto && window.TomSelect) {
            tomSelectProducto = new TomSelect(inputProducto, {
                options: opciones,
                maxItems: 1,
                valueField: 'value',
                labelField: 'text',
                searchField: ['nombre', 'sku', 'text'],
                placeholder: 'Buscar producto o SKU...',
                create: false,
                closeAfterSelect: true,
                onFocus: function() {
                    // Cuando el usuario hace click para buscar, limpiar selección anterior
                    if (this.getValue()) {
                        this.clear();
                    }
                },
                render: {
                    option: function(data, escape) {
                        return `<div class="py-1">
                            <div class="font-bold text-gray-800">${escape(data.nombre)}</div>
                            ${data.sku ? '<div class="text-xs text-gray-500">SKU: ' + escape(data.sku) + '</div>' : ''}
                        </div>`;
                    },
                    item: function(data, escape) {
                        // Al seleccionar, solo mostramos el nombre limpio
                        return `<div>${escape(data.nombre)}</div>`;
                    }
                },
                onChange: function(value) {
                    // Guardar el ID del producto seleccionado en el input hidden
                    const inputHidden = document.getElementById('filtro-producto-id-kardex');
                    if (inputHidden) {
                        inputHidden.value = value || '';
                    }
                    console.log('[Kardex] Producto seleccionado:', value);
                },
                // Truco de UX: Quitar el cursor parpadeante al seleccionar
                onItemAdd: function() {
                    this.blur();
                }
            });

            console.log('[Kardex] Tom Select inicializado correctamente');
        } else {
            console.warn('[Kardex] Tom Select no disponible, usando input estándar');
        }

    } catch (error) {
        console.error('[Kardex] Error al inicializar autocomplete:', error);
    }
}

// ========================================
// CARGA DE DATOS - KPIs
// ========================================

/**
 * Carga los KPIs (tarjetas de resumen financiero) desde la RPC
 * @param {Object} filtros - Objeto con los filtros de búsqueda
 */
async function cargarKPIsKardex(filtros) {
    console.log('[Kardex] Cargando KPIs...', filtros);

    try {
        // Llamada RPC para obtener KPIs
        const { data, error } = await supabaseClient.rpc('fn_reporte_kardex_kpis', {
            p_fecha_desde: filtros.p_fecha_desde,
            p_fecha_hasta: filtros.p_fecha_hasta,
            p_id_producto: filtros.p_id_producto,
            p_id_tipo_movimiento: filtros.p_id_tipo_movimiento,
            p_id_usuario: filtros.p_id_usuario
        });

        if (error) {
            console.error('[Kardex] Error al cargar KPIs:', error);
            throw error;
        }

        console.log('[Kardex] KPIs recibidos:', data);

        // Guardar datos
        datosKPIsActuales = data;

        // Renderizar KPIs
        renderizarKPIs(data);

    } catch (error) {
        console.error('[Kardex] Error al cargar KPIs:', error);
        showNotification('Error al cargar los indicadores financieros', 'error');

        // Mostrar valores en 0 en caso de error
        renderizarKPIs({
            dinero_entradas: 0,
            dinero_salidas: 0,
            balance_neto: 0
        });
    }
}

/**
 * Renderiza los KPIs en las tarjetas
 * @param {Object} kpis - Objeto con los valores de KPIs
 */
function renderizarKPIs(kpis) {
    const kpiEntradas = document.getElementById('kpi-entradas');
    const kpiSalidas = document.getElementById('kpi-salidas');
    const kpiBalance = document.getElementById('kpi-balance');

    if (kpiEntradas) {
        kpiEntradas.textContent = window.formatMoney(kpis.dinero_entradas || 0, true); // true = formato compacto para KPI
    }
    if (kpiSalidas) {
        kpiSalidas.textContent = window.formatMoney(kpis.dinero_salidas || 0, true); // true = formato compacto para KPI
    }
    if (kpiBalance) {
        kpiBalance.textContent = window.formatMoney(kpis.balance_neto || 0, true); // true = formato compacto para KPI
    }

    console.log('[Kardex] KPIs renderizados correctamente');
}

// ========================================
// CARGA DE DATOS - TABLA
// ========================================

/**
 * Ejecuta la búsqueda de movimientos con los filtros actuales
 */
async function ejecutarBusquedaKardex() {
    console.log('[Kardex] Ejecutando búsqueda...');

    try {
        // Obtener valores de los filtros
        const filtros = obtenerFiltrosActuales();

        // Validar fechas requeridas
        if (!filtros.p_fecha_desde || !filtros.p_fecha_hasta) {
            showNotification('Por favor, selecciona un rango de fechas válido', 'warning');
            return;
        }

        // Mostrar indicador de carga
        mostrarCargandoTabla();

        // Cargar KPIs y Tabla en paralelo
        await Promise.all([
            cargarKPIsKardex(filtros),
            cargarDatosTablaKardex(filtros)
        ]);

        console.log('[Kardex] Búsqueda completada');

    } catch (error) {
        console.error('[Kardex] Error al ejecutar búsqueda:', error);
        showNotification('Error al buscar movimientos', 'error');
        mostrarTablaVacia('Error al cargar datos. Intenta nuevamente.');
    }
}

/**
 * Obtiene los valores actuales de los filtros
 * @returns {Object} Objeto con los parámetros para la RPC
 */
function obtenerFiltrosActuales() {
    // Obtener valores raw de los inputs
    const rawFechaDesde = document.getElementById('fecha-desde')?.value || '';
    const rawFechaHasta = document.getElementById('fecha-hasta')?.value || '';
    const rawProductoId = document.getElementById('filtro-producto-id-kardex')?.value || '';
    const rawTipoMovimiento = document.getElementById('filtro-tipo-movimiento')?.value || '';
    const rawUsuarioId = document.getElementById('filtro-usuario-kardex')?.value || '';

    // SANITIZACIÓN: Convertir cadenas vacías a null
    // Si el valor es "" o "todos", envía null. Si tiene valor, procésalo.
    const params = {
        p_fecha_desde: rawFechaDesde === '' ? null : rawFechaDesde,
        p_fecha_hasta: rawFechaHasta === '' ? null : rawFechaHasta,
        // p_id_producto es UUID (string), NO convertir a parseInt
        p_id_producto: (rawProductoId === '' || rawProductoId === 'todos') ? null : rawProductoId,
        // p_id_tipo_movimiento es UUID (string), NO convertir a parseInt
        p_id_tipo_movimiento: (rawTipoMovimiento === '' || rawTipoMovimiento === 'todos') ? null : rawTipoMovimiento,
        // p_id_usuario es UUID (string), NO convertir a parseInt
        p_id_usuario: (rawUsuarioId === '' || rawUsuarioId === 'todos') ? null : rawUsuarioId
    };

    console.log('[Kardex] Parámetros construidos:', params);
    console.log('[Kardex] Valores raw:', { rawProductoId, rawTipoMovimiento, rawUsuarioId });

    return params;
}

/**
 * Carga los datos de la tabla desde la RPC
 * @param {Object} filtros - Objeto con los filtros de búsqueda
 */
async function cargarDatosTablaKardex(filtros) {
    console.log('[Kardex] Cargando datos de la tabla...', filtros);

    try {
        // Llamada RPC para obtener movimientos
        const { data, error } = await supabaseClient.rpc('fn_reporte_kardex', {
            p_fecha_desde: filtros.p_fecha_desde,
            p_fecha_hasta: filtros.p_fecha_hasta,
            p_id_producto: filtros.p_id_producto,
            p_id_tipo_movimiento: filtros.p_id_tipo_movimiento,
            p_id_usuario: filtros.p_id_usuario
        });

        if (error) {
            console.error('[Kardex] Error al cargar datos:', error);
            throw error;
        }

        console.log('[Kardex] Datos recibidos:', data?.length || 0, 'registros');

        // Guardar datos
        datosKardexActuales = data || [];

        // Inicializar paginación
        estadoPaginacion.totalRegistros = datosKardexActuales.length;
        estadoPaginacion.totalPaginas = Math.ceil(datosKardexActuales.length / estadoPaginacion.filasPorPagina);
        estadoPaginacion.paginaActual = 1; // Resetear a página 1

        // Renderizar tabla con paginación
        renderizarTablaPaginada();

    } catch (error) {
        console.error('[Kardex] Error al cargar datos de tabla:', error);
        throw error;
    }
}

/**
 * Renderiza la tabla con paginación aplicada
 * Corta el array de datos según la página actual
 */
function renderizarTablaPaginada() {
    // 🚨 VERIFICAR SI EL MÓDULO ESTÁ ACTIVO
    if (!kardexModuloActivo) {
        console.warn('[Kardex] Módulo inactivo, cancelando renderizado.');
        return;
    }

    const inicio = (estadoPaginacion.paginaActual - 1) * estadoPaginacion.filasPorPagina;
    const fin = inicio + estadoPaginacion.filasPorPagina;
    const movimientosPagina = datosKardexActuales.slice(inicio, fin);

    // Renderizar solo los movimientos de esta página
    renderizarTablaKardex(movimientosPagina);

    // Actualizar controles de paginación
    actualizarControlesPaginacion();
}

/**
 * Actualiza los controles de paginación (botones y texto)
 */
function actualizarControlesPaginacion() {
    const btnPrev = document.getElementById('btn-prev-page-kardex');
    const btnNext = document.getElementById('btn-next-page-kardex');
    const pageInfo = document.getElementById('page-info-kardex');
    const paginationControls = document.getElementById('pagination-controls-kardex');

    // Mostrar/ocultar controles según si hay datos
    if (paginationControls) {
        if (datosKardexActuales.length === 0) {
            paginationControls.style.display = 'none';
        } else {
            paginationControls.style.display = 'flex';
        }
    }

    // Actualizar texto de página
    if (pageInfo) {
        const inicio = (estadoPaginacion.paginaActual - 1) * estadoPaginacion.filasPorPagina + 1;
        const fin = Math.min(estadoPaginacion.paginaActual * estadoPaginacion.filasPorPagina, estadoPaginacion.totalRegistros);
        pageInfo.textContent = `Mostrando ${inicio}-${fin} de ${estadoPaginacion.totalRegistros} registros | Página ${estadoPaginacion.paginaActual} de ${estadoPaginacion.totalPaginas}`;
    }

    // Habilitar/deshabilitar botones
    if (btnPrev) {
        btnPrev.disabled = estadoPaginacion.paginaActual === 1;
    }

    if (btnNext) {
        btnNext.disabled = estadoPaginacion.paginaActual >= estadoPaginacion.totalPaginas;
    }

    console.log('[Kardex] Paginación actualizada:', estadoPaginacion);
}

/**
 * Renderiza la tabla de movimientos
 * @param {Array} movimientos - Array de objetos con los movimientos
 */
function renderizarTablaKardex(movimientos) {
    // 🚨 VERIFICAR SI EL MÓDULO ESTÁ ACTIVO
    if (!kardexModuloActivo) {
        console.warn('[Kardex] Módulo inactivo, cancelando renderizado.');
        return;
    }

    const tbody = document.getElementById('tbody-kardex');
    const mensajeSinResultados = document.getElementById('mensaje-sin-resultados-kardex');

    // --- BLOQUE DE SEGURIDAD ---
    // Protección contra cambios de vista rápidos (DOM no listo)
    if (!tbody) {
        console.warn('[Kardex] Tbody no encontrado en el DOM (cambio de vista detectado).');
        // Desactivar módulo para evitar futuras ejecuciones
        kardexModuloActivo = false;
        return;
    }
    // ---------------------------

    // Limpiar tabla
    tbody.innerHTML = '';

    // Si no hay datos, mostrar mensaje
    if (!movimientos || movimientos.length === 0) {
        mostrarTablaVacia('No se encontraron movimientos para los filtros seleccionados.');
        if (mensajeSinResultados) {
            mensajeSinResultados.style.display = 'block';
        }
        return;
    }

    // Ocultar mensaje de sin resultados
    if (mensajeSinResultados) {
        mensajeSinResultados.style.display = 'none';
    }

    // Renderizar cada fila
    movimientos.forEach((mov) => {
        const tr = document.createElement('tr');

        // Aplicar clases condicionales para cantidad y total
        const claseValor = mov.cantidad_con_signo >= 0 ? 'val-positivo' : 'val-negativo';
        const signo = mov.cantidad_con_signo > 0 ? '+' : '';

        // Determinar clase de badge según tipo de movimiento
        const claseBadge = obtenerClaseBadgeMovimiento(mov.codigo_movimiento);

        // Construir HTML de la fila
        tr.innerHTML = `
            <td>${window.formatDate(mov.fecha)}</td>
            <td>
                <span class="producto-nombre">${mov.nombre_producto || 'Sin nombre'}</span>
                <span class="producto-sku">${mov.sku || '-'}</span>
            </td>
            <td class="text-center">
                <span class="badge-movimiento ${claseBadge}">${mov.codigo_movimiento || 'N/A'}</span>
            </td>
            <td class="text-right ${claseValor}">${signo}${mov.cantidad_con_signo || 0}</td>
            <td class="text-right">${window.formatMoney(mov.costo_historico || 0)}</td>
            <td class="text-right ${claseValor}">${window.formatMoney(mov.total_monetario || 0)}</td>
            <td class="text-right">${mov.saldo_stock || 0}</td>
            <td class="text-center">
                ${renderizarUsuario(mov.nombre_usuario)}
            </td>
        `;

        tbody.appendChild(tr);
    });

    console.log('[Kardex] Tabla renderizada:', movimientos.length, 'filas');
}

/**
 * Obtiene la clase CSS del badge según el código de movimiento
 * @param {string} codigo - Código del movimiento (COMPRA, VENTA, etc.)
 * @returns {string} Clase CSS del badge
 */
function obtenerClaseBadgeMovimiento(codigo) {
    const mapa = {
        'COMPRA': 'badge-compra',
        'VENTA': 'badge-venta',
        'AJUSTE': 'badge-ajuste',
        'DEVOLUCION': 'badge-devolucion'
    };
    return mapa[codigo?.toUpperCase()] || 'badge-default';
}

/**
 * Renderiza el avatar y nombre del usuario
 * @param {string} nombreUsuario - Nombre del usuario
 * @returns {string} HTML del usuario
 */
function renderizarUsuario(nombreUsuario) {
    if (!nombreUsuario) return '-';

    // Obtener iniciales
    const iniciales = nombreUsuario
        .split(' ')
        .map(n => n.charAt(0))
        .join('')
        .substring(0, 2)
        .toUpperCase();

    return `
        <div class="user-avatar-mini">
            <div class="user-avatar-circle">${iniciales}</div>
            <span class="user-name-short">${nombreUsuario}</span>
        </div>
    `;
}

/**
 * Muestra indicador de carga en la tabla
 */
function mostrarCargandoTabla() {
    const tbody = document.getElementById('tbody-kardex');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center" style="padding: 40px;">
                    <i class="fas fa-spinner fa-spin"></i> Cargando movimientos...
                </td>
            </tr>
        `;
    }
}

/**
 * Muestra mensaje cuando no hay datos
 * @param {string} mensaje - Mensaje a mostrar
 */
function mostrarTablaVacia(mensaje) {
    const tbody = document.getElementById('tbody-kardex');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center" style="padding: 40px; font-style: italic; color: #888;">
                    <i class="fas fa-info-circle"></i> ${mensaje}
                </td>
            </tr>
        `;
    }
}

// ========================================
// CARGA DE TIPOS DE MOVIMIENTO PARA FILTRO
// ========================================

/**
 * Carga la lista de tipos de movimiento en el select de filtros
 */
async function cargarTiposMovimientoEnFiltro() {
    console.log('[Kardex] Cargando tipos de movimiento para filtro...');

    try {
        const selectTipo = document.getElementById('filtro-tipo-movimiento');
        if (!selectTipo) return;

        // Obtener tipos de movimiento desde la tabla tipos_movimiento_inventario
        const { data, error } = await supabaseClient
            .from('tipos_movimiento_inventario')
            .select('id_tipo_movimiento, descripcion_movimiento')
            .order('descripcion_movimiento', { ascending: true });

        if (error) {
            console.error('[Kardex] Error al cargar tipos de movimiento:', error);
            // Dejar opción por defecto en caso de error
            selectTipo.innerHTML = '<option value="">Todos los movimientos</option>';
            return;
        }

        // Limpiar select completamente
        selectTipo.innerHTML = '';

        // IMPORTANTE: La opción "Todos" debe tener value="" (cadena vacía)
        // para que la lógica de sanitización envíe null al backend
        const opcionTodos = document.createElement('option');
        opcionTodos.value = '';
        opcionTodos.textContent = 'Todos los movimientos';
        selectTipo.appendChild(opcionTodos);

        // Agregar tipos de movimiento desde la BD
        if (data && data.length > 0) {
            data.forEach(tipo => {
                const option = document.createElement('option');
                option.value = tipo.id_tipo_movimiento; // UUID correcto
                option.textContent = tipo.descripcion_movimiento;
                selectTipo.appendChild(option);
            });
        }

        console.log('[Kardex] Tipos de movimiento cargados:', data?.length || 0);

    } catch (error) {
        console.error('[Kardex] Error al cargar tipos de movimiento:', error);
        // Asegurar que al menos haya una opción
        const selectTipo = document.getElementById('filtro-tipo-movimiento');
        if (selectTipo) {
            selectTipo.innerHTML = '<option value="">Todos los movimientos</option>';
        }
    }
}

// ========================================
// CARGA DE USUARIOS PARA FILTRO
// ========================================

/**
 * Carga la lista de usuarios en el select de filtros
 */
async function cargarUsuariosEnFiltro() {
    console.log('[Kardex] Cargando usuarios para filtro...');

    try {
        // Obtener usuarios desde la tabla perfiles
        const { data, error } = await supabaseClient
            .from('perfiles')
            .select('id, nombre_completo')
            .order('nombre_completo');

        if (error) {
            console.error('[Kardex] Error al cargar usuarios:', error);
            return;
        }

        const selectUsuario = document.getElementById('filtro-usuario-kardex');
        if (!selectUsuario) return;

        // Limpiar opciones existentes (excepto "Todos")
        selectUsuario.innerHTML = '<option value="">Todos los usuarios</option>';

        // Agregar usuarios
        if (data && data.length > 0) {
            data.forEach(usuario => {
                const option = document.createElement('option');
                option.value = usuario.id;
                option.textContent = usuario.nombre_completo || 'Sin nombre';
                selectUsuario.appendChild(option);
            });
        }

        console.log('[Kardex] Usuarios cargados:', data?.length || 0);

    } catch (error) {
        console.error('[Kardex] Error al cargar usuarios:', error);
    }
}

// ========================================
// EXPORTACIÓN CSV
// ========================================

/**
 * Exporta los datos actuales a CSV
 */
function exportarKardexCSV() {
    console.log('[Kardex] Exportando a CSV...');

    if (!datosKardexActuales || datosKardexActuales.length === 0) {
        showNotification('No hay datos para exportar', 'warning');
        return;
    }

    try {
        // Cabeceras del CSV
        const headers = [
            'Fecha',
            'Producto',
            'SKU',
            'Tipo Movimiento',
            'Cantidad',
            'Costo Unitario',
            'Total',
            'Saldo',
            'Usuario'
        ];

        // Construir filas
        const rows = datosKardexActuales.map(mov => [
            window.formatDate(mov.fecha),
            mov.nombre_producto || '',
            mov.sku || '',
            mov.codigo_movimiento || '',
            mov.cantidad_con_signo || 0,
            mov.costo_historico || 0,
            mov.total_monetario || 0,
            mov.saldo_stock || 0,
            mov.nombre_usuario || ''
        ]);

        // Generar CSV
        let csvContent = '\uFEFF'; // BOM para Excel
        csvContent += headers.join(',') + '\n';
        rows.forEach(row => {
            csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        // Descargar archivo
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        const fechaActual = new Date().toISOString().split('T')[0];
        link.setAttribute('href', url);
        link.setAttribute('download', `kardex_movimientos_${fechaActual}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification('Archivo CSV exportado correctamente', 'success');
        console.log('[Kardex] CSV exportado correctamente');

    } catch (error) {
        console.error('[Kardex] Error al exportar CSV:', error);
        showNotification('Error al exportar CSV', 'error');
    }
}

// ========================================
// UTILIDADES
// ========================================

// ========================================
// INICIALIZACIÓN AUTOMÁTICA (DESARROLLO)
// ========================================

/**
 * Auto-inicialización para desarrollo/pruebas
 * Comentar o eliminar en producción
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Solo auto-inicializar si estamos en la página de Kardex
        if (window.location.pathname.includes('reporte-kardex')) {
            console.log('[Kardex] Auto-inicialización en modo desarrollo');
            // cargarPaginaReporteKardex(); // Descomentar para pruebas
        }
    });
}

console.log('[Kardex] Módulo cargado y listo');

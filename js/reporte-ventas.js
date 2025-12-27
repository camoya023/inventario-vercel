/**
 * =========================================================================
 * MÓDULO DE INFORME DE VENTAS
 * Dashboard completo de ventas con KPIs, gráficos y tabla detallada
 * =========================================================================
 */

// ========================================
// VARIABLES GLOBALES
// ========================================
// 🚨 BANDERA DE MÓDULO ACTIVO (evita colisiones con otros módulos)
let ventasModuloActivo = false;

let datosVentasActuales = []; // Array para almacenar los resultados actuales
let datosKPIsVentasActuales = null; // Objeto para almacenar los KPIs
let chartTopProductos = null; // Instancia del gráfico de Chart.js

// Estado de paginación (renombrado para evitar conflicto con ventas-lista.js)
const estadoPaginacionInformeVentas = {
    paginaActual: 1,
    filasPorPagina: 20,
    totalRegistros: 0,
    totalPaginas: 1
};

// ========================================
// FUNCIÓN PRINCIPAL DE CARGA
// ========================================
/**
 * Función principal que carga la vista del informe de ventas
 * Se llama desde home.js al hacer click en el menú
 */
async function cargarPaginaInformeVentas() {
    console.log('[InformeVentas] ===== INICIALIZANDO MÓDULO DE INFORME DE VENTAS =====');

    // 🚨 CRÍTICO: Desactivar otros módulos antes de activar este
    if (typeof desactivarTodosLosModulos === 'function') {
        desactivarTodosLosModulos();
    }

    // 🚨 ACTIVAR BANDERA DE MÓDULO
    ventasModuloActivo = true;

    try {
        const workArea = document.querySelector('.work-area');
        if (!workArea) {
            throw new Error('No se encontró el área de trabajo');
        }

        // Mostrar indicador de carga
        workArea.innerHTML = '<div class="loading-spinner-container"><div class="loading-spinner"></div><p>Cargando informe de ventas...</p></div>';

        // Cargar HTML de la vista
        const response = await fetch('/views/reporte-ventas.html');
        if (!response.ok) throw new Error('Error al cargar la vista de Informe de Ventas');

        const html = await response.text();
        workArea.innerHTML = html;

        // Cargar CSS específico si no está cargado
        cargarCSSInformeVentas();

        // Inicializar vista
        await inicializarVistaInformeVentas();
        console.log('[InformeVentas] ✅ Módulo inicializado correctamente');
    } catch (error) {
        console.error('[InformeVentas] ❌ Error al inicializar:', error);
        showNotification('Error al cargar módulo de Informe de Ventas: ' + error.message, 'error');
    }
}

/**
 * Carga el CSS específico del módulo Informe de Ventas si no está cargado
 */
function cargarCSSInformeVentas() {
    const cssId = 'informe-ventas-css';
    if (!document.getElementById(cssId)) {
        const link = document.createElement('link');
        link.id = cssId;
        link.rel = 'stylesheet';
        link.href = '/css/reporte-ventas.css';
        document.head.appendChild(link);
        console.log('[InformeVentas] CSS específico cargado');
    }
}

/**
 * Inicializa la vista del informe de ventas
 */
async function inicializarVistaInformeVentas() {
    console.log("[InformeVentas] Inicializando vista...");

    try {
        // 1. Configurar fechas por defecto (últimos 7 días)
        configurarFechasPorDefectoVentas();

        // 2. Configurar event listeners
        configurarEventListenersVentas();

        // 3. Inicializar autocomplete de clientes (Tom Select)
        await inicializarAutocompleteClientes();

        // 4. Ejecutar búsqueda automática con fechas por defecto
        await ejecutarBusquedaVentas();

        console.log("[InformeVentas] Vista inicializada correctamente");

    } catch (error) {
        console.error('[InformeVentas] Error al inicializar vista:', error);
        showNotification('Error al inicializar el módulo de Informe de Ventas. Recarga la página.', 'error');
    }
}

// ========================================
// CONFIGURACIÓN INICIAL
// ========================================

/**
 * Configura los inputs de fecha con valores por defecto
 * Fecha Desde: Hace 7 días
 * Fecha Hasta: Hoy
 */
function configurarFechasPorDefectoVentas() {
    const fechaDesde = document.getElementById('fecha-desde-ventas');
    const fechaHasta = document.getElementById('fecha-hasta-ventas');

    if (fechaDesde && fechaHasta) {
        // Usar funciones de utils.js - Últimos 7 días por defecto
        fechaDesde.value = window.getDateDaysAgo(7);
        fechaHasta.value = window.getTodayISO();
        console.log('[InformeVentas] Fechas por defecto configuradas:', fechaDesde.value, '-', fechaHasta.value);
    }
}

/**
 * Limpia todos los filtros y restablece la vista al estado inicial
 */
async function limpiarFiltrosInformeVentas() {
    try {
        console.log('[InformeVentas] Limpiando filtros...');

        // 1. LIMPIAR SELECT2 (Clientes)
        const selectCliente = $('#filtro-cliente-ventas');
        if (selectCliente.length) {
            selectCliente.val('').trigger('change');
            console.log('[InformeVentas] Select2 limpiado correctamente');
        }

        // 2. Restablecer fechas al valor por defecto (últimos 7 días)
        configurarFechasPorDefectoVentas();

        // 3. Ejecutar búsqueda automáticamente para refrescar
        console.log('[InformeVentas] Filtros limpios. Recargando...');
        await ejecutarBusquedaVentas();

        console.log('[InformeVentas] Filtros limpiados y búsqueda ejecutada');

    } catch (error) {
        console.error('[InformeVentas] Error al limpiar filtros:', error);
        showNotification('Error al limpiar filtros', 'error');
    }
}

/**
 * Configura todos los event listeners del módulo
 */
function configurarEventListenersVentas() {
    console.log("[InformeVentas] Configurando event listeners...");

    // Botón de Búsqueda
    const btnBuscar = document.getElementById('btn-buscar-ventas');
    if (btnBuscar) {
        btnBuscar.addEventListener('click', ejecutarBusquedaVentas);
    }

    // Botón de Limpiar Filtros
    const btnLimpiar = document.getElementById('btn-limpiar-ventas');
    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', limpiarFiltrosInformeVentas);
    }

    // Botón de Exportar CSV
    const btnExportar = document.getElementById('btn-exportar-csv-ventas');
    if (btnExportar) {
        btnExportar.addEventListener('click', exportarVentasCSV);
    }

    // Toggle de Filtros Colapsables
    const btnToggleFiltros = document.getElementById('btn-toggle-filtros-ventas');
    const filtrosContent = document.getElementById('filtros-ventas-content');
    if (btnToggleFiltros && filtrosContent) {
        btnToggleFiltros.addEventListener('click', () => {
            const isExpanded = btnToggleFiltros.getAttribute('aria-expanded') === 'true';
            btnToggleFiltros.setAttribute('aria-expanded', !isExpanded);
            filtrosContent.classList.toggle('collapsed');
        });
    }

    // Búsqueda con Enter en los filtros
    const filtroCliente = document.getElementById('filtro-cliente-ventas');
    if (filtroCliente) {
        filtroCliente.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                ejecutarBusquedaVentas();
            }
        });
    }

    // Botones de Paginación
    const btnPrevPage = document.getElementById('btn-prev-page-ventas');
    const btnNextPage = document.getElementById('btn-next-page-ventas');

    if (btnPrevPage) {
        btnPrevPage.addEventListener('click', () => {
            if (estadoPaginacionVentas.paginaActual > 1) {
                estadoPaginacionVentas.paginaActual--;
                renderizarTablaPaginadaVentas();
            }
        });
    }

    if (btnNextPage) {
        btnNextPage.addEventListener('click', () => {
            if (estadoPaginacionVentas.paginaActual < estadoPaginacionVentas.totalPaginas) {
                estadoPaginacionVentas.paginaActual++;
                renderizarTablaPaginadaVentas();
            }
        });
    }

    console.log("[InformeVentas] Event listeners configurados");
}

// ========================================
// AUTOCOMPLETE DE CLIENTES (SELECT2)
// ========================================

let select2ClienteInformeVentas = null; // Instancia global de Select2

/**
 * Inicializa el autocomplete de clientes usando Select2 con búsqueda AJAX
 */
async function inicializarAutocompleteClientes() {
    console.log('[InformeVentas] Inicializando Select2 para clientes...');

    try {
        const selectCliente = $('#filtro-cliente-ventas');
        if (!selectCliente.length || typeof $.fn.select2 === 'undefined') {
            console.warn('[InformeVentas] Select2 no disponible o elemento no encontrado');
            return;
        }

        select2ClienteInformeVentas = selectCliente.select2({
            placeholder: 'Buscar cliente (mínimo 3 letras)...',
            allowClear: true,
            minimumInputLength: 3,
            language: {
                inputTooShort: function() {
                    return 'Escribe al menos 3 caracteres para buscar...';
                },
                searching: function() {
                    return 'Buscando clientes...';
                },
                noResults: function() {
                    return 'No se encontraron clientes';
                }
            },
            ajax: {
                delay: 400,
                transport: async function(params, success, failure) {
                    try {
                        const termino = params.data.term || '';

                        if (termino.length < 3) {
                            success({ results: [{ id: '', text: 'Todos los clientes' }] });
                            return { abort: () => {} };
                        }

                        console.log('[InformeVentas] Buscando clientes con término:', termino);

                        const { data, error } = await supabaseClient
                            .from('clientes')
                            .select('id, nombres, apellidos, razon_social, numero_identificacion')
                            .is('fecha_eliminacion_logica', null)
                            .or(`nombres.ilike.%${termino}%,apellidos.ilike.%${termino}%,razon_social.ilike.%${termino}%,numero_identificacion.ilike.%${termino}%`)
                            .limit(15)
                            .order('nombres', { ascending: true });

                        if (error) {
                            console.error('[InformeVentas] Error buscando clientes:', error);
                            failure(error);
                            return { abort: () => {} };
                        }

                        console.log('[InformeVentas] Clientes encontrados:', data?.length || 0);

                        // Formatear datos para Select2
                        const results = data.map(c => {
                            let nombreVisual = c.razon_social || `${c.nombres || ''} ${c.apellidos || ''}`.trim();
                            // Solo agregar documento si existe
                            if (c.numero_identificacion) {
                                nombreVisual += ` (${c.numero_identificacion})`;
                            }
                            return {
                                id: c.id,
                                text: nombreVisual
                            };
                        });

                        success({ results });

                    } catch (error) {
                        console.error('[InformeVentas] Error en búsqueda:', error);
                        failure(error);
                    }
                    return { abort: () => {} };
                }
            }
        });

        // Auto-enfoque cuando se abre el select
        selectCliente.on('select2:open', function() {
            setTimeout(function() {
                document.querySelector('.select2-search__field').focus();
            }, 100);
        });

        // Event listener para cambios
        selectCliente.on('change', function() {
            const valor = $(this).val();
            console.log('[InformeVentas] Cliente seleccionado:', valor || 'Todos');
        });

        console.log('[InformeVentas] Select2 inicializado correctamente');

    } catch (error) {
        console.error('[InformeVentas] Error al inicializar Select2:', error);
    }
}

// ========================================
// CARGA DE DATOS - KPIs
// ========================================

/**
 * Carga los KPIs desde la RPC
 * @param {Object} filtros - Objeto con los filtros de búsqueda
 */
async function cargarKPIsVentas(filtros) {
    console.log('[InformeVentas] Cargando KPIs...', filtros);

    try {
        // Llamada RPC para obtener KPIs
        const { data, error } = await supabaseClient.rpc('fn_reporte_ventas_kpis', {
            p_fecha_desde: filtros.p_fecha_desde,
            p_fecha_hasta: filtros.p_fecha_hasta,
            p_id_cliente: filtros.p_id_cliente
        });

        if (error) {
            console.error('[InformeVentas] Error al cargar KPIs:', error);
            throw error;
        }

        console.log('[InformeVentas] KPIs recibidos:', data);

        // Guardar datos
        datosKPIsVentasActuales = data;

        // Renderizar KPIs
        renderizarKPIsVentas(data);

        // Renderizar gráfico con datos de top productos
        if (data && data.grafico_top_productos) {
            renderizarGraficoTopProductos(data.grafico_top_productos);
        } else {
            mostrarMensajeSinDatosGrafico();
        }

    } catch (error) {
        console.error('[InformeVentas] Error al cargar KPIs:', error);
        showNotification('Error al cargar los indicadores de ventas', 'error');

        // Mostrar valores en 0 en caso de error
        renderizarKPIsVentas({
            total_dinero: 0,
            cantidad_ventas: 0,
            ticket_promedio: 0,
            ganancia_estimada: 0
        });
        mostrarMensajeSinDatosGrafico();
    }
}

/**
 * Renderiza los KPIs en las tarjetas
 * @param {Object} kpis - Objeto con los valores de KPIs
 */
function renderizarKPIsVentas(kpis) {
    const kpiVentasTotales = document.getElementById('kpi-ventas-totales');
    const kpiCantidadVentas = document.getElementById('kpi-cantidad-ventas');
    const kpiTicketPromedio = document.getElementById('kpi-ticket-promedio');
    const kpiGananciaEstimada = document.getElementById('kpi-ganancia-estimada');

    if (kpiVentasTotales) {
        kpiVentasTotales.textContent = window.formatMoney(kpis.total_dinero || 0, true); // true = formato compacto para KPI
    }
    if (kpiCantidadVentas) {
        kpiCantidadVentas.textContent = kpis.cantidad_ventas || 0;
    }
    if (kpiTicketPromedio) {
        kpiTicketPromedio.textContent = window.formatMoney(kpis.ticket_promedio || 0, true); // true = formato compacto para KPI
    }
    if (kpiGananciaEstimada) {
        kpiGananciaEstimada.textContent = window.formatMoney(kpis.ganancia_estimada || 0, true); // true = formato compacto para KPI
    }

    console.log('[InformeVentas] KPIs renderizados correctamente');
}

// ========================================
// GRÁFICO DE TOP PRODUCTOS (CHART.JS)
// ========================================

/**
 * Renderiza el gráfico de barras con los productos más vendidos
 * @param {Array} datosGrafico - Array con {nombre_producto, total_vendido}
 */
function renderizarGraficoTopProductos(datosGrafico) {
    console.log('[InformeVentas] Renderizando gráfico de top productos...', datosGrafico);

    const canvas = document.getElementById('graficoTopProductos');
    const mensajeSinDatos = document.getElementById('mensaje-sin-datos-grafico');

    // Validar si hay datos
    if (!datosGrafico || datosGrafico.length === 0) {
        mostrarMensajeSinDatosGrafico();
        return;
    }

    // Ocultar mensaje de sin datos
    if (mensajeSinDatos) {
        mensajeSinDatos.style.display = 'none';
    }

    // Mostrar canvas
    if (canvas) {
        canvas.style.display = 'block';
    }

    // Extraer labels y data
    const labels = datosGrafico.map(item => item.nombre_producto);
    const data = datosGrafico.map(item => item.total_vendido);

    // Colores bonitos (tonos de azul/verde)
    const coloresBarras = [
        'rgba(54, 162, 235, 0.8)',   // Azul
        'rgba(75, 192, 192, 0.8)',   // Verde azulado
        'rgba(153, 102, 255, 0.8)',  // Púrpura
        'rgba(255, 159, 64, 0.8)',   // Naranja
        'rgba(255, 99, 132, 0.8)',   // Rojo
        'rgba(201, 203, 207, 0.8)',  // Gris
        'rgba(255, 205, 86, 0.8)',   // Amarillo
        'rgba(100, 181, 246, 0.8)',  // Azul claro
        'rgba(129, 199, 132, 0.8)',  // Verde claro
        'rgba(171, 71, 188, 0.8)'    // Púrpura oscuro
    ];

    const coloresBorde = coloresBarras.map(color => color.replace('0.8', '1'));

    // Destruir gráfico anterior si existe
    if (chartTopProductos) {
        chartTopProductos.destroy();
    }

    // Crear nuevo gráfico
    if (canvas && window.Chart) {
        const ctx = canvas.getContext('2d');
        chartTopProductos = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Unidades Vendidas',
                    data: data,
                    backgroundColor: coloresBarras,
                    borderColor: coloresBorde,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2.5,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'Vendido: ' + context.parsed.y + ' unidades';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0
                        },
                        title: {
                            display: true,
                            text: 'Cantidad de Unidades'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Productos'
                        }
                    }
                }
            }
        });

        console.log('[InformeVentas] Gráfico renderizado correctamente');
    } else {
        console.warn('[InformeVentas] Chart.js no disponible o canvas no encontrado');
        mostrarMensajeSinDatosGrafico();
    }
}

/**
 * Muestra mensaje cuando no hay datos para el gráfico
 */
function mostrarMensajeSinDatosGrafico() {
    const canvas = document.getElementById('graficoTopProductos');
    const mensajeSinDatos = document.getElementById('mensaje-sin-datos-grafico');

    if (canvas) {
        canvas.style.display = 'none';
    }
    if (mensajeSinDatos) {
        mensajeSinDatos.style.display = 'flex';
    }

    // Destruir gráfico si existe
    if (chartTopProductos) {
        chartTopProductos.destroy();
        chartTopProductos = null;
    }
}

// ========================================
// CARGA DE DATOS - TABLA
// ========================================

/**
 * Ejecuta la búsqueda de ventas con los filtros actuales
 */
async function ejecutarBusquedaVentas() {
    console.log('[InformeVentas] Ejecutando búsqueda...');

    try {
        // Obtener valores de los filtros
        const filtros = obtenerFiltrosActualesVentas();

        // Validar fechas requeridas
        if (!filtros.p_fecha_desde || !filtros.p_fecha_hasta) {
            showNotification('Por favor, selecciona un rango de fechas válido', 'warning');
            return;
        }

        // Mostrar indicador de carga
        mostrarCargandoTablaVentas();

        // Cargar KPIs y Tabla en paralelo
        await Promise.all([
            cargarKPIsVentas(filtros),
            cargarDatosTablaVentas(filtros)
        ]);

        console.log('[InformeVentas] Búsqueda completada');

    } catch (error) {
        console.error('[InformeVentas] Error al ejecutar búsqueda:', error);
        showNotification('Error al buscar ventas', 'error');
        mostrarTablaVaciaVentas('Error al cargar datos. Intenta nuevamente.');
    }
}

/**
 * Obtiene los valores actuales de los filtros
 * @returns {Object} Objeto con los parámetros para la RPC
 */
function obtenerFiltrosActualesVentas() {
    const rawFechaDesde = document.getElementById('fecha-desde-ventas')?.value || '';
    const rawFechaHasta = document.getElementById('fecha-hasta-ventas')?.value || '';
    const rawClienteId = document.getElementById('filtro-cliente-ventas')?.value || '';

    const params = {
        p_fecha_desde: rawFechaDesde === '' ? null : rawFechaDesde,
        p_fecha_hasta: rawFechaHasta === '' ? null : rawFechaHasta,
        p_id_cliente: (rawClienteId === '' || rawClienteId === 'todos') ? null : rawClienteId
    };

    console.log('[InformeVentas] Parámetros construidos:', params);
    return params;
}

/**
 * Carga los datos de la tabla desde la RPC
 * @param {Object} filtros - Objeto con los filtros de búsqueda
 */
async function cargarDatosTablaVentas(filtros) {
    console.log('[InformeVentas] Cargando datos de la tabla...', filtros);

    try {
        // Llamada RPC para obtener listado de ventas
        const { data, error } = await supabaseClient.rpc('fn_reporte_ventas_listado', {
            p_fecha_desde: filtros.p_fecha_desde,
            p_fecha_hasta: filtros.p_fecha_hasta,
            p_id_cliente: filtros.p_id_cliente
        });

        if (error) {
            console.error('[InformeVentas] Error al cargar datos:', error);
            throw error;
        }

        console.log('[InformeVentas] Datos recibidos:', data?.length || 0, 'registros');

        // Guardar datos
        datosVentasActuales = data || [];

        // Inicializar paginación
        estadoPaginacionVentas.totalRegistros = datosVentasActuales.length;
        estadoPaginacionVentas.totalPaginas = Math.ceil(datosVentasActuales.length / estadoPaginacionVentas.filasPorPagina);
        estadoPaginacionVentas.paginaActual = 1;

        // Renderizar tabla con paginación
        renderizarTablaPaginadaVentas();

    } catch (error) {
        console.error('[InformeVentas] Error al cargar datos de tabla:', error);
        throw error;
    }
}

/**
 * Renderiza la tabla con paginación aplicada
 */
function renderizarTablaPaginadaVentas() {
    // 🚨 VERIFICAR SI EL MÓDULO ESTÁ ACTIVO
    if (!ventasModuloActivo) {
        console.warn('[InformeVentas] Módulo inactivo, cancelando renderizado.');
        return;
    }

    const inicio = (estadoPaginacionVentas.paginaActual - 1) * estadoPaginacionVentas.filasPorPagina;
    const fin = inicio + estadoPaginacionVentas.filasPorPagina;
    const ventasPagina = datosVentasActuales.slice(inicio, fin);

    renderizarTablaInformeVentas(ventasPagina);
    actualizarControlesPaginacionVentas();
}

/**
 * Actualiza los controles de paginación
 */
function actualizarControlesPaginacionVentas() {
    const btnPrev = document.getElementById('btn-prev-page-ventas');
    const btnNext = document.getElementById('btn-next-page-ventas');
    const pageInfo = document.getElementById('page-info-ventas');
    const paginationControls = document.getElementById('pagination-controls-ventas');

    if (paginationControls) {
        if (datosVentasActuales.length === 0) {
            paginationControls.style.display = 'none';
        } else {
            paginationControls.style.display = 'flex';
        }
    }

    if (pageInfo) {
        const inicio = (estadoPaginacionVentas.paginaActual - 1) * estadoPaginacionVentas.filasPorPagina + 1;
        const fin = Math.min(estadoPaginacionVentas.paginaActual * estadoPaginacionVentas.filasPorPagina, estadoPaginacionVentas.totalRegistros);
        pageInfo.textContent = `Mostrando ${inicio}-${fin} de ${estadoPaginacionVentas.totalRegistros} registros | Página ${estadoPaginacionVentas.paginaActual} de ${estadoPaginacionVentas.totalPaginas}`;
    }

    if (btnPrev) {
        btnPrev.disabled = estadoPaginacionVentas.paginaActual === 1;
    }

    if (btnNext) {
        btnNext.disabled = estadoPaginacionVentas.paginaActual >= estadoPaginacionVentas.totalPaginas;
    }

    console.log('[InformeVentas] Paginación actualizada:', estadoPaginacionVentas);
}

/**
 * Renderiza la tabla de ventas del informe
 * @param {Array} ventas - Array de objetos con las ventas
 */
function renderizarTablaInformeVentas(ventas) {
    // 🚨 VERIFICAR SI EL MÓDULO ESTÁ ACTIVO
    if (!ventasModuloActivo) {
        console.warn('[InformeVentas] Módulo inactivo, cancelando renderizado.');
        return;
    }

    const tbody = document.getElementById('tbody-ventas');
    const mensajeSinResultados = document.getElementById('mensaje-sin-resultados-ventas');

    if (!tbody) {
        console.warn('[InformeVentas] Tbody no encontrado en el DOM.');
        ventasModuloActivo = false;
        return;
    }

    tbody.innerHTML = '';

    if (!ventas || ventas.length === 0) {
        mostrarTablaVaciaVentas('No se encontraron ventas para los filtros seleccionados.');
        if (mensajeSinResultados) {
            mensajeSinResultados.style.display = 'block';
        }
        return;
    }

    if (mensajeSinResultados) {
        mensajeSinResultados.style.display = 'none';
    }

    ventas.forEach((venta) => {
        const tr = document.createElement('tr');

        // Determinar clase de badge según estado
        const claseBadge = obtenerClaseBadgeEstado(venta.estado);

        tr.innerHTML = `
            <td>${new Date(venta.fecha).toLocaleDateString()}</td>
            <td>${venta.codigo_venta || 'S/N'}</td>
            <td>${venta.nombre_cliente || 'Cliente General'}</td>
            <td class="text-right">${window.formatMoney(venta.total_venta || 0)}</td>
            <td class="text-center">
                <span class="badge-estado ${claseBadge}">${venta.estado || 'N/A'}</span>
            </td>
        `;

        tbody.appendChild(tr);
    });

    console.log('[InformeVentas] Tabla renderizada:', ventas.length, 'filas');
}

/**
 * Obtiene la clase CSS del badge según el estado
 * @param {string} estado - Estado de la venta
 * @returns {string} Clase CSS del badge
 */
function obtenerClaseBadgeEstado(estado) {
    const mapa = {
        'COMPLETADA': 'badge-completada',
        'PENDIENTE': 'badge-pendiente',
        'CANCELADA': 'badge-cancelada',
        'EN_PROCESO': 'badge-en-proceso'
    };
    return mapa[estado?.toUpperCase()] || 'badge-default';
}

/**
 * Muestra indicador de carga en la tabla
 */
function mostrarCargandoTablaVentas() {
    const tbody = document.getElementById('tbody-ventas');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center" style="padding: 40px;">
                    <i class="fas fa-spinner fa-spin"></i> Cargando ventas...
                </td>
            </tr>
        `;
    }
}

/**
 * Muestra mensaje cuando no hay datos
 * @param {string} mensaje - Mensaje a mostrar
 */
function mostrarTablaVaciaVentas(mensaje) {
    const tbody = document.getElementById('tbody-ventas');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center" style="padding: 40px; font-style: italic; color: #888;">
                    <i class="fas fa-info-circle"></i> ${mensaje}
                </td>
            </tr>
        `;
    }
}

// ========================================
// EXPORTACIÓN CSV
// ========================================

/**
 * Exporta los datos actuales a CSV
 */
function exportarVentasCSV() {
    console.log('[InformeVentas] Exportando a CSV...');

    if (!datosVentasActuales || datosVentasActuales.length === 0) {
        showNotification('No hay datos para exportar', 'warning');
        return;
    }

    try {
        const headers = ['Fecha', 'Folio', 'Cliente', 'Total', 'Estado'];

        const rows = datosVentasActuales.map(venta => [
            window.formatDate(venta.fecha_venta),
            venta.folio_venta || '',
            venta.nombre_cliente || '',
            venta.total_venta || 0,
            venta.estado_venta || ''
        ]);

        let csvContent = '\uFEFF';
        csvContent += headers.join(',') + '\n';
        rows.forEach(row => {
            csvContent += row.map(cell => `"${cell}"`).join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        const fechaActual = new Date().toISOString().split('T')[0];
        link.setAttribute('href', url);
        link.setAttribute('download', `informe_ventas_${fechaActual}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification('Archivo CSV exportado correctamente', 'success');
        console.log('[InformeVentas] CSV exportado correctamente');

    } catch (error) {
        console.error('[InformeVentas] Error al exportar CSV:', error);
        showNotification('Error al exportar CSV', 'error');
    }
}

console.log('[InformeVentas] Módulo cargado y listo');

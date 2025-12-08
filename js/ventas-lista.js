/**
 * =========================================================================
 * MÓDULO DE VENTAS - LISTA
 * Gestión de lista de ventas con filtros, paginación, análisis y acciones
 * =========================================================================
 */

// ========================================
// VARIABLES GLOBALES
// ========================================
const estadoPaginacionVentas = {
    paginaActual: 1,
    filasPorPagina: 10,
    totalRegistros: 0,
    totalPages: 1,
    filtros: {}
};

// Referencias a componentes externos
let flatpickrRangoFechasVentasVentas = null;
let select2ClienteVentasVentas = null;

// Flag para evitar sobrescritura durante restauración
let restaurandoFiltros = false;

// ========================================
// FUNCIÓN PRINCIPAL DE CARGA
// ========================================
/**
 * Función principal que carga la vista de lista de ventas
 * Se llama desde home.js al hacer click en el menú
 */
async function cargarPaginaVentas() {
    console.log('[Ventas] ===== INICIALIZANDO MÓDULO DE VENTAS =====');

    try {
        const workArea = document.querySelector('.work-area');
        if (!workArea) {
            throw new Error('No se encontró el área de trabajo');
        }

        // Mostrar indicador de carga
        workArea.innerHTML = '<div class="loading-spinner-container"><div class="loading-spinner"></div><p>Cargando módulo de ventas...</p></div>';

        // Cargar HTML de la vista de lista
        const response = await fetch('/views/ventas-lista.html');
        if (!response.ok) throw new Error('Error al cargar la vista de ventas');

        const html = await response.text();
        workArea.innerHTML = html;

        // Inicializar vista
        await inicializarVistaListaVentas();
        console.log('[Ventas] ✅ Módulo inicializado correctamente');
    } catch (error) {
        console.error('[Ventas] ❌ Error al inicializar:', error);
        toastr.error('Error al cargar módulo de ventas: ' + error.message, 'Error');
    }
}

/**
 * Inicializa la vista de lista de ventas
 */
async function inicializarVistaListaVentas() {
    console.log("[Ventas] Inicializando vista de Lista de Ventas...");

    try {
        // 1. Configurar event listeners
        configurarEventListenersListaVentas();

        // 2. Inicializar componentes de filtros (Select2, Flatpickr)
        inicializarComponentesFiltrosVentas();

        // 3. Restaurar filtros guardados (si existen)
        setTimeout(() => {
            restaurarFiltrosGuardadosVentas();

            // 5. Cargar datos iniciales
            ejecutarBusquedaDeVentas();

            // 6. Actualizar efectos visuales
            setTimeout(() => {
                actualizarEfectosVisualesFiltros();
                console.log('[Ventas] ✅ Vista de ventas inicializada con persistencia');
            }, 100);
        }, 300);

        console.log("[Ventas] Vista de Lista de Ventas inicializada correctamente");

    } catch (error) {
        console.error('[Ventas] Error al inicializar vista:', error);
        toastr.error('Error al inicializar el módulo de ventas. Recarga la página.', 'Error');
    }
}

// ========================================
// CONFIGURACIÓN DE EVENT LISTENERS
// ========================================
function configurarEventListenersListaVentas() {
    console.log("[Ventas] Configurando event listeners...");

    // Botón Nueva Venta
    const btnNuevaVenta = document.getElementById('btn-agregar-venta');
    if (btnNuevaVenta) {
        btnNuevaVenta.addEventListener('click', () => {
            cargarVistaFormularioVenta('create');
        });
    }

    // Botón Limpiar Filtros
    const btnLimpiarFiltros = document.getElementById('btn-limpiar-filtros-ventas');
    if (btnLimpiarFiltros) {
        btnLimpiarFiltros.addEventListener('click', limpiarFiltrosVentas);
    }

    // Toggle Filtros (Collapse/Expand)
    const btnToggleFiltros = document.getElementById('btn-toggle-filtros-ventas');
    if (btnToggleFiltros) {
        btnToggleFiltros.addEventListener('click', toggleFiltrosVentas);
    }

    // Toggle Análisis
    const btnToggleAnalisis = document.getElementById('btn-toggle-analisis');
    if (btnToggleAnalisis) {
        btnToggleAnalisis.addEventListener('click', toggleAnalisisVentas);
    }

    // Input de búsqueda con debounce
    const inputBuscar = document.getElementById('input-buscar-ventas');
    if (inputBuscar) {
        inputBuscar.addEventListener('input', debounce(() => {
            estadoPaginacionVentas.filtros.busqueda = inputBuscar.value.trim();
            estadoPaginacionVentas.paginaActual = 1;
            guardarFiltrosEnStorage();
            ejecutarBusquedaDeVentas();
        }, 400));
    }

    // Select de Estado Venta
    const filtroEstadoVenta = document.getElementById('filtro-estado-venta');
    if (filtroEstadoVenta) {
        filtroEstadoVenta.addEventListener('change', () => {
            estadoPaginacionVentas.filtros.estadoVenta = filtroEstadoVenta.value;
            estadoPaginacionVentas.paginaActual = 1;
            guardarFiltrosEnStorage();
            ejecutarBusquedaDeVentas();
        });
    }

    // Select de Tipo de Entrega
    const filtroTipoEntrega = document.getElementById('filtro-tipo-entrega');
    if (filtroTipoEntrega) {
        filtroTipoEntrega.addEventListener('change', () => {
            estadoPaginacionVentas.filtros.tipoEntrega = filtroTipoEntrega.value;
            estadoPaginacionVentas.paginaActual = 1;
            guardarFiltrosEnStorage();
            ejecutarBusquedaDeVentas();
        });
    }

    // Select de Estado Pago
    const filtroEstadoPago = document.getElementById('filtro-estado-pago-ventas');
    if (filtroEstadoPago) {
        filtroEstadoPago.addEventListener('change', () => {
            estadoPaginacionVentas.filtros.estadoPago = filtroEstadoPago.value;
            estadoPaginacionVentas.paginaActual = 1;
            guardarFiltrosEnStorage();
            ejecutarBusquedaDeVentas();
        });
    }

    // Botones de rango rápido de fechas
    const btnRangoHoy = document.getElementById('btn-rango-hoy');
    if (btnRangoHoy) {
        btnRangoHoy.addEventListener('click', () => {
            const hoy = new Date();
            if (flatpickrRangoFechasVentas) {
                flatpickrRangoFechasVentas.setDate([hoy, hoy]);
                marcarBotonRangoActivo(btnRangoHoy);
                guardarFiltrosEnStorage();
                ejecutarBusquedaDeVentas();
            }
        });
    }

    const btnRango7Dias = document.getElementById('btn-rango-7dias');
    if (btnRango7Dias) {
        btnRango7Dias.addEventListener('click', () => {
            const hoy = new Date();
            const hace7Dias = new Date();
            hace7Dias.setDate(hoy.getDate() - 7);
            if (flatpickrRangoFechasVentas) {
                flatpickrRangoFechasVentas.setDate([hace7Dias, hoy]);
                marcarBotonRangoActivo(btnRango7Dias);
                guardarFiltrosEnStorage();
                ejecutarBusquedaDeVentas();
            }
        });
    }

    const btnRangoMes = document.getElementById('btn-rango-mes');
    if (btnRangoMes) {
        btnRangoMes.addEventListener('click', () => {
            const hoy = new Date();
            const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            if (flatpickrRangoFechasVentas) {
                flatpickrRangoFechasVentas.setDate([primerDiaMes, hoy]);
                marcarBotonRangoActivo(btnRangoMes);
                guardarFiltrosEnStorage();
                ejecutarBusquedaDeVentas();
            }
        });
    }

    // Botones de paginación
    const btnPrevPage = document.getElementById('btn-anterior');
    const btnNextPage = document.getElementById('btn-siguiente');

    if (btnPrevPage) {
        btnPrevPage.addEventListener('click', () => {
            if (estadoPaginacionVentas.paginaActual > 1) {
                estadoPaginacionVentas.paginaActual--;
                ejecutarBusquedaDeVentas();
            }
        });
    }

    if (btnNextPage) {
        btnNextPage.addEventListener('click', () => {
            const totalPages = Math.ceil(estadoPaginacionVentas.totalRegistros / estadoPaginacionVentas.filasPorPagina);
            if (estadoPaginacionVentas.paginaActual < totalPages) {
                estadoPaginacionVentas.paginaActual++;
                ejecutarBusquedaDeVentas();
            }
        });
    }

    // Delegación de eventos para botones de acción en la tabla
    const tbodyVentas = document.getElementById('tbody-ventas');
    if (tbodyVentas) {
        tbodyVentas.addEventListener('click', async (e) => {
            // Menú de acciones
            const btnAcciones = e.target.closest('.actions-menu-container .button');
            if (btnAcciones) {
                e.preventDefault();
                e.stopPropagation();

                const container = btnAcciones.closest('.actions-menu-container');
                const menu = container.querySelector('.actions-menu');

                // Cerrar todos los otros menús
                document.querySelectorAll('.actions-menu').forEach(m => {
                    if (m !== menu) m.classList.remove('show');
                });

                // Toggle del menú actual
                menu.classList.toggle('show');
                return;
            }

            // Opciones del menú
            const opcionMenu = e.target.closest('.actions-menu-item');
            if (opcionMenu) {
                e.preventDefault();

                const accion = opcionMenu.dataset.action;
                const fila = opcionMenu.closest('tr');
                const idVenta = fila.dataset.idVenta;
                const codigoVenta = fila.dataset.codigoVenta;
                const nombreCliente = fila.dataset.nombreCliente;
                const saldoPendiente = parseFloat(fila.dataset.saldoPendiente) || 0;

                console.log(`[Ventas] Acción: "${accion}" en Venta ID: ${idVenta}`);

                // Cerrar menú
                opcionMenu.closest('.actions-menu').classList.remove('show');

                // Ejecutar acción
                switch(accion) {
                    case 'ver_detalles':
                        await cargarVistaDetalleVenta(idVenta);
                        break;

                    case 'imprimir_factura':
                        await imprimirFacturaVenta(idVenta, codigoVenta);
                        break;

                    case 'editar_venta':
                        await cargarVistaFormularioVenta('edit', idVenta);
                        break;

                    case 'editar_estado':
                        await mostrarDialogoCambiarEstado(idVenta, codigoVenta, nombreCliente, saldoPendiente);
                        break;

                    case 'anular_venta':
                        await confirmarAnularVenta(idVenta, codigoVenta, nombreCliente);
                        break;

                    case 'agregar_pago':
                        if (saldoPendiente <= 0) {
                            toastr.info("Esta venta ya está completamente pagada.");
                            return;
                        }
                        await mostrarDialogoAgregarPago(idVenta, codigoVenta, nombreCliente, saldoPendiente);
                        break;

                    case 'ver_pagos':
                        await mostrarDialogoGestionarPagos(idVenta, codigoVenta, nombreCliente);
                        break;

                    case 'borrar_venta':
                        await confirmarBorrarVenta(idVenta, codigoVenta, nombreCliente);
                        break;

                    default:
                        console.warn('[Ventas] Acción no implementada:', accion);
                        toastr.info('Función en desarrollo');
                }
            }
        });
    }

    // Cerrar menús al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.actions-menu-container')) {
            document.querySelectorAll('.actions-menu').forEach(menu => {
                menu.classList.remove('show');
            });
        }
    });

    console.log("[Ventas] Event listeners configurados");
}

// ========================================
// INICIALIZACIÓN DE COMPONENTES (Select2, Flatpickr)
// ========================================
function inicializarComponentesFiltrosVentas() {
    console.log("[Ventas] Inicializando componentes de filtros (Select2, Flatpickr)...");

    // Flatpickr para el rango de fechas
    const inputRangoFechas = document.getElementById('filtro-rango-fechas-ventas');
    if (inputRangoFechas && typeof flatpickr !== 'undefined') {
        flatpickrRangoFechasVentas = flatpickr(inputRangoFechas, {
            mode: "range",
            dateFormat: "d/m/Y",
            locale: "es",
            onClose: function(selectedDates) {
                console.log('[Ventas] Flatpickr onClose - fechas seleccionadas:', selectedDates);
                if (!restaurandoFiltros) {
                    guardarFiltrosEnStorage();
                    ejecutarBusquedaDeVentas();
                }
            }
        });
    }

    // Select2 para el filtro de clientes con búsqueda AJAX
    const selectCliente = $('#filtro-cliente-ventas');
    if (selectCliente.length && typeof $.fn.select2 !== 'undefined') {
        select2ClienteVentas = selectCliente.select2({
            placeholder: "Buscar cliente (mínimo 3 letras)...",
            allowClear: true,
            minimumInputLength: 3,
            ajax: {
                delay: 400,
                transport: async function(params, success, failure) {
                    try {
                        const termino = params.data.term || '';

                        if (termino.length < 3) {
                            success({ results: [{ id: '', text: 'Todos los clientes' }] });
                            return { abort: () => {} };
                        }

                        console.log("[Ventas Filtros] Buscando clientes:", termino);
                        const client = getSupabaseClient();

                        const { data, error } = await client
                            .from('clientes')
                            .select('id, codigo_cliente, nombres, apellidos, razon_social')
                            .eq('estado', 'Activo')
                            .or(`nombres.ilike.%${termino}%,apellidos.ilike.%${termino}%,razon_social.ilike.%${termino}%,codigo_cliente.ilike.%${termino}%`)
                            .order('nombres')
                            .limit(20);

                        if (error) throw error;

                        const resultados = (data || []).map(c => ({
                            id: c.id,
                            text: c.razon_social || `${c.nombres || ''} ${c.apellidos || ''}`.trim()
                        }));

                        const todos = { id: '', text: 'Todos los clientes' };
                        success({ results: [todos, ...resultados] });

                    } catch (error) {
                        console.error("[Ventas Filtros] Error al buscar clientes:", error);
                        failure(error);
                    }
                    return { abort: () => {} };
                }
            }
        });

        // Auto-focus en el campo de búsqueda cuando se abre
        selectCliente.on('select2:open', function() {
            setTimeout(function() {
                const searchField = document.querySelector('.select2-search__field');
                if (searchField) searchField.focus();
            }, 100);
        });

        // Al seleccionar un cliente, ejecutar búsqueda
        selectCliente.on('select2:select select2:clear', function(e) {
            if (!restaurandoFiltros) {
                const clienteId = $(this).val();
                estadoPaginacionVentas.filtros.clienteId = clienteId || null;
                estadoPaginacionVentas.paginaActual = 1;
                guardarFiltrosEnStorage();
                ejecutarBusquedaDeVentas();
            }
        });
    }

    console.log("[Ventas] Componentes de filtros inicializados");
}

// ========================================
// CARGA DE DATOS (RPC fn_obtener_lista_ventas)
// ========================================
async function ejecutarBusquedaDeVentas() {
    console.log("[Ventas] Ejecutando búsqueda con filtros:", estadoPaginacionVentas.filtros);

    const tbody = document.getElementById('tbody-ventas');
    if (!tbody) {
        console.error("[Ventas] No se encontró el tbody-ventas");
        return;
    }

    try {
        // Mostrar indicador de carga
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Cargando ventas...</td></tr>';

        const client = getSupabaseClient();

        // Parsear rango de fechas
        let fechaInicio = null;
        let fechaFin = null;
        if (flatpickrRangoFechasVentas && flatpickrRangoFechasVentas.selectedDates.length > 0) {
            fechaInicio = flatpickrRangoFechasVentas.selectedDates[0].toISOString().split('T')[0];
            if (flatpickrRangoFechasVentas.selectedDates.length > 1) {
                fechaFin = flatpickrRangoFechasVentas.selectedDates[1].toISOString().split('T')[0];
            } else {
                fechaFin = fechaInicio;
            }
        }

        const offset = (estadoPaginacionVentas.paginaActual - 1) * estadoPaginacionVentas.filasPorPagina;

        // Llamada RPC
        const { data, error } = await client.rpc('fn_obtener_lista_ventas', {
            p_page: estadoPaginacionVentas.paginaActual,
            p_limit: estadoPaginacionVentas.filasPorPagina,
            p_busqueda: estadoPaginacionVentas.filtros.busqueda || null,
            p_cliente_id: estadoPaginacionVentas.filtros.clienteId || null,
            p_estado_venta: estadoPaginacionVentas.filtros.estadoVenta || null,
            p_tipo_entrega: estadoPaginacionVentas.filtros.tipoEntrega || null,
            p_estado_pago: estadoPaginacionVentas.filtros.estadoPago || null,
            p_fecha_inicio: fechaInicio,
            p_fecha_fin: fechaFin
        });

        if (error) {
            console.error("[Ventas] Error al cargar ventas:", error);
            throw error;
        }

        console.log("[Ventas] Datos recibidos:", data);

        // Validar respuesta de RPC
        if (data && data.exito === false) {
            console.warn('[Ventas] RPC retornó error:', data);

            if (data.codigo_error === 'PERMISO_DENEGADO') {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: red;">No tienes permisos para ver ventas. Contacta al administrador.</td></tr>';
                return;
            } else if (data.codigo_error === 'SIN_EMPRESA') {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: red;">Usuario no asociado a una empresa.</td></tr>';
                return;
            } else {
                throw new Error(data.mensaje || 'Error desconocido al cargar ventas');
            }
        }

        // Actualizar total de registros
        estadoPaginacionVentas.totalRegistros = data.total || 0;

        // Renderizar tabla y paginación
        renderizarTablaVentas(data.datos || []);
        renderizarPaginacionVentas();

    } catch (error) {
        console.error("[Ventas] Error al cargar datos:", error);

        if (error.message && error.message.includes('permiso')) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: red;">No tienes permisos para ver ventas. Contacta al administrador.</td></tr>';
        } else if (error.message && error.message.includes('sesión')) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color: red;">Sesión expirada. Recargando...</td></tr>';
            setTimeout(() => location.reload(), 2000);
        } else {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: red;">Error: ${error.message}</td></tr>`;
        }
    }
}

// ========================================
// RENDERIZADO DE TABLA
// ========================================
function renderizarTablaVentas(ventas) {
    const tbody = document.getElementById('tbody-ventas');
    tbody.innerHTML = '';

    if (!ventas || ventas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No se encontraron ventas con los filtros aplicados.</td></tr>';
        return;
    }

    ventas.forEach(venta => {
        const row = document.createElement('tr');
        row.dataset.idVenta = venta.id;
        row.dataset.codigoVenta = venta.codigo_venta;
        row.dataset.nombreCliente = venta.nombre_cliente || 'Ventas Mostrador';
        row.dataset.saldoPendiente = venta.saldo_pendiente || 0;

        // Formatear fecha
        const fecha = moment(venta.fecha_venta).format('DD/MM/YYYY');

        // Badges de estado
        const badgeEstado = obtenerBadgeEstadoVenta(venta.estado);
        const badgeEstadoPago = obtenerBadgeEstadoPagoVenta(venta.estado_pago);

        // Formatear moneda
        const totalFormateado = formatCurrency(venta.monto_total);
        const nombreCliente = venta.nombre_cliente || 'Ventas Mostrador';

        // Menú de acciones dinámico
        let opcionesMenu = `
            <a href="#" class="actions-menu-item" data-action="ver_detalles">
                <i class="fas fa-eye"></i> Ver Detalles
            </a>
            <a href="#" class="actions-menu-item" data-action="imprimir_factura">
                <i class="fas fa-print"></i> Imprimir Factura
            </a>
        `;

        if (venta.estado !== 'Completado' && venta.estado !== 'Anulada') {
            opcionesMenu += `
                <a href="#" class="actions-menu-item" data-action="editar_venta">
                    <i class="fas fa-pencil-alt"></i> Editar
                </a>
                <a href="#" class="actions-menu-item" data-action="editar_estado">
                    <i class="fas fa-sync-alt"></i> Cambiar Estado
                </a>
            `;
        }

        if (venta.estado === 'Completado') {
            opcionesMenu += `
                <div class="divider"></div>
                <a href="#" class="actions-menu-item text-warning" data-action="anular_venta">
                    <i class="fas fa-ban"></i> Anular Venta
                </a>
            `;
        }

        opcionesMenu += `
            <div class="divider"></div>
            <a href="#" class="actions-menu-item" data-action="agregar_pago">
                <i class="fas fa-dollar-sign"></i> Agregar Pago
            </a>
            <a href="#" class="actions-menu-item" data-action="ver_pagos">
                <i class="fas fa-list-ul"></i> Ver Pagos
            </a>
        `;

        if (venta.estado !== 'Completado' && venta.estado !== 'Anulada') {
            opcionesMenu += `
                <div class="divider"></div>
                <a href="#" class="actions-menu-item text-danger" data-action="borrar_venta">
                    <i class="fas fa-trash-alt"></i> Borrar
                </a>
            `;
        }

        row.innerHTML = `
            <td class="text-center" data-column="acciones">
                <div class="actions-menu-container">
                    <button class="button button-secondary">Acciones</button>
                    <div class="actions-menu">${opcionesMenu}</div>
                </div>
            </td>
            <td data-column="codigo"><strong>${venta.codigo_venta}</strong></td>
            <td data-column="cliente">${nombreCliente}</td>
            <td data-column="fecha">${fecha}</td>
            <td data-column="estado">${badgeEstado}</td>
            <td data-column="estado_pago">${badgeEstadoPago}</td>
            <td data-column="tipo_envio">${venta.tipo_envio || 'N/A'}</td>
            <td data-column="total" class="text-right">${totalFormateado}</td>
        `;

        tbody.appendChild(row);
    });

    // Aplicar preferencias de columnas
}

function obtenerBadgeEstadoVenta(estado) {
    const badges = {
        'Borrador': '<span class="badge badge-secondary">Borrador</span>',
        'En Proceso': '<span class="badge badge-info">En Proceso</span>',
        'Completado': '<span class="badge badge-success">Completado</span>',
        'Cancelada': '<span class="badge badge-danger">Cancelada</span>',
        'Anulada': '<span class="badge badge-danger">Anulada</span>'
    };
    return badges[estado] || `<span class="badge">${estado}</span>`;
}

function obtenerBadgeEstadoPagoVenta(estadoPago) {
    const badges = {
        'Pendiente de Pago': '<span class="badge badge-danger">Pendiente</span>',
        'Abonada': '<span class="badge badge-warning">Abonada</span>',
        'Pagada': '<span class="badge badge-success">Pagada</span>'
    };
    return badges[estadoPago] || `<span class="badge">${estadoPago}</span>`;
}

// ========================================
// PAGINACIÓN
// ========================================
function renderizarPaginacionVentas() {
    const totalPages = Math.ceil(estadoPaginacionVentas.totalRegistros / estadoPaginacionVentas.filasPorPagina);
    const pageInfo = document.getElementById('info-pagina');
    const btnPrev = document.getElementById('btn-anterior');
    const btnNext = document.getElementById('btn-siguiente');

    if (pageInfo) {
        pageInfo.textContent = `Página ${estadoPaginacionVentas.paginaActual} de ${totalPages || 1} (Total: ${estadoPaginacionVentas.totalRegistros} ventas)`;
    }

    if (btnPrev) {
        btnPrev.disabled = estadoPaginacionVentas.paginaActual <= 1;
    }

    if (btnNext) {
        btnNext.disabled = estadoPaginacionVentas.paginaActual >= totalPages;
    }
}

// ========================================
// ACCIONES
// ========================================

/**
 * Confirmar anulación de venta
 */
async function confirmarAnularVenta(idVenta, codigoVenta, nombreCliente) {
    const result = await Swal.fire({
        title: '¡ACCIÓN CRÍTICA! - Anular Venta',
        html: `
            <p>Estás a punto de ANULAR la venta <strong>${codigoVenta}</strong>.</p>
            <p>Cliente: <strong>${nombreCliente}</strong></p>
            <p>El inventario se revertirá. ¿Estás seguro de continuar?</p>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, Anular',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d33'
    });

    if (result.isConfirmed) {
        try {
            Swal.fire({
                title: 'Procesando...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const client = getSupabaseClient();
            const { data, error } = await client.rpc('fn_anular_venta', {
                p_id_venta: idVenta
            });

            if (error) {
                console.error('[Ventas] Error al anular venta:', error);
                throw new Error(error.message);
            }

            if (data?.exito === false) {
                console.warn('[Ventas] RPC retornó error:', data);

                if (data.codigo_error === 'PERMISO_DENEGADO') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Permiso Denegado',
                        text: data.mensaje || 'No tienes permisos para anular ventas',
                        confirmButtonText: 'Entendido'
                    });
                    return;
                } else {
                    throw new Error(data.mensaje || 'Error desconocido al anular la venta');
                }
            }

            Swal.fire({
                icon: 'success',
                title: 'Venta Anulada',
                text: data.mensaje || 'La venta se anuló exitosamente.',
                confirmButtonText: 'OK'
            });

            await ejecutarBusquedaDeVentas();

        } catch (error) {
            console.error('[Ventas] Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message,
                confirmButtonText: 'Cerrar'
            });
        }
    }
}

/**
 * Confirmar eliminación de venta
 */
async function confirmarBorrarVenta(idVenta, codigoVenta, nombreCliente) {
    const result = await Swal.fire({
        title: `¿Borrar la venta ${codigoVenta}?`,
        html: `
            <p>Cliente: <strong>${nombreCliente}</strong></p>
            <p>¡Esta acción no se puede deshacer! El registro desaparecerá por completo.</p>
        `,
        icon: 'error',
        showCancelButton: true,
        confirmButtonText: 'Sí, ¡bórrala!',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d33'
    });

    if (result.isConfirmed) {
        try {
            Swal.fire({
                title: 'Procesando...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const client = getSupabaseClient();

            // Obtener el ID del usuario actual de la sesión
            const { data: { session }, error: sessionError } = await client.auth.getSession();
            if (sessionError || !session?.user?.id) {
                throw new Error('No se pudo obtener la sesión del usuario');
            }

            const { data, error } = await client.rpc('fn_eliminar_venta', {
                id_venta_a_eliminar: idVenta,
                id_usuario_responsable: session.user.id
            });

            if (error) {
                console.error('[Ventas] Error al borrar venta:', error);
                throw new Error(error.message);
            }

            if (data?.exito === false) {
                console.warn('[Ventas] RPC retornó error:', data);

                if (data.codigo_error === 'PERMISO_DENEGADO') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Permiso Denegado',
                        text: data.mensaje || 'No tienes permisos para borrar ventas',
                        confirmButtonText: 'Entendido'
                    });
                    return;
                } else {
                    throw new Error(data.mensaje || 'Error desconocido al borrar la venta');
                }
            }

            Swal.fire({
                icon: 'success',
                title: 'Venta Borrada',
                text: data.mensaje || 'La venta se borró correctamente.',
                confirmButtonText: 'OK'
            });

            await ejecutarBusquedaDeVentas();

        } catch (error) {
            console.error('[Ventas] Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message,
                confirmButtonText: 'Cerrar'
            });
        }
    }
}

// ========================================
// PANEL DE ANÁLISIS/KPIs
// ========================================
async function actualizarTarjetasAnalisisPeriodo() {
    console.log('[Ventas] Actualizando tarjetas de análisis...');

    try {
        const client = getSupabaseClient();

        // Parsear rango de fechas
        let fechaInicio = null;
        let fechaFin = null;
        if (flatpickrRangoFechasVentas && flatpickrRangoFechasVentas.selectedDates.length > 0) {
            fechaInicio = flatpickrRangoFechasVentas.selectedDates[0].toISOString().split('T')[0];
            if (flatpickrRangoFechasVentas.selectedDates.length > 1) {
                fechaFin = flatpickrRangoFechasVentas.selectedDates[1].toISOString().split('T')[0];
            } else {
                fechaFin = fechaInicio;
            }
        }

        // Llamar a RPC de análisis (si existe)
        const { data, error } = await client.rpc('fn_obtener_analisis_ventas', {
            p_fecha_inicio: fechaInicio,
            p_fecha_fin: fechaFin,
            p_cliente_id: estadoPaginacionVentas.filtros.clienteId || null,
            p_estado_venta: estadoPaginacionVentas.filtros.estadoVenta || null
        });

        if (error) {
            console.error('[Ventas] Error al cargar análisis:', error);
            return;
        }

        // Actualizar tarjetas
        if (data && data.exito !== false) {
            document.getElementById('kpi-ingresos').textContent = formatCurrency(data.total_ingresos || 0);
            document.getElementById('kpi-ganancia').textContent = formatCurrency(data.ganancia_neta || 0);
            document.getElementById('kpi-num-ventas').textContent = data.numero_ventas || 0;
            document.getElementById('kpi-ticket-promedio').textContent = formatCurrency(data.ticket_promedio || 0);
        }

    } catch (error) {
        console.error('[Ventas] Error al actualizar análisis:', error);
    }
}

// ========================================
// GESTOR DE COLUMNAS
// ========================================
// ========================================

/**
 * Toggle de filtros (collapse/expand)
 */
function toggleFiltrosVentas() {
    const filtrosContent = document.getElementById('filtros-ventas-content');
    const btnToggle = document.getElementById('btn-toggle-filtros-ventas');
    const icon = btnToggle.querySelector('i.fa-chevron-up, i.fa-chevron-down');
    const analysisPanel = document.getElementById('analysis-panel');

    if (filtrosContent.classList.contains('is-visible')) {
        filtrosContent.classList.remove('is-visible');
        if (icon) {
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        }
    } else {
        filtrosContent.classList.add('is-visible');
        if (icon) {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        }
        // Cerrar análisis si está abierto
        if (analysisPanel && analysisPanel.classList.contains('is-visible')) {
            analysisPanel.classList.remove('is-visible');
        }
    }
}

/**
 * Toggle de análisis
 */
function toggleAnalisisVentas() {
    const analysisPanel = document.getElementById('analysis-panel');
    const filtrosContent = document.getElementById('filtros-ventas-content');

    if (analysisPanel.classList.contains('is-visible')) {
        analysisPanel.classList.remove('is-visible');
    } else {
        analysisPanel.classList.add('is-visible');
        // Cerrar filtros si está abierto
        if (filtrosContent && filtrosContent.classList.contains('is-visible')) {
            filtrosContent.classList.remove('is-visible');
        }
        // Actualizar datos del panel
        actualizarTarjetasAnalisisPeriodo();
    }
}

/**
 * Limpiar todos los filtros
 */
function limpiarFiltrosVentas() {
    console.log('[Ventas] Limpiando filtros...');

    // Activar flag para evitar guardado durante limpieza
    restaurandoFiltros = true;

    // Limpiar objeto de filtros
    estadoPaginacionVentas.filtros = {};
    estadoPaginacionVentas.paginaActual = 1;

    // Limpiar campos del formulario
    const inputBuscar = document.getElementById('input-buscar-ventas');
    if (inputBuscar) inputBuscar.value = '';

    const filtroEstado = document.getElementById('filtro-estado-venta');
    if (filtroEstado) filtroEstado.value = '';

    const filtroTipoEntrega = document.getElementById('filtro-tipo-entrega');
    if (filtroTipoEntrega) filtroTipoEntrega.value = '';

    const filtroEstadoPago = document.getElementById('filtro-estado-pago-ventas');
    if (filtroEstadoPago) filtroEstadoPago.value = '';

    // Limpiar Select2 de cliente
    if (select2ClienteVentas) {
        select2ClienteVentas.val('').trigger('change');
    }

    // Limpiar Flatpickr de fechas
    if (flatpickrRangoFechasVentas) {
        flatpickrRangoFechasVentas.clear();
    }

    // Limpiar botones de rango
    document.querySelectorAll('.filter-quick-actions .button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Limpiar localStorage
    localStorage.removeItem('ventas_filtros');

    // Ejecutar búsqueda
    setTimeout(() => {
        restaurandoFiltros = false;
        ejecutarBusquedaDeVentas();
        actualizarEfectosVisualesFiltros();
    }, 100);
}

/**
 * Marcar botón de rango como activo
 */
function marcarBotonRangoActivo(boton) {
    document.querySelectorAll('.filter-quick-actions .button').forEach(btn => {
        btn.classList.remove('active');
    });
    if (boton) {
        boton.classList.add('active');
    }
}

/**
 * Guardar filtros en localStorage
 */
function guardarFiltrosEnStorage() {
    if (restaurandoFiltros) return;

    const filtros = {
        busqueda: document.getElementById('input-buscar-ventas')?.value || '',
        clienteId: estadoPaginacionVentas.filtros.clienteId || null,
        estadoVenta: document.getElementById('filtro-estado-venta')?.value || '',
        tipoEntrega: document.getElementById('filtro-tipo-entrega')?.value || '',
        estadoPago: document.getElementById('filtro-estado-pago-ventas')?.value || '',
        fechaInicio: null,
        fechaFin: null
    };

    if (flatpickrRangoFechasVentas && flatpickrRangoFechasVentas.selectedDates.length > 0) {
        filtros.fechaInicio = flatpickrRangoFechasVentas.selectedDates[0].toISOString().split('T')[0];
        if (flatpickrRangoFechasVentas.selectedDates.length > 1) {
            filtros.fechaFin = flatpickrRangoFechasVentas.selectedDates[1].toISOString().split('T')[0];
        } else {
            filtros.fechaFin = filtros.fechaInicio;
        }
    }

    localStorage.setItem('ventas_filtros', JSON.stringify(filtros));
    console.log('[Ventas] Filtros guardados en localStorage:', filtros);
}

/**
 * Restaurar filtros desde localStorage
 */
function restaurarFiltrosGuardadosVentas() {
    const filtrosStr = localStorage.getItem('ventas_filtros');
    if (!filtrosStr) {
        console.log('[Ventas] No hay filtros guardados para restaurar');
        return false;
    }

    try {
        restaurandoFiltros = true;
        const filtros = JSON.parse(filtrosStr);
        console.log('[Ventas] Restaurando filtros:', filtros);

        // Restaurar campos de texto
        if (filtros.busqueda) {
            const inputBuscar = document.getElementById('input-buscar-ventas');
            if (inputBuscar) inputBuscar.value = filtros.busqueda;
        }

        // Restaurar selects
        if (filtros.estadoVenta) {
            const filtroEstado = document.getElementById('filtro-estado-venta');
            if (filtroEstado) filtroEstado.value = filtros.estadoVenta;
        }

        if (filtros.tipoEntrega) {
            const filtroTipoEntrega = document.getElementById('filtro-tipo-entrega');
            if (filtroTipoEntrega) filtroTipoEntrega.value = filtros.tipoEntrega;
        }

        if (filtros.estadoPago) {
            const filtroEstadoPago = document.getElementById('filtro-estado-pago-ventas');
            if (filtroEstadoPago) filtroEstadoPago.value = filtros.estadoPago;
        }

        // Restaurar cliente en Select2
        if (filtros.clienteId && select2ClienteVentas) {
            select2ClienteVentas.val(filtros.clienteId).trigger('change');
        }

        // Restaurar fechas
        if (filtros.fechaInicio && filtros.fechaFin && flatpickrRangoFechasVentas) {
            const fechaInicio = new Date(filtros.fechaInicio + 'T00:00:00');
            const fechaFin = new Date(filtros.fechaFin + 'T00:00:00');

            if (!isNaN(fechaInicio.getTime()) && !isNaN(fechaFin.getTime())) {
                flatpickrRangoFechasVentas.setDate([fechaInicio, fechaFin], false);
            }
        }

        // Actualizar objeto de filtros
        estadoPaginacionVentas.filtros = {
            busqueda: filtros.busqueda || null,
            clienteId: filtros.clienteId || null,
            estadoVenta: filtros.estadoVenta || null,
            tipoEntrega: filtros.tipoEntrega || null,
            estadoPago: filtros.estadoPago || null
        };

        setTimeout(() => {
            restaurandoFiltros = false;
        }, 500);

        return true;

    } catch (error) {
        console.error('[Ventas] Error al restaurar filtros:', error);
        localStorage.removeItem('ventas_filtros');
        restaurandoFiltros = false;
        return false;
    }
}

/**
 * Actualizar efectos visuales de filtros
 */
function actualizarEfectosVisualesFiltros() {
    const hayFiltrosActivos =
        estadoPaginacionVentas.filtros.busqueda ||
        estadoPaginacionVentas.filtros.clienteId ||
        estadoPaginacionVentas.filtros.estadoVenta ||
        estadoPaginacionVentas.filtros.tipoEntrega ||
        estadoPaginacionVentas.filtros.estadoPago ||
        (flatpickrRangoFechasVentas && flatpickrRangoFechasVentas.selectedDates.length > 0);

    // El botón "Limpiar Filtros" siempre está visible y habilitado
    // No necesita lógica especial aquí
}

/**
 * Debounce - Evita que una función se ejecute demasiadas veces seguidas
 */
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Formatear moneda
 */
function formatCurrency(valor) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(valor || 0);
}

// ========================================
// NUEVAS FUNCIONES PARA ACCIONES DEL MENÚ
// ========================================

/**
 * Imprimir factura de una venta
 */
async function imprimirFacturaVenta(idVenta, codigoVenta) {
    console.log('[Ventas] Imprimiendo factura para venta:', codigoVenta || idVenta);

    try {
        toastr.info("Generando factura...");

        // Obtener datos de la venta
        const client = getSupabaseClient();
        const { data, error } = await client.rpc('fn_obtener_venta_detalle', {
            p_id_venta: idVenta
        });

        if (error) {
            console.error('[Ventas] Error al obtener venta para factura:', error);
            throw new Error(error.message);
        }

        if (!data || !data.exito) {
            const mensaje = data?.mensaje || 'No se pudo obtener la venta';
            throw new Error(mensaje);
        }

        // Generar contenido de la factura
        const ventaData = data.datos;
        const contenidoFactura = generarContenidoFacturaPOS(ventaData);

        // Imprimir
        imprimirFacturaPOSVer(contenidoFactura);

        toastr.success("Factura generada exitosamente");

    } catch (error) {
        console.error('[Ventas] Error al imprimir factura:', error);
        toastr.error('Error al generar la factura: ' + error.message);
    }
}

/**
 * Genera el contenido de texto para la factura POS
 */
function generarContenidoFacturaPOS(venta) {
    const ANCHO_TICKET = 36; // Ancho para impresoras de 80mm
    const SEPARADOR = "=".repeat(ANCHO_TICKET);

    const centrar = (texto) => texto.padStart(Math.floor((ANCHO_TICKET + texto.length) / 2), ' ').padEnd(ANCHO_TICKET, ' ');
    const alinearExtremos = (izq, der) => izq + der.padStart(ANCHO_TICKET - izq.length, ' ');

    // Función auxiliar para dividir nombres largos en varias líneas
    const envolverTexto = (texto, maxAncho) => {
        const lineas = [];
        const palabras = texto.split(' ');
        let lineaActual = '';
        palabras.forEach(palabra => {
            if ((lineaActual + palabra).length > maxAncho) {
                lineas.push(lineaActual.trim());
                lineaActual = '';
            }
            lineaActual += palabra + ' ';
        });
        lineas.push(lineaActual.trim());
        return lineas;
    };

    let contenido = '';

    // Datos de la venta y cliente
    const fechaVenta = new Date(venta.fecha_venta).toLocaleDateString('es-CO', { timeZone: 'UTC' });
    contenido += alinearExtremos(`Remisión: ${venta.codigo_venta}`, `Fecha: ${fechaVenta}`) + '\n';

    const nombreCliente = venta.clientes
        ? (venta.clientes.razon_social || `${venta.clientes.nombres} ${venta.clientes.apellidos}`)
        : 'Ventas Mostrador';
    contenido += `Cliente: ${nombreCliente}\n`;

    if (venta.clientes) {
        contenido += `ID: ${venta.clientes.codigo_cliente}\n`;
    }

    if (venta.tipo_envio === 'Domicilio' && venta.direccion_entrega) {
        contenido += `Tel Cliente: ${venta.clientes?.telefono_principal || ''}\n`;

        const direccionCompleta = venta.direccion_entrega.direccion_completa || '';
        if (direccionCompleta) {
            const lineasDireccion = envolverTexto(`Dirección: ${direccionCompleta}`, ANCHO_TICKET);
            contenido += lineasDireccion[0] + '\n';
            for (let i = 1; i < lineasDireccion.length; i++) {
                contenido += `           ${lineasDireccion[i]}\n`;
            }
        }

        if (venta.direccion_entrega.barrio) {
            const barrioYCiudad = `${venta.direccion_entrega.barrio}, ${venta.direccion_entrega.ciudad_municipio}`;
            const lineasBarrio = envolverTexto(barrioYCiudad, ANCHO_TICKET - 11);
            contenido += `           ${lineasBarrio[0]}\n`;
            for (let i = 1; i < lineasBarrio.length; i++) {
                contenido += `           ${lineasBarrio[i]}\n`;
            }
        }

        if (venta.direccion_entrega.indicaciones_adicionales) {
            const indicaciones = venta.direccion_entrega.indicaciones_adicionales;
            const lineasIndicaciones = envolverTexto(`Indic: ${indicaciones}`, ANCHO_TICKET - 11);
            contenido += `           ${lineasIndicaciones[0]}\n`;
            for (let i = 1; i < lineasIndicaciones.length; i++) {
                contenido += `           ${lineasIndicaciones[i]}\n`;
            }
        }
    }

    // Sección de productos
    contenido += SEPARADOR + '\n';
    contenido += "Producto        Cant Precio Subtotal\n";
    contenido += "-".repeat(ANCHO_TICKET) + '\n';

    let totalArticulos = 0;
    venta.detalles_venta.forEach(detalle => {
        totalArticulos += detalle.cantidad;

        const producto = detalle.productos || {};
        const nombreProducto = producto.nombre_producto || 'Producto';
        const precioUnitario = detalle.precio_unitario_venta || 0;
        const totalLinea = detalle.total_linea || (detalle.cantidad * precioUnitario);

        // Nombre del producto con longitud limitada
        const nombreCorto = nombreProducto.substring(0, 15);
        const cantidadStr = detalle.cantidad.toString();
        const precioStr = Math.round(precioUnitario).toLocaleString('es-CO');
        const totalStr = Math.round(totalLinea).toLocaleString('es-CO');

        const lineaProducto = `${nombreCorto.padEnd(15)} ${cantidadStr.padStart(4)} ${precioStr.padStart(6)} ${totalStr.padStart(9)}\n`;
        contenido += lineaProducto;
    });

    contenido += SEPARADOR + '\n';
    contenido += alinearExtremos(`Total Artículos: ${totalArticulos}`, '') + '\n';
    contenido += '\n';

    // Resumen de totales
    const formatearMoneda = (valor) => `$${Math.round(valor || 0).toLocaleString('es-CO')}`;
    contenido += alinearExtremos('Subtotal:', formatearMoneda(venta.subtotal)) + '\n';
    contenido += alinearExtremos('Descuentos:', `-${formatearMoneda(venta.total_descuentos)}`) + '\n';
    contenido += alinearExtremos('Impuestos:', formatearMoneda(venta.total_impuestos)) + '\n';
    contenido += alinearExtremos('Envío:', formatearMoneda(venta.costo_envio)) + '\n';
    contenido += SEPARADOR + '\n';
    contenido += alinearExtremos('TOTAL:', formatearMoneda(venta.monto_total)) + '\n';
    contenido += SEPARADOR + '\n';

    // Estado de pago
    contenido += '\n';
    contenido += `Estado de Pago: ${venta.estado_pago}\n`;
    if (venta.saldo_pendiente > 0) {
        contenido += alinearExtremos('Saldo Pendiente:', formatearMoneda(venta.saldo_pendiente)) + '\n';
    }

    if (venta.observaciones) {
        contenido += '\n';
        contenido += `Observaciones: ${venta.observaciones}\n`;
    }

    contenido += '\n';
    contenido += centrar('Gracias por su compra') + '\n';

    return contenido;
}

/**
 * Abre una ventana nueva e imprime el contenido de la factura
 */
function imprimirFacturaPOSVer(factura) {
    if (!factura) {
        console.error("Error: No se recibió la factura para imprimir.");
        return;
    }

    const ventanaImpresion = window.open('', '_blank');
    if (!ventanaImpresion) {
        toastr.error("Permita las ventanas emergentes para imprimir la factura.");
        return;
    }

    const estilos = `
        <style>
            body { font-family: 'Source Sans Pro', monospace; font-size: 26px; }
            .titulo { font-size: 30px; font-weight: bold; text-align: center; }
            .contenido { font-size: 26px; font-weight: 700; }
            .negrita { font-weight: bold; }
            .centrado { text-align: center; }
        </style>
    `;

    const contenido = `
        <html>
            <head>
                <title>Factura de Venta</title>
                ${estilos}
            </head>
            <body>
                <div class="titulo">REMISION</div>
                <pre>${factura}</pre>
                <script>
                    window.onload = function() {
                        window.print();
                        window.onafterprint = function() {
                            window.close();
                        };
                    };
                <\/script>
            </body>
        </html>
    `;

    ventanaImpresion.document.open();
    ventanaImpresion.document.write(contenido);
    ventanaImpresion.document.close();
}

/**
 * Mostrar diálogo para cambiar estado de una venta
 */
async function mostrarDialogoCambiarEstado(idVenta, codigoVenta, nombreCliente, saldoPendiente) {
    console.log('[Ventas] Cambiando estado de venta:', codigoVenta);

    const result = await Swal.fire({
        title: `Cambiar estado de la Venta ${codigoVenta}`,
        html: `<p>Cliente: <strong>${nombreCliente}</strong></p>`,
        input: 'select',
        inputOptions: {
            'Borrador': 'Borrador',
            'En Proceso': 'En Proceso',
            'Completado': 'Completado',
            'Cancelada': 'Cancelada'
        },
        inputPlaceholder: 'Seleccione un nuevo estado',
        showCancelButton: true,
        confirmButtonText: 'Actualizar Estado',
        cancelButtonText: 'Cancelar',
        inputValidator: (value) => {
            if (!value) {
                return '¡Necesitas seleccionar un estado!';
            }
        }
    });

    if (result.isConfirmed) {
        const nuevoEstado = result.value;

        try {
            Swal.fire({
                title: 'Procesando...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const client = getSupabaseClient();
            const { data, error } = await client.rpc('fn_cambiar_estado_venta', {
                p_id_venta: idVenta,
                p_nuevo_estado: nuevoEstado
            });

            if (error) {
                console.error('[Ventas] Error al cambiar estado:', error);
                throw new Error(error.message);
            }

            if (data?.exito === false) {
                throw new Error(data.mensaje || 'Error al cambiar estado');
            }

            Swal.fire({
                icon: 'success',
                title: 'Estado Actualizado',
                text: `El estado de la venta se cambió a "${nuevoEstado}" exitosamente.`,
                confirmButtonText: 'OK'
            });

            // Si cambió a Completado y hay saldo pendiente, preguntar si quiere agregar un pago
            if (nuevoEstado === 'Completado' && saldoPendiente > 0) {
                const resultPago = await Swal.fire({
                    title: `Venta ${codigoVenta} Completada`,
                    html: `<p>Cliente: <strong>${nombreCliente}</strong></p><p>¿Deseas registrar un pago ahora?</p>`,
                    icon: 'success',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, registrar pago',
                    cancelButtonText: 'No, más tarde'
                });

                if (resultPago.isConfirmed) {
                    await mostrarDialogoAgregarPago(idVenta, codigoVenta, nombreCliente, saldoPendiente);
                }
            }

            await ejecutarBusquedaDeVentas();

        } catch (error) {
            console.error('[Ventas] Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message,
                confirmButtonText: 'Cerrar'
            });
        }
    }
}

/**
 * Mostrar diálogo para agregar un pago
 */
async function mostrarDialogoAgregarPago(idVenta, codigoVenta, nombreCliente, saldoPendiente) {
    console.log('[Ventas] Agregando pago a venta:', codigoVenta);

    const result = await Swal.fire({
        title: `Registrar Pago - Venta ${codigoVenta}`,
        html: `
            <p>Cliente: <strong>${nombreCliente}</strong></p>
            <p>Saldo Pendiente: <strong>${formatCurrency(saldoPendiente)}</strong></p>
            <div class="swal2-form">
                <label>Monto del Pago:</label>
                <input type="number" id="swal-monto" class="swal2-input" placeholder="Ingrese el monto" step="0.01" min="0" max="${saldoPendiente}">

                <label>Método de Pago:</label>
                <select id="swal-metodo" class="swal2-input">
                    <option value="">Seleccione un método</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Tarjeta Débito">Tarjeta Débito</option>
                    <option value="Tarjeta Crédito">Tarjeta Crédito</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Nequi">Nequi</option>
                    <option value="Daviplata">Daviplata</option>
                    <option value="Otro">Otro</option>
                </select>

                <label>Notas (opcional):</label>
                <textarea id="swal-notas" class="swal2-textarea" placeholder="Observaciones del pago"></textarea>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Registrar Pago',
        cancelButtonText: 'Cancelar',
        width: '500px',
        preConfirm: () => {
            const monto = parseFloat(document.getElementById('swal-monto').value);
            const metodo = document.getElementById('swal-metodo').value;
            const notas = document.getElementById('swal-notas').value;

            if (!monto || monto <= 0) {
                Swal.showValidationMessage('Ingrese un monto válido');
                return false;
            }

            if (monto > saldoPendiente) {
                Swal.showValidationMessage(`El monto no puede exceder el saldo pendiente (${formatCurrency(saldoPendiente)})`);
                return false;
            }

            if (!metodo) {
                Swal.showValidationMessage('Seleccione un método de pago');
                return false;
            }

            return { monto, metodo, notas };
        }
    });

    if (result.isConfirmed) {
        const { monto, metodo, notas } = result.value;

        try {
            Swal.fire({
                title: 'Procesando...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const client = getSupabaseClient();
            const { data, error } = await client.rpc('fn_registrar_pago_venta', {
                p_id_venta: idVenta,
                p_monto_pagado: monto,
                p_metodo_pago: metodo,
                p_notas: notas || null
            });

            if (error) {
                console.error('[Ventas] Error al registrar pago:', error);
                throw new Error(error.message);
            }

            if (data?.exito === false) {
                throw new Error(data.mensaje || 'Error al registrar el pago');
            }

            Swal.fire({
                icon: 'success',
                title: 'Pago Registrado',
                text: `Se registró un pago de ${formatCurrency(monto)} exitosamente.`,
                confirmButtonText: 'OK'
            });

            await ejecutarBusquedaDeVentas();

        } catch (error) {
            console.error('[Ventas] Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message,
                confirmButtonText: 'Cerrar'
            });
        }
    }
}

/**
 * Mostrar diálogo para gestionar pagos de una venta
 */
async function mostrarDialogoGestionarPagos(idVenta, codigoVenta, nombreCliente) {
    console.log('[Ventas] Gestionando pagos de venta:', codigoVenta);

    try {
        Swal.fire({
            title: 'Cargando pagos...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        // Obtener los pagos de la venta
        const client = getSupabaseClient();
        const { data, error } = await client.rpc('fn_obtener_venta_detalle', {
            p_id_venta: idVenta
        });

        if (error) {
            throw new Error(error.message);
        }

        if (!data || !data.exito) {
            throw new Error(data?.mensaje || 'No se pudieron obtener los pagos');
        }

        const venta = data.datos;
        const pagos = venta.pagos || [];

        // Generar HTML de la tabla de pagos
        let htmlPagos = '';
        if (pagos.length > 0) {
            htmlPagos = `
                <table class="swal2-table" style="width: 100%; text-align: left; margin-top: 20px;">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Método</th>
                            <th>Monto</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            let totalPagado = 0;
            pagos.forEach(p => {
                totalPagado += p.monto_pagado || 0;
                const fechaPago = moment(p.fecha_pago).format('DD/MM/YYYY HH:mm');
                htmlPagos += `
                    <tr>
                        <td>${fechaPago}</td>
                        <td>${p.metodo_pago}</td>
                        <td style="text-align: right;">${formatCurrency(p.monto_pagado)}</td>
                    </tr>
                `;
            });

            htmlPagos += `
                    </tbody>
                    <tfoot>
                        <tr style="font-weight: bold;">
                            <td colspan="2">TOTAL PAGADO:</td>
                            <td style="text-align: right;">${formatCurrency(totalPagado)}</td>
                        </tr>
                        <tr style="font-weight: bold;">
                            <td colspan="2">SALDO PENDIENTE:</td>
                            <td style="text-align: right;">${formatCurrency(venta.saldo_pendiente)}</td>
                        </tr>
                    </tfoot>
                </table>
            `;
        } else {
            htmlPagos = '<p style="margin-top: 20px; text-align: center; color: #999;">No se han registrado pagos para esta venta.</p>';
        }

        Swal.fire({
            title: `Pagos de la Venta ${codigoVenta}`,
            html: `
                <p>Cliente: <strong>${nombreCliente}</strong></p>
                <p>Total Venta: <strong>${formatCurrency(venta.monto_total)}</strong></p>
                ${htmlPagos}
            `,
            width: '600px',
            confirmButtonText: 'Cerrar'
        });

    } catch (error) {
        console.error('[Ventas] Error:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al cargar los pagos: ' + error.message,
            confirmButtonText: 'Cerrar'
        });
    }
}

console.log('[Ventas Lista] ✅ Módulo cargado');

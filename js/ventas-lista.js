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
                    case 'editar_venta':
                        await cargarVistaFormularioVenta('edit', idVenta);
                        break;
                    case 'anular_venta':
                        await confirmarAnularVenta(idVenta, codigoVenta, nombreCliente);
                        break;
                    case 'eliminar_venta':
                        await confirmarEliminarVenta(idVenta, codigoVenta, nombreCliente);
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
        `;

        if (venta.estado !== 'Completado' && venta.estado !== 'Anulada') {
            opcionesMenu += `
                <a href="#" class="actions-menu-item" data-action="editar_venta">
                    <i class="fas fa-edit"></i> Editar
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

        if (venta.estado !== 'Completado' && venta.estado !== 'Anulada') {
            opcionesMenu += `
                <div class="divider"></div>
                <a href="#" class="actions-menu-item text-danger" data-action="eliminar_venta">
                    <i class="fas fa-trash"></i> Eliminar
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
async function confirmarEliminarVenta(idVenta, codigoVenta, nombreCliente) {
    const result = await Swal.fire({
        title: '¿Eliminar Venta?',
        html: `
            <p>Se eliminará permanentemente la venta <strong>${codigoVenta}</strong>.</p>
            <p>Cliente: <strong>${nombreCliente}</strong></p>
            <p>Esta acción no se puede deshacer.</p>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, Eliminar',
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
            const { data, error } = await client.rpc('fn_eliminar_venta', {
                p_id_venta: idVenta
            });

            if (error) {
                console.error('[Ventas] Error al eliminar venta:', error);
                throw new Error(error.message);
            }

            if (data?.exito === false) {
                console.warn('[Ventas] RPC retornó error:', data);

                if (data.codigo_error === 'PERMISO_DENEGADO') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Permiso Denegado',
                        text: data.mensaje || 'No tienes permisos para eliminar ventas',
                        confirmButtonText: 'Entendido'
                    });
                    return;
                } else {
                    throw new Error(data.mensaje || 'Error desconocido al eliminar la venta');
                }
            }

            Swal.fire({
                icon: 'success',
                title: 'Venta Eliminada',
                text: data.mensaje || 'La venta se eliminó exitosamente.',
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

console.log('[Ventas Lista] ✅ Módulo cargado');

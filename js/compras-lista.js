/**
 * =========================================================================
 * MÓDULO DE COMPRAS - LISTA
 * Gestión de lista de compras con filtros, paginación y acciones
 * =========================================================================
 */

// ========================================
// VARIABLES GLOBALES
// ========================================
const estadoPaginacionCompras = {
    paginaActual: 1,
    filasPorPagina: 10,
    totalRegistros: 0,
    totalPages: 1,
    filtros: {}
};

// Referencias a componentes externos
let flatpickrRangoFechas = null;
let select2Proveedor = null;

// ========================================
// FUNCIÓN PRINCIPAL DE CARGA
// ========================================
/**
 * Función principal que carga la vista de lista de compras
 * Se llama desde home.js al hacer click en el menú
 */
async function cargarPaginaCompras() {
    console.log('[Compras] ===== INICIALIZANDO MÓDULO DE COMPRAS =====');

    try {
        const workArea = document.querySelector('.work-area');
        if (!workArea) {
            throw new Error('No se encontró el área de trabajo');
        }

        // Mostrar indicador de carga
        workArea.innerHTML = '<div class="loading-spinner-container"><div class="loading-spinner"></div><p>Cargando módulo de compras...</p></div>';

        // Cargar HTML de la vista de lista
        const response = await fetch('/views/compras-lista.html');
        if (!response.ok) throw new Error('Error al cargar la vista de compras');

        const html = await response.text();
        workArea.innerHTML = html;

        // Inicializar vista
        await inicializarVistaListaCompras();
        console.log('[Compras] ✅ Módulo inicializado correctamente');
    } catch (error) {
        console.error('[Compras] ❌ Error al inicializar:', error);
        showNotification('Error al cargar módulo de compras: ' + error.message, 'error');
    }
}

/**
 * Inicializa la vista de lista de compras
 */
async function inicializarVistaListaCompras() {
    console.log("[Compras] Inicializando vista de Lista de Compras...");

    try {
        // 1. Configurar event listeners
        configurarEventListenersListaCompras();

        // 2. Inicializar componentes de filtros (Select2, Flatpickr)
        inicializarComponentesFiltrosCompras();

        // 3. Cargar datos iniciales
        await ejecutarBusquedaDeCompras();

        console.log("[Compras] Vista de Lista de Compras inicializada correctamente");

    } catch (error) {
        console.error('[Compras] Error al inicializar vista:', error);
        showNotification('Error al inicializar el módulo de compras. Recarga la página.', 'error');
    }
}

// ========================================
// CONFIGURACIÓN DE EVENT LISTENERS
// ========================================
function configurarEventListenersListaCompras() {
    console.log("[Compras] Configurando event listeners...");

    // Botón Nueva Compra
    const btnNuevaCompra = document.getElementById('btn-nueva-compra');
    if (btnNuevaCompra) {
        btnNuevaCompra.addEventListener('click', () => {
            cargarVistaFormularioCompra('create');
        });
    }

    // Botón Limpiar Filtros
    const btnLimpiarFiltros = document.getElementById('btn-limpiar-filtros-compras');
    if (btnLimpiarFiltros) {
        btnLimpiarFiltros.addEventListener('click', limpiarFiltrosCompras);
    }

    // Toggle Filtros (Collapse/Expand)
    const btnToggleFiltros = document.getElementById('btn-toggle-filtros-compras');
    if (btnToggleFiltros) {
        btnToggleFiltros.addEventListener('click', toggleFiltrosCompras);
    }

    // Input de búsqueda con debounce
    const inputBuscar = document.getElementById('input-buscar-compras');
    if (inputBuscar) {
        inputBuscar.addEventListener('input', debounce(() => {
            estadoPaginacionCompras.filtros.terminoBusqueda = inputBuscar.value.trim();
            estadoPaginacionCompras.paginaActual = 1;
            ejecutarBusquedaDeCompras();
        }, 400));
    }

    // Select de Estado Compra
    const filtroEstadoCompra = document.getElementById('filtro-estado-compra');
    if (filtroEstadoCompra) {
        filtroEstadoCompra.addEventListener('change', () => {
            estadoPaginacionCompras.filtros.estadoCompra = filtroEstadoCompra.value;
            estadoPaginacionCompras.paginaActual = 1;
            ejecutarBusquedaDeCompras();
        });
    }

    // Select de Estado Pago
    const filtroEstadoPago = document.getElementById('filtro-estado-pago');
    if (filtroEstadoPago) {
        filtroEstadoPago.addEventListener('change', () => {
            estadoPaginacionCompras.filtros.estadoPago = filtroEstadoPago.value;
            estadoPaginacionCompras.paginaActual = 1;
            ejecutarBusquedaDeCompras();
        });
    }

    // Botones de paginación
    const btnPrevPage = document.getElementById('btn-prev-page-compras');
    const btnNextPage = document.getElementById('btn-next-page-compras');

    if (btnPrevPage) {
        btnPrevPage.addEventListener('click', () => {
            if (estadoPaginacionCompras.paginaActual > 1) {
                estadoPaginacionCompras.paginaActual--;
                ejecutarBusquedaDeCompras();
            }
        });
    }

    if (btnNextPage) {
        btnNextPage.addEventListener('click', () => {
            const totalPages = Math.ceil(estadoPaginacionCompras.totalRegistros / estadoPaginacionCompras.filasPorPagina);
            if (estadoPaginacionCompras.paginaActual < totalPages) {
                estadoPaginacionCompras.paginaActual++;
                ejecutarBusquedaDeCompras();
            }
        });
    }

    // Delegación de eventos para botones de acción en la tabla
    const tbodyCompras = document.getElementById('tbody-compras');
    if (tbodyCompras) {
        tbodyCompras.addEventListener('click', async (e) => {
            const btnVerDetalle = e.target.closest('.btn-ver-detalle');
            const btnRecibir = e.target.closest('.btn-recibir-compra');
            const btnEditar = e.target.closest('.btn-editar-compra');
            const btnPago = e.target.closest('.btn-registrar-pago');
            const btnAnular = e.target.closest('.btn-anular-compra');

            if (btnVerDetalle) {
                const compraId = btnVerDetalle.dataset.id;
                await cargarVistaDetalleCompra(compraId);
            } else if (btnRecibir) {
                const compraId = btnRecibir.dataset.id;
                await confirmarRecibirCompra(compraId);
            } else if (btnEditar && !btnEditar.disabled) {
                const compraId = btnEditar.dataset.id;
                await cargarVistaFormularioCompra('edit', compraId);
            } else if (btnPago && !btnPago.disabled) {
                const compraId = btnPago.dataset.id;
                const saldo = parseFloat(btnPago.dataset.saldo);
                await mostrarModalRegistrarPago(compraId, saldo);
            } else if (btnAnular) {
                const compraId = btnAnular.dataset.id;
                const estado = btnAnular.dataset.estado;
                await confirmarAnularCompra(compraId, estado);
            }
        });
    }

    console.log("[Compras] Event listeners configurados");
}

// ========================================
// INICIALIZACIÓN DE COMPONENTES (Select2, Flatpickr)
// ========================================
function inicializarComponentesFiltrosCompras() {
    console.log("[Compras] Inicializando componentes de filtros (Select2, Flatpickr)...");

    // Flatpickr para el rango de fechas
    const inputRangoFechas = document.getElementById('filtro-rango-fechas-compras');
    if (inputRangoFechas && typeof flatpickr !== 'undefined') {
        flatpickrRangoFechas = flatpickr(inputRangoFechas, {
            mode: "range",
            dateFormat: "d/m/Y",
            locale: "es",
            onClose: function() {
                ejecutarBusquedaDeCompras();
            }
        });
    }

    // Select2 para el filtro de proveedores con búsqueda AJAX
    const selectProveedor = $('#filtro-proveedor-compras');
    if (selectProveedor.length && typeof $.fn.select2 !== 'undefined') {
        select2Proveedor = selectProveedor.select2({
            placeholder: "Buscar proveedor (mínimo 3 letras)...",
            allowClear: true,
            minimumInputLength: 3,
            ajax: {
                delay: 400,
                transport: async function(params, success, failure) {
                    try {
                        const termino = params.data.term || '';

                        if (termino.length < 3) {
                            success({ results: [{ id: '', text: 'Todos los proveedores' }] });
                            return { abort: () => {} };
                        }

                        console.log("[Compras Filtros] Buscando proveedores:", termino);
                        const client = getSupabaseClient();

                        const { data, error } = await client
                            .from('proveedores')
                            .select('id, nombre_empresa, codigo_proveedor')
                            .eq('activo', true)
                            .or(`nombre_empresa.ilike.%${termino}%,codigo_proveedor.ilike.%${termino}%`)
                            .order('nombre_empresa')
                            .limit(20);

                        if (error) throw error;

                        const resultados = (data || []).map(p => ({
                            id: p.id,
                            text: `${p.nombre_empresa} (${p.codigo_proveedor || 'S/C'})`
                        }));

                        const todos = { id: '', text: 'Todos los proveedores' };
                        success({ results: [todos, ...resultados] });

                    } catch (error) {
                        console.error("[Compras Filtros] Error al buscar proveedores:", error);
                        failure(error);
                    }
                    return { abort: () => {} };
                }
            }
        });

        // Auto-focus en el campo de búsqueda cuando se abre
        selectProveedor.on('select2:open', function() {
            setTimeout(function() {
                const searchField = document.querySelector('.select2-search__field');
                if (searchField) searchField.focus();
            }, 100);
        });

        // Al seleccionar un proveedor, ejecutar búsqueda
        selectProveedor.on('select2:select select2:clear', function(e) {
            const proveedorId = $(this).val();
            estadoPaginacionCompras.filtros.proveedorId = proveedorId || null;
            estadoPaginacionCompras.paginaActual = 1;
            ejecutarBusquedaDeCompras();
        });
    }

    console.log("[Compras] Componentes de filtros inicializados");
}

// ========================================
// CARGA DE DATOS (RPC filtrar_compras)
// ========================================
async function ejecutarBusquedaDeCompras() {
    console.log("[Compras] Ejecutando búsqueda con filtros:", estadoPaginacionCompras.filtros);

    const tbody = document.getElementById('tbody-compras');
    if (!tbody) {
        console.error("[Compras] No se encontró el tbody-compras");
        return;
    }

    try {
        // Mostrar indicador de carga
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Cargando compras...</td></tr>';

        const client = getSupabaseClient();

        // Parsear rango de fechas
        let fechaDesde = null;
        let fechaHasta = null;
        if (flatpickrRangoFechas && flatpickrRangoFechas.selectedDates.length === 2) {
            fechaDesde = moment(flatpickrRangoFechas.selectedDates[0]).toISOString();
            fechaHasta = moment(flatpickrRangoFechas.selectedDates[1]).toISOString();
        }

        const offset = (estadoPaginacionCompras.paginaActual - 1) * estadoPaginacionCompras.filasPorPagina;

        // ✅ LLAMADA RPC REAL
        const { data, error } = await client.rpc('filtrar_compras', {
            p_estado: estadoPaginacionCompras.filtros.estadoCompra || null,
            p_estado_pago: estadoPaginacionCompras.filtros.estadoPago || null,
            p_id_proveedor: estadoPaginacionCompras.filtros.proveedorId || null,
            p_fecha_desde: fechaDesde,
            p_fecha_hasta: fechaHasta,
            p_busqueda: estadoPaginacionCompras.filtros.terminoBusqueda || null,
            p_limit: estadoPaginacionCompras.filasPorPagina,
            p_offset: offset,
            p_orden_campo: 'fecha_compra',
            p_orden_direccion: 'DESC'
        });

        if (error) {
            console.error("[Compras] Error al cargar compras:", error);
            throw error;
        }

        console.log("[Compras] Datos recibidos:", data);

        // Actualizar total de registros
        estadoPaginacionCompras.totalRegistros = data.total || 0;

        // Renderizar tabla y paginación
        renderizarTablaCompras(data.compras || []);
        renderizarPaginacionCompras();

    } catch (error) {
        console.error("[Compras] Error al cargar datos:", error);

        if (error.message && error.message.includes('permiso')) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color: red;">No tienes permisos para ver compras. Contacta al administrador.</td></tr>';
        } else if (error.message && error.message.includes('sesión')) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color: red;">Sesión expirada. Recargando...</td></tr>';
            setTimeout(() => location.reload(), 2000);
        } else {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color: red;">Error: ${error.message}</td></tr>`;
        }
    }
}

// ========================================
// RENDERIZADO DE TABLA
// ========================================
function renderizarTablaCompras(compras) {
    const tbody = document.getElementById('tbody-compras');
    tbody.innerHTML = '';

    if (!compras || compras.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No se encontraron compras con los filtros aplicados.</td></tr>';
        return;
    }

    compras.forEach(compra => {
        const row = document.createElement('tr');

        // Formatear fecha
        const fecha = moment(compra.fecha_compra).format('DD/MM/YYYY');

        // Badges de estado
        const badgeEstado = obtenerBadgeEstadoCompra(compra.estado);
        const badgeEstadoPago = obtenerBadgeEstadoPago(compra.estado_pago);

        // Formatear moneda
        const totalFormateado = formatCurrency(compra.total_compra);
        const saldoFormateado = formatCurrency(compra.saldo_pendiente);

        // Validaciones para botones
        const puedeEditar = compra.estado === 'Borrador';
        const puedeRecibir = compra.estado === 'Ordenada';
        const puedeRegistrarPago = compra.saldo_pendiente > 0 &&
                                    compra.estado !== 'Borrador' &&
                                    compra.estado !== 'Anulada';

        row.innerHTML = `
            <td data-column="fecha">${fecha}</td>
            <td data-column="numero_factura">${compra.numero_factura || '-'}</td>
            <td data-column="proveedor">${compra.proveedor?.nombre_empresa || '-'}</td>
            <td data-column="estado">${badgeEstado}</td>
            <td data-column="estado_pago">${badgeEstadoPago}</td>
            <td data-column="condicion_pago">${compra.condicion_pago}</td>
            <td data-column="total" class="text-right">${totalFormateado}</td>
            <td data-column="saldo_pendiente" class="text-right">${saldoFormateado}</td>
            <td class="text-center">
                <button class="btn-accion btn-ver-detalle" data-id="${compra.id_compra}" title="Ver Detalle">
                    <i class="fas fa-eye"></i>
                </button>
                ${puedeRecibir ? `
                <button class="btn-accion btn-recibir-compra" data-id="${compra.id_compra}" title="Recibir Compra">
                    <i class="fas fa-check-circle"></i>
                </button>
                ` : ''}
                <button class="btn-accion btn-editar-compra" data-id="${compra.id_compra}"
                        ${!puedeEditar ? 'disabled' : ''} title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-accion btn-registrar-pago" data-id="${compra.id_compra}"
                        data-saldo="${compra.saldo_pendiente}"
                        ${!puedeRegistrarPago ? 'disabled' : ''} title="Registrar Pago">
                    <i class="fas fa-dollar-sign"></i>
                </button>
                <button class="btn-accion btn-anular-compra" data-id="${compra.id_compra}"
                        data-estado="${compra.estado}" title="Anular">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

function obtenerBadgeEstadoCompra(estado) {
    const badges = {
        'Borrador': '<span class="badge badge-secondary">Borrador</span>',
        'Ordenada': '<span class="badge badge-info">Ordenada</span>',
        'Recibida Parcialmente': '<span class="badge badge-warning">Recibida Parcialmente</span>',
        'Recibida': '<span class="badge badge-success">Recibida</span>',
        'Cancelada': '<span class="badge badge-danger">Cancelada</span>',
        'Anulada': '<span class="badge badge-danger">Anulada</span>'
    };
    return badges[estado] || `<span class="badge">${estado}</span>`;
}

function obtenerBadgeEstadoPago(estadoPago) {
    const badges = {
        'Pendiente de Pago': '<span class="badge badge-danger">Pendiente</span>',
        'Abonada': '<span class="badge badge-warning">Abonada</span>',
        'Pagada': '<span class="badge badge-success">Pagada</span>',
        'Anulada': '<span class="badge badge-secondary">Anulada</span>'
    };
    return badges[estadoPago] || `<span class="badge">${estadoPago}</span>`;
}

// ========================================
// PAGINACIÓN
// ========================================
function renderizarPaginacionCompras() {
    const totalPages = Math.ceil(estadoPaginacionCompras.totalRegistros / estadoPaginacionCompras.filasPorPagina);
    const pageInfo = document.getElementById('page-info-compras');
    const btnPrev = document.getElementById('btn-prev-page-compras');
    const btnNext = document.getElementById('btn-next-page-compras');

    if (pageInfo) {
        pageInfo.textContent = `Página ${estadoPaginacionCompras.paginaActual} de ${totalPages || 1} (Total: ${estadoPaginacionCompras.totalRegistros} compras)`;
    }

    if (btnPrev) {
        btnPrev.disabled = estadoPaginacionCompras.paginaActual <= 1;
    }

    if (btnNext) {
        btnNext.disabled = estadoPaginacionCompras.paginaActual >= totalPages;
    }
}

// ========================================
// ACCIONES
// ========================================

/**
 * Registrar pago a una compra (usando SweetAlert2)
 */
async function mostrarModalRegistrarPago(idCompra, saldoActual) {
    const result = await Swal.fire({
        title: 'Registrar Pago',
        html: `
            <div style="text-align: left;">
                <p style="margin-bottom: 15px;">
                    <strong>Saldo Actual:</strong> ${formatCurrency(saldoActual)}
                </p>

                <label for="swal-monto" style="display: block; margin-bottom: 5px;">
                    Monto a Pagar <span style="color: red;">*</span>
                </label>
                <input id="swal-monto" type="number" class="swal2-input"
                       value="${saldoActual}" min="0" max="${saldoActual}" step="0.01"
                       style="width: 90%;">

                <label for="swal-fecha-pago" style="display: block; margin-top: 10px; margin-bottom: 5px;">
                    Fecha de Pago <span style="color: red;">*</span>
                </label>
                <input id="swal-fecha-pago" type="text" class="swal2-input flatpickr-fecha-pago"
                       placeholder="Seleccionar fecha" style="width: 90%;">

                <label for="swal-metodo" style="display: block; margin-top: 10px; margin-bottom: 5px;">
                    Método de Pago <span style="color: red;">*</span>
                </label>
                <select id="swal-metodo" class="swal2-input" style="width: 90%;">
                    <option value="Efectivo">Efectivo</option>
                    <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                    <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                    <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Otro">Otro</option>
                </select>

                <label for="swal-referencia" style="display: block; margin-top: 10px; margin-bottom: 5px;">
                    Referencia (opcional)
                </label>
                <input id="swal-referencia" type="text" class="swal2-input"
                       placeholder="Número de transacción" style="width: 90%;">

                <label for="swal-notas" style="display: block; margin-top: 10px; margin-bottom: 5px;">
                    Notas (opcional)
                </label>
                <textarea id="swal-notas" class="swal2-textarea"
                          placeholder="Notas adicionales" style="width: 90%;"></textarea>
            </div>
        `,
        didOpen: () => {
            flatpickr('#swal-fecha-pago', {
                dateFormat: 'd/m/Y',
                defaultDate: 'today',
                locale: 'es'
            });
            const montoInput = document.getElementById('swal-monto');
            montoInput.focus();
            montoInput.select();
        },
        confirmButtonText: 'Registrar Pago',
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        focusConfirm: false,
        preConfirm: () => {
            const monto = parseFloat(document.getElementById('swal-monto').value);
            const fechaPagoStr = document.getElementById('swal-fecha-pago').value;

            if (!monto || monto <= 0) {
                Swal.showValidationMessage('El monto debe ser un número mayor a cero.');
                return false;
            }
            if (monto > saldoActual) {
                Swal.showValidationMessage('El monto no puede ser mayor al saldo actual.');
                return false;
            }
            if (!fechaPagoStr) {
                Swal.showValidationMessage('Debes seleccionar una fecha para el pago.');
                return false;
            }

            return {
                p_id_compra: idCompra,
                p_monto_pagado: monto,
                p_metodo_pago: document.getElementById('swal-metodo').value,
                p_fecha_pago: moment(fechaPagoStr, 'DD/MM/YYYY').toISOString(),
                p_referencia: document.getElementById('swal-referencia').value || null,
                p_notas: document.getElementById('swal-notas').value || null
            };
        }
    });

    if (result.isConfirmed) {
        try {
            Swal.fire({
                title: 'Procesando Pago...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const client = getSupabaseClient();
            const { data, error } = await client.rpc('registrar_pago_a_compra', result.value);

            if (error) {
                console.error('[Compras] Error al registrar pago:', error);
                throw new Error(error.message);
            }

            if (data?.success === false) {
                console.warn('[Compras] RPC retornó error:', data);

                if (data.codigo_error === 'PERMISO_DENEGADO') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Permiso Denegado',
                        text: data.mensaje || 'No tienes permisos para registrar pagos de compras',
                        confirmButtonText: 'Entendido'
                    });
                    return;
                } else if (data.codigo_error === 'MONTO_EXCEDE_SALDO') {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Monto Inválido',
                        text: data.mensaje,
                        confirmButtonText: 'Entendido'
                    });
                    return;
                } else {
                    throw new Error(data.mensaje || 'Error desconocido al registrar el pago');
                }
            }

            Swal.fire({
                icon: 'success',
                title: 'Pago Registrado',
                text: `Pago de ${formatCurrency(result.value.p_monto_pagado)} registrado exitosamente.`,
                confirmButtonText: 'OK'
            });

            await ejecutarBusquedaDeCompras();

        } catch (error) {
            console.error('[Compras] Error:', error);
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
 * Confirmar anulación de compra
 */
async function confirmarAnularCompra(idCompra, estado) {
    const titulo = estado === 'Borrador' ?
        '¿Eliminar Borrador?' :
        '¡ACCIÓN CRÍTICA! - Anular Compra';

    const mensaje = estado === 'Borrador' ?
        'Se eliminará este borrador permanentemente.' :
        `Estás a punto de ANULAR una compra en estado "${estado}". Si ya fue recibida, el inventario se revertirá. ¿Estás seguro de continuar?`;

    const result = await Swal.fire({
        title: titulo,
        text: mensaje,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: estado === 'Borrador' ? 'Sí, Eliminar' : 'Sí, Anular',
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
            const { data, error } = await client.rpc('anular_compra', {
                p_id_compra: idCompra
            });

            if (error) {
                console.error('[Compras] Error al anular compra:', error);
                throw new Error(error.message);
            }

            if (data?.success === false) {
                console.warn('[Compras] RPC retornó error:', data);

                if (data.codigo_error === 'PERMISO_DENEGADO') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Permiso Denegado',
                        text: data.mensaje || 'No tienes permisos para anular/eliminar compras',
                        confirmButtonText: 'Entendido'
                    });
                    return;
                } else if (data.codigo_error === 'COMPRA_YA_ANULADA') {
                    Swal.fire({
                        icon: 'info',
                        title: 'Información',
                        text: data.mensaje,
                        confirmButtonText: 'Entendido'
                    });
                    return;
                } else {
                    throw new Error(data.mensaje || 'Error desconocido al anular la compra');
                }
            }

            Swal.fire({
                icon: 'success',
                title: estado === 'Borrador' ? 'Borrador Eliminado' : 'Compra Anulada',
                text: data.mensaje || 'La operación se completó exitosamente.',
                confirmButtonText: 'OK'
            });

            await ejecutarBusquedaDeCompras();

        } catch (error) {
            console.error('[Compras] Error:', error);
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
 * Confirma y procesa el cambio de estado de "Ordenada" a "Recibida"
 */
async function confirmarRecibirCompra(idCompra) {
    const result = await Swal.fire({
        title: '¿Recibir esta Compra?',
        html: `
            <p>Se cambiará el estado de <strong>Ordenada</strong> a <strong>Recibida</strong>.</p>
            <p>Esto actualizará el inventario automáticamente.</p>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, Recibir',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#007bff'
    });

    if (result.isConfirmed) {
        try {
            Swal.fire({
                title: 'Procesando...',
                text: 'Actualizando estado de la compra...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const client = getSupabaseClient();
            const { error } = await client
                .from('compras')
                .update({ estado: 'Recibida' })
                .eq('id_compra', idCompra);

            if (error) {
                console.error('[Compras] Error al recibir compra:', error);
                throw new Error(error.message);
            }

            Swal.fire({
                icon: 'success',
                title: 'Compra Recibida',
                text: 'El estado ha sido actualizado y el inventario se ha actualizado.',
                confirmButtonText: 'OK'
            });

            await ejecutarBusquedaDeCompras();

        } catch (error) {
            console.error('[Compras] Error:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'No se pudo actualizar el estado de la compra',
                confirmButtonText: 'Cerrar'
            });
        }
    }
}

// ========================================
// FUNCIONES DE UTILIDAD
// ========================================

/**
 * Toggle de filtros (collapse/expand)
 */
function toggleFiltrosCompras() {
    const filtrosContent = document.getElementById('filtros-compras-content');
    const btnToggle = document.getElementById('btn-toggle-filtros-compras');
    const icon = btnToggle.querySelector('i.fa-chevron-up, i.fa-chevron-down');

    if (filtrosContent.classList.contains('is-open')) {
        filtrosContent.classList.remove('is-open');
        if (icon) {
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        }
        btnToggle.setAttribute('aria-expanded', 'false');
    } else {
        filtrosContent.classList.add('is-open');
        if (icon) {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        }
        btnToggle.setAttribute('aria-expanded', 'true');
    }
}

/**
 * Limpiar todos los filtros
 */
function limpiarFiltrosCompras() {
    console.log('[Compras] Limpiando filtros...');

    // Limpiar objeto de filtros
    estadoPaginacionCompras.filtros = {};
    estadoPaginacionCompras.paginaActual = 1;

    // Limpiar campos del formulario
    const inputBuscar = document.getElementById('input-buscar-compras');
    if (inputBuscar) inputBuscar.value = '';

    const filtroEstado = document.getElementById('filtro-estado-compra');
    if (filtroEstado) filtroEstado.value = '';

    const filtroEstadoPago = document.getElementById('filtro-estado-pago');
    if (filtroEstadoPago) filtroEstadoPago.value = '';

    // Limpiar Select2 de proveedor
    if (select2Proveedor) {
        select2Proveedor.val('').trigger('change');
    }

    // Limpiar Flatpickr de fechas
    if (flatpickrRangoFechas) {
        flatpickrRangoFechas.clear();
    }

    // Ejecutar búsqueda
    ejecutarBusquedaDeCompras();
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

console.log('[Compras Lista] ✅ Módulo cargado');

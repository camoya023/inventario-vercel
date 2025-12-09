/**
 * =========================================================================
 * MÓDULO DE COMPRAS - DETALLE
 * Vista de detalle de una compra específica
 * =========================================================================
 */

/**
 * Carga la vista de detalle de una compra
 * @param {string} idCompra - UUID de la compra
 */
async function cargarVistaDetalleCompra(idCompra) {
    console.log('[Compras] Cargando detalle de compra:', idCompra);

    try {
        const workArea = document.querySelector('.work-area');
        if (!workArea) {
            throw new Error('No se encontró el área de trabajo');
        }

        // Mostrar indicador de carga
        workArea.innerHTML = `
            <div class="loading-spinner-container">
                <div class="loading-spinner"></div>
                <p>Cargando detalle de compra...</p>
            </div>
        `;

        // Cargar HTML de la vista de detalle
        const response = await fetch('/views/compras-detalle.html');
        if (!response.ok) throw new Error('Error al cargar la vista de detalle');

        const html = await response.text();
        workArea.innerHTML = html;

        // Obtener datos de la compra
        const client = getSupabaseClient();
        const { data, error } = await client.rpc('obtener_compra_con_detalles', {
            p_id_compra: idCompra
        });

        if (error) {
            console.error("[Compras] Error al obtener detalle:", error);
            throw error;
        }

        if (!data) {
            throw new Error('No se encontraron datos para esta compra');
        }

        console.log("[Compras] Datos de detalle recibidos:", data);

        // Renderizar los datos
        renderizarDatosDetalleCompra(data);

        // Configurar event listeners
        configurarEventListenersDetalleCompra();

        console.log('[Compras] Detalle de compra cargado correctamente');

    } catch (error) {
        console.error("[Compras] Error al cargar detalle:", error);

        const workArea = document.querySelector('.work-area');

        if (error.message && error.message.includes('permiso')) {
            workArea.innerHTML = `
                <div class="error-message" style="padding: 40px; text-align: center;">
                    <i class="fas fa-lock" style="font-size: 48px; color: #dc3545; margin-bottom: 20px;"></i>
                    <p style="font-size: 18px; color: #dc3545;">No tienes permisos para ver detalles de compras.</p>
                    <p>Contacta al administrador.</p>
                    <button class="button button-secondary" onclick="cargarPaginaCompras()" style="margin-top: 20px;">
                        <i class="fas fa-arrow-left"></i> Volver a la Lista
                    </button>
                </div>
            `;
        } else if (error.message && error.message.includes('sesión')) {
            workArea.innerHTML = `
                <div class="error-message" style="padding: 40px; text-align: center;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #ffc107; margin-bottom: 20px;"></i>
                    <p style="font-size: 18px; color: #ffc107;">Sesión expirada.</p>
                    <p>Recargando la página...</p>
                </div>
            `;
            setTimeout(() => location.reload(), 2000);
        } else {
            workArea.innerHTML = `
                <div class="error-message" style="padding: 40px; text-align: center;">
                    <i class="fas fa-exclamation-circle" style="font-size: 48px; color: #dc3545; margin-bottom: 20px;"></i>
                    <p style="font-size: 18px; color: #dc3545;">Error al cargar el detalle</p>
                    <p>${error.message}</p>
                    <button class="button button-secondary" onclick="cargarPaginaCompras()" style="margin-top: 20px;">
                        <i class="fas fa-arrow-left"></i> Volver a la Lista
                    </button>
                </div>
            `;
        }
    }
}

/**
 * Configura los event listeners de la vista de detalle
 */
function configurarEventListenersDetalleCompra() {
    const btnVolver = document.getElementById('btn-volver-a-lista-compras');
    if (btnVolver) {
        btnVolver.addEventListener('click', () => {
            cargarPaginaCompras();
        });
    }
}

/**
 * Renderiza los datos de la compra en la vista de detalle
 * @param {Object} datos - Datos de la compra obtenidos de la RPC
 */
function renderizarDatosDetalleCompra(datos) {
    console.log('[Compras] Renderizando datos de detalle...');

    // Extraer datos (compatibilidad con formato RPC)
    const compra = {
        id_compra: datos.id_compra,
        numero_factura: datos.numero_factura,
        fecha_compra: datos.fecha_compra,
        estado: datos.estado,
        estado_pago: datos.estado_pago,
        total_compra: datos.total_compra,
        saldo_pendiente: datos.saldo_pendiente,
        condicion_pago: datos.condicion_pago,
        notas: datos.notas
    };

    const proveedor = datos.proveedor || null;
    const detalles = datos.detalles || [];
    const pagos = datos.pagos || [];

    // Determinar clases de badges
    let estadoClase = 'badge-secondary';
    if (compra.estado === 'Recibida') {
        estadoClase = 'badge-success';
    } else if (compra.estado === 'Ordenada') {
        estadoClase = 'badge-warning';
    } else if (compra.estado === 'Borrador') {
        estadoClase = 'badge-info';
    } else if (compra.estado === 'Anulada') {
        estadoClase = 'badge-danger';
    }

    let pagoClase = 'badge-secondary';
    if (compra.estado_pago === 'Pagada') {
        pagoClase = 'badge-success';
    } else if (compra.estado_pago === 'Abonada') {
        pagoClase = 'badge-warning';
    } else if (compra.estado_pago === 'Pendiente de Pago') {
        pagoClase = 'badge-danger';
    }

    // Rellenar resumen
    $('#detalle-numero-factura').text(compra.numero_factura || `(${compra.id_compra.substring(0,8)}...)`);
    $('#detalle-proveedor').text(proveedor ? proveedor.nombre_empresa : 'PROVEEDOR ELIMINADO');
    $('#detalle-fecha').text(moment(compra.fecha_compra).format('DD/MM/YYYY'));
    $('#detalle-estados').html(`
        <span class="badge ${estadoClase}">${compra.estado}</span>
        <span class="badge ${pagoClase}">${compra.estado_pago}</span>
    `);
    $('#detalle-total').text(formatCurrency(compra.total_compra));
    $('#detalle-saldo').text(formatCurrency(compra.saldo_pendiente));

    // Rellenar tabla de productos
    const tbodyProductos = $('#tbody-detalle-productos');
    tbodyProductos.empty();

    let cantidadTotalArticulos = 0;

    if (detalles && detalles.length > 0) {
        detalles.forEach(d => {
            cantidadTotalArticulos += d.cantidad;

            const sku = d.sku || (d.producto ? d.producto.sku : 'N/A');
            const nombreProducto = d.nombre_producto || (d.producto ? d.producto.nombre_producto : 'N/A');
            const precioUnitario = d.precio_unitario_compra || d.costo_unitario_neto || 0;
            const subtotalLinea = d.subtotal_linea || d.total_linea || 0;

            const fila = `
                <tr>
                    <td>${sku}</td>
                    <td>${nombreProducto}</td>
                    <td class="text-right">${d.cantidad}</td>
                    <td class="text-right">${formatCurrency(precioUnitario)}</td>
                    <td class="text-right">${formatCurrency(subtotalLinea)}</td>
                </tr>
            `;
            tbodyProductos.append(fila);
        });
    } else {
        tbodyProductos.append('<tr><td colspan="5" style="text-align:center;">No hay productos en esta compra.</td></tr>');
    }

    // Actualizar total de artículos
    $('#detalle-total-cantidad').text(cantidadTotalArticulos);

    // Rellenar tabla de pagos
    const tbodyPagos = $('#tbody-detalle-pagos');
    tbodyPagos.empty();

    if (pagos && pagos.length > 0) {
        pagos.forEach(p => {
            const fila = `
                <tr>
                    <td>${moment(p.fecha_pago).format('DD/MM/YYYY hh:mm A')}</td>
                    <td>${p.metodo_pago}</td>
                    <td>${p.notas || '-'}</td>
                    <td class="text-right">${formatCurrency(p.monto_pagado)}</td>
                </tr>
            `;
            tbodyPagos.append(fila);
        });
    } else {
        tbodyPagos.append('<tr><td colspan="4" style="text-align:center;">No se han registrado pagos para esta compra.</td></tr>');
    }

    console.log('[Compras] Datos renderizados correctamente');
}

/**
 * Formatea un valor numérico como moneda
 */
function formatCurrency(valor) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(valor || 0);
}

console.log('[Compras Detalle] ✅ Módulo cargado');

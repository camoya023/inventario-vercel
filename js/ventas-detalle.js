/**
 * =========================================================================
 * MÓDULO DE VENTAS - DETALLE
 * Vista de detalle de una venta específica
 * =========================================================================
 */

/**
 * Carga la vista de detalle de una venta
 * @param {string} idVenta - UUID de la venta
 */
async function cargarVistaDetalleVenta(idVenta) {
    console.log('[Ventas] Cargando detalle de venta:', idVenta);

    try {
        const workArea = document.querySelector('.work-area');
        if (!workArea) {
            throw new Error('No se encontró el área de trabajo');
        }

        // Mostrar indicador de carga
        workArea.innerHTML = `
            <div class="loading-spinner-container">
                <div class="loading-spinner"></div>
                <p>Cargando detalle de venta...</p>
            </div>
        `;

        // Cargar HTML de la vista de detalle
        const response = await fetch('/views/ventas-detalle.html');
        if (!response.ok) throw new Error('Error al cargar la vista de detalle');

        const html = await response.text();
        workArea.innerHTML = html;

        // Obtener datos de la venta
        const client = getSupabaseClient();
        const { data, error } = await client.rpc('fn_obtener_venta_detalle', {
            p_id_venta: idVenta
        });

        if (error) {
            console.error("[Ventas] Error al obtener detalle:", error);
            throw error;
        }

        if (!data || !data.exito) {
            const mensaje = data?.mensaje || 'No se encontraron datos para esta venta';
            throw new Error(mensaje);
        }

        console.log("[Ventas] Datos de detalle recibidos:", data);

        // Renderizar los datos
        renderizarDatosDetalleVenta(data.datos);

        // Configurar event listeners
        configurarEventListenersDetalleVenta(idVenta);

        console.log('[Ventas] Detalle de venta cargado correctamente');

    } catch (error) {
        console.error("[Ventas] Error al cargar detalle:", error);

        const workArea = document.querySelector('.work-area');

        if (error.message && error.message.includes('permiso')) {
            workArea.innerHTML = `
                <div class="error-message" style="padding: 40px; text-align: center;">
                    <i class="fas fa-lock" style="font-size: 48px; color: #dc3545; margin-bottom: 20px;"></i>
                    <p style="font-size: 18px; color: #dc3545;">No tienes permisos para ver detalles de ventas.</p>
                    <p>Contacta al administrador.</p>
                    <button class="button button-secondary" onclick="cargarPaginaVentas()" style="margin-top: 20px;">
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
                    <button class="button button-secondary" onclick="cargarPaginaVentas()" style="margin-top: 20px;">
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
function configurarEventListenersDetalleVenta(idVenta) {
    const btnVolver = document.getElementById('btn-volver-a-lista-ventas');
    if (btnVolver) {
        btnVolver.addEventListener('click', () => {
            cargarPaginaVentas();
        });
    }

    const btnImprimir = document.getElementById('btn-imprimir-factura-detalle');
    if (btnImprimir) {
        btnImprimir.addEventListener('click', async () => {
            await imprimirFacturaVenta(idVenta);
        });
    }
}

/**
 * Renderiza los datos de la venta en la vista de detalle
 * @param {Object} datos - Datos de la venta obtenidos de la RPC
 */
function renderizarDatosDetalleVenta(datos) {
    console.log('[Ventas] Renderizando datos de detalle...');

    // Extraer datos principales
    const venta = {
        id_venta: datos.id_venta,
        codigo_venta: datos.codigo_venta,
        fecha_venta: datos.fecha_venta,
        estado: datos.estado,
        estado_pago: datos.estado_pago,
        monto_total: datos.monto_total,
        subtotal: datos.subtotal,
        total_impuestos: datos.total_impuestos,
        total_descuentos: datos.total_descuentos,
        costo_envio: datos.costo_envio,
        saldo_pendiente: datos.saldo_pendiente,
        tipo_envio: datos.tipo_envio,
        observaciones: datos.observaciones
    };

    const cliente = datos.clientes || null;
    const direccion = datos.direccion_entrega || null;
    const vendedor = datos.usuario_responsable || null;
    const detalles = datos.detalles_venta || [];
    const pagos = datos.pagos_venta || [];

    // Determinar clases de badges
    let estadoClase = 'badge-secondary';
    if (venta.estado === 'Completado') {
        estadoClase = 'badge-success';
    } else if (venta.estado === 'Pendiente') {
        estadoClase = 'badge-warning';
    } else if (venta.estado === 'Anulada') {
        estadoClase = 'badge-danger';
    }

    let pagoClase = 'badge-secondary';
    if (venta.estado_pago === 'Pagada') {
        pagoClase = 'badge-success';
    } else if (venta.estado_pago === 'Abonada') {
        pagoClase = 'badge-warning';
    } else if (venta.estado_pago === 'Pendiente de Pago') {
        pagoClase = 'badge-danger';
    }

    // Rellenar header
    $('#detalle-codigo-venta').text(venta.codigo_venta || `VENTA-${venta.id_venta.substring(0,8)}`);
    $('#detalle-estado-venta').html(`<span class="badge ${estadoClase}">${venta.estado}</span>`);
    $('#detalle-estado-pago-header').html(`<span class="badge ${pagoClase}">${venta.estado_pago}</span>`);

    // Rellenar tarjetas de resumen
    const nombreCliente = cliente
        ? (cliente.razon_social || `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim())
        : 'Venta Mostrador';

    $('#detalle-cliente').text(nombreCliente);
    $('#detalle-fecha').text(moment(venta.fecha_venta).format('DD/MM/YYYY'));
    $('#detalle-total').text(formatCurrency(venta.monto_total));
    $('#detalle-saldo').text(formatCurrency(venta.saldo_pendiente));

    // Rellenar información del cliente
    $('#detalle-cliente-nombre').text(nombreCliente);
    $('#detalle-cliente-codigo').text(cliente ? cliente.codigo_cliente : 'N/A');
    $('#detalle-cliente-telefono').text(cliente ? cliente.telefono_principal : 'N/A');

    // Rellenar información de entrega
    const tipoEnvio = venta.tipo_envio || 'No aplica';
    $('#detalle-tipo-envio').text(tipoEnvio);

    if (direccion) {
        const textoDireccion = `${direccion.direccion_completa}, ${direccion.barrio || ''}, ${direccion.ciudad_municipio}`;
        $('#detalle-direccion').text(textoDireccion);
    } else {
        $('#detalle-direccion').text('No aplica');
    }

    // Rellenar información adicional
    $('#detalle-vendedor').text(vendedor?.nombre_completo || 'No disponible');
    $('#detalle-observaciones').text(venta.observaciones || 'Sin observaciones');

    // Rellenar tabla de productos
    const tbodyProductos = $('#tbody-detalle-productos');
    tbodyProductos.empty();

    let cantidadTotalArticulos = 0;
    let totalDescuentos = 0;
    let totalImpuestos = 0;
    let totalGeneral = 0;
    let subtotalCalculado = 0; // ✅ NUEVO: Para calcular el subtotal real

    if (detalles && detalles.length > 0) {
        detalles.forEach(d => {
            cantidadTotalArticulos += d.cantidad;

            const producto = d.productos || {};
            const sku = producto.sku || 'N/A';
            const nombreProducto = producto.nombre_producto || 'Producto no encontrado';
            const precioUnitario = d.precio_unitario_venta || 0;
            const subtotalLinea = d.subtotal_linea || (d.cantidad * precioUnitario);
            const porcDescuento = d.porcentaje_descuento || 0;
            const porcImpuesto = d.porcentaje_impuesto || 0;
            const montoDescuento = d.monto_descuento || 0;
            const montoImpuesto = d.monto_impuesto || 0;
            const totalLinea = d.total_linea || subtotalLinea;

            subtotalCalculado += subtotalLinea; // ✅ SUMAR subtotal de cada línea
            totalDescuentos += montoDescuento;
            totalImpuestos += montoImpuesto;
            totalGeneral += totalLinea;

            const fila = `
                <tr>
                    <td>${sku}</td>
                    <td>${nombreProducto}</td>
                    <td class="text-right">${d.cantidad}</td>
                    <td class="text-right">${formatCurrency(precioUnitario)}</td>
                    <td class="text-right">${formatCurrency(subtotalLinea)}</td>
                    <td class="text-right">${porcDescuento > 0 ? porcDescuento + '%' : '-'}</td>
                    <td class="text-right">${porcImpuesto > 0 ? porcImpuesto + '%' : '-'}</td>
                    <td class="text-right">${formatCurrency(totalLinea)}</td>
                </tr>
            `;
            tbodyProductos.append(fila);
        });
    } else {
        tbodyProductos.append('<tr><td colspan="8" style="text-align:center;">No hay productos en esta venta.</td></tr>');
    }

    // Actualizar totales del footer de la tabla de productos
    $('#detalle-total-cantidad').text(cantidadTotalArticulos);
    $('#detalle-total-descuento').text(formatCurrency(totalDescuentos));
    $('#detalle-total-impuestos').text(formatCurrency(totalImpuestos));
    $('#detalle-total-general').text(formatCurrency(totalGeneral));

    // ✅ Actualizar tarjetas de resumen con los valores correctos
    $('#detalle-subtotal').text(formatCurrency(subtotalCalculado));
    $('#detalle-descuentos').text('-' + formatCurrency(venta.monto_descuento_global || totalDescuentos));
    $('#detalle-impuestos').text(formatCurrency(venta.impuestos || totalImpuestos));

    // ✅ Costo de envío: Mostrar N/A si tipo_envio = "Recogen"
    if (venta.tipo_envio === 'Recogen') {
        $('#detalle-costo-envio-card').text('N/A');
    } else {
        $('#detalle-costo-envio-card').text(formatCurrency(venta.costo_envio || 0));
    }

    // Rellenar tabla de pagos
    const tbodyPagos = $('#tbody-detalle-pagos');
    tbodyPagos.empty();

    let totalPagado = 0;

    if (pagos && pagos.length > 0) {
        pagos.forEach(p => {
            totalPagado += p.monto || 0;

            const fila = `
                <tr>
                    <td>${moment(p.fecha_pago).format('DD/MM/YYYY hh:mm A')}</td>
                    <td>${p.metodo_pago || 'N/A'}</td>
                    <td>${p.notas || '-'}</td>
                    <td class="text-right">${formatCurrency(p.monto)}</td>
                </tr>
            `;
            tbodyPagos.append(fila);
        });
    } else {
        tbodyPagos.append('<tr><td colspan="4" style="text-align:center;">No se han registrado pagos para esta venta.</td></tr>');
    }

    // Actualizar total pagado en el footer
    $('#detalle-total-pagado').text(formatCurrency(totalPagado));

    console.log('[Ventas] Datos renderizados correctamente');
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

console.log('[Ventas Detalle] ✅ Módulo cargado');

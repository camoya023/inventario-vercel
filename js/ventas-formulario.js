/**
 * =========================================================================
 * MÓDULO DE VENTAS - FORMULARIO
 * Gestión de formulario para crear/editar ventas
 * =========================================================================
 */

// ========================================
// VARIABLES GLOBALES
// ========================================
let totalesVentaActual = {
    subtotal: 0,
    cantidad: 0,
    envio: 0,
    impuestos: 0,
    descuento: 0,
    total: 0
};

let modoEdicionVentas = {
    activo: false,
    idVenta: null
};

let flatpickrInstance = null;
let cuentasBancariasDisponibles = [];

// ========================================
// FUNCIÓN PRINCIPAL DE CARGA
// ========================================
/**
 * Carga la vista del formulario de ventas
 * @param {string} modo - 'create' o 'edit'
 * @param {string} idVenta - UUID de la venta (solo para modo 'edit')
 */
async function cargarVistaFormularioVenta(modo = 'create', idVenta = null) {
    console.log('[Ventas] Cargando formulario en modo:', modo);

    try {
        const workArea = document.querySelector('.work-area');
        if (!workArea) {
            throw new Error('No se encontró el área de trabajo');
        }

        // Mostrar indicador de carga
        workArea.innerHTML = '<div class="loading-spinner-container"><div class="loading-spinner"></div><p>Cargando formulario...</p></div>';

        // Cargar HTML del formulario
        const response = await fetch('/views/ventas-formulario.html');
        if (!response.ok) throw new Error('Error al cargar la vista del formulario');

        const html = await response.text();
        workArea.innerHTML = html;

        // Configurar modo de edición
        if (modo === 'edit' && idVenta) {
            modoEdicionVentas = { activo: true, idVenta: idVenta };
            document.getElementById('titulo-formulario-venta').textContent = 'Editar Venta';
        } else {
            modoEdicionVentas = { activo: false, idVenta: null };
            document.getElementById('titulo-formulario-venta').textContent = 'Crear Nueva Venta';
        }

        // Inicializar formulario
        await inicializarFormularioVenta();

        // Si es modo edición, cargar datos
        if (modoEdicionVentas.activo) {
            await cargarDatosVentaParaEditar(idVenta);
        }

    } catch (error) {
        console.error('[Ventas] Error al cargar formulario:', error);
        toastr.error('Error al cargar formulario: ' + error.message);
    }
}

/**
 * Inicializa el formulario de venta
 */
async function inicializarFormularioVenta() {
    console.log("[Ventas] Inicializando formulario...");

    try {
        // 1. Cargar datos necesarios
        await cargarDatosIniciales();

        // 2. Configurar event listeners
        configurarEventListenersFormularioVenta();

        // 3. Inicializar componentes (Select2, Flatpickr)
        inicializarComponentesExternosFormularioVenta();

        // 4. Disparar evento change del selector de estado
        $('#venta-estado').trigger('change');

        console.log("[Ventas] Formulario inicializado correctamente");

    } catch (error) {
        console.error('[Ventas] Error al inicializar formulario:', error);
        toastr.error('Error al inicializar formulario: ' + error.message);
    }
}

// ========================================
// CARGAR DATOS
// ========================================
/**
 * Carga todos los datos iniciales necesarios
 */
async function cargarDatosIniciales() {
    console.log("[Ventas] Cargando datos iniciales (cuentas bancarias)...");

    try {
        const client = getSupabaseClient();

        // Consultar cuentas bancarias activas
        const { data, error } = await client
            .from('cuentas_bancarias_empresa')
            .select('*')
            .eq('activa', true)
            .order('nombre_cuenta', { ascending: true });

        if (error) throw error;

        cuentasBancariasDisponibles = data || [];
        console.log('[Ventas] Cuentas bancarias cargadas:', cuentasBancariasDisponibles.length);

    } catch (error) {
        console.error("[Ventas] Error al cargar cuentas bancarias:", error);
        toastr.error('Error al cargar cuentas bancarias. Recarga la página.');
        cuentasBancariasDisponibles = [];
    }
}

/**
 * Carga los datos de una venta para editarla
 */
async function cargarDatosVentaParaEditar(idVenta) {
    try {
        console.log('[Ventas] Cargando datos de venta para editar:', idVenta);

        const client = getSupabaseClient();
        const { data, error } = await client.rpc('fn_obtener_venta_detalle', {
            p_id_venta: idVenta
        });

        if (error) throw error;
        if (!data) throw new Error('No se encontraron datos de la venta');

        console.log('[Ventas] Datos de venta recibidos:', data);

        // Poblar formulario
        await poblarFormularioVenta(data);

    } catch (error) {
        console.error('[Ventas] Error al cargar datos:', error);
        toastr.error('Error al cargar datos de la venta: ' + error.message);
        cargarPaginaVentas();
    }
}

/**
 * Pobla el formulario con los datos de una venta existente
 */
async function poblarFormularioVenta(datos) {
    console.log('[Ventas] Poblando formulario con datos...');

    // Cliente
    if (datos.clientes) {
        const nombreCliente = datos.clientes.razon_social ||
            `${datos.clientes.nombres} ${datos.clientes.apellidos}`.trim();
        const option = new Option(nombreCliente, datos.clientes.id, true, true);
        $('#select-cliente').append(option).trigger('change');

        // Esto disparará la carga de datos del cliente
        setTimeout(async () => {
            const response = await obtenerDetallesClienteSupabase(datos.clientes.id);
            renderizarDatosClienteEnFormularioVenta(response);
        }, 500);
    }

    // Fecha
    if (flatpickrInstance) {
        flatpickrInstance.setDate(moment(datos.fecha_venta).toDate());
    }

    // Estado
    $('#venta-estado').val(datos.estado).trigger('change');

    // Tipo de envío
    $('#venta-tipo-envio').val(datos.tipo_envio || 'Recogen').trigger('change');

    // Dirección de entrega
    if (datos.id_direccion_entrega) {
        setTimeout(() => {
            $('#venta-direccion').val(datos.id_direccion_entrega);
        }, 1000);
    }

    // Costo de envío
    $('#venta-costo-envio').val(datos.costo_envio || 0);

    // Observaciones
    $('#venta-observaciones').val(datos.observaciones || '');

    // Detalles (productos)
    if (datos.detalles_venta && datos.detalles_venta.length > 0) {
        $('#carrito-tbody').find('.empty-cart-row').remove();

        for (const detalle of datos.detalles_venta) {
            const productoData = {
                id_producto: detalle.id_producto,
                nombre_producto: detalle.productos?.nombre_producto || 'Producto',
                sku: detalle.productos?.sku || 'N/A',
                precio_venta_actual: detalle.precio_unitario_venta,
                costo_promedio: detalle.costo_unitario_venta || 0,
                id_tipo_impuesto: detalle.id_tipo_impuesto,
                porcentaje_impuesto: detalle.porcentaje_impuesto || 0
            };

            agregarProductoAlCarrito(productoData, detalle.cantidad);

            // Actualizar valores específicos
            const fila = $(`#carrito-tbody tr[data-id-producto="${detalle.id_producto}"]`);
            fila.find('.input-descuento').val(detalle.porcentaje_descuento || 0);
        }

        actualizarResumenGeneral();
    }

    // Pagos (si existen)
    if (datos.pagos_venta && datos.pagos_venta.length > 0) {
        $('#payments-container').empty();
        datos.pagos_venta.forEach(pago => {
            agregarFilaDePago(pago.monto, pago.metodo_pago, pago.id_cuenta_bancaria_destino);
        });
    }

    console.log('[Ventas] Formulario poblado correctamente');
}

// ========================================
// EVENT LISTENERS
// ========================================
function configurarEventListenersFormularioVenta() {
    console.log('[Ventas] Configurando event listeners del formulario...');

    // Botón Guardar
    const btnGuardar = document.getElementById('btn-guardar-venta');
    if (btnGuardar) {
        btnGuardar.addEventListener('click', guardarVenta);
    }

    // Botón Cancelar
    const btnCancelar = document.getElementById('btn-cancelar-venta');
    if (btnCancelar) {
        btnCancelar.addEventListener('click', () => {
            mostrarModalConfirmacion(
                'Se perderán todos los datos no guardados de esta venta.',
                () => { cargarPaginaVentas(); },
                '¿Cancelar operación?'
            );
        });
    }

    // Listener para Select2 de Cliente
    $('#select-cliente').on('select2:select', async function(e) {
        const clienteId = e.params.data.id;

        // Resetear campos
        resetearCamposDeVenta();

        const infoCard = document.getElementById('cliente-info-card');

        if (clienteId && clienteId !== 'mostrador') {
            infoCard.style.display = 'block';
            infoCard.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando datos del cliente...';

            const response = await obtenerDetallesClienteSupabase(clienteId);
            renderizarDatosClienteEnFormularioVenta(response);
        } else {
            infoCard.style.display = 'none';
            infoCard.innerHTML = '';
            $('#direccion-container').hide();
            $('#venta-direccion').empty().append('<option>Seleccione una dirección...</option>');
        }
    });

    $('#select-cliente').on('select2:clear', function() {
        resetearFormularioCompleto();
    });

    // Listener para tipo de envío
    $('#venta-tipo-envio').off('change').on('change', function() {
        const esDomicilio = this.value === 'Domicilio';
        const direccionContainer = $('#direccion-container');
        const costoEnvioContainer = $('#costo-envio-container');

        costoEnvioContainer.toggle(esDomicilio);

        if (esDomicilio) {
            const idCliente = $('#select-cliente').val();
            if (!idCliente || idCliente === 'mostrador') {
                toastr.warning("Por favor, selecciona un cliente válido primero.");
                $(this).val('Recogen');
                costoEnvioContainer.hide();
                return;
            }
            direccionContainer.show();
        } else {
            direccionContainer.hide();
            $('#venta-costo-envio').val(0).trigger('input');
            $('#venta-direccion').val(null);
        }
    });

    // Listener para estado de venta
    $('#venta-estado').on('change', function() {
        const esCompletado = (this.value === 'Completado');
        const paymentsContainer = $('#payments-container');

        $('#seccion-pagos').css('display', esCompletado ? 'block' : 'none');

        if (esCompletado && paymentsContainer.children().length === 0) {
            agregarFilaDePago();
        }

        let textoBoton = 'Guardar Venta';
        if (this.value === 'Borrador') {
            textoBoton = 'Guardar Borrador';
        } else if (esCompletado) {
            textoBoton = 'Finalizar y Guardar Venta';
        }
        $('#btn-guardar-venta').text(textoBoton);
    });

    // Listener para costo de envío
    $('#venta-costo-envio').on('input', function() {
        console.log('Costo de envío ha cambiado, recalculando totales...');
        actualizarResumenGeneral();
    });

    // Listener para búsqueda de productos
    $('#buscar-producto').on('keyup', buscarYRenderizarProductos);

    // Listener para hacer clic en un resultado
    $('#product-search-results').on('click', '.result-item', function() {
        const productoData = $(this).data('producto');
        if (productoData) {
            agregarProductoAlCarrito(productoData);
        }
    });

    // Listener para las interacciones dentro del carrito
    $('#carrito-tbody').on('click input', function(event) {
        const target = $(event.target);

        if (target.closest('.delete-item-btn').length) {
            target.closest('tr').remove();
            if ($('#carrito-tbody tr').not('.empty-cart-row').length === 0) {
                $('#carrito-tbody').html('<tr class="empty-cart-row"><td colspan="7">Aún no has agregado productos.</td></tr>');
            }
            actualizarResumenGeneral();
        }

        if (target.is('.input-cantidad, .input-precio, .input-descuento, .input-impuesto')) {
            actualizarResumenGeneral();
        }
    });

    // Auto-seleccionar texto al hacer foco
    $('#carrito-tbody').on('focus', 'input', function() {
        $(this).select();
    });

    // Configurar listeners de pagos
    configurarListenersDePagos();

    console.log('[Ventas] Event listeners configurados');
}

/**
 * Configura todos los listeners relacionados con la sección de pagos
 */
function configurarListenersDePagos() {
    console.log("Configurando listeners para la sección de Pagos...");

    const paymentsContainer = $('#payments-container');
    const btnAgregarPago = $('#btn-agregar-pago');

    // Listener delegado para las filas de pago
    if (paymentsContainer.length > 0) {
        paymentsContainer.on('input click change', function(event) {
            const target = $(event.target);

            // Caso A: Cambio en monto de pago
            if (event.type === 'input' && target.hasClass('payment-amount-input')) {
                console.log('Monto de pago modificado. Recalculando...');
                target.attr('data-edited', 'true');

                const totalVenta = parseFloat($('#summary-total').text().replace(/[^0-9]+/g, "")) || 0;
                let totalPagadoActual = 0;
                paymentsContainer.find('.payment-amount-input').each(function() {
                    totalPagadoActual += parseFloat($(this).val()) || 0;
                });

                if (totalPagadoActual > totalVenta) {
                    const excedente = totalPagadoActual - totalVenta;
                    const valorActualInput = parseFloat(target.val()) || 0;
                    target.val(valorActualInput - excedente);
                    toastr.warning('El monto pagado no puede exceder el total de la venta.', 'Monto Ajustado');
                }

                actualizarResumenDePagos();
            }

            // Caso B: Eliminar pago
            else if (event.type === 'click' && target.closest('.delete-payment-btn').length) {
                console.log('Eliminando fila de pago y recalculando...');
                target.closest('.payment-row').remove();
                actualizarResumenDePagos();
            }

            // Caso C: Cambio de método de pago
            else if (event.type === 'change' && target.hasClass('metodo-pago-select')) {
                console.log('Método de pago cambiado a:', target.val());
                const filaActual = target.closest('.payment-row');
                const contenedorCuenta = filaActual.find('.cuenta-destino-container');
                const metodosConCuenta = ['Transferencia'];

                if (metodosConCuenta.includes(target.val())) {
                    if (cuentasBancariasDisponibles.length > 0) {
                        contenedorCuenta.show();
                    } else {
                        toastr.warning('No hay cuentas bancarias configuradas para recibir este tipo de pago.');
                        target.val('Efectivo');
                    }
                } else {
                    contenedorCuenta.hide();
                }
            }
        });
    }

    // Listener para agregar otro pago
    if (btnAgregarPago.length > 0) {
        btnAgregarPago.on('click', function() {
            console.log("Botón 'Agregar otro pago' presionado.");
            agregarFilaDePago();
        });
    }
}

// ========================================
// INICIALIZACIÓN DE COMPONENTES
// ========================================
function inicializarComponentesExternosFormularioVenta() {
    console.log('[Ventas] Inicializando componentes externos...');

    // Flatpickr para fecha
    if (typeof flatpickr !== 'undefined') {
        flatpickrInstance = flatpickr("#venta-fecha", {
            locale: "es",
            enableTime: false,
            dateFormat: "Y-m-d",
            altInput: true,
            altFormat: "d/m/Y",
            defaultDate: "today"
        });
    }

    // Select2 para Clientes
    if (typeof $.fn.select2 !== 'undefined') {
        $('#select-cliente').select2({
            placeholder: 'Busque un cliente (mínimo 3 letras)...',
            allowClear: true,
            minimumInputLength: 3,
            language: {
                inputTooShort: function() {
                    return 'Por favor, escribe 3 o más caracteres para buscar...';
                },
                searching: function() {
                    return 'Buscando clientes...';
                },
                noResults: function() {
                    return 'No se encontraron clientes';
                }
            },
            ajax: {
                delay: 350,
                transport: async function(params, success, failure) {
                    try {
                        const termino = params.data.term || "";
                        console.log(`[Ventas] Buscando clientes con término: "${termino}"`);

                        const client = getSupabaseClient();

                        const { data, error } = await client
                            .from('clientes')
                            .select('id, codigo_cliente, nombres, apellidos, razon_social')
                            .or(`nombres.ilike.%${termino}%,apellidos.ilike.%${termino}%,razon_social.ilike.%${termino}%,codigo_cliente.ilike.%${termino}%`)
                            .eq('estado', 'Activo')
                            .order('nombres', { ascending: true })
                            .limit(20);

                        if (error) {
                            console.error('[Ventas] Error al buscar clientes:', error);
                            failure();
                            return;
                        }

                        const resultados = (data || []).map(cliente => ({
                            id: cliente.id,
                            text: cliente.razon_social || `${cliente.nombres} ${cliente.apellidos}`.trim(),
                            codigo: cliente.codigo_cliente
                        }));

                        console.log('[Ventas] Clientes encontrados:', resultados.length);
                        success({ results: resultados });

                    } catch (error) {
                        console.error('[Ventas] Error en búsqueda de clientes:', error);
                        failure();
                    }
                    return { abort: () => {} };
                }
            }
        });

        // Auto-focus en Select2
        $('#select-cliente').on('select2:open', function() {
            setTimeout(() => {
                const searchField = document.querySelector('.select2-search__field');
                if (searchField) searchField.focus();
            }, 100);
        });
    }

    console.log('[Ventas] Componentes externos inicializados');
}

// ========================================
// GESTIÓN DE CLIENTE
// ========================================
/**
 * Obtiene los detalles de un cliente usando Supabase
 */
async function obtenerDetallesClienteSupabase(clienteId) {
    try {
        console.log('[Ventas] Obteniendo detalles del cliente:', clienteId);

        const client = getSupabaseClient();

        const { data: cliente, error } = await client
            .from('clientes')
            .select(`
                *,
                direcciones_cliente(
                    id,
                    nombre_referencia_direccion,
                    direccion_completa,
                    barrio,
                    ciudad_municipio,
                    departamento_estado,
                    indicaciones_adicionales,
                    es_direccion_envio_predeterminada
                )
            `)
            .eq('id', clienteId)
            .single();

        if (error) {
            console.error('[Ventas] Error al obtener cliente:', error);
            return {
                exito: false,
                mensaje: 'No se pudo cargar la información del cliente'
            };
        }

        console.log('[Ventas] Cliente obtenido:', cliente);

        return {
            exito: true,
            datos: cliente
        };

    } catch (error) {
        console.error('[Ventas] Error en obtenerDetallesClienteSupabase:', error);
        return {
            exito: false,
            mensaje: 'Error al cargar los datos del cliente'
        };
    }
}

/**
 * Renderiza los datos del cliente en la tarjeta de información
 */
function renderizarDatosClienteEnFormularioVenta(response) {
    const infoCard = document.getElementById('cliente-info-card');

    if (!response.exito) {
        infoCard.innerHTML = `<p class="text-danger">${response.mensaje}</p>`;
        return;
    }

    const cliente = response.datos;
    const nombreCompleto = cliente.razon_social || `${cliente.nombres || ''} ${cliente.apellidos || ''}`.trim();

    const infoCardHtml = `
        <div class="info-grid">
            <div class="info-item"><strong>Cliente:</strong><span>${nombreCompleto}</span></div>
            <div class="info-item"><strong>Código:</strong><span>${cliente.codigo_cliente || 'N/A'}</span></div>
            <div class="info-item"><strong>Saldo:</strong><span class="text-danger">${formatearMoneda(cliente.saldo_pendiente || 0)}</span></div>
            <div class="info-item"><strong>Celular:</strong><span>${cliente.telefono_principal || 'N/A'}</span></div>
            ${cliente.notas_internas ? `
                <div class="info-item-full">
                    <strong>Notas sobre el cliente:</strong>
                    <span>${cliente.notas_internas}</span>
                </div>
            ` : ''}
        </div>
    `;
    infoCard.innerHTML = infoCardHtml;

    // Poblar direcciones
    const selectDireccion = $('#venta-direccion');
    selectDireccion.empty().append('<option value="">Seleccione una dirección...</option>');

    console.log('[Ventas] Renderizando direcciones. Total:', cliente.direcciones_cliente?.length || 0);

    if (cliente.direcciones_cliente && cliente.direcciones_cliente.length > 0) {
        let idDireccionPredeterminada = null;

        cliente.direcciones_cliente.forEach(dir => {
            const textoOpcion = `${dir.nombre_referencia_direccion || 'Dirección'}: ${dir.direccion_completa}, ${dir.barrio || ''} (${dir.ciudad_municipio})`;
            const opcion = new Option(textoOpcion, dir.id);
            selectDireccion.append(opcion);

            if (dir.es_direccion_envio_predeterminada) {
                idDireccionPredeterminada = dir.id;
            }
        });

        if (idDireccionPredeterminada) {
            selectDireccion.val(idDireccionPredeterminada).trigger('change');
        }
    } else {
        selectDireccion.append('<option value="" disabled>Este cliente no tiene direcciones registradas.</option>');
    }
}

// ========================================
// BÚSQUEDA DE PRODUCTOS
// ========================================
/**
 * Función de debounce para búsqueda
 */
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

/**
 * Busca y renderiza productos
 */
const buscarYRenderizarProductos = debounce(async function() {
    console.log('[Ventas] Iniciando búsqueda de productos...');
    const termino = $('#buscar-producto').val();
    const resultsContainer = $('#product-search-results');

    if (termino.length < 3) {
        resultsContainer.hide().empty();
        console.log('[Ventas] Término muy corto, búsqueda cancelada.');
        return;
    }

    resultsContainer.show().html('<div class="result-item">Buscando...</div>');

    try {
        const client = getSupabaseClient();

        const { data: productos, error } = await client
            .from('productos')
            .select(`
                id_producto,
                nombre_producto,
                sku,
                stock_actual,
                precio_venta_actual,
                costo_promedio,
                id_tipo_impuesto,
                tipos_impuesto(porcentaje)
            `)
            .or(`nombre_producto.ilike.%${termino}%,sku.ilike.%${termino}%`)
            .eq('activo', true)
            .order('nombre_producto', { ascending: true })
            .limit(20);

        console.log('[Ventas] Productos encontrados:', productos);

        if (error) {
            console.error('[Ventas] Error al buscar productos:', error);
            resultsContainer.html('<div class="result-item">Error al buscar productos.</div>');
            return;
        }

        resultsContainer.empty();

        if (productos && productos.length > 0) {
            productos.forEach(producto => {
                const productoDataString = JSON.stringify(producto).replace(/'/g, "&apos;");
                const itemHtml = `
                    <div class='result-item' data-producto='${productoDataString}'>
                        <div class="product-name">${producto.nombre_producto}</div>
                        <div class="product-details">SKU: ${producto.sku} | Stock: ${producto.stock_actual || 0}</div>
                    </div>
                `;
                resultsContainer.append(itemHtml);
            });
        } else {
            resultsContainer.html('<div class="result-item">No se encontraron productos.</div>');
        }
    } catch (error) {
        console.error('[Ventas] Error en búsqueda de productos:', error);
        resultsContainer.html('<div class="result-item">Error al buscar productos.</div>');
    }
}, 350);

// ========================================
// GESTIÓN DEL CARRITO
// ========================================
/**
 * Agrega un producto al carrito
 */
function agregarProductoAlCarrito(producto, cantidadInicial = 1) {
    const carritoBody = $('#carrito-tbody');
    const idProducto = producto.id_producto;

    const filaExistente = carritoBody.find(`tr[data-id-producto="${idProducto}"]`);

    if (filaExistente.length > 0) {
        console.log("Producto ya existe, incrementando cantidad...");
        const inputCantidad = filaExistente.find('.input-cantidad');
        let cantidadActual = parseInt(inputCantidad.val()) || 0;
        inputCantidad.val(cantidadActual + 1);
        inputCantidad.trigger('input');
        inputCantidad.focus().select();
    } else {
        console.log("Producto nuevo, agregando al carrito...");
        carritoBody.find('.empty-cart-row').remove();

        const porcentajeImpuesto = producto.tipos_impuesto?.porcentaje || 0;
        const idTipoImpuesto = producto.id_tipo_impuesto || null;

        const nuevaFilaHtml = `
            <tr data-id-producto="${idProducto}" data-id-tipo-impuesto="${idTipoImpuesto || ''}" data-costo-unitario="${producto.costo_promedio || 0}">
                <td>${producto.nombre_producto}</td>
                <td><input type="number" class="form-input-table text-right input-cantidad" value="${cantidadInicial}" min="1"></td>
                <td><input type="number" class="form-input-table text-right input-precio" value="${producto.precio_venta_actual}" step="0.01" min="0"></td>
                <td><input type="number" class="form-input-table text-right input-descuento" value="0" min="0" max="100" step="0.01"></td>
                <td><input type="number" class="form-input-table text-right input-impuesto" value="${porcentajeImpuesto}" min="0" max="100" step="0.01"></td>
                <td class="text-right total-linea">$0.00</td>
                <td class="text-center">
                    <button class="button-icon-danger delete-item-btn"><i class="fas fa-trash-alt"></i></button>
                </td>
            </tr>
        `;
        carritoBody.prepend(nuevaFilaHtml);

        const nuevaFila = carritoBody.find(`tr[data-id-producto="${idProducto}"]`);
        const inputCantidadNuevo = nuevaFila.find('.input-cantidad');
        inputCantidadNuevo.focus().select();
    }

    $('#product-search-results').hide().empty();
    $('#buscar-producto').val('');

    actualizarResumenGeneral();
}

// ========================================
// CÁLCULO DE TOTALES (SIN DESCUENTO GLOBAL)
// ========================================
/**
 * Calcula todos los totales de la venta y actualiza la UI
 * IMPORTANTE: NO incluye descuento global, solo descuentos por línea
 */
function actualizarResumenGeneral() {
    console.log("Recalculando todos los totales...");
    const carritoBody = $('#carrito-tbody');
    let subtotalGeneral = 0;
    let impuestosGeneral = 0;
    let cantidadTotal = 0;
    let descuentosLineas = 0;

    // Recorremos el carrito para calcular totales de productos
    carritoBody.find('tr').not('.empty-cart-row').each(function() {
        const fila = $(this);
        const cantidad = parseFloat(fila.find('.input-cantidad').val()) || 0;
        const precioUnitario = parseFloat(fila.find('.input-precio').val()) || 0;
        const porcentajeDescuento = parseFloat(fila.find('.input-descuento').val()) || 0;
        const porcentajeImpuesto = parseFloat(fila.find('.input-impuesto').val()) || 0;

        // Cálculos:
        // 1. Subtotal línea = Precio × Cantidad
        const subtotalLinea = cantidad * precioUnitario;

        // 2. Descuento línea = Subtotal × % descuento ÷ 100
        const montoDescuentoLinea = Math.round((subtotalLinea * porcentajeDescuento / 100) * 100) / 100;

        // 3. Base gravable = Subtotal - Descuento
        const baseGravable = subtotalLinea - montoDescuentoLinea;

        // 4. Impuesto línea = Base gravable × % impuesto ÷ 100
        const montoImpuestoLinea = Math.round((baseGravable * porcentajeImpuesto / 100) * 100) / 100;

        // 5. Total línea = Base gravable + Impuesto
        const totalLinea = baseGravable + montoImpuestoLinea;

        // Actualizar UI de la línea
        fila.find('.total-linea').text(formatearMoneda(totalLinea));

        // Acumular totales generales
        subtotalGeneral += subtotalLinea;
        impuestosGeneral += montoImpuestoLinea;
        cantidadTotal += cantidad;
        descuentosLineas += montoDescuentoLinea;
    });

    // Obtener costo de envío
    const costoEnvio = parseFloat($('#venta-costo-envio').val()) || 0;

    // Calcular gran total
    // TOTAL = Subtotal - Descuentos por línea + Impuestos + Envío
    const granTotal = subtotalGeneral - descuentosLineas + impuestosGeneral + costoEnvio;

    // Guardar en objeto global
    totalesVentaActual = {
        subtotal: subtotalGeneral,
        cantidad: cantidadTotal,
        envio: costoEnvio,
        impuestos: impuestosGeneral,
        descuento: descuentosLineas, // Solo descuentos por línea
        total: granTotal
    };

    // Actualizar interfaz visual
    $('#summary-subtotal').text(formatearMoneda(totalesVentaActual.subtotal));
    $('#summary-cantidad').text(totalesVentaActual.cantidad);
    $('#summary-descuento').text('-' + formatearMoneda(totalesVentaActual.descuento));
    $('#summary-envio').text(formatearMoneda(totalesVentaActual.envio));
    $('#summary-impuestos').text(formatearMoneda(totalesVentaActual.impuestos));
    $('#summary-total').text(formatearMoneda(totalesVentaActual.total));

    // Actualizar resumen de pagos
    actualizarResumenDePagos();
}

// ========================================
// GESTIÓN DE PAGOS
// ========================================
/**
 * Agrega una nueva fila de pago
 */
function agregarFilaDePago(montoInicial = 0, metodoPago = 'Efectivo', idCuentaBancaria = null) {
    console.log("Añadiendo una nueva fila de pago...");

    const paymentsContainer = document.getElementById('payments-container');

    // Si no se especifica monto y es la primera fila, auto-rellenar con el total
    if (montoInicial === 0 && paymentsContainer.childElementCount === 0) {
        console.log("Es la primera fila de pago. Auto-rellenando el total.");
        const totalVentaSpan = document.getElementById('summary-total');
        montoInicial = parseFloat(totalVentaSpan.textContent.replace(/[^0-9]+/g, "")) || 0;
    }

    const paymentRow = document.createElement('div');
    paymentRow.className = 'payment-row';

    let opcionesDeCuentas = '<option value="">Seleccione Cuenta...</option>';
    cuentasBancariasDisponibles.forEach(cuenta => {
        const selected = cuenta.id === idCuentaBancaria ? 'selected' : '';
        opcionesDeCuentas += `<option value="${cuenta.id}" ${selected}>${cuenta.nombre_cuenta}</option>`;
    });

    const mostrarCuenta = metodoPago === 'Transferencia' ? 'block' : 'none';

    paymentRow.innerHTML = `
        <select class="form-input-select metodo-pago-select">
            <option value="Efectivo" ${metodoPago === 'Efectivo' ? 'selected' : ''}>Efectivo</option>
            <option value="Transferencia" ${metodoPago === 'Transferencia' ? 'selected' : ''}>Transferencia</option>
            <option value="Tarjeta" ${metodoPago === 'Tarjeta' ? 'selected' : ''}>Tarjeta</option>
        </select>
        <div class="cuenta-destino-container" style="display:${mostrarCuenta};">
             <select class="form-input-select cuenta-destino-select">${opcionesDeCuentas}</select>
        </div>
        <input type="number" class="form-input text-right payment-amount-input" value="${montoInicial}" placeholder="0.00" data-edited="false">
        <button class="button-icon-danger delete-payment-btn" title="Eliminar este pago">
            <i class="fas fa-trash-alt"></i>
        </button>
    `;

    if (paymentsContainer.childElementCount === 0) {
        const montoInput = paymentRow.querySelector('.payment-amount-input');
        if (montoInput) {
            montoInput.setAttribute('data-edited', 'false');
        }
    }

    paymentsContainer.appendChild(paymentRow);
    actualizarResumenDePagos();
}

/**
 * Actualiza el resumen de pagos
 */
function actualizarResumenDePagos() {
    console.log("Actualizando resumen de pagos...");
    const paymentsContainer = $('#payments-container');
    const totalVentaSpan = $('#summary-total');
    const totalPagadoSpan = $('#summary-pagado');
    const saldoSpan = $('#summary-saldo');
    const btnAgregarPago = $('#btn-agregar-pago');

    const filasDePago = paymentsContainer.find('.payment-row');
    const totalVenta = parseFloat(totalVentaSpan.text().replace(/[^0-9]+/g, "")) || 0;

    // Auto-actualizar primera fila si no ha sido editada
    if (filasDePago.length === 1) {
        const unicoInputMonto = filasDePago.find('.payment-amount-input');

        if (unicoInputMonto.attr('data-edited') === 'false') {
            console.log("Auto-actualizando el monto del pago único para que coincida con el total de la venta.");
            unicoInputMonto.val(totalVenta);
        }
    }

    let totalPagado = 0;
    paymentsContainer.find('.payment-amount-input').each(function() {
        totalPagado += parseFloat($(this).val()) || 0;
    });

    let saldoPendiente = totalVenta - totalPagado;
    if (saldoPendiente < 0) {
        saldoPendiente = 0;
    }

    totalPagadoSpan.text(formatearMoneda(totalPagado));
    saldoSpan.text(formatearMoneda(saldoPendiente));

    if (saldoPendiente > 0) {
        saldoSpan.removeClass('saldo-cero').addClass('saldo-positivo');
    } else {
        saldoSpan.removeClass('saldo-positivo').addClass('saldo-cero');
    }

    if (saldoPendiente <= 0) {
        console.log("Saldo es cero o menos. Deshabilitando botón de agregar pago.");
        btnAgregarPago.prop('disabled', true);
    } else {
        console.log("Aún hay saldo pendiente. Habilitando botón de agregar pago.");
        btnAgregarPago.prop('disabled', false);
    }
}

// ========================================
// VALIDACIÓN Y GUARDADO
// ========================================
/**
 * Valida los campos del formulario antes de guardar
 */
function validarFormularioVenta() {
    if (!$('#select-cliente').val()) {
        toastr.error("Debe seleccionar un cliente.");
        return false;
    }
    if (!$('#venta-estado').val()) {
        toastr.error("Debe seleccionar un estado para la venta.");
        return false;
    }
    if (!$('#venta-tipo-envio').val()) {
        toastr.error("Debe seleccionar un tipo de entrega.");
        return false;
    }
    if ($('#venta-tipo-envio').val() === 'Domicilio') {
        if (!$('#venta-direccion').val() || $('#venta-direccion').val() === 'Seleccione una dirección...') {
            toastr.error("Debe seleccionar una dirección de envío para entregas a domicilio.");
            return false;
        }
    }
    if ($('#carrito-tbody .empty-cart-row').length > 0 || $('#carrito-tbody tr').not('.empty-cart-row').length === 0) {
        toastr.error("Debe agregar al menos un producto a la venta.");
        return false;
    }
    return true;
}

/**
 * Recopila todos los datos del formulario
 */
function recopilarDatosDelFormulario() {
    const flatpickrInstanceLocal = document.getElementById('venta-fecha')._flatpickr;
    const fechaSeleccionada = flatpickrInstanceLocal.selectedDates[0] || new Date();
    const idDireccionSeleccionada = $('#venta-direccion').val();

    // Recopilar productos del carrito
    const productos = [];
    $('#carrito-tbody tr').each(function() {
        const fila = $(this);
        if (fila.hasClass('empty-cart-row')) return;

        const idTipoImpuesto = fila.data('id-tipo-impuesto');
        const costoUnitario = parseFloat(fila.data('costo-unitario')) || 0;

        productos.push({
            id_producto: fila.data('id-producto'),
            cantidad: parseFloat(fila.find('.input-cantidad').val()) || 0,
            precio_unitario_venta: parseFloat(fila.find('.input-precio').val()) || 0,
            costo_unitario_venta: costoUnitario,
            porcentaje_descuento: parseFloat(fila.find('.input-descuento').val()) || 0,
            id_tipo_impuesto: idTipoImpuesto || null,
            porcentaje_impuesto: parseFloat(fila.find('.input-impuesto').val()) || 0
        });
    });

    // Recopilación de pagos
    const pagos = [];
    $('#payments-container .payment-row').each(function() {
        const fila = $(this);
        const montoPago = parseFloat(fila.find('.payment-amount-input').val()) || 0;

        if (montoPago > 0) {
            pagos.push({
                monto: montoPago,
                metodo_pago: fila.find('.metodo-pago-select').val(),
                id_cuenta_bancaria_destino: fila.find('.cuenta-destino-select').val() || null,
                fecha_pago_in: fechaSeleccionada.toISOString()
            });
        }
    });

    // Construir objeto principal (SIN descuento global)
    const datosVenta = {
        id_cliente: $('#select-cliente').val() || null,
        fecha_venta: fechaSeleccionada.toISOString(),
        estado: $('#venta-estado').val(),
        tipo_envio: $('#venta-tipo-envio').val() || null,
        id_direccion_entrega: (idDireccionSeleccionada && idDireccionSeleccionada !== "" && idDireccionSeleccionada !== "Seleccione una dirección...") ? idDireccionSeleccionada : null,
        costo_envio: parseFloat($('#venta-costo-envio').val()) || 0,
        observaciones: $('#venta-observaciones').val(),
        monto_subtotal: totalesVentaActual.subtotal,
        impuestos: totalesVentaActual.impuestos,
        monto_total: totalesVentaActual.total,
        productos: productos,
        pagos: pagos
    };

    console.log("Datos de venta finales listos para enviar:", datosVenta);
    return datosVenta;
}

/**
 * Guarda la venta (crear o actualizar)
 */
async function guardarVenta(event) {
    event.preventDefault();

    if (!validarFormularioVenta()) {
        return;
    }

    const botonGuardar = $(event.currentTarget);
    botonGuardar.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> Guardando...');

    try {
        const client = getSupabaseClient();
        const datosParaGuardar = recopilarDatosDelFormulario();

        if (modoEdicionVentas.activo) {
            // MODO EDICIÓN
            console.log(`[Ventas] Modo Edición para Venta ID: ${modoEdicionVentas.idVenta}`);

            const { data, error } = await client.rpc('fn_actualizar_venta_completa', {
                p_id_venta: modoEdicionVentas.idVenta,
                p_venta: datosParaGuardar,
                p_detalles: datosParaGuardar.productos,
                p_pagos: datosParaGuardar.pagos || []
            });

            if (error) throw error;

            botonGuardar.prop('disabled', false).text('Finalizar y Guardar Venta');

            if (data && data.success) {
                toastr.success(`¡Venta ${data.codigo_venta} actualizada exitosamente!`, 'Éxito');
                setTimeout(() => cargarPaginaVentas(), 2000);
            } else {
                const mensaje = data?.mensaje || 'Error desconocido al actualizar la venta';
                toastr.error('Error al actualizar: ' + mensaje);
            }

        } else {
            // MODO CREACIÓN
            console.log("[Ventas] Modo Creación. Llamando a fn_crear_venta_completa...");

            const { data, error } = await client.rpc('fn_crear_venta_completa', {
                p_venta: {
                    id_cliente: datosParaGuardar.id_cliente,
                    fecha_venta: datosParaGuardar.fecha_venta,
                    estado: datosParaGuardar.estado,
                    tipo_envio: datosParaGuardar.tipo_envio,
                    id_direccion_entrega: datosParaGuardar.id_direccion_entrega,
                    monto_subtotal: datosParaGuardar.monto_subtotal,
                    impuestos: datosParaGuardar.impuestos,
                    costo_envio: datosParaGuardar.costo_envio,
                    monto_total: datosParaGuardar.monto_total,
                    observaciones: datosParaGuardar.observaciones
                },
                p_detalles: datosParaGuardar.productos,
                p_pagos: datosParaGuardar.pagos || []
            });

            if (error) throw error;

            botonGuardar.prop('disabled', false).text('Finalizar y Guardar Venta');

            if (data && data.success) {
                toastr.success(`¡Venta ${data.codigo_venta} creada exitosamente!`, 'Éxito');
                setTimeout(resetearFormularioCompleto, 2000);
            } else {
                const mensaje = data?.mensaje || 'Error desconocido al guardar la venta';
                toastr.error('Error al guardar: ' + mensaje);
            }
        }
    } catch (error) {
        console.error('[Ventas] Error en guardarVenta:', error);
        botonGuardar.prop('disabled', false).text('Finalizar y Guardar Venta');
        const mensaje = error?.message || error?.msg || 'Error de comunicación con el servidor';
        toastr.error(mensaje, 'Error de Comunicación');
    }
}

// ========================================
// UTILIDADES
// ========================================
/**
 * Resetea los campos de estado y tipo de envío
 */
function resetearCamposDeVenta() {
    console.log("Reseteando campos de Estado y Entrega...");
    $('#venta-estado').val("").trigger('change');
    $('#venta-tipo-envio').val("").trigger('change');
}

/**
 * Resetea todo el formulario a su estado inicial
 */
function resetearFormularioCompleto() {
    console.log("Ejecutando reseteo completo del formulario...");

    $('#select-cliente').val(null).trigger('change');
    $('#cliente-info-card').hide().html('');
    $('#venta-estado').val("");
    $('#venta-tipo-envio').val("");
    $('#direccion-container').hide();
    $('#costo-envio-container').hide();
    $('#seccion-pagos').hide();

    const filaVaciaHtml = '<tr class="empty-cart-row"><td colspan="7">Aún no has agregado productos.</td></tr>';
    $('#carrito-tbody').html(filaVaciaHtml);

    $('#payments-container').empty();
    $('#venta-observaciones').val('');
    $('#buscar-producto').val('');
    $('#venta-costo-envio').val(0);

    actualizarResumenGeneral();

    $('html, body').animate({ scrollTop: 0 }, 'slow');
    toastr.info("Formulario listo para una nueva venta.");
}

/**
 * Formatea un número como moneda
 */
function formatearMoneda(valor) {
    const numero = valor || 0;
    const numeroRedondeado = Math.round(numero);

    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(numeroRedondeado);
}

console.log('[Ventas Formulario] Módulo cargado correctamente');

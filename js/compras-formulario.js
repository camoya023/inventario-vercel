/**
 * =========================================================================
 * MÓDULO DE COMPRAS - FORMULARIO
 * Gestión de formulario para crear/editar compras
 * =========================================================================
 */

// ========================================
// VARIABLES GLOBALES
// ========================================
let compraActual = {
    proveedor: null,
    fecha: '',
    numero_factura: '',
    estado: 'Recibida',
    condicion_pago: 'Contado',
    detalles: [],
    subtotal: 0,
    impuestos: 0,
    total: 0,
    notas: ''
};

let modoEdicion = {
    activo: false,
    idCompra: null
};

let tiposImpuestoDisponibles = [];

// ========================================
// FUNCIÓN PRINCIPAL DE CARGA
// ========================================
/**
 * Carga la vista del formulario de compras
 * @param {string} modo - 'create' o 'edit'
 * @param {string} idCompra - UUID de la compra (solo para modo 'edit')
 */
async function cargarVistaFormularioCompra(modo = 'create', idCompra = null) {
    console.log('[Compras] Cargando formulario en modo:', modo);

    try {
        const workArea = document.querySelector('.work-area');
        if (!workArea) {
            throw new Error('No se encontró el área de trabajo');
        }

        // Mostrar indicador de carga
        workArea.innerHTML = '<div class="loading-spinner-container"><div class="loading-spinner"></div><p>Cargando formulario...</p></div>';

        // Cargar HTML del formulario
        const response = await fetch('/views/compras-formulario.html');
        if (!response.ok) throw new Error('Error al cargar la vista del formulario');

        const html = await response.text();
        workArea.innerHTML = html;

        // Configurar modo de edición
        if (modo === 'edit' && idCompra) {
            modoEdicion = { activo: true, idCompra: idCompra };
            document.getElementById('titulo-formulario-compra').textContent = 'Editar Compra';
        } else {
            modoEdicion = { activo: false, idCompra: null };
            document.getElementById('titulo-formulario-compra').textContent = 'Registrar Nueva Compra';
        }

        // Inicializar formulario
        await inicializarFormularioCompra();

        // Si es modo edición, cargar datos
        if (modoEdicion.activo) {
            await cargarDatosCompraParaEditar(idCompra);
        }

    } catch (error) {
        console.error('[Compras] Error al cargar formulario:', error);
        showNotification('Error al cargar formulario: ' + error.message, 'error');
    }
}

/**
 * Inicializa el formulario de compra
 */
async function inicializarFormularioCompra() {
    console.log("[Compras] Inicializando formulario...");

    try {
        // 1. Cargar tipos de impuesto
        await cargarTiposImpuesto();

        // 2. Configurar event listeners
        configurarEventListenersFormularioCompra();

        // 3. Inicializar componentes (Select2, Flatpickr)
        inicializarComponentesExternosFormularioCompra();

        // 4. Disparar evento change del selector de estado
        $('#compra-estado').trigger('change');

        // 5. Deshabilitar búsqueda de productos hasta seleccionar proveedor
        $('#compra-buscar-producto').prop('disabled', true);

        console.log("[Compras] Formulario inicializado correctamente");

    } catch (error) {
        console.error('[Compras] Error al inicializar formulario:', error);
        showNotification('Error al inicializar formulario: ' + error.message, 'error');
    }
}

// ========================================
// CARGAR DATOS
// ========================================
/**
 * Carga los tipos de impuesto disponibles
 */
async function cargarTiposImpuesto() {
    try {
        console.log("[Compras] Cargando tipos de impuesto...");
        const client = getSupabaseClient();

        const { data, error } = await client
            .from('tipos_impuesto')
            .select('id, nombre, porcentaje')
            .order('porcentaje', { ascending: false });

        if (error) throw error;

        tiposImpuestoDisponibles = data || [];
        console.log("[Compras] Tipos de impuesto cargados:", tiposImpuestoDisponibles.length);

    } catch (error) {
        console.error("[Compras] Error al cargar tipos de impuesto:", error);
        showNotification('Error al cargar tipos de impuesto. Recarga la página.', 'error');
        tiposImpuestoDisponibles = [];
    }
}

/**
 * Carga los datos de una compra para editarla
 */
async function cargarDatosCompraParaEditar(idCompra) {
    try {
        console.log('[Compras] Cargando datos de compra para editar:', idCompra);

        const client = getSupabaseClient();
        const { data, error } = await client.rpc('obtener_compra_con_detalles', {
            p_id_compra: idCompra
        });

        if (error) throw error;
        if (!data) throw new Error('No se encontraron datos de la compra');

        console.log('[Compras] Datos de compra recibidos:', data);

        // Poblar formulario
        await poblarFormularioCompra(data);

    } catch (error) {
        console.error('[Compras] Error al cargar datos:', error);
        showNotification('Error al cargar datos de la compra: ' + error.message, 'error');
        cargarPaginaCompras();
    }
}

/**
 * Pobla el formulario con los datos de una compra existente
 */
async function poblarFormularioCompra(datos) {
    console.log('[Compras] Poblando formulario con datos...');

    // Proveedor
    if (datos.proveedor) {
        const option = new Option(datos.proveedor.nombre_empresa, datos.proveedor.id, true, true);
        $('#compra-proveedor').append(option).trigger('change');
        compraActual.proveedor = { id: datos.proveedor.id, text: datos.proveedor.nombre_empresa };
        $('#compra-buscar-producto').prop('disabled', false);
    }

    // Fecha
    const fpInstance = document.querySelector("#compra-fecha")._flatpickr;
    if (fpInstance) {
        fpInstance.setDate(moment(datos.fecha_compra).toDate());
    }

    // Estado
    $('#compra-estado').val(datos.estado).trigger('change');

    // Número de factura
    $('#compra-numero-factura').val(datos.numero_factura || '');

    // Condición de pago
    $('#compra-condicion-pago').val(datos.condicion_pago);

    // Notas
    $('#compra-notas').val(datos.notas || '');

    // Detalles (productos)
    if (datos.detalles && datos.detalles.length > 0) {
        $('#fila-sin-productos').hide();

        for (const detalle of datos.detalles) {
            const productoData = {
                id: detalle.id_producto,
                text: `${detalle.nombre_producto} (SKU: ${detalle.sku || 'N/A'})`,
                precio_costo: detalle.precio_unitario_compra,
                id_tipo_impuesto: detalle.id_tipo_impuesto
            };

            agregarProductoAlDetalle(productoData);

            // Actualizar valores específicos
            const fila = $(`#fila-detalle-${detalle.id_producto}`);
            fila.find('.input-cantidad').val(detalle.cantidad);
            fila.find('.input-precio').val(detalle.precio_unitario_compra);
            fila.find('.input-descuento').val(detalle.descuento_pct || 0);

            if (detalle.id_tipo_impuesto) {
                fila.find('.select-impuesto').val(detalle.id_tipo_impuesto);
            }
        }

        recalcularTotalesCompra();
    }

    console.log('[Compras] Formulario poblado correctamente');
}

// ========================================
// EVENT LISTENERS
// ========================================
function configurarEventListenersFormularioCompra() {
    console.log('[Compras] Configurando event listeners del formulario...');

    // Botón Guardar
    const btnGuardar = document.getElementById('btn-guardar-compra');
    if (btnGuardar) {
        btnGuardar.addEventListener('click', guardarCompra);
    }

    // Botón Cancelar
    const btnCancelar = document.getElementById('btn-cancelar-compra');
    if (btnCancelar) {
        btnCancelar.addEventListener('click', () => {
            mostrarModalConfirmacion(
                'Se perderán todos los datos no guardados de esta compra.',
                () => { cargarPaginaCompras(); },
                '¿Cancelar operación?'
            );
        });
    }

    // Listener para el estado de la compra
    $('#compra-estado').on('change', function() {
        const estadoSeleccionado = $(this).val();
        const condicionPagoSelect = $('#compra-condicion-pago');

        if (estadoSeleccionado === 'Borrador') {
            condicionPagoSelect.prop('disabled', true);
        } else {
            condicionPagoSelect.prop('disabled', false);
        }
    });

    // Listener para Select2 de Proveedor
    $('#compra-proveedor').on('select2:select', function(e) {
        const nuevoProveedor = e.params.data;

        if (modoEdicion.activo && compraActual.proveedor && compraActual.proveedor.id !== nuevoProveedor.id) {
            mostrarModalConfirmacion(
                'Al cambiar el proveedor, la lista de productos actual se borrará. ¿Estás seguro?',
                () => {
                    compraActual.proveedor = { id: nuevoProveedor.id, text: nuevoProveedor.text };
                    $('#tbody-detalles-compra').empty().html('<tr id="fila-sin-productos"><td colspan="9" style="text-align:center;">Agrega productos del nuevo proveedor.</td></tr>');
                    recalcularTotalesCompra();
                    $('#compra-buscar-producto').prop('disabled', false);
                },
                '¿Cambiar de Proveedor?'
            );
        } else {
            compraActual.proveedor = { id: nuevoProveedor.id, text: nuevoProveedor.text };
            $('#compra-buscar-producto').prop('disabled', false);
        }
    });

    $('#compra-proveedor').on('select2:unselect', function() {
        $('#compra-buscar-producto').prop('disabled', true).val(null).trigger('change');
        $('#tbody-detalles-compra').empty().html('<tr id="fila-sin-productos"><td colspan="9" style="text-align:center;">Selecciona un proveedor para agregar productos.</td></tr>');
        recalcularTotalesCompra();
    });

    // Listener para Select2 de Productos
    $('#compra-buscar-producto').on('select2:select', function(e) {
        const productoSeleccionado = e.params.data;
        agregarProductoAlDetalle(productoSeleccionado);
        $(this).val(null).trigger('change');
    });

    // Listener para eliminar productos (delegación)
    $('#tbody-detalles-compra').on('click', '.btn-eliminar-detalle', function() {
        const productoId = $(this).data('product-id');
        eliminarProductoDelDetalle(productoId);
    });

    // Auto-seleccionar texto en inputs numéricos
    $('#tbody-detalles-compra').on('focus', 'input[type="number"]', function() {
        $(this).select();
    });

    console.log('[Compras] Event listeners configurados');
}

// ========================================
// INICIALIZACIÓN DE COMPONENTES
// ========================================
function inicializarComponentesExternosFormularioCompra() {
    console.log('[Compras] Inicializando componentes externos...');

    // Flatpickr para fecha
    if (typeof flatpickr !== 'undefined') {
        flatpickr("#compra-fecha", {
            defaultDate: "today",
            dateFormat: "d/m/Y",
            locale: "es"
        });
    }

    // Select2 para Proveedores
    if (typeof $.fn.select2 !== 'undefined') {
        $('#compra-proveedor').select2({
            placeholder: "Buscar proveedor (mínimo 3 letras)...",
            minimumInputLength: 3,
            allowClear: true,
            ajax: {
                delay: 400,
                transport: async function(params, success, failure) {
                    try {
                        const termino = params.data.term || '';

                        if (termino.length < 3) {
                            success({ results: [] });
                            return { abort: () => {} };
                        }

                        const client = getSupabaseClient();
                        const { data, error } = await client
                            .from('proveedores')
                            .select('id, nombre_empresa, codigo_proveedor')
                            .eq('activo', true)
                            .or(`nombre_empresa.ilike.%${termino}%,codigo_proveedor.ilike.%${termino}%`)
                            .order('nombre_empresa')
                            .limit(20);

                        if (error) throw error;

                        const results = (data || []).map(p => ({
                            id: p.id,
                            text: `${p.nombre_empresa} (${p.codigo_proveedor || 'S/C'})`
                        }));

                        success({ results });

                    } catch (error) {
                        console.error("[Compras] Error al buscar proveedores:", error);
                        failure(error);
                    }
                    return { abort: () => {} };
                }
            }
        });

        // Select2 para Productos (filtrado por proveedor)
        $('#compra-buscar-producto').select2({
            placeholder: "Buscar producto (mínimo 3 letras)...",
            minimumInputLength: 3,
            allowClear: true,
            templateResult: function(data) {
                if (data.loading) return data.text;
                if (!data.id) return data.text;

                const stockValue = data.stock_actual || 0;
                const bgColor = stockValue > 0 ? '#28a745' : '#dc3545';
                const stockText = stockValue;

                return $(`
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>${data.text.split(' - Stock:')[0]}</span>
                        <span style="background-color: ${bgColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; font-weight: 600; margin-left: 10px;">
                            Stock: ${stockText}
                        </span>
                    </div>
                `);
            },
            ajax: {
                delay: 400,
                transport: async function(params, success, failure) {
                    try {
                        const termino = params.data.term || '';
                        const proveedorId = compraActual.proveedor ? compraActual.proveedor.id : null;

                        if (!proveedorId) {
                            success({ results: [] });
                            return { abort: () => {} };
                        }

                        if (termino.length < 3) {
                            success({ results: [] });
                            return { abort: () => {} };
                        }

                        const client = getSupabaseClient();
                        const { data, error } = await client
                            .from('proveedores_productos')
                            .select(`
                                id_producto,
                                precio_costo,
                                productos:id_producto (
                                    id_producto,
                                    nombre_producto,
                                    sku,
                                    id_tipo_impuesto,
                                    stock_actual
                                )
                            `)
                            .eq('id_proveedor', proveedorId)
                            .limit(100);

                        if (error) throw error;

                        const terminoLower = termino.toLowerCase();
                        const results = (data || [])
                            .filter(pp => {
                                if (!pp.productos) return false;
                                const nombre = (pp.productos.nombre_producto || '').toLowerCase();
                                const sku = (pp.productos.sku || '').toLowerCase();
                                return nombre.includes(terminoLower) || sku.includes(terminoLower);
                            })
                            .slice(0, 20)
                            .map(pp => ({
                                id: pp.productos.id_producto,
                                text: `${pp.productos.nombre_producto} (SKU: ${pp.productos.sku || 'N/A'}) - Stock: ${pp.productos.stock_actual || 0}`,
                                precio_costo: pp.precio_costo,
                                id_tipo_impuesto: pp.productos.id_tipo_impuesto,
                                stock_actual: pp.productos.stock_actual || 0
                            }));

                        success({ results });

                    } catch (error) {
                        console.error("[Compras] Error al buscar productos:", error);
                        failure(error);
                    }
                    return { abort: () => {} };
                }
            }
        });

        // Auto-focus en Select2
        $('#compra-proveedor, #compra-buscar-producto').on('select2:open', function() {
            setTimeout(() => {
                const searchField = document.querySelector('.select2-search__field');
                if (searchField) searchField.focus();
            }, 100);
        });
    }

    console.log('[Compras] Componentes externos inicializados');
}

// ========================================
// GESTIÓN DE DETALLES
// ========================================
/**
 * Agrega un producto al detalle de la compra
 */
function agregarProductoAlDetalle(producto) {
    const inputExistente = $('#tbody-detalles-compra input.input-cantidad[data-product-id="' + producto.id + '"]');

    if (inputExistente.length > 0) {
        // Producto ya existe: incrementar cantidad
        const cantidadInput = inputExistente.first();
        let cantidadActual = parseFloat(cantidadInput.val()) || 0;
        cantidadInput.val(cantidadActual + 1);

        const filaExistente = cantidadInput.closest('tr');
        filaExistente.addClass('flash-update');
        setTimeout(() => filaExistente.removeClass('flash-update'), 700);

        cantidadInput.focus().select();
    } else {
        // Producto nuevo: agregar fila
        $('#fila-sin-productos').hide();

        // Determinar tipo de impuesto
        let tipoImpuestoSeleccionado = null;
        if (producto.id_tipo_impuesto && producto.id_tipo_impuesto !== null) {
            tipoImpuestoSeleccionado = producto.id_tipo_impuesto;
        } else {
            const excluido = tiposImpuestoDisponibles.find(ti =>
                ti.nombre.toLowerCase().includes('exclu') ||
                ti.nombre.toLowerCase().includes('exento') ||
                ti.porcentaje === 0
            );
            tipoImpuestoSeleccionado = excluido ? excluido.id : (tiposImpuestoDisponibles[0]?.id || null);
        }

        // Generar opciones del select de impuestos
        const opcionesSorted = [...tiposImpuestoDisponibles].sort((a, b) => {
            if (a.porcentaje === 0) return -1;
            if (b.porcentaje === 0) return 1;
            return b.porcentaje - a.porcentaje;
        });

        const opcionesImpuesto = opcionesSorted.map(ti =>
            `<option value="${ti.id}" data-porcentaje="${ti.porcentaje}" ${ti.id === tipoImpuestoSeleccionado ? 'selected' : ''}>
                ${ti.nombre} (${ti.porcentaje}%)
            </option>`
        ).join('');

        const filaHTML = `
            <tr id="fila-detalle-${producto.id}">
                <td>${producto.text}</td>
                <td>
                    <input type="number" class="form-input input-cantidad" value="1" min="1" step="1"
                           data-product-id="${producto.id}"
                           oninput="recalcularTotalesCompra()"
                           style="text-align: center; width: 75px; box-sizing: border-box; padding: 4px;">
                </td>
                <td>
                    <input type="number" class="form-input input-precio" value="${producto.precio_costo || 0}" step="any" min="0"
                           data-product-id="${producto.id}"
                           oninput="recalcularTotalesCompra()"
                           style="width: 100px; box-sizing: border-box; padding: 4px;">
                </td>
                <td>
                    <input type="number" class="form-input input-descuento" value="0" min="0" max="100" step="0.01"
                           data-product-id="${producto.id}"
                           oninput="recalcularTotalesCompra()"
                           placeholder="0"
                           style="text-align: center; width: 80px; box-sizing: border-box; padding: 4px;">
                </td>
                <td>
                    <select class="form-input-select select-impuesto" data-product-id="${producto.id}"
                            onchange="recalcularTotalesCompra()" style="width: 135px; padding: 4px;">
                        ${opcionesImpuesto}
                    </select>
                </td>
                <td class="text-right celda-base-gravable" data-product-id="${producto.id}">$ 0</td>
                <td class="text-right celda-monto-impuesto" data-product-id="${producto.id}">$ 0</td>
                <td class="text-right celda-total-linea" data-product-id="${producto.id}">$ 0</td>
                <td class="text-center">
                    <button type="button" class="button-icon button-icon-danger btn-eliminar-detalle"
                            data-product-id="${producto.id}" title="Eliminar">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;

        $('#tbody-detalles-compra').prepend(filaHTML);

        const nuevaFila = $(`#fila-detalle-${producto.id}`);
        const inputCantidadNuevo = nuevaFila.find('.input-cantidad').first();
        inputCantidadNuevo.focus().select();
    }

    recalcularTotalesCompra();
}

/**
 * Elimina un producto del detalle
 */
function eliminarProductoDelDetalle(productoId) {
    $(`#fila-detalle-${productoId}`).remove();
    recalcularTotalesCompra();

    if ($('#tbody-detalles-compra tr').length === 0) {
        $('#fila-sin-productos').show();
    }
}

/**
 * Recalcula todos los totales con impuestos y descuentos
 */
function recalcularTotalesCompra() {
    let subtotalBrutoGeneral = 0;
    let descuentosGeneral = 0;
    let subtotalGeneral = 0;
    let impuestosGeneral = 0;
    let cantidadTotal = 0;

    compraActual.detalles = [];

    $('#tbody-detalles-compra tr').each(function() {
        const fila = $(this);
        if (fila.attr('id') === 'fila-sin-productos') return;

        const productoId = fila.find('.input-cantidad').data('product-id');
        const cantidad = parseFloat(fila.find('.input-cantidad').val()) || 0;
        const precioLista = parseFloat(fila.find('.input-precio').val()) || 0;
        const descuentoPct = parseFloat(fila.find('.input-descuento').val()) || 0;

        const selectImpuesto = fila.find('.select-impuesto');
        const tipoImpuestoId = parseInt(selectImpuesto.val());
        const porcentajeImpuesto = parseFloat(selectImpuesto.find('option:selected').data('porcentaje')) || 0;

        // CÁLCULOS
        const subtotalBruto = precioLista * cantidad;
        const montoDescuento = subtotalBruto * (descuentoPct / 100);
        const baseGravable = subtotalBruto - montoDescuento;
        const montoImpuesto = baseGravable * (porcentajeImpuesto / 100);
        const totalLinea = baseGravable + montoImpuesto;

        // Actualizar celdas
        fila.find('.celda-base-gravable').text(formatCurrency(baseGravable));
        fila.find('.celda-monto-impuesto').text(formatCurrency(montoImpuesto));
        fila.find('.celda-total-linea').text(formatCurrency(totalLinea));

        // Acumular
        cantidadTotal += cantidad;
        subtotalBrutoGeneral += subtotalBruto;
        descuentosGeneral += montoDescuento;
        subtotalGeneral += baseGravable;
        impuestosGeneral += montoImpuesto;

        // Guardar en el objeto
        compraActual.detalles.push({
            id_producto: productoId,
            cantidad: cantidad,
            precio_lista_compra: precioLista,
            descuento_pct: descuentoPct,
            costo_unitario_neto: baseGravable / cantidad,
            id_tipo_impuesto: tipoImpuestoId
        });
    });

    // Actualizar totales en la UI
    $('#compra-total-cantidad').text(cantidadTotal);
    $('#compra-subtotal-bruto').text(formatCurrency(subtotalBrutoGeneral));
    $('#compra-total-descuentos').text(formatCurrency(descuentosGeneral));
    $('#compra-subtotal').text(formatCurrency(subtotalGeneral));
    $('#compra-total-impuestos').text(formatCurrency(impuestosGeneral));
    $('#compra-total').text(formatCurrency(subtotalGeneral + impuestosGeneral));

    compraActual.subtotal = subtotalGeneral;
    compraActual.impuestos = impuestosGeneral;
    compraActual.total = subtotalGeneral + impuestosGeneral;
}

// ========================================
// GUARDAR COMPRA
// ========================================
async function guardarCompra() {
    try {
        // Recalcular totales
        recalcularTotalesCompra();

        // Validar fecha
        const fpInstance = document.querySelector("#compra-fecha")._flatpickr;
        let fechaISO = null;
        if (fpInstance && fpInstance.selectedDates.length > 0) {
            fechaISO = moment(fpInstance.selectedDates[0]).toISOString();
        } else {
            Swal.fire('Error de Validación', 'La fecha de la compra es obligatoria.', 'error');
            return;
        }

        // Validar proveedor
        const proveedorId = $('#compra-proveedor').val();
        if (!proveedorId) {
            Swal.fire('Error de Validación', 'Debes seleccionar un proveedor.', 'error');
            return;
        }

        // Validar productos
        if (compraActual.detalles.length === 0) {
            Swal.fire('Error de Validación', 'Debes agregar al menos un producto a la compra.', 'error');
            return;
        }

        // Recolectar datos
        const numeroFactura = $('#compra-numero-factura').val().trim();
        const estado = $('#compra-estado').val();
        const condicionPago = $('#compra-condicion-pago').val();
        const notas = $('#compra-notas').val().trim();

        const datosCompra = {
            id_proveedor: proveedorId,
            fecha_compra: fechaISO,
            numero_factura: numeroFactura,
            estado: estado,
            condicion_pago: condicionPago,
            notas: notas,
            detalles: compraActual.detalles
        };

        console.log("[Compras] Enviando datos a RPC:", datosCompra);

        const client = getSupabaseClient();

        if (modoEdicion.activo) {
            // ACTUALIZAR COMPRA EXISTENTE
            Swal.fire({
                title: 'Actualizando Compra...',
                text: 'Por favor espera.',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const { data, error } = await client.rpc('actualizar_compra_borrador', {
                p_id_compra: modoEdicion.idCompra,
                datos_compra: datosCompra
            });

            if (error) throw new Error(error.message || 'Error al actualizar la compra');

            Swal.fire({
                title: '¡Éxito!',
                text: 'La compra ha sido actualizada correctamente.',
                icon: 'success',
                confirmButtonText: 'Volver a la Lista'
            }).then(() => {
                modoEdicion = { activo: false, idCompra: null };
                cargarPaginaCompras();
            });

        } else {
            // CREAR NUEVA COMPRA
            Swal.fire({
                title: 'Guardando Compra...',
                text: 'Por favor espera.',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            const { data, error } = await client.rpc('registrar_compra_completa', {
                datos_compra: datosCompra
            });

            if (error) throw new Error(error.message || 'Error al guardar la compra');

            const result = await Swal.fire({
                title: '¡Éxito!',
                text: 'La compra ha sido guardada correctamente.',
                icon: 'success',
                showCancelButton: true,
                confirmButtonText: 'Registrar Otra Compra',
                cancelButtonText: 'Volver a la Lista'
            });

            if (result.isConfirmed) {
                location.reload();
            } else {
                cargarPaginaCompras();
            }
        }

    } catch (error) {
        console.error("[Compras] Error al guardar:", error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message,
            confirmButtonText: 'Cerrar'
        });
    }
}

// ========================================
// UTILIDADES
// ========================================
function formatCurrency(valor) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(valor || 0);
}

console.log('[Compras Formulario] ✅ Módulo cargado');

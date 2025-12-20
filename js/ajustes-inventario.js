// ========================================================================
// MÓDULO: AJUSTES DE INVENTARIO
// Descripción: Gestión de ajustes de inventario con soporte para diferentes
//              tipos de movimientos (ENT-AJ, SAL-AJ, SAL-MER, ENT-DEV,
//              SAL-DEV, INI-STK, INV-FIS)
// ========================================================================

// Variables Globales del Módulo
let ajustesInventario_tiposMovimiento = [];
let ajustesInventario_flatpickrInstance = null;
let ajustesInventario_searchTimeout = null;

// Variables para patrón dirty form
let ajustesInventario_estadoInicial = null;

/**
 * Función principal de inicialización del módulo
 */
function inicializarVistaAjustesInventario() {
    console.log('[AJUSTES-INVENTARIO] Inicializando vista de Ajustes de Inventario...');

    // Limpiar variables globales
    resetearVariablesGlobalesAjustes();

    // Configurar fecha actual
    configurarFechaAjuste();

    // Configurar event listeners
    configurarListenersAjustesInventario();

    // Cargar tipos de movimiento
    cargarTiposMovimientoSelect();

    // Capturar estado inicial para dirty form (después de breve delay para asegurar que todo esté cargado)
    setTimeout(() => {
        capturarEstadoInicialAjuste();
    }, 100);

    console.log('[AJUSTES-INVENTARIO] Vista inicializada correctamente.');
}

/**
 * Resetear variables globales del módulo
 */
function resetearVariablesGlobalesAjustes() {
    ajustesInventario_tiposMovimiento = [];

    if (ajustesInventario_flatpickrInstance) {
        ajustesInventario_flatpickrInstance.destroy();
        ajustesInventario_flatpickrInstance = null;
    }

    if (ajustesInventario_searchTimeout) {
        clearTimeout(ajustesInventario_searchTimeout);
        ajustesInventario_searchTimeout = null;
    }
}

/**
 * Configurar Flatpickr para el campo de fecha
 */
function configurarFechaAjuste() {
    const fechaInput = document.getElementById('ajuste-fecha');
    if (!fechaInput) {
        console.error('[AJUSTES-INVENTARIO] No se encontró el elemento #ajuste-fecha');
        return;
    }

    // Configuración de Flatpickr
    const config = {
        locale: "es",
        enableTime: false,
        dateFormat: "Y-m-d",     // Formato estándar para BD
        altInput: true,          // Muestra formato diferente al usuario
        altFormat: "d/m/Y",      // Formato visual
        defaultDate: "today"     // Fecha de hoy por defecto
    };

    // Inicializar Flatpickr
    ajustesInventario_flatpickrInstance = flatpickr(fechaInput, config);
    console.log('[AJUSTES-INVENTARIO] Flatpickr inicializado correctamente.');
}

/**
 * Cargar tipos de movimiento en el select
 */
async function cargarTiposMovimientoSelect() {
    console.log('[AJUSTES-INVENTARIO] Cargando tipos de movimiento...');

    const select = document.getElementById('ajuste-tipo-movimiento');
    if (!select) {
        console.error('[AJUSTES-INVENTARIO] Select de tipo de movimiento no encontrado');
        return;
    }

    // Mostrar estado de carga
    select.innerHTML = '<option value="" disabled selected>Cargando tipos...</option>';

    try {
        // Obtener cliente de Supabase
        const client = getSupabaseClient();

        // Llamar a función RPC de Supabase
        const { data, error } = await client.rpc('rpc_obtener_tipos_movimiento_ajustes');

        if (error) {
            console.error('[AJUSTES-INVENTARIO] Error al cargar tipos:', error);
            showNotification('Error al cargar tipos de movimiento', 'error');
            select.innerHTML = '<option value="" disabled selected>Error al cargar tipos</option>';
            return;
        }

        if (data && data.exito && data.datos) {
            ajustesInventario_tiposMovimiento = data.datos;
            poblarSelectTiposMovimiento(data.datos);
        } else if (data && !data.exito) {
            console.error('[AJUSTES-INVENTARIO] Error:', data.mensaje);
            showNotification(data.mensaje, 'error');
            select.innerHTML = '<option value="" disabled selected>Error al cargar tipos</option>';
        } else {
            console.warn('[AJUSTES-INVENTARIO] No se encontraron tipos de movimiento');
            select.innerHTML = '<option value="" disabled selected>No hay tipos disponibles</option>';
        }

    } catch (error) {
        console.error('[AJUSTES-INVENTARIO] Error inesperado:', error);
        showNotification('Error al cargar tipos de movimiento', 'error');
        select.innerHTML = '<option value="" disabled selected>Error al cargar tipos</option>';
    }
}

/**
 * Poblar el select con los tipos de movimiento
 */
function poblarSelectTiposMovimiento(tiposMovimiento) {
    const select = document.getElementById('ajuste-tipo-movimiento');

    // Limpiar y añadir opción por defecto
    select.innerHTML = '<option value="" disabled selected>Seleccione un tipo...</option>';

    // Añadir cada tipo de movimiento
    tiposMovimiento.forEach(tipo => {
        const option = document.createElement('option');
        option.value = tipo.id_tipo_movimiento;
        option.textContent = `${tipo.codigo_tipo_movimiento} - ${tipo.descripcion_movimiento}`;
        option.dataset.efecto = tipo.efecto_en_stock;
        option.dataset.modoAjuste = tipo.modo_ajuste || '';
        select.appendChild(option);
    });

    console.log(`[AJUSTES-INVENTARIO] ${tiposMovimiento.length} tipos de movimiento cargados`);
}

/**
 * Configurar todos los event listeners
 */
function configurarListenersAjustesInventario() {
    // Listener para cambio de tipo de movimiento
    const tipoSelect = document.getElementById('ajuste-tipo-movimiento');
    if (tipoSelect) {
        tipoSelect.addEventListener('change', function() {
            actualizarTablaSegunTipo(this.value);
        });
    }

    // Listener para búsqueda de productos con debounce
    const buscadorProducto = document.getElementById('ajuste-buscar-producto');
    if (buscadorProducto) {
        buscadorProducto.addEventListener('input', function() {
            // Debounce: esperar 300ms antes de buscar
            if (ajustesInventario_searchTimeout) {
                clearTimeout(ajustesInventario_searchTimeout);
            }

            ajustesInventario_searchTimeout = setTimeout(() => {
                buscarProductos(this.value);
            }, 300);
        });

        // Cerrar resultados al hacer clic fuera
        buscadorProducto.addEventListener('blur', function() {
            setTimeout(() => {
                const resultados = document.getElementById('ajuste-search-results');
                if (resultados) {
                    resultados.classList.remove('show');
                }
            }, 200);
        });

        // Reabrir resultados al enfocar si hay texto
        buscadorProducto.addEventListener('focus', function() {
            if (this.value.length >= 2) {
                const resultados = document.getElementById('ajuste-search-results');
                if (resultados && resultados.children.length > 0) {
                    resultados.classList.add('show');
                }
            }
        });
    }

    // Listener para el botón guardar
    const btnGuardar = document.getElementById('btn-guardar-ajuste-inventario');
    if (btnGuardar) {
        btnGuardar.addEventListener('click', guardarAjusteInventario);
    }

    // Listener para el botón cancelar con validación dirty form
    const btnCancelar = document.getElementById('btn-cancelar-ajuste-inventario');
    if (btnCancelar) {
        btnCancelar.addEventListener('click', function() {
            console.log('[AJUSTES-INVENTARIO] Cancelar clickeado');

            // Verificar si hay cambios sin guardar
            if (verificarCambiosEnAjuste()) {
                // Formulario sucio - mostrar confirmación
                const mensaje = 'Hay cambios sin guardar que se perderán.';
                const titulo = '¿Cancelar ajuste?';

                mostrarModalConfirmacion(mensaje, function() {
                    console.log('[AJUSTES-INVENTARIO] Usuario confirmó cancelar con cambios');
                    limpiarFormularioAjuste();
                    showNotification('Formulario limpiado', 'info');
                }, titulo);
            } else {
                // Formulario limpio - limpiar de todas formas por si acaso
                console.log('[AJUSTES-INVENTARIO] No hay cambios, limpiando formulario');
                limpiarFormularioAjuste();
            }
        });
    }
}

/**
 * Actualizar tabla según el tipo de movimiento seleccionado
 */
function actualizarTablaSegunTipo(tipoMovimientoId) {
    console.log('[AJUSTES-INVENTARIO] Cambiando tipo de movimiento a:', tipoMovimientoId);

    const theadSimple = document.getElementById('thead-ajuste-simple');
    const theadFisico = document.getElementById('thead-ajuste-fisico');
    const tbody = document.getElementById('tbody-ajustes');

    if (!tipoMovimientoId || ajustesInventario_tiposMovimiento.length === 0) {
        console.log('[AJUSTES-INVENTARIO] Tipo no seleccionado o datos no cargados');
        return;
    }

    // Buscar el tipo seleccionado
    const tipoSeleccionado = ajustesInventario_tiposMovimiento.find(
        tm => tm.id_tipo_movimiento === tipoMovimientoId
    );

    if (tipoSeleccionado) {
        console.log('[AJUSTES-INVENTARIO] Tipo seleccionado:', tipoSeleccionado);

        // Verificar el modo de ajuste
        if (tipoSeleccionado.modo_ajuste === 'ConteoFisico') {
            console.log('[AJUSTES-INVENTARIO] Modo: CONTEO FÍSICO');
            theadSimple.style.display = 'none';
            theadFisico.style.display = '';
        } else {
            console.log('[AJUSTES-INVENTARIO] Modo: AJUSTE SIMPLE');
            theadFisico.style.display = 'none';
            theadSimple.style.display = '';
        }

        // Limpiar la tabla
        tbody.innerHTML = '<tr class="empty-row"><td colspan="6" class="text-center">Añada productos para empezar el ajuste.</td></tr>';

    } else {
        console.error('[AJUSTES-INVENTARIO] No se encontró el tipo de movimiento');
    }
}

/**
 * Buscar productos usando RPC de Supabase
 */
async function buscarProductos(termino) {
    console.log('[AJUSTES-INVENTARIO] Buscando productos:', termino);

    const resultados = document.getElementById('ajuste-search-results');

    // Limpiar resultados si el término es muy corto
    if (!termino || termino.length < 2) {
        resultados.classList.remove('show');
        resultados.innerHTML = '';
        return;
    }

    // Mostrar estado de carga
    resultados.innerHTML = '<div class="search-result-item loading">Buscando...</div>';
    resultados.classList.add('show');

    try {
        // Obtener cliente de Supabase
        const client = getSupabaseClient();

        // Llamar a función RPC de Supabase
        const { data, error } = await client.rpc('rpc_buscar_productos_inventario', {
            p_termino: termino
        });

        if (error) {
            console.error('[AJUSTES-INVENTARIO] Error en búsqueda:', error);
            resultados.innerHTML = '<div class="search-result-item no-results">Error en la búsqueda</div>';
            setTimeout(() => resultados.classList.remove('show'), 2000);
            return;
        }

        if (data && data.exito && data.datos && data.datos.length > 0) {
            mostrarResultadosBusqueda(data.datos);
        } else if (data && !data.exito) {
            console.error('[AJUSTES-INVENTARIO] Error:', data.mensaje);
            resultados.innerHTML = `<div class="search-result-item no-results">${data.mensaje}</div>`;
            setTimeout(() => resultados.classList.remove('show'), 2000);
        } else {
            resultados.innerHTML = '<div class="search-result-item no-results">No se encontraron productos</div>';
            setTimeout(() => resultados.classList.remove('show'), 2000);
        }

    } catch (error) {
        console.error('[AJUSTES-INVENTARIO] Error inesperado en búsqueda:', error);
        resultados.innerHTML = '<div class="search-result-item no-results">Error en la búsqueda</div>';
        setTimeout(() => resultados.classList.remove('show'), 2000);
    }
}

/**
 * Mostrar resultados de búsqueda de productos
 */
function mostrarResultadosBusqueda(productos) {
    const resultados = document.getElementById('ajuste-search-results');

    if (!productos || productos.length === 0) {
        resultados.innerHTML = '<div class="search-result-item no-results">No se encontraron productos</div>';
        setTimeout(() => resultados.classList.remove('show'), 2000);
        return;
    }

    // Generar HTML para cada producto
    const productosHTML = productos.map(producto => {
        const stockActual = producto.stock_actual !== null ? producto.stock_actual : 0;
        const costoPromedio = producto.costo_promedio !== null ? producto.costo_promedio : 0;
        const precioVenta = producto.precio_venta_actual !== null ? producto.precio_venta_actual : 0;

        return `
            <div class="search-result-item" onclick='agregarProductoATabla(${JSON.stringify(producto).replace(/'/g, "&#39;")})'>
                <strong>${producto.nombre_producto}</strong><br>
                <small>SKU: ${producto.sku} | Stock: ${stockActual} | Precio: $${precioVenta.toLocaleString()}</small>
            </div>
        `;
    }).join('');

    resultados.innerHTML = productosHTML;
    resultados.classList.add('show');
}

/**
 * Agregar producto a la tabla de ajustes
 */
function agregarProductoATabla(producto) {
    console.log('[AJUSTES-INVENTARIO] Agregando producto:', producto);

    const tbody = document.getElementById('tbody-ajustes');
    const emptyRow = tbody.querySelector('.empty-row');

    // Verificar si el producto ya está en la tabla
    const filaExistente = tbody.querySelector(`tr[data-producto-id="${producto.id_producto}"]`);
    if (filaExistente) {
        showNotification('Este producto ya está en la lista', 'warning');
        document.getElementById('ajuste-search-results').classList.remove('show');
        document.getElementById('ajuste-buscar-producto').value = '';
        return;
    }

    // Validación especial para Stock Inicial (INI-STK)
    const tipoSelect = document.getElementById('ajuste-tipo-movimiento');
    const tipoMovimientoId = tipoSelect.value;
    const tipoSeleccionado = ajustesInventario_tiposMovimiento.find(
        tm => tm.id_tipo_movimiento === tipoMovimientoId
    );

    if (tipoSeleccionado && tipoSeleccionado.codigo_tipo_movimiento === 'INI-STK') {
        const stockActual = producto.stock_actual || 0;
        if (stockActual > 0) {
            showNotification(
                `No se puede usar "Stock Inicial" en el producto "${producto.nombre_producto}" porque ya tiene stock de ${stockActual} unidades. ` +
                `Use "Entrada por Ajuste" para agregar unidades.`,
                'error'
            );
            document.getElementById('ajuste-search-results').classList.remove('show');
            document.getElementById('ajuste-buscar-producto').value = '';
            return;
        }
    }

    // Remover fila vacía si existe
    if (emptyRow) {
        emptyRow.remove();
    }

    // Verificar qué modo está activo
    const theadSimple = document.getElementById('thead-ajuste-simple');
    const theadFisico = document.getElementById('thead-ajuste-fisico');
    const esConteoFisico = theadFisico.style.display !== 'none';

    // Crear nueva fila
    const nuevaFila = document.createElement('tr');
    nuevaFila.setAttribute('data-producto-id', producto.id_producto);
    nuevaFila.setAttribute('data-stock-actual', producto.stock_actual || 0);
    nuevaFila.setAttribute('data-costo-promedio', producto.costo_promedio || 0);

    const stockActual = producto.stock_actual || 0;
    const costoPromedio = producto.costo_promedio || 0;

    if (esConteoFisico) {
        // Modo Conteo Físico
        nuevaFila.innerHTML = `
            <td>
                ${producto.nombre_producto}<br>
                <small>SKU: ${producto.sku}</small>
            </td>
            <td class="text-center stock-sistema">${stockActual}</td>
            <td class="text-center">
                <input type="number" class="input-ajuste" value="" min="0" step="0.001" placeholder="Conteo...">
            </td>
            <td class="text-center">
                <input type="number" class="input-costo" value="${costoPromedio}" min="0" step="0.01">
            </td>
            <td class="text-center">
                <span class="diferencia-calculada">-</span>
            </td>
            <td class="text-center">
                <button type="button" class="btn-remove-product" onclick="removerProductoDeTabla(this)">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
    } else {
        // Modo Ajuste Simple
        const tipoSelect = document.getElementById('ajuste-tipo-movimiento');
        const tipoMovimientoId = tipoSelect.value;
        let efectoEnStock = 1;

        if (tipoMovimientoId && ajustesInventario_tiposMovimiento.length > 0) {
            const tipoSeleccionado = ajustesInventario_tiposMovimiento.find(
                tm => tm.id_tipo_movimiento === tipoMovimientoId
            );
            if (tipoSeleccionado) {
                efectoEnStock = tipoSeleccionado.efecto_en_stock;
            }
        }

        const stockResultanteInicial = stockActual + (0 * efectoEnStock);

        nuevaFila.innerHTML = `
            <td>
                ${producto.nombre_producto}<br>
                <small>SKU: ${producto.sku}</small>
            </td>
            <td class="text-center stock-actual">${stockActual}</td>
            <td class="text-center">
                <input type="number" class="input-ajuste" value="0" min="0" step="0.001">
            </td>
            <td class="text-center">
                <input type="number" class="input-costo" value="${costoPromedio}" min="0" step="0.01">
            </td>
            <td class="text-center">
                <span class="stock-resultante">${stockResultanteInicial}</span>
            </td>
            <td class="text-center">
                <button type="button" class="btn-remove-product" onclick="removerProductoDeTabla(this)">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
    }

    tbody.appendChild(nuevaFila);

    // Ocultar resultados de búsqueda
    document.getElementById('ajuste-search-results').classList.remove('show');
    document.getElementById('ajuste-buscar-producto').value = '';

    // Configurar listeners para los inputs
    const inputCantidad = nuevaFila.querySelector('.input-ajuste');

    inputCantidad.addEventListener('input', function() {
        // Validar números negativos en modo ajuste simple
        if (!esConteoFisico && parseFloat(this.value) < 0) {
            this.value = Math.abs(parseFloat(this.value));
            showNotification('En ajustes simples ingrese solo cantidades positivas. El tipo de movimiento determina si es entrada o salida.', 'warning');
        }

        if (esConteoFisico) {
            actualizarDiferenciaConteo(this);
        } else {
            actualizarStockResultante(this);
        }
    });

    // Auto-selección del texto al enfocar
    inputCantidad.addEventListener('focus', function() {
        this.select();
    });

    // Enfocar el input
    inputCantidad.focus();
}

/**
 * Actualizar stock resultante (Modo Ajuste Simple)
 */
function actualizarStockResultante(inputCantidad) {
    const fila = inputCantidad.closest('tr');
    const stockActual = parseFloat(fila.getAttribute('data-stock-actual')) || 0;
    const cantidadAjuste = parseFloat(inputCantidad.value) || 0;

    // Obtener el efecto del tipo de movimiento
    const tipoSelect = document.getElementById('ajuste-tipo-movimiento');
    const tipoMovimientoId = tipoSelect.value;

    let efectoEnStock = 1;
    if (tipoMovimientoId && ajustesInventario_tiposMovimiento.length > 0) {
        const tipoSeleccionado = ajustesInventario_tiposMovimiento.find(
            tm => tm.id_tipo_movimiento === tipoMovimientoId
        );
        if (tipoSeleccionado) {
            efectoEnStock = tipoSeleccionado.efecto_en_stock;
        }
    }

    // Cálculo: Stock Actual + (Cantidad × Efecto)
    const stockResultante = stockActual + (cantidadAjuste * efectoEnStock);

    const spanResultante = fila.querySelector('.stock-resultante');
    spanResultante.textContent = stockResultante.toFixed(3);

    // Aplicar colores
    const ajusteFinal = cantidadAjuste * efectoEnStock;
    spanResultante.className = 'stock-resultante';
    if (ajusteFinal > 0) {
        spanResultante.classList.add('diferencia-positiva');
    } else if (ajusteFinal < 0) {
        spanResultante.classList.add('diferencia-negativa');
    }
}

/**
 * Actualizar diferencia (Modo Conteo Físico)
 */
function actualizarDiferenciaConteo(inputConteo) {
    const fila = inputConteo.closest('tr');
    const stockSistema = parseFloat(fila.getAttribute('data-stock-actual')) || 0;
    const conteoFisico = parseFloat(inputConteo.value);

    const spanDiferencia = fila.querySelector('.diferencia-calculada');

    if (isNaN(conteoFisico) || inputConteo.value === '') {
        spanDiferencia.textContent = '-';
        spanDiferencia.className = 'diferencia-calculada';
        return;
    }

    const diferencia = conteoFisico - stockSistema;
    spanDiferencia.textContent = diferencia.toFixed(3);

    // Aplicar colores
    spanDiferencia.className = 'diferencia-calculada';
    if (diferencia > 0) {
        spanDiferencia.classList.add('diferencia-positiva');
    } else if (diferencia < 0) {
        spanDiferencia.classList.add('diferencia-negativa');
    }
}

/**
 * Remover producto de la tabla
 */
function removerProductoDeTabla(boton) {
    const fila = boton.closest('tr');
    fila.remove();

    // Si no quedan productos, mostrar fila vacía
    const tbody = document.getElementById('tbody-ajustes');
    if (tbody.children.length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="6" class="text-center">Añada productos para empezar el ajuste.</td></tr>';
    }
}

/**
 * Guardar ajuste de inventario
 */
async function guardarAjusteInventario() {
    console.log('[AJUSTES-INVENTARIO] Guardando ajuste...');

    // Validar datos básicos
    const fecha = document.getElementById('ajuste-fecha').value;
    const tipoMovimientoId = document.getElementById('ajuste-tipo-movimiento').value;
    const notas = document.getElementById('ajuste-notas').value;

    if (!fecha) {
        showNotification('Por favor seleccione una fecha para el ajuste', 'error');
        return;
    }

    if (!tipoMovimientoId) {
        showNotification('Por favor seleccione un tipo de ajuste', 'error');
        return;
    }

    // Obtener productos de la tabla
    const tbody = document.getElementById('tbody-ajustes');
    const filas = tbody.querySelectorAll('tr:not(.empty-row)');

    if (filas.length === 0) {
        showNotification('Agregue al menos un producto para el ajuste', 'error');
        return;
    }

    // Obtener información del tipo de movimiento
    const tipoSeleccionado = ajustesInventario_tiposMovimiento.find(
        tm => tm.id_tipo_movimiento === tipoMovimientoId
    );

    if (!tipoSeleccionado) {
        showNotification('Error: Tipo de movimiento no válido', 'error');
        return;
    }

    // Preparar array de productos
    const productosAjuste = [];
    let hayErrores = false;

    filas.forEach((fila, index) => {
        const productoId = fila.getAttribute('data-producto-id');
        const inputCantidad = fila.querySelector('.input-ajuste');
        const inputCosto = fila.querySelector('.input-costo');
        const cantidadIngresada = inputCantidad.value.trim();

        // Validar cantidad
        if (cantidadIngresada === '' || isNaN(cantidadIngresada)) {
            showNotification(`Producto en fila ${index + 1}: Ingrese una cantidad válida`, 'error');
            hayErrores = true;
            return;
        }

        const cantidad = parseFloat(cantidadIngresada);

        // Validar según el modo
        if (tipoSeleccionado.modo_ajuste === 'ConteoFisico') {
            if (cantidad < 0) {
                showNotification(`Producto en fila ${index + 1}: El conteo físico no puede ser negativo`, 'error');
                hayErrores = true;
                return;
            }
        } else {
            // Validaciones para ajustes simples
            if (cantidad < 0) {
                showNotification(`Producto en fila ${index + 1}: En ajustes simples ingrese solo cantidades positivas. El tipo de movimiento determina si es entrada o salida.`, 'error');
                hayErrores = true;
                return;
            }
            if (cantidad === 0) {
                showNotification(`Producto en fila ${index + 1}: La cantidad a ajustar no puede ser cero`, 'error');
                hayErrores = true;
                return;
            }
        }

        // Calcular cantidad para enviar
        let cantidadParaEnviar = cantidad;

        if (tipoSeleccionado.modo_ajuste === 'ConteoFisico') {
            const stockSistema = parseFloat(fila.getAttribute('data-stock-actual')) || 0;
            cantidadParaEnviar = cantidad - stockSistema;

            // Solo procesar si hay diferencia
            if (cantidadParaEnviar === 0) {
                return;
            }
        }

        // Obtener costo
        const precioCosto = parseFloat(inputCosto.value) || 0;

        productosAjuste.push({
            id_producto: productoId,
            cantidad_ajustada: cantidadParaEnviar,
            precio_unitario_costo: precioCosto
        });
    });

    if (hayErrores) {
        return;
    }

    if (productosAjuste.length === 0) {
        showNotification('No hay productos con ajustes para guardar', 'warning');
        return;
    }

    // Preparar datos completos
    const datosAjuste = {
        p_fecha_ajuste: fecha,
        p_id_tipo_movimiento: tipoMovimientoId,
        p_notas: notas || null,
        p_productos: productosAjuste
    };

    console.log('[AJUSTES-INVENTARIO] Datos a enviar:', datosAjuste);

    // Deshabilitar botón
    const btnGuardar = document.getElementById('btn-guardar-ajuste-inventario');
    const textoOriginal = btnGuardar.innerHTML;
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        // Obtener cliente de Supabase
        const client = getSupabaseClient();

        // Llamar a función RPC de Supabase
        const { data, error } = await client.rpc('rpc_guardar_ajuste_inventario', datosAjuste);

        // Capturar errores de Supabase (validaciones de stock, triggers, etc.)
        if (error) {
            console.error('[AJUSTES-INVENTARIO] Error al guardar:', error);
            Swal.fire({
                icon: 'error',
                title: 'No se pudo guardar',
                text: error.message
            });
            return;
        }

        console.log('[AJUSTES-INVENTARIO] Respuesta:', data);

        if (data && data.exito) {
            // Mensaje dinámico según el tipo de movimiento
            let mensajeExito = 'Ajuste de inventario guardado correctamente';

            if (tipoSeleccionado.efecto_en_stock > 0) {
                // Entrada (códigos: ENT-AJ, INI-STK, ENT-DEV, etc.)
                mensajeExito = 'Entrada de stock registrada';
            } else if (tipoSeleccionado.efecto_en_stock < 0) {
                // Salida (códigos: SAL-AJ, SAL-MER, SAL-DEV, etc.)
                mensajeExito = 'Salida de stock registrada';
            }

            Swal.fire({
                icon: 'success',
                title: '¡Éxito!',
                text: mensajeExito,
                timer: 2000,
                showConfirmButton: false
            });

            // Limpiar formulario
            limpiarFormularioAjuste();
        } else if (data && !data.exito) {
            Swal.fire({
                icon: 'error',
                title: 'No se pudo guardar',
                text: data.mensaje || 'Error al guardar el ajuste'
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error al guardar el ajuste'
            });
        }

    } catch (error) {
        console.error('[AJUSTES-INVENTARIO] Error inesperado:', error);
        showNotification('Error al guardar el ajuste', 'error');
    } finally {
        // Restaurar botón
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = textoOriginal;
    }
}

/**
 * Limpiar formulario después de guardado exitoso
 */
function limpiarFormularioAjuste() {
    // Limpiar campos
    document.getElementById('ajuste-tipo-movimiento').value = '';
    document.getElementById('ajuste-notas').value = '';

    // Resetear fecha a hoy
    if (ajustesInventario_flatpickrInstance) {
        ajustesInventario_flatpickrInstance.setDate(new Date());
    }

    // Limpiar tabla
    const tbody = document.getElementById('tbody-ajustes');
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6" class="text-center">Añada productos para empezar el ajuste.</td></tr>';

    // Ocultar cabeceras específicas
    document.getElementById('thead-ajuste-simple').style.display = '';
    document.getElementById('thead-ajuste-fisico').style.display = 'none';

    // Limpiar buscador
    document.getElementById('ajuste-buscar-producto').value = '';
    document.getElementById('ajuste-search-results').classList.remove('show');

    // Recapturar estado inicial después de limpiar
    setTimeout(() => {
        capturarEstadoInicialAjuste();
    }, 100);

    console.log('[AJUSTES-INVENTARIO] Formulario limpiado');
}

/**
 * Capturar estado inicial del formulario para dirty form pattern
 */
function capturarEstadoInicialAjuste() {
    ajustesInventario_estadoInicial = {
        fecha: document.getElementById('ajuste-fecha').value,
        tipoMovimiento: document.getElementById('ajuste-tipo-movimiento').value,
        notas: document.getElementById('ajuste-notas').value,
        cantidadProductos: document.querySelectorAll('#tbody-ajustes tr:not(.empty-row)').length
    };

    console.log('[AJUSTES-INVENTARIO] Estado inicial capturado:', ajustesInventario_estadoInicial);
}

/**
 * Verificar si hay cambios en el formulario
 * @returns {boolean} True si hay cambios, false en caso contrario
 */
function verificarCambiosEnAjuste() {
    console.log('[AJUSTES-INVENTARIO] Verificando cambios...');

    if (!ajustesInventario_estadoInicial) {
        console.log('[AJUSTES-INVENTARIO] No hay estado inicial, no hay cambios');
        return false;
    }

    // Obtener estado actual
    const estadoActual = {
        fecha: document.getElementById('ajuste-fecha').value,
        tipoMovimiento: document.getElementById('ajuste-tipo-movimiento').value,
        notas: document.getElementById('ajuste-notas').value,
        cantidadProductos: document.querySelectorAll('#tbody-ajustes tr:not(.empty-row)').length
    };

    // Comparar estados
    for (const key in estadoActual) {
        if (estadoActual[key] !== ajustesInventario_estadoInicial[key]) {
            console.log(`[AJUSTES-INVENTARIO] Cambio detectado en: ${key}`);
            console.log(`  Inicial: "${ajustesInventario_estadoInicial[key]}"`);
            console.log(`  Actual: "${estadoActual[key]}"`);
            return true;
        }
    }

    console.log('[AJUSTES-INVENTARIO] No hay cambios');
    return false;
}

// Exponer función de inicialización globalmente
window.inicializarVistaAjustesInventario = inicializarVistaAjustesInventario;

console.log('[AJUSTES-INVENTARIO] Módulo cargado correctamente');

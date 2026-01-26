// =========================================================================
// MODULO DE INFORME DE VENTA POR PRODUCTO - VERCEL
// =========================================================================

// Bandera de modulo activo (evita colisiones con otros modulos)
let informeVentaProductoModuloActivo = false;

// Variables globales del modulo
let ivp_currentPage = 1;
const ivp_rowsPerPage = 50;
let ivp_allData = [];
let ivp_isLoading = false;
let ivp_select2Initialized = false;

// Filtros actuales
let ivp_productoSeleccionado = null;
let ivp_fechaInicio = '';
let ivp_fechaFin = '';
let ivp_estadosFiltro = ['TODOS'];

// Instancias de Flatpickr
let ivp_fpInicio = null;
let ivp_fpFin = null;

// =========================================================================
// FUNCION DE INICIALIZACION DEL MODULO
// =========================================================================

/**
 * Limpia todos los timers y recursos del modulo
 */
function limpiarModuloInformeVentaProducto() {
    console.log('[Informe Venta Producto] Limpiando recursos del modulo...');

    // Destruir instancias de Flatpickr
    if (ivp_fpInicio) {
        ivp_fpInicio.destroy();
        ivp_fpInicio = null;
    }
    if (ivp_fpFin) {
        ivp_fpFin.destroy();
        ivp_fpFin = null;
    }

    // Destruir Select2 si existe
    const selectProducto = $('#select-producto-historial');
    if (selectProducto.length && ivp_select2Initialized) {
        try {
            selectProducto.select2('destroy');
        } catch (e) {
            console.warn('[Informe Venta Producto] Error destruyendo Select2:', e);
        }
        ivp_select2Initialized = false;
    }

    console.log('[Informe Venta Producto] Modulo limpiado correctamente');
}

/**
 * Resetea todas las variables globales del modulo
 */
function resetearVariablesGlobalesIVP() {
    console.log('[Informe Venta Producto] Reseteando variables globales...');

    ivp_currentPage = 1;
    ivp_allData = [];
    ivp_isLoading = false;
    ivp_productoSeleccionado = null;
    ivp_fechaInicio = '';
    ivp_fechaFin = '';
    ivp_estadosFiltro = ['TODOS'];

    console.log('[Informe Venta Producto] Variables globales reseteadas');
}

/**
 * Funcion principal para cargar el modulo de informe de venta por producto
 * Se llama desde home.js cuando se navega a la pagina
 */
async function cargarPaginaInformeVentaProducto() {
    console.log('[Informe Venta Producto] ===== INICIALIZANDO MODULO =====');

    // Desactivar otros modulos antes de activar este
    if (typeof desactivarTodosLosModulos === 'function') {
        desactivarTodosLosModulos();
    }

    // Activar bandera de modulo
    informeVentaProductoModuloActivo = true;

    // Resetear variables globales
    resetearVariablesGlobalesIVP();

    try {
        // Inicializar componentes
        await inicializarComponentesIVP();

        // Configurar event listeners
        configurarEventListenersIVP();

        console.log('[Informe Venta Producto] Modulo inicializado correctamente');
    } catch (error) {
        console.error('[Informe Venta Producto] Error inicializando modulo:', error);
        showNotification('Error al cargar el informe: ' + error.message, 'error');
    }
}

// =========================================================================
// INICIALIZACION DE COMPONENTES
// =========================================================================

/**
 * Inicializa Select2 y Flatpickr
 */
async function inicializarComponentesIVP() {
    console.log('[Informe Venta Producto] Inicializando componentes...');

    // Inicializar Select2 para busqueda de productos
    await inicializarSelect2Productos();

    // Inicializar Flatpickr para fechas
    inicializarFlatpickrFechas();

    // Configurar checkboxes de estados
    configurarCheckboxesEstados();

    console.log('[Informe Venta Producto] Componentes inicializados');
}

/**
 * Inicializa Select2 con busqueda dinamica de productos
 */
async function inicializarSelect2Productos() {
    console.log('[Informe Venta Producto] Inicializando Select2...');

    const selectElement = $('#select-producto-historial');
    if (!selectElement.length) {
        console.error('[Informe Venta Producto] Elemento select no encontrado');
        return;
    }

    selectElement.select2({
        placeholder: 'Escriba para buscar producto (min. 3 caracteres)...',
        minimumInputLength: 3,
        allowClear: true,
        language: {
            inputTooShort: function() {
                return 'Escriba al menos 3 caracteres para buscar...';
            },
            noResults: function() {
                return 'No se encontraron productos';
            },
            searching: function() {
                return 'Buscando...';
            }
        },
        templateResult: function(data) {
            if (data.loading) return data.text;
            if (!data.id) return data.text;

            return $(`
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${data.text}</strong>
                        ${data.sku ? `<br><small style="color: #6b7280;">SKU: ${data.sku}</small>` : ''}
                    </div>
                </div>
            `);
        },
        templateSelection: function(data) {
            return data.text || data.id;
        },
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
                    if (!client) {
                        failure(new Error('Cliente Supabase no inicializado'));
                        return { abort: () => {} };
                    }

                    // Buscar productos por nombre o SKU
                    const { data, error } = await client
                        .from('productos')
                        .select('id_producto, nombre_producto, sku')
                        .or(`nombre_producto.ilike.%${termino}%,sku.ilike.%${termino}%`)
                        .eq('activo', true)
                        .order('nombre_producto', { ascending: true })
                        .limit(20);

                    if (error) throw error;

                    const results = (data || []).map(producto => ({
                        id: producto.id_producto,
                        text: producto.nombre_producto,
                        sku: producto.sku,
                        nombre: producto.nombre_producto
                    }));

                    success({ results });

                } catch (error) {
                    console.error('[Informe Venta Producto] Error buscando productos:', error);
                    failure(error);
                }
                return { abort: () => {} };
            }
        }
    });

    // Event cuando se selecciona un producto
    selectElement.on('select2:select', function(e) {
        const data = e.params.data;
        ivp_productoSeleccionado = {
            id: data.id,
            nombre: data.nombre || data.text,
            sku: data.sku
        };
        console.log('[Informe Venta Producto] Producto seleccionado:', ivp_productoSeleccionado);
    });

    // Event cuando se limpia la seleccion
    selectElement.on('select2:clear', function() {
        ivp_productoSeleccionado = null;
        console.log('[Informe Venta Producto] Seleccion de producto limpiada');
    });

    // Auto-focus en el campo de busqueda
    selectElement.on('select2:open', function() {
        setTimeout(() => {
            const searchField = document.querySelector('.select2-search__field');
            if (searchField) searchField.focus();
        }, 100);
    });

    ivp_select2Initialized = true;
    console.log('[Informe Venta Producto] Select2 inicializado');
}

/**
 * Inicializa los selectores de fecha con Flatpickr
 */
function inicializarFlatpickrFechas() {
    console.log('[Informe Venta Producto] Inicializando Flatpickr...');

    // Calcular fechas por defecto (hoy + una semana a futuro)
    const hoy = new Date();
    const unaSemanaFuturo = new Date();
    unaSemanaFuturo.setDate(hoy.getDate() + 7);

    // Formatear fechas YYYY-MM-DD
    const formatearFecha = (fecha) => {
        return fecha.toISOString().split('T')[0];
    };

    ivp_fechaInicio = formatearFecha(hoy);
    ivp_fechaFin = formatearFecha(unaSemanaFuturo);

    // Configuracion comun de Flatpickr
    const configComun = {
        dateFormat: 'Y-m-d',        // Formato interno para la API
        altInput: true,              // Usar input alternativo para mostrar
        altFormat: 'd/m/Y',          // Formato de visualizacion DD/MM/YYYY
        locale: 'es',
        allowInput: false,
        disableMobile: true
    };

    // Fecha Inicio
    const inputInicio = document.getElementById('fecha-inicio-venta-producto');
    if (inputInicio) {
        ivp_fpInicio = flatpickr(inputInicio, {
            ...configComun,
            defaultDate: ivp_fechaInicio,
            onChange: function(selectedDates, dateStr) {
                ivp_fechaInicio = dateStr;
                console.log('[Informe Venta Producto] Fecha inicio:', dateStr);
            }
        });
    }

    // Fecha Fin
    const inputFin = document.getElementById('fecha-fin-venta-producto');
    if (inputFin) {
        ivp_fpFin = flatpickr(inputFin, {
            ...configComun,
            defaultDate: ivp_fechaFin,
            onChange: function(selectedDates, dateStr) {
                ivp_fechaFin = dateStr;
                console.log('[Informe Venta Producto] Fecha fin:', dateStr);
            }
        });
    }

    console.log('[Informe Venta Producto] Flatpickr inicializado con fechas:', ivp_fechaInicio, '-', ivp_fechaFin);
}

/**
 * Configura la logica de los checkboxes de estados
 */
function configurarCheckboxesEstados() {
    console.log('[Informe Venta Producto] Configurando checkboxes de estados...');

    const checkTodos = document.getElementById('estado-todos');
    const checksEstados = document.querySelectorAll('.checkbox-estado input[type="checkbox"]:not(#estado-todos)');

    if (!checkTodos) return;

    // Cuando se marca "Todos", desmarcar los demas
    checkTodos.addEventListener('change', function() {
        if (this.checked) {
            checksEstados.forEach(cb => cb.checked = false);
            ivp_estadosFiltro = ['TODOS'];
        }
        actualizarEstadosFiltro();
    });

    // Cuando se marca un estado individual, desmarcar "Todos"
    checksEstados.forEach(cb => {
        cb.addEventListener('change', function() {
            if (this.checked) {
                checkTodos.checked = false;
            }
            actualizarEstadosFiltro();

            // Si no hay ninguno marcado, marcar "Todos" automaticamente
            const algunoMarcado = Array.from(checksEstados).some(c => c.checked);
            if (!algunoMarcado) {
                checkTodos.checked = true;
                ivp_estadosFiltro = ['TODOS'];
            }
        });
    });

    console.log('[Informe Venta Producto] Checkboxes configurados');
}

/**
 * Actualiza el array de estados filtro basado en los checkboxes marcados
 */
function actualizarEstadosFiltro() {
    const checkTodos = document.getElementById('estado-todos');
    const checksEstados = document.querySelectorAll('.checkbox-estado input[type="checkbox"]:not(#estado-todos)');

    if (checkTodos && checkTodos.checked) {
        ivp_estadosFiltro = ['TODOS'];
    } else {
        ivp_estadosFiltro = Array.from(checksEstados)
            .filter(cb => cb.checked)
            .map(cb => cb.value);
    }

    console.log('[Informe Venta Producto] Estados filtro actualizados:', ivp_estadosFiltro);
}

// =========================================================================
// EVENT LISTENERS
// =========================================================================

/**
 * Configura los event listeners del modulo
 */
function configurarEventListenersIVP() {
    console.log('[Informe Venta Producto] Configurando event listeners...');

    // Boton de buscar
    const btnBuscar = document.getElementById('btn-buscar-historial-producto');
    if (btnBuscar) {
        btnBuscar.addEventListener('click', ejecutarBusquedaHistorial);
    }

    // Botones de paginacion
    const btnPrev = document.getElementById('btn-prev-page-venta-producto');
    const btnNext = document.getElementById('btn-next-page-venta-producto');

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            if (ivp_currentPage > 1) {
                ivp_currentPage--;
                renderizarTablaPaginadaIVP();
            }
        });
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            const totalPages = Math.ceil(ivp_allData.length / ivp_rowsPerPage);
            if (ivp_currentPage < totalPages) {
                ivp_currentPage++;
                renderizarTablaPaginadaIVP();
            }
        });
    }

    // Boton de exportar CSV
    const btnExportar = document.getElementById('btn-exportar-csv-venta-producto');
    if (btnExportar) {
        btnExportar.addEventListener('click', exportarVentaProductoCSV);
    }

    console.log('[Informe Venta Producto] Event listeners configurados');
}

// =========================================================================
// BUSQUEDA Y CARGA DE DATOS
// =========================================================================

/**
 * Ejecuta la busqueda del historial de producto
 */
async function ejecutarBusquedaHistorial() {
    // Verificar si el modulo esta activo
    if (!informeVentaProductoModuloActivo) {
        console.warn('[Informe Venta Producto] Modulo inactivo, cancelando busqueda');
        return;
    }

    // Validar que hay un producto seleccionado
    if (!ivp_productoSeleccionado) {
        showNotification('Por favor, seleccione un producto para buscar', 'warning');
        return;
    }

    // Validar fechas
    if (!ivp_fechaInicio || !ivp_fechaFin) {
        showNotification('Por favor, seleccione el rango de fechas', 'warning');
        return;
    }

    if (ivp_isLoading) {
        console.log('[Informe Venta Producto] Ya hay una busqueda en proceso');
        return;
    }

    ivp_isLoading = true;
    console.log('[Informe Venta Producto] Ejecutando busqueda...');
    console.log('[Informe Venta Producto] Parametros:', {
        producto: ivp_productoSeleccionado.nombre,
        fechaInicio: ivp_fechaInicio,
        fechaFin: ivp_fechaFin,
        estados: ivp_estadosFiltro
    });

    // Mostrar loading en tabla
    const tbody = document.getElementById('tbody-venta-producto');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center" style="padding: 40px;">
                    <i class="fas fa-spinner fa-spin"></i> Buscando historial de ventas...
                </td>
            </tr>
        `;
    }

    // Deshabilitar boton de busqueda
    const btnBuscar = document.getElementById('btn-buscar-historial-producto');
    if (btnBuscar) {
        btnBuscar.disabled = true;
        btnBuscar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Consultando...';
    }

    try {
        const client = getSupabaseClient();
        if (!client) {
            throw new Error('Cliente de Supabase no inicializado');
        }

        // Llamar a la funcion RPC
        const { data, error } = await client.rpc('buscar_historial_producto', {
            busqueda_producto: ivp_productoSeleccionado.nombre,
            fecha_inicio: ivp_fechaInicio,
            fecha_fin: ivp_fechaFin,
            estados_filtro: ivp_estadosFiltro
        });

        if (error) {
            throw error;
        }

        // Verificar si el modulo sigue activo
        if (!informeVentaProductoModuloActivo) {
            console.warn('[Informe Venta Producto] Modulo inactivo despues de la consulta');
            return;
        }

        // Guardar datos
        ivp_allData = data || [];
        ivp_currentPage = 1;

        console.log(`[Informe Venta Producto] ${ivp_allData.length} registros encontrados`);

        // Mostrar resumen de busqueda
        mostrarResumenBusqueda();

        // Renderizar tabla
        renderizarTablaPaginadaIVP();

        // Mostrar controles de paginacion
        const paginationControls = document.getElementById('pagination-controls-venta-producto');
        if (paginationControls) {
            paginationControls.style.display = ivp_allData.length > 0 ? 'flex' : 'none';
        }

    } catch (error) {
        console.error('[Informe Venta Producto] Error en busqueda:', error);
        showNotification('Error al consultar el historial: ' + error.message, 'error');

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center" style="padding: 40px; color: #EF4444;">
                        <i class="fas fa-exclamation-triangle"></i>
                        Error al cargar los datos: ${error.message}
                    </td>
                </tr>
            `;
        }
    } finally {
        ivp_isLoading = false;

        // Restaurar boton de busqueda
        if (btnBuscar) {
            btnBuscar.disabled = false;
            btnBuscar.innerHTML = '<i class="fas fa-search"></i> Consultar';
        }
    }
}

/**
 * Muestra el resumen de la busqueda realizada
 */
function mostrarResumenBusqueda() {
    const resumenContainer = document.getElementById('resumen-busqueda-venta-producto');
    if (!resumenContainer) return;

    // Mostrar el contenedor
    resumenContainer.style.display = 'flex';

    // Actualizar nombre del producto
    const nombreProducto = document.getElementById('resumen-producto-nombre');
    if (nombreProducto && ivp_productoSeleccionado) {
        nombreProducto.textContent = ivp_productoSeleccionado.nombre;
    }

    // Actualizar fechas
    const fechas = document.getElementById('resumen-fechas');
    if (fechas) {
        fechas.textContent = `${formatearFechaCorta(ivp_fechaInicio)} - ${formatearFechaCorta(ivp_fechaFin)}`;
    }

    // Actualizar total de registros
    const totalRegistros = document.getElementById('resumen-total-registros');
    if (totalRegistros) {
        totalRegistros.textContent = `${ivp_allData.length} registro${ivp_allData.length !== 1 ? 's' : ''}`;
    }
}

// =========================================================================
// RENDERIZADO DE TABLA
// =========================================================================

/**
 * Renderiza la tabla con paginacion client-side
 */
function renderizarTablaPaginadaIVP() {
    // Verificar si el modulo esta activo
    if (!informeVentaProductoModuloActivo) {
        console.warn('[Informe Venta Producto] Modulo inactivo, cancelando renderizado');
        return;
    }

    console.log(`[Informe Venta Producto] Renderizando pagina ${ivp_currentPage}...`);

    const tbody = document.getElementById('tbody-venta-producto');
    if (!tbody) {
        console.warn('[Informe Venta Producto] Tbody no encontrado');
        return;
    }

    // Calcular indices de paginacion
    const startIndex = (ivp_currentPage - 1) * ivp_rowsPerPage;
    const endIndex = startIndex + ivp_rowsPerPage;
    const paginatedData = ivp_allData.slice(startIndex, endIndex);

    // Limpiar tabla
    tbody.innerHTML = '';

    // Si no hay datos
    if (paginatedData.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-state-row">
                <td colspan="6">
                    <div class="empty-state-content">
                        <i class="fas fa-inbox"></i>
                        <p>No se encontraron registros de ventas para este producto en el periodo seleccionado</p>
                    </div>
                </td>
            </tr>
        `;
        actualizarControlesPaginacionIVP();
        return;
    }

    // Renderizar filas
    paginatedData.forEach(item => {
        const row = document.createElement('tr');

        // Determinar clase del badge segun estado
        const estadoClass = obtenerClaseEstado(item.estado);

        // Formatear telefono para links
        const telefonoLimpio = item.telefono_principal ? item.telefono_principal.replace(/\D/g, '') : '';

        row.innerHTML = `
            <td>
                <div style="font-weight: 600; color: #1F2937;">${escapeHtmlIVP(item.nombre_producto || '-')}</div>
            </td>
            <td>${escapeHtmlIVP(item.nombre_cliente || '-')}</td>
            <td>
                ${item.telefono_principal ? `
                    <div class="contacto-telefono">
                        <span>${escapeHtmlIVP(item.telefono_principal)}</span>
                        <a href="https://wa.me/${telefonoLimpio}" target="_blank" class="btn-whatsapp" title="WhatsApp">
                            <i class="fab fa-whatsapp"></i>
                        </a>
                    </div>
                ` : '-'}
            </td>
            <td class="text-center">${formatearFechaCorta(item.fecha_solicitud)}</td>
            <td class="text-right" style="font-weight: 500;">${formatearNumeroIVP(item.cantidad)}</td>
            <td class="text-center">
                <span class="estado-badge ${estadoClass}">${escapeHtmlIVP(item.estado || '-')}</span>
            </td>
        `;

        tbody.appendChild(row);
    });

    // Actualizar controles de paginacion
    actualizarControlesPaginacionIVP();

    console.log(`[Informe Venta Producto] ${paginatedData.length} filas renderizadas`);
}

/**
 * Obtiene la clase CSS para el badge de estado
 */
function obtenerClaseEstado(estado) {
    if (!estado) return 'estado-borrador';

    const estadoLower = estado.toLowerCase();

    if (estadoLower === 'completado' || estadoLower === 'completada') {
        return 'estado-completado';
    } else if (estadoLower === 'pendiente') {
        return 'estado-pendiente';
    } else if (estadoLower === 'en proceso' || estadoLower === 'en_proceso') {
        return 'estado-en-proceso';
    } else if (estadoLower === 'borrador') {
        return 'estado-borrador';
    }

    return 'estado-borrador';
}

/**
 * Actualiza los controles de paginacion
 */
function actualizarControlesPaginacionIVP() {
    const totalPages = Math.ceil(ivp_allData.length / ivp_rowsPerPage) || 1;
    const btnPrev = document.getElementById('btn-prev-page-venta-producto');
    const btnNext = document.getElementById('btn-next-page-venta-producto');
    const pageInfo = document.getElementById('page-info-venta-producto');

    // Habilitar/deshabilitar botones
    if (btnPrev) {
        btnPrev.disabled = ivp_currentPage <= 1;
    }

    if (btnNext) {
        btnNext.disabled = ivp_currentPage >= totalPages;
    }

    // Actualizar informacion de pagina
    if (pageInfo) {
        if (ivp_allData.length === 0) {
            pageInfo.textContent = 'No hay resultados';
        } else {
            const start = (ivp_currentPage - 1) * ivp_rowsPerPage + 1;
            const end = Math.min(ivp_currentPage * ivp_rowsPerPage, ivp_allData.length);
            pageInfo.textContent = `Mostrando ${start}-${end} de ${ivp_allData.length} | Pagina ${ivp_currentPage} de ${totalPages}`;
        }
    }
}

// =========================================================================
// EXPORTACION A CSV
// =========================================================================

/**
 * Exporta los datos actuales a CSV
 */
async function exportarVentaProductoCSV() {
    console.log('[Informe Venta Producto] Iniciando exportacion a CSV...');

    if (!ivp_allData || ivp_allData.length === 0) {
        showNotification('No hay datos para exportar. Realice una busqueda primero.', 'warning');
        return;
    }

    const btn = document.getElementById('btn-exportar-csv-venta-producto');

    // Estado de carga
    if (btn) {
        btn.disabled = true;
        btn.classList.add('button-loading');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exportando...';

        try {
            // Headers del CSV
            const headers = [
                'Producto',
                'Cliente',
                'Telefono',
                'Fecha',
                'Cantidad',
                'Estado'
            ];

            // Convertir datos a filas CSV
            const rows = ivp_allData.map(item => {
                return [
                    cleanCsvValueIVP(item.nombre_producto),
                    cleanCsvValueIVP(item.nombre_cliente),
                    cleanCsvValueIVP(item.telefono_principal),
                    item.fecha_solicitud || '',
                    item.cantidad || 0,
                    cleanCsvValueIVP(item.estado)
                ];
            });

            // Crear string CSV
            const csvString = [
                headers.join(','),
                ...rows.map(row => row.join(','))
            ].join('\n');

            // Descargar archivo con BOM para UTF-8
            const blob = new Blob(["\uFEFF" + csvString], {
                type: 'text/csv;charset=utf-8;'
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');

            const fecha = new Date().toISOString().slice(0, 10);
            const nombreProducto = ivp_productoSeleccionado?.nombre?.substring(0, 20) || 'producto';
            const nombreArchivo = `informe_venta_${nombreProducto.replace(/[^a-zA-Z0-9]/g, '_')}_${fecha}.csv`;

            link.setAttribute('href', url);
            link.setAttribute('download', nombreArchivo);

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showNotification(`${ivp_allData.length} registros exportados exitosamente`, 'success');
            console.log('[Informe Venta Producto] Exportacion completada');

        } catch (error) {
            console.error('[Informe Venta Producto] Error exportando:', error);
            showNotification('Error al exportar el archivo CSV', 'error');
        } finally {
            // Restaurar boton
            if (btn) {
                btn.disabled = false;
                btn.classList.remove('button-loading');
                btn.innerHTML = originalText;
            }
        }
    }
}

/**
 * Limpia valores para CSV (escapa comillas, comas, etc.)
 */
function cleanCsvValueIVP(value) {
    if (value === null || value === undefined) return '';
    const stringValue = value.toString();

    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

// =========================================================================
// FUNCIONES HELPER
// =========================================================================

/**
 * Formatea un numero con separadores de miles
 */
function formatearNumeroIVP(numero) {
    if (numero === null || numero === undefined) return '0';
    return Number(numero).toLocaleString('es-CO');
}

/**
 * Formatea una fecha en formato corto (DD/MM/YYYY)
 * Evita problemas de zona horaria parseando la fecha manualmente
 */
function formatearFechaCorta(fechaStr) {
    if (!fechaStr) return '-';

    try {
        // Si viene en formato YYYY-MM-DD, parsear manualmente para evitar desfase de zona horaria
        if (typeof fechaStr === 'string' && fechaStr.match(/^\d{4}-\d{2}-\d{2}/)) {
            const partes = fechaStr.split('T')[0].split('-');
            const dia = partes[2];
            const mes = partes[1];
            const anio = partes[0];
            return `${dia}/${mes}/${anio}`;
        }

        // Fallback para otros formatos
        const fecha = new Date(fechaStr + 'T12:00:00');
        if (isNaN(fecha.getTime())) return fechaStr;

        return fecha.toLocaleDateString('es-CO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        return fechaStr;
    }
}

/**
 * Escapa HTML para prevenir XSS
 */
function escapeHtmlIVP(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// =========================================================================
// MÓDULO DE MARCAS - GESTIÓN COMPLETA
// =========================================================================

// Variables globales
let modalMarca;
let formMarca;
let modalMarcaTitulo;

// Variable para el patrón dirty form
let estadoInicialFormularioMarca = {};

// =========================================================================
// FUNCIÓN DE INICIALIZACIÓN DEL MÓDULO
// =========================================================================

/**
 * Función principal para cargar el módulo de marcas.
 * Se llama desde home.js cuando se navega a la página de marcas.
 */
async function cargarPaginaMarcas() {
    console.log('[Marcas] ===== INICIALIZANDO MÓDULO DE MARCAS =====');

    try {
        // Configurar event listeners
        configurarPaginaMarcasYListeners();

        // Cargar lista de marcas
        await cargarDatosTablaMarcas();

        console.log('[Marcas] ✓ Módulo inicializado correctamente');
    } catch (error) {
        console.error('[Marcas] Error al inicializar módulo:', error);
        toastr.error('Error al cargar el módulo de marcas: ' + error.message, 'Error de Inicialización');
    }
}

/**
 * Configura los event listeners para los elementos de la página de marcas.
 */
function configurarPaginaMarcasYListeners() {
    console.log('[Marcas] Configurando event listeners...');

    // Inicializar modal de marca
    if (typeof inicializarModalMarca === 'function') {
        inicializarModalMarca();
    } else {
        console.error('[Marcas] La función inicializarModalMarca no está definida');
    }

    // Botón para añadir marca
    const btnAbrirModal = document.getElementById('btn-abrir-modal-nueva-marca');
    if (btnAbrirModal) {
        btnAbrirModal.addEventListener('click', () => abrirModalMarca('add'));
    }

    // Barra de búsqueda
    const searchBar = document.getElementById('input-buscar-marcas');
    if (searchBar) {
        searchBar.addEventListener('input', manejarBusquedaMarcas);
    }

    // Delegación de eventos para botones de acción en la tabla
    const tableContainer = document.querySelector('.data-table-default');
    if (tableContainer) {
        tableContainer.addEventListener('click', manejarAccionesTablaMarcas);
    }

    console.log('[Marcas] ✓ Event listeners configurados');
}

// =========================================================================
// INICIALIZACIÓN Y MANEJO DEL MODAL
// =========================================================================

/**
 * Inicializa el modal de marca y sus event listeners.
 */
function inicializarModalMarca() {
    console.log('[Marcas] Inicializando modal...');

    modalMarca = document.getElementById('modal-marca');
    formMarca = document.getElementById('form-marca');
    modalMarcaTitulo = document.getElementById('modal-marca-titulo');

    if (!modalMarca || !formMarca) {
        console.error('[Marcas] Modal no encontrado en el DOM');
        return;
    }

    // Botón cerrar (X)
    const btnCerrarX = document.getElementById('btn-cerrar-modal-marca-x');
    if (btnCerrarX) {
        btnCerrarX.addEventListener('click', cerrarModalMarca);
    }

    // Botón cancelar
    const btnCancelar = document.getElementById('btn-cancelar-operacion-marca');
    if (btnCancelar) {
        btnCancelar.addEventListener('click', cerrarModalMarca);
    }

    // Click fuera del modal
    modalMarca.addEventListener('click', (e) => {
        if (e.target === modalMarca) {
            cerrarModalMarca();
        }
    });

    // Submit del formulario
    formMarca.addEventListener('submit', manejarGuardarMarca);

    console.log('[Marcas] ✓ Modal inicializado');
}

/**
 * Abre el modal de marca en modo añadir o editar.
 * @param {string} modo - 'add' o 'edit'
 * @param {Object} marcaParaEditar - Datos de la marca (solo en modo edit)
 */
function abrirModalMarca(modo = 'add', marcaParaEditar = null) {
    console.log('[Marcas] Abriendo modal en modo:', modo);

    if (!modalMarca || !formMarca) {
        console.error('[Marcas] Modal no inicializado');
        return;
    }

    formMarca.reset();
    limpiarMensajesValidacionMarca();

    const inputId = document.getElementById('input-id-marca');
    const btnGuardar = document.getElementById('btn-guardar-cambios-marca');

    if (modo === 'edit' && marcaParaEditar) {
        // Modo EDITAR
        modalMarcaTitulo.textContent = 'Editar Marca';
        inputId.value = marcaParaEditar.id;
        document.getElementById('input-nombre-marca').value = marcaParaEditar.nombre || '';
        btnGuardar.textContent = 'Actualizar Marca';
    } else {
        // Modo AÑADIR
        modalMarcaTitulo.textContent = 'Añadir Nueva Marca';
        inputId.value = '';
        btnGuardar.textContent = 'Guardar Marca';
    }

    // Mostrar modal
    modalMarca.style.display = 'flex';
    setTimeout(() => {
        modalMarca.classList.add('is-visible');
        document.getElementById('input-nombre-marca').focus();
    }, 10);

    // Guardar estado inicial después de que el modal esté visible
    setTimeout(() => guardarEstadoInicialFormularioMarca(), 100);
}

/**
 * Cierra el modal de marca con validación de cambios (patrón dirty form).
 */
function cerrarModalMarca() {
    if (!modalMarca) return;

    console.log('[Marcas] Intentando cerrar modal...');

    // Verificar si hay cambios sin guardar
    if (verificarCambiosEnFormularioMarca()) {
        const mensaje = 'Hay cambios sin guardar que se perderán.';
        const titulo = '¿Cancelar sin guardar?';

        mostrarModalConfirmacion(mensaje, function() {
            console.log('[Marcas] Usuario confirmó cerrar sin guardar');
            modalMarca.classList.remove('is-visible');
            setTimeout(() => {
                if (!modalMarca.classList.contains('is-visible')) {
                    modalMarca.style.display = 'none';
                }
            }, 250);
        }, titulo);
    } else {
        // Formulario limpio - cerrar sin confirmación
        console.log('[Marcas] No hay cambios, cerrando sin confirmación');
        modalMarca.classList.remove('is-visible');
        setTimeout(() => {
            if (!modalMarca.classList.contains('is-visible')) {
                modalMarca.style.display = 'none';
            }
        }, 250);
    }
}

// =========================================================================
// FUNCIONES PARA DETECTAR CAMBIOS EN FORMULARIO (DIRTY FORM)
// =========================================================================

/**
 * Obtiene los valores actuales del formulario de marca.
 * @returns {Object} Objeto con los valores actuales del formulario
 */
function obtenerValoresActualesFormularioMarca() {
    return {
        nombre_marca: document.getElementById('input-nombre-marca')?.value || ''
    };
}

/**
 * Guarda el estado inicial del formulario de marca.
 */
function guardarEstadoInicialFormularioMarca() {
    estadoInicialFormularioMarca = obtenerValoresActualesFormularioMarca();
    console.log('[Marcas] Estado inicial del formulario guardado:', estadoInicialFormularioMarca);
}

/**
 * Verifica si hay cambios en el formulario de marca comparando con el estado inicial.
 * @returns {boolean} true si hay cambios, false si no hay cambios
 */
function verificarCambiosEnFormularioMarca() {
    const estadoActual = obtenerValoresActualesFormularioMarca();

    const hayCambios = estadoActual.nombre_marca !== estadoInicialFormularioMarca.nombre_marca;

    console.log('[Marcas] Verificando cambios:', {
        inicial: estadoInicialFormularioMarca,
        actual: estadoActual,
        hayCambios: hayCambios
    });

    return hayCambios;
}

// =========================================================================
// CARGA Y RENDERIZADO DE DATOS
// =========================================================================

/**
 * Obtiene y renderiza los datos de las marcas en la tabla.
 */
async function cargarDatosTablaMarcas() {
    const tbodyMarcas = document.getElementById('tbody-marcas');
    if (!tbodyMarcas) {
        console.error('[Marcas] Elemento tbody-marcas no encontrado');
        return;
    }

    tbodyMarcas.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:20px;font-style:italic;">Obteniendo datos de marcas...</td></tr>`;

    try {
        const client = getSupabaseClient();
        if (!client) {
            throw new Error('Cliente de Supabase no inicializado');
        }

        console.log('[Marcas] Cargando marcas desde Supabase...');

        // Obtener marcas con conteo de productos
        const { data, error } = await client
            .from('marcas')
            .select('id_marca, nombre_marca, productos(count)')
            .order('nombre_marca', { ascending: true });

        if (error) {
            console.error('[Marcas] Error al cargar marcas:', error);
            tbodyMarcas.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:20px;color:red;">Error al cargar marcas: ${error.message}</td></tr>`;
            return;
        }

        console.log('[Marcas] Marcas cargadas:', data?.length || 0);

        // Procesar datos para cantidad de productos
        const processedData = data.map(marca => {
            const count = (marca.productos && Array.isArray(marca.productos) && marca.productos.length > 0 && marca.productos[0].hasOwnProperty('count'))
                          ? marca.productos[0].count
                          : 0;

            const { productos, ...restOfMarca } = marca;

            return {
                ...restOfMarca,
                cantidad_productos: count
            };
        });

        renderizarTablaMarcas(processedData);

    } catch (error) {
        console.error('[Marcas] Error inesperado al cargar marcas:', error);
        tbodyMarcas.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:20px;color:red;">Error de comunicación: ${error.message}</td></tr>`;
    }
}

/**
 * Renderiza las filas de la tabla de marcas.
 * @param {Array<Object>} listaMarcas Array de objetos de marca
 */
function renderizarTablaMarcas(listaMarcas) {
    const tbodyMarcas = document.getElementById('tbody-marcas');
    if (!tbodyMarcas) {
        console.error('[Marcas] Elemento tbody-marcas no encontrado');
        return;
    }

    tbodyMarcas.innerHTML = '';

    if (!listaMarcas || listaMarcas.length === 0) {
        tbodyMarcas.innerHTML = `<tr><td colspan="3" style="text-align:center;padding:20px;font-style:italic;">No hay marcas registradas.</td></tr>`;
        return;
    }

    listaMarcas.forEach(marca => {
        const tr = document.createElement('tr');
        tr.dataset.brandId = marca.id_marca;

        // Columna: Nombre
        const tdNombre = document.createElement('td');
        tdNombre.textContent = marca.nombre_marca || '(Sin nombre)';
        tr.appendChild(tdNombre);

        // Columna: Nº Productos
        const tdNumProductos = document.createElement('td');
        tdNumProductos.textContent = marca.cantidad_productos || '0';
        tdNumProductos.style.textAlign = 'center';
        tr.appendChild(tdNumProductos);

        // Columna: Acciones
        const tdAcciones = document.createElement('td');
        tdAcciones.classList.add('cell-actions');
        tdAcciones.innerHTML = `
            <button class="action-button action-button-edit" title="Editar Marca">
                <i class="fas fa-pencil-alt"></i>
            </button>
            <button class="action-button action-button-delete" title="Eliminar Marca">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        tr.appendChild(tdAcciones);

        tbodyMarcas.appendChild(tr);
    });
}

/**
 * Refresca la tabla de marcas.
 */
function refrescarTablaMarcas() {
    console.log('[Marcas] Refrescando tabla...');
    cargarDatosTablaMarcas();
}

// =========================================================================
// MANEJO DE ACCIONES EN LA TABLA
// =========================================================================

/**
 * Manejador de eventos para los botones de acción en la tabla.
 * @param {Event} event Objeto evento del clic
 */
function manejarAccionesTablaMarcas(event) {
    const actionButton = event.target.closest('.action-button');
    if (!actionButton) return;

    const tr = actionButton.closest('tr');
    const brandId = tr ? tr.dataset.brandId : null;

    if (!brandId) {
        console.warn('[Marcas] No se pudo obtener el ID de la marca', tr);
        return;
    }

    if (actionButton.classList.contains('action-button-edit')) {
        console.log('[Marcas] Acción: Editar marca', brandId);
        obtenerMarcaParaEditar(brandId);
    } else if (actionButton.classList.contains('action-button-delete')) {
        console.log('[Marcas] Acción: Eliminar marca', brandId);
        confirmarYEliminarMarca(brandId);
    }
}

/**
 * Obtiene los datos de una marca para editar.
 * @param {string} idMarca UUID de la marca
 */
async function obtenerMarcaParaEditar(idMarca) {
    try {
        console.log('[Marcas] Obteniendo marca para editar, ID:', idMarca);

        const client = getSupabaseClient();
        if (!client) {
            throw new Error('Cliente de Supabase no inicializado');
        }

        const { data, error } = await client
            .from('marcas')
            .select('*')
            .eq('id_marca', idMarca)
            .single();

        if (error) {
            console.error('[Marcas] Error al obtener marca:', error);

            if (error.code === 'PGRST116') {
                toastr.error('La marca no fue encontrada o no tienes permisos para verla.', 'Error de Permisos');
            } else {
                toastr.error('Error al obtener datos de la marca: ' + error.message, 'Error');
            }
            return;
        }

        if (!data) {
            toastr.warning('No se encontraron datos de la marca.', 'Advertencia');
            return;
        }

        console.log('[Marcas] Marca obtenida:', data);

        const marcaParaEditar = {
            id: data.id_marca,
            nombre: data.nombre_marca
        };

        abrirModalMarca('edit', marcaParaEditar);

    } catch (error) {
        console.error('[Marcas] Error inesperado al obtener marca:', error);
        toastr.error('Error de comunicación al obtener datos para editar: ' + error.message, 'Error de Comunicación');
    }
}

/**
 * Muestra confirmación y elimina una marca usando RPC.
 * @param {string} idMarca UUID de la marca a eliminar
 */
async function confirmarYEliminarMarca(idMarca) {
    const nombreMarca = obtenerNombreMarcaDeLaFilaPorId(idMarca) || 'la marca seleccionada';

    mostrarModalConfirmacion(
        `¿Estás realmente seguro de que quieres eliminar ${nombreMarca}?\nEsta acción no se puede deshacer.`,
        async function() {
            try {
                console.log('[Marcas] Eliminando marca ID:', idMarca);

                const client = getSupabaseClient();
                if (!client) {
                    throw new Error('Cliente de Supabase no inicializado');
                }

                const { data, error } = await client
                    .rpc('fn_eliminar_marca', {
                        p_marca_id: idMarca
                    });

                if (error) throw error;

                if (!data.exito) {
                    throw new Error(data.mensaje);
                }

                console.log('[Marcas] Marca eliminada:', data);
                toastr.success(data.mensaje, 'Éxito');
                refrescarTablaMarcas();

            } catch (error) {
                console.error('[Marcas] Error al eliminar marca:', error);
                toastr.error(error.message || 'Error al eliminar la marca', 'Error al Eliminar');
            }
        },
        'Confirmar Eliminación'
    );
}

/**
 * Obtiene el nombre de una marca de la tabla por su ID.
 * @param {string} idMarca UUID de la marca
 * @returns {string} Nombre de la marca o fallback
 */
function obtenerNombreMarcaDeLaFilaPorId(idMarca) {
    const tbodyMarcas = document.getElementById('tbody-marcas');
    if (!tbodyMarcas) return `ID: ${idMarca}`;

    const fila = tbodyMarcas.querySelector(`tr[data-brand-id="${idMarca}"]`);
    if (fila && fila.cells[0]) {
        return `"${fila.cells[0].textContent.trim()}"`;
    }
    return `la marca seleccionada (ID: ${idMarca})`;
}

// =========================================================================
// BÚSQUEDA LOCAL EN LA TABLA
// =========================================================================

/**
 * Maneja el evento de búsqueda en la tabla de marcas.
 * @param {Event} event Objeto evento del input
 */
function manejarBusquedaMarcas(event) {
    const searchTerm = quitarAcentos(event.target.value.toLowerCase().trim());
    const tbodyMarcas = document.getElementById('tbody-marcas');

    if (!tbodyMarcas) {
        console.warn('[Marcas] tbody-marcas no encontrado');
        return;
    }

    const tableRows = tbodyMarcas.querySelectorAll('tr');
    let hayResultados = false;

    tableRows.forEach(row => {
        // No procesar filas de mensaje (colspan)
        if (row.cells.length === 1 && row.cells[0].getAttribute('colspan')) {
            return;
        }

        const tdNombre = row.cells[0];
        const nombreMarca = quitarAcentos(tdNombre ? tdNombre.textContent.toLowerCase() : '');

        if (nombreMarca.includes(searchTerm)) {
            row.style.display = '';
            hayResultados = true;
        } else {
            row.style.display = 'none';
        }
    });

    // Manejo del mensaje "No se encontraron resultados"
    let noResultsRow = tbodyMarcas.querySelector('.no-results-row-marcas');

    if (!hayResultados && searchTerm !== '') {
        if (!noResultsRow) {
            noResultsRow = document.createElement('tr');
            noResultsRow.classList.add('no-results-row-marcas');
            const cell = document.createElement('td');
            cell.setAttribute('colspan', '3');
            cell.textContent = 'No se encontraron marcas que coincidan con la búsqueda.';
            cell.style.textAlign = 'center';
            cell.style.padding = '15px';
            cell.style.fontStyle = 'italic';
            noResultsRow.appendChild(cell);
            tbodyMarcas.appendChild(noResultsRow);
        } else {
            noResultsRow.style.display = '';
        }
    } else if (noResultsRow) {
        noResultsRow.style.display = 'none';
    }
}

// =========================================================================
// GUARDAR MARCA (CREAR/EDITAR)
// =========================================================================

/**
 * Maneja el guardado de marca (crear o editar) usando RPC.
 * @param {Event} event Objeto evento del submit
 */
async function manejarGuardarMarca(event) {
    event.preventDefault();
    console.log('[Marcas] Iniciando proceso de guardado...');

    limpiarMensajesValidacionMarca();

    const btnGuardar = document.getElementById('btn-guardar-cambios-marca');
    const btnCancelar = document.getElementById('btn-cancelar-operacion-marca');
    const textoOriginalBtn = btnGuardar.textContent;

    try {
        // Deshabilitar botones
        btnGuardar.disabled = true;
        btnCancelar.disabled = true;
        btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        // Obtener datos del formulario
        const idMarca = document.getElementById('input-id-marca').value.trim();
        const nombreMarca = document.getElementById('input-nombre-marca').value.trim();

        // Validar nombre
        if (!nombreMarca) {
            mostrarErrorValidacion('nombre-marca', 'El nombre de la marca es obligatorio');
            return;
        }

        if (nombreMarca.length > 100) {
            mostrarErrorValidacion('nombre-marca', 'El nombre no puede exceder 100 caracteres');
            return;
        }

        const client = getSupabaseClient();
        if (!client) {
            throw new Error('Cliente de Supabase no inicializado');
        }

        let resultado;

        if (idMarca) {
            // EDITAR - Usar RPC
            console.log('[Marcas] Actualizando marca existente...');

            const { data, error } = await client.rpc('fn_actualizar_marca', {
                p_marca_data: {
                    id_marca: idMarca,
                    nombre_marca: nombreMarca
                }
            });

            if (error) throw error;
            resultado = data;

        } else {
            // CREAR - Usar RPC
            console.log('[Marcas] Creando nueva marca...');

            const { data, error } = await client.rpc('fn_crear_marca', {
                p_marca_data: {
                    nombre_marca: nombreMarca
                }
            });

            if (error) throw error;
            resultado = data;
        }

        // Verificar resultado
        if (!resultado.exito) {
            throw new Error(resultado.mensaje);
        }

        console.log('[Marcas] Operación exitosa:', resultado);
        toastr.success(resultado.mensaje, 'Éxito');

        // Cerrar modal y refrescar tabla
        modalMarca.classList.remove('is-visible');
        setTimeout(() => {
            if (!modalMarca.classList.contains('is-visible')) {
                modalMarca.style.display = 'none';
            }
        }, 250);

        refrescarTablaMarcas();

    } catch (error) {
        console.error('[Marcas] Error al guardar marca:', error);
        toastr.error(error.message || 'Error al guardar la marca', 'Error');
    } finally {
        // Rehabilitar botones
        btnGuardar.disabled = false;
        btnCancelar.disabled = false;
        btnGuardar.textContent = textoOriginalBtn;
    }
}

// =========================================================================
// VALIDACIÓN DEL FORMULARIO
// =========================================================================

/**
 * Muestra un mensaje de error de validación en un campo.
 * @param {string} fieldId ID del campo (sin 'input-' o 'error-')
 * @param {string} mensaje Mensaje de error
 */
function mostrarErrorValidacion(fieldId, mensaje) {
    const input = document.getElementById('input-' + fieldId);
    const errorDiv = document.getElementById('error-' + fieldId);

    if (input) input.classList.add('is-invalid');
    if (errorDiv) {
        errorDiv.textContent = mensaje;
        errorDiv.style.display = 'block';
    }

    // Hacer foco en el primer campo con error
    if (input) input.focus();
}

/**
 * Limpia todos los mensajes de validación del formulario.
 */
function limpiarMensajesValidacionMarca() {
    const inputs = formMarca.querySelectorAll('.form-input');
    inputs.forEach(input => input.classList.remove('is-invalid'));

    const errorMessages = formMarca.querySelectorAll('.validation-message');
    errorMessages.forEach(msg => {
        msg.textContent = '';
        msg.style.display = 'none';
    });
}

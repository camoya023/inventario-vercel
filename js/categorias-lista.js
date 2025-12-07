// =========================================================================
// MÓDULO DE CATEGORÍAS - GESTIÓN COMPLETA
// =========================================================================

// Variables globales
let modalCategoria;
let formCategoria;
let modalCategoriaTitulo;

// Variable para el patrón dirty form
let estadoInicialFormularioCategoria = {};

// =========================================================================
// FUNCIÓN DE INICIALIZACIÓN DEL MÓDULO
// =========================================================================

/**
 * Función principal para cargar el módulo de categorías.
 * Se llama desde home.js cuando se navega a la página de categorías.
 */
async function cargarPaginaCategorias() {
    console.log('[Categorías] ===== INICIALIZANDO MÓDULO DE CATEGORÍAS =====');

    try {
        // Configurar event listeners
        configurarPaginaCategoriasYListeners();

        // Cargar lista de categorías
        await cargarDatosTablaCategorias();

        console.log('[Categorías] ✓ Módulo inicializado correctamente');
    } catch (error) {
        console.error('[Categorías] Error al inicializar módulo:', error);
        toastr.error('Error al cargar el módulo de categorías: ' + error.message, 'Error de Inicialización');
    }
}

/**
 * Configura los event listeners para los elementos de la página de categorías.
 */
function configurarPaginaCategoriasYListeners() {
    console.log('[Categorías] Configurando event listeners...');

    // Inicializar modal de categoría
    if (typeof inicializarModalCategoria === 'function') {
        inicializarModalCategoria();
    } else {
        console.error('[Categorías] La función inicializarModalCategoria no está definida');
    }

    // Botón para añadir categoría
    const btnAbrirModal = document.getElementById('btn-abrir-modal-nueva-categoria');
    if (btnAbrirModal) {
        btnAbrirModal.addEventListener('click', () => abrirModalCategoria('add'));
    }

    // Barra de búsqueda
    const searchBar = document.getElementById('input-buscar-categorias');
    if (searchBar) {
        searchBar.addEventListener('input', manejarBusquedaCategorias);
    }

    // Delegación de eventos para botones de acción en la tabla
    const tableContainer = document.querySelector('.data-table-default');
    if (tableContainer) {
        tableContainer.addEventListener('click', manejarAccionesTablaCategorias);
    }

    console.log('[Categorías] ✓ Event listeners configurados');
}

// =========================================================================
// INICIALIZACIÓN Y MANEJO DEL MODAL
// =========================================================================

/**
 * Inicializa el modal de categoría y sus event listeners.
 */
function inicializarModalCategoria() {
    console.log('[Categorías] Inicializando modal...');

    modalCategoria = document.getElementById('modal-categoria');
    formCategoria = document.getElementById('form-categoria');
    modalCategoriaTitulo = document.getElementById('modal-categoria-titulo');

    if (!modalCategoria || !formCategoria) {
        console.error('[Categorías] Modal no encontrado en el DOM');
        return;
    }

    // Botón cerrar (X)
    const btnCerrarX = document.getElementById('btn-cerrar-modal-categoria-x');
    if (btnCerrarX) {
        btnCerrarX.addEventListener('click', cerrarModalCategoria);
    }

    // Botón cancelar
    const btnCancelar = document.getElementById('btn-cancelar-operacion-categoria');
    if (btnCancelar) {
        btnCancelar.addEventListener('click', cerrarModalCategoria);
    }

    // Click fuera del modal
    modalCategoria.addEventListener('click', (e) => {
        if (e.target === modalCategoria) {
            cerrarModalCategoria();
        }
    });

    // Submit del formulario
    formCategoria.addEventListener('submit', manejarGuardarCategoria);

    console.log('[Categorías] ✓ Modal inicializado');
}

/**
 * Abre el modal de categoría en modo añadir o editar.
 * @param {string} modo - 'add' o 'edit'
 * @param {Object} categoriaParaEditar - Datos de la categoría (solo en modo edit)
 */
function abrirModalCategoria(modo = 'add', categoriaParaEditar = null) {
    console.log('[Categorías] Abriendo modal en modo:', modo);

    if (!modalCategoria || !formCategoria) {
        console.error('[Categorías] Modal no inicializado');
        return;
    }

    formCategoria.reset();
    limpiarMensajesValidacionCategoria();

    const inputId = document.getElementById('input-id-categoria');
    const btnGuardar = document.getElementById('btn-guardar-cambios-categoria');

    if (modo === 'edit' && categoriaParaEditar) {
        // Modo EDITAR
        modalCategoriaTitulo.textContent = 'Editar Categoría';
        inputId.value = categoriaParaEditar.id;
        document.getElementById('input-nombre-categoria').value = categoriaParaEditar.nombre || '';
        document.getElementById('input-descripcion-categoria').value = categoriaParaEditar.descripcion || '';
        btnGuardar.textContent = 'Actualizar Categoría';
    } else {
        // Modo AÑADIR
        modalCategoriaTitulo.textContent = 'Añadir Nueva Categoría';
        inputId.value = '';
        btnGuardar.textContent = 'Guardar Categoría';
    }

    // Mostrar modal
    modalCategoria.style.display = 'flex';
    setTimeout(() => {
        modalCategoria.classList.add('is-visible');
        document.getElementById('input-nombre-categoria').focus();
    }, 10);

    // Guardar estado inicial después de que el modal esté visible
    setTimeout(() => guardarEstadoInicialFormularioCategoria(), 100);
}

/**
 * Cierra el modal de categoría con validación de cambios (patrón dirty form).
 */
function cerrarModalCategoria() {
    if (!modalCategoria) return;

    console.log('[Categorías] Intentando cerrar modal...');

    // Verificar si hay cambios sin guardar
    if (verificarCambiosEnFormularioCategoria()) {
        const mensaje = 'Hay cambios sin guardar que se perderán.';
        const titulo = '¿Cancelar sin guardar?';

        mostrarModalConfirmacion(mensaje, function() {
            console.log('[Categorías] Usuario confirmó cerrar sin guardar');
            modalCategoria.classList.remove('is-visible');
            setTimeout(() => {
                if (!modalCategoria.classList.contains('is-visible')) {
                    modalCategoria.style.display = 'none';
                }
            }, 250);
        }, titulo);
    } else {
        // Formulario limpio - cerrar sin confirmación
        console.log('[Categorías] No hay cambios, cerrando sin confirmación');
        modalCategoria.classList.remove('is-visible');
        setTimeout(() => {
            if (!modalCategoria.classList.contains('is-visible')) {
                modalCategoria.style.display = 'none';
            }
        }, 250);
    }
}

// =========================================================================
// FUNCIONES PARA DETECTAR CAMBIOS EN FORMULARIO (DIRTY FORM)
// =========================================================================

/**
 * Obtiene los valores actuales del formulario de categoría.
 * @returns {Object} Objeto con los valores actuales del formulario
 */
function obtenerValoresActualesFormularioCategoria() {
    return {
        nombre_categoria: document.getElementById('input-nombre-categoria')?.value || '',
        descripcion_categoria: document.getElementById('input-descripcion-categoria')?.value || ''
    };
}

/**
 * Guarda el estado inicial del formulario de categoría.
 */
function guardarEstadoInicialFormularioCategoria() {
    estadoInicialFormularioCategoria = obtenerValoresActualesFormularioCategoria();
    console.log('[Categorías] Estado inicial del formulario guardado:', estadoInicialFormularioCategoria);
}

/**
 * Verifica si hay cambios en el formulario de categoría comparando con el estado inicial.
 * @returns {boolean} true si hay cambios, false si no hay cambios
 */
function verificarCambiosEnFormularioCategoria() {
    const estadoActual = obtenerValoresActualesFormularioCategoria();

    const hayCambios =
        estadoActual.nombre_categoria !== estadoInicialFormularioCategoria.nombre_categoria ||
        estadoActual.descripcion_categoria !== estadoInicialFormularioCategoria.descripcion_categoria;

    console.log('[Categorías] Verificando cambios:', {
        inicial: estadoInicialFormularioCategoria,
        actual: estadoActual,
        hayCambios: hayCambios
    });

    return hayCambios;
}

// =========================================================================
// CARGA Y RENDERIZADO DE DATOS
// =========================================================================

/**
 * Obtiene y renderiza los datos de las categorías en la tabla.
 */
async function cargarDatosTablaCategorias() {
    const tbodyCategorias = document.getElementById('tbody-categorias');
    if (!tbodyCategorias) {
        console.error('[Categorías] Elemento tbody-categorias no encontrado');
        return;
    }

    tbodyCategorias.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;font-style:italic;">Obteniendo datos de categorías...</td></tr>`;

    try {
        const client = getSupabaseClient();
        if (!client) {
            throw new Error('Cliente de Supabase no inicializado');
        }

        console.log('[Categorías] Cargando categorías desde Supabase...');

        // Obtener categorías con conteo de productos
        const { data, error } = await client
            .from('categorias')
            .select('id_categoria, nombre_categoria, descripcion_categoria, productos(count)')
            .order('nombre_categoria', { ascending: true });

        if (error) {
            console.error('[Categorías] Error al cargar categorías:', error);
            tbodyCategorias.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:red;">Error al cargar categorías: ${error.message}</td></tr>`;
            return;
        }

        console.log('[Categorías] Categorías cargadas:', data?.length || 0);

        // Procesar datos para cantidad de productos
        const processedData = data.map(categoria => {
            const count = (categoria.productos && Array.isArray(categoria.productos) && categoria.productos.length > 0 && categoria.productos[0].hasOwnProperty('count'))
                          ? categoria.productos[0].count
                          : 0;

            const { productos, ...restOfCategoria } = categoria;

            return {
                ...restOfCategoria,
                cantidad_productos: count
            };
        });

        renderizarTablaCategorias(processedData);

    } catch (error) {
        console.error('[Categorías] Error inesperado al cargar categorías:', error);
        tbodyCategorias.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:red;">Error de comunicación: ${error.message}</td></tr>`;
    }
}

/**
 * Renderiza las filas de la tabla de categorías.
 * @param {Array<Object>} listaCategorias Array de objetos de categoría
 */
function renderizarTablaCategorias(listaCategorias) {
    const tbodyCategorias = document.getElementById('tbody-categorias');
    if (!tbodyCategorias) {
        console.error('[Categorías] Elemento tbody-categorias no encontrado');
        return;
    }

    tbodyCategorias.innerHTML = '';

    if (!listaCategorias || listaCategorias.length === 0) {
        tbodyCategorias.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;font-style:italic;">No hay categorías registradas.</td></tr>`;
        return;
    }

    listaCategorias.forEach(categoria => {
        const tr = document.createElement('tr');
        tr.dataset.categoryId = categoria.id_categoria;

        // Columna: Nombre
        const tdNombre = document.createElement('td');
        tdNombre.textContent = categoria.nombre_categoria || '(Sin nombre)';
        tr.appendChild(tdNombre);

        // Columna: Descripción
        const tdDescripcion = document.createElement('td');
        tdDescripcion.textContent = categoria.descripcion_categoria || '';
        tr.appendChild(tdDescripcion);

        // Columna: Nº Productos
        const tdNumProductos = document.createElement('td');
        tdNumProductos.textContent = categoria.cantidad_productos || '0';
        tdNumProductos.style.textAlign = 'center';
        tr.appendChild(tdNumProductos);

        // Columna: Acciones
        const tdAcciones = document.createElement('td');
        tdAcciones.classList.add('cell-actions');
        tdAcciones.innerHTML = `
            <button class="action-button action-button-edit" title="Editar Categoría">
                <i class="fas fa-pencil-alt"></i>
            </button>
            <button class="action-button action-button-delete" title="Eliminar Categoría">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        tr.appendChild(tdAcciones);

        tbodyCategorias.appendChild(tr);
    });
}

/**
 * Refresca la tabla de categorías.
 */
function refrescarTablaCategorias() {
    console.log('[Categorías] Refrescando tabla...');
    cargarDatosTablaCategorias();
}

// =========================================================================
// MANEJO DE ACCIONES EN LA TABLA
// =========================================================================

/**
 * Manejador de eventos para los botones de acción en la tabla.
 * @param {Event} event Objeto evento del clic
 */
function manejarAccionesTablaCategorias(event) {
    const actionButton = event.target.closest('.action-button');
    if (!actionButton) return;

    const tr = actionButton.closest('tr');
    const categoryId = tr ? tr.dataset.categoryId : null;

    if (!categoryId) {
        console.warn('[Categorías] No se pudo obtener el ID de la categoría', tr);
        return;
    }

    if (actionButton.classList.contains('action-button-edit')) {
        console.log('[Categorías] Acción: Editar categoría', categoryId);
        obtenerCategoriaParaEditar(categoryId);
    } else if (actionButton.classList.contains('action-button-delete')) {
        console.log('[Categorías] Acción: Eliminar categoría', categoryId);
        confirmarYEliminarCategoria(categoryId);
    }
}

/**
 * Obtiene los datos de una categoría para editar.
 * @param {string} idCategoria UUID de la categoría
 */
async function obtenerCategoriaParaEditar(idCategoria) {
    try {
        console.log('[Categorías] Obteniendo categoría para editar, ID:', idCategoria);

        const client = getSupabaseClient();
        if (!client) {
            throw new Error('Cliente de Supabase no inicializado');
        }

        const { data, error } = await client
            .from('categorias')
            .select('*')
            .eq('id_categoria', idCategoria)
            .single();

        if (error) {
            console.error('[Categorías] Error al obtener categoría:', error);

            if (error.code === 'PGRST116') {
                toastr.error('La categoría no fue encontrada o no tienes permisos para verla.', 'Error de Permisos');
            } else {
                toastr.error('Error al obtener datos de la categoría: ' + error.message, 'Error');
            }
            return;
        }

        if (!data) {
            toastr.warning('No se encontraron datos de la categoría.', 'Advertencia');
            return;
        }

        console.log('[Categorías] Categoría obtenida:', data);

        const categoriaParaEditar = {
            id: data.id_categoria,
            nombre: data.nombre_categoria,
            descripcion: data.descripcion_categoria || ''
        };

        abrirModalCategoria('edit', categoriaParaEditar);

    } catch (error) {
        console.error('[Categorías] Error inesperado al obtener categoría:', error);
        toastr.error('Error de comunicación al obtener datos para editar: ' + error.message, 'Error de Comunicación');
    }
}

/**
 * Muestra confirmación y elimina una categoría usando RPC.
 * @param {string} idCategoria UUID de la categoría a eliminar
 */
async function confirmarYEliminarCategoria(idCategoria) {
    const nombreCategoria = obtenerNombreCategoriaDeLaFilaPorId(idCategoria) || 'la categoría seleccionada';

    mostrarModalConfirmacion(
        `¿Estás realmente seguro de que quieres eliminar ${nombreCategoria}?\nEsta acción no se puede deshacer.`,
        async function() {
            try {
                console.log('[Categorías] Eliminando categoría ID:', idCategoria);

                const client = getSupabaseClient();
                if (!client) {
                    throw new Error('Cliente de Supabase no inicializado');
                }

                const { data, error } = await client
                    .rpc('fn_eliminar_categoria', {
                        p_categoria_id: idCategoria
                    });

                if (error) throw error;

                if (!data.exito) {
                    throw new Error(data.mensaje);
                }

                console.log('[Categorías] Categoría eliminada:', data);
                toastr.success(data.mensaje, 'Éxito');
                refrescarTablaCategorias();

            } catch (error) {
                console.error('[Categorías] Error al eliminar categoría:', error);
                toastr.error(error.message || 'Error al eliminar la categoría', 'Error al Eliminar');
            }
        },
        'Confirmar Eliminación'
    );
}

/**
 * Obtiene el nombre de una categoría de la tabla por su ID.
 * @param {string} idCategoria UUID de la categoría
 * @returns {string} Nombre de la categoría o fallback
 */
function obtenerNombreCategoriaDeLaFilaPorId(idCategoria) {
    const tbodyCategorias = document.getElementById('tbody-categorias');
    if (!tbodyCategorias) return `ID: ${idCategoria}`;

    const fila = tbodyCategorias.querySelector(`tr[data-category-id="${idCategoria}"]`);
    if (fila && fila.cells[0]) {
        return `"${fila.cells[0].textContent.trim()}"`;
    }
    return `la categoría seleccionada (ID: ${idCategoria})`;
}

// =========================================================================
// BÚSQUEDA LOCAL EN LA TABLA
// =========================================================================

/**
 * Maneja el evento de búsqueda en la tabla de categorías.
 * @param {Event} event Objeto evento del input
 */
function manejarBusquedaCategorias(event) {
    const searchTerm = quitarAcentos(event.target.value.toLowerCase().trim());
    const tbodyCategorias = document.getElementById('tbody-categorias');

    if (!tbodyCategorias) {
        console.warn('[Categorías] tbody-categorias no encontrado');
        return;
    }

    const tableRows = tbodyCategorias.querySelectorAll('tr');
    let hayResultados = false;

    tableRows.forEach(row => {
        // No procesar filas de mensaje (colspan)
        if (row.cells.length === 1 && row.cells[0].getAttribute('colspan')) {
            return;
        }

        const tdNombre = row.cells[0];
        const tdDescripcion = row.cells[1];

        const nombreCategoria = quitarAcentos(tdNombre ? tdNombre.textContent.toLowerCase() : '');
        const descripcionCategoria = quitarAcentos(tdDescripcion ? tdDescripcion.textContent.toLowerCase() : '');

        if (nombreCategoria.includes(searchTerm) || descripcionCategoria.includes(searchTerm)) {
            row.style.display = '';
            hayResultados = true;
        } else {
            row.style.display = 'none';
        }
    });

    // Manejo del mensaje "No se encontraron resultados"
    let noResultsRow = tbodyCategorias.querySelector('.no-results-row-categorias');

    if (!hayResultados && searchTerm !== '') {
        if (!noResultsRow) {
            noResultsRow = document.createElement('tr');
            noResultsRow.classList.add('no-results-row-categorias');
            const cell = document.createElement('td');
            cell.setAttribute('colspan', '4');
            cell.textContent = 'No se encontraron categorías que coincidan con la búsqueda.';
            cell.style.textAlign = 'center';
            cell.style.padding = '15px';
            cell.style.fontStyle = 'italic';
            noResultsRow.appendChild(cell);
            tbodyCategorias.appendChild(noResultsRow);
        } else {
            noResultsRow.style.display = '';
        }
    } else if (noResultsRow) {
        noResultsRow.style.display = 'none';
    }
}

// =========================================================================
// GUARDAR CATEGORÍA (CREAR/EDITAR)
// =========================================================================

/**
 * Maneja el guardado de categoría (crear o editar) usando RPC.
 * @param {Event} event Objeto evento del submit
 */
async function manejarGuardarCategoria(event) {
    event.preventDefault();
    console.log('[Categorías] Iniciando proceso de guardado...');

    limpiarMensajesValidacionCategoria();

    const btnGuardar = document.getElementById('btn-guardar-cambios-categoria');
    const btnCancelar = document.getElementById('btn-cancelar-operacion-categoria');
    const textoOriginalBtn = btnGuardar.textContent;

    try {
        // Deshabilitar botones
        btnGuardar.disabled = true;
        btnCancelar.disabled = true;
        btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

        // Obtener datos del formulario
        const idCategoria = document.getElementById('input-id-categoria').value.trim();
        const nombreCategoria = document.getElementById('input-nombre-categoria').value.trim();
        const descripcionCategoria = document.getElementById('input-descripcion-categoria').value.trim();

        // Validar nombre
        if (!nombreCategoria) {
            mostrarErrorValidacion('nombre-categoria', 'El nombre de la categoría es obligatorio');
            return;
        }

        if (nombreCategoria.length > 100) {
            mostrarErrorValidacion('nombre-categoria', 'El nombre no puede exceder 100 caracteres');
            return;
        }

        if (descripcionCategoria.length > 500) {
            mostrarErrorValidacion('descripcion-categoria', 'La descripción no puede exceder 500 caracteres');
            return;
        }

        const client = getSupabaseClient();
        if (!client) {
            throw new Error('Cliente de Supabase no inicializado');
        }

        let resultado;

        if (idCategoria) {
            // EDITAR - Usar RPC
            console.log('[Categorías] Actualizando categoría existente...');

            const { data, error } = await client.rpc('fn_actualizar_categoria', {
                p_categoria_data: {
                    id_categoria: idCategoria,
                    nombre_categoria: nombreCategoria,
                    descripcion_categoria: descripcionCategoria
                }
            });

            if (error) throw error;
            resultado = data;

        } else {
            // CREAR - Usar RPC
            console.log('[Categorías] Creando nueva categoría...');

            const { data, error } = await client.rpc('fn_crear_categoria', {
                p_categoria_data: {
                    nombre_categoria: nombreCategoria,
                    descripcion_categoria: descripcionCategoria
                }
            });

            if (error) throw error;
            resultado = data;
        }

        // Verificar resultado
        if (!resultado.exito) {
            throw new Error(resultado.mensaje);
        }

        console.log('[Categorías] Operación exitosa:', resultado);
        toastr.success(resultado.mensaje, 'Éxito');

        // Cerrar modal y refrescar tabla
        modalCategoria.classList.remove('is-visible');
        setTimeout(() => {
            if (!modalCategoria.classList.contains('is-visible')) {
                modalCategoria.style.display = 'none';
            }
        }, 250);

        refrescarTablaCategorias();

    } catch (error) {
        console.error('[Categorías] Error al guardar categoría:', error);
        toastr.error(error.message || 'Error al guardar la categoría', 'Error');
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
function limpiarMensajesValidacionCategoria() {
    const inputs = formCategoria.querySelectorAll('.form-input');
    inputs.forEach(input => input.classList.remove('is-invalid'));

    const errorMessages = formCategoria.querySelectorAll('.validation-message');
    errorMessages.forEach(msg => {
        msg.textContent = '';
        msg.style.display = 'none';
    });
}

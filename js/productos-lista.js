// =========================================================================
// MÓDULO DE LISTA DE PRODUCTOS - VERCEL
// =========================================================================

// Variables globales del módulo
let productos_currentPage = 1;
const productos_rowsPerPage = 10;
let productos_currentSearchTerm = "";
let productos_currentFilterCategoria = "";
let productos_currentFilterMarca = "";
let productos_currentFilterEstado = "";
let productos_isLoading = false;

// Referencias a elementos del modal
let modalProducto;
let formProducto;
let modalProductoTitulo;
let modalConfirmacion;

// Variables para modal de confirmación genérica
let confirmModalElement;
let confirmModalTitle;
let confirmModalMessage;
let btnCerrarConfirm;
let btnCancelarConfirm;
let btnAceptarConfirm;
let currentConfirmResolve = null;

// =========================================================================
// FUNCIÓN DE INICIALIZACIÓN DEL MÓDULO
// =========================================================================

/**
 * Función principal para cargar el módulo de productos.
 * Se llama desde home.js cuando se navega a la página de productos.
 */
async function cargarPaginaProductos() {
    console.log('[Productos] ===== INICIALIZANDO MÓDULO DE PRODUCTOS =====');

    try {
        // Configurar event listeners
        configurarPaginaProductosYListeners();

        // Cargar datos iniciales
        await cargarDesplegablesProducto();

        // Cargar lista de productos
        productos_currentPage = 1;
        await cargarDatosTablaProductos();

        console.log('[Productos] ✅ Módulo de productos inicializado correctamente');
    } catch (error) {
        console.error('[Productos] ❌ Error inicializando módulo:', error);
        showNotification('Error al cargar el módulo de productos: ' + error.message, 'error');
    }
}

/**
 * Configura los listeners de eventos para el módulo de productos.
 */
function configurarPaginaProductosYListeners() {
    console.log('[Productos] Configurando event listeners...');

    // Inicializar elementos del modal
    modalProducto = document.getElementById('modal-producto');
    formProducto = document.getElementById('form-producto');
    modalProductoTitulo = document.getElementById('modal-producto-titulo');
    modalConfirmacion = document.getElementById('modal-confirmacion-accion');

    // Inicializar modales
    if (typeof inicializarModalProducto === 'function') {
        inicializarModalProducto();
    }

    // Inicializar modal de confirmación (actualmente no se usa, se usa confirm() nativo)
    // inicializarModalConfirmacion();

    // Botón para añadir producto
    const btnNuevoProducto = document.getElementById('btn-abrir-modal-nuevo-producto');
    if (btnNuevoProducto) {
        btnNuevoProducto.addEventListener('click', () => abrirModalProducto('add'));
    }

    // Botón para colapsar/expandir filtros
    const btnToggleFiltros = document.getElementById('btn-toggle-filtros-productos');
    if (btnToggleFiltros) {
        btnToggleFiltros.addEventListener('click', function() {
            const filtrosContent = document.getElementById('filtros-productos-content');
            const isExpanded = this.getAttribute('aria-expanded') === 'true';

            this.setAttribute('aria-expanded', !isExpanded);
            filtrosContent.classList.toggle('collapsed');
        });
    }

    // Barra de búsqueda
    const searchInput = document.getElementById('input-buscar-productos');
    if (searchInput) {
        searchInput.addEventListener('input', manejarBusquedaYFiltrosProductos);
    }

    // Selectores de filtro
    const filtroCategoria = document.getElementById('filtro-categoria-producto');
    const filtroMarca = document.getElementById('filtro-marca-producto');
    const filtroEstado = document.getElementById('filtro-estado-producto');

    if (filtroCategoria) filtroCategoria.addEventListener('change', manejarBusquedaYFiltrosProductos);
    if (filtroMarca) filtroMarca.addEventListener('change', manejarBusquedaYFiltrosProductos);
    if (filtroEstado) filtroEstado.addEventListener('change', manejarBusquedaYFiltrosProductos);

    // Delegación de eventos para botones de acción en la tabla
    const tbodyProductos = document.getElementById('tbody-productos');
    if (tbodyProductos) {
        tbodyProductos.addEventListener('click', manejarAccionesTablaProductos);
    }

    // Botones de paginación
    const btnPrevPage = document.getElementById('btn-prev-page-productos');
    const btnNextPage = document.getElementById('btn-next-page-productos');

    if (btnPrevPage) {
        btnPrevPage.addEventListener('click', () => {
            if (productos_currentPage > 1) {
                productos_currentPage--;
                cargarDatosTablaProductos();
            }
        });
    }

    if (btnNextPage) {
        btnNextPage.addEventListener('click', () => {
            productos_currentPage++;
            cargarDatosTablaProductos();
        });
    }

    console.log('[Productos] ✓ Event listeners configurados');
}

// =========================================================================
// MODAL DE CONFIRMACIÓN GENÉRICA
// =========================================================================

/**
 * Inicializa el modal de confirmación genérica.
 */
function inicializarModalConfirmacion() {
    console.log('[Productos] Buscando elementos del modal de confirmación...');

    confirmModalElement = document.getElementById('modal-confirmacion-generica');
    confirmModalTitle = document.getElementById('modal-confirmacion-generica-titulo');
    confirmModalMessage = document.getElementById('modal-confirmacion-generica-mensaje');
    btnCerrarConfirm = document.getElementById('btn-cerrar-modal-confirmacion-generica-x');
    btnCancelarConfirm = document.getElementById('btn-cancelar-modal-confirmacion-generica');
    btnAceptarConfirm = document.getElementById('btn-aceptar-modal-confirmacion-generica');

    console.log('[Productos] Elementos encontrados:');
    console.log('  - confirmModalElement:', !!confirmModalElement, confirmModalElement);
    console.log('  - confirmModalTitle:', !!confirmModalTitle, confirmModalTitle);
    console.log('  - confirmModalMessage:', !!confirmModalMessage, confirmModalMessage);
    console.log('  - btnCerrarConfirm:', !!btnCerrarConfirm, btnCerrarConfirm);
    console.log('  - btnCancelarConfirm:', !!btnCancelarConfirm, btnCancelarConfirm);
    console.log('  - btnAceptarConfirm:', !!btnAceptarConfirm, btnAceptarConfirm);

    if (!confirmModalElement || !btnCerrarConfirm || !btnCancelarConfirm || !btnAceptarConfirm) {
        console.error('[Productos] ❌ Modal de confirmación no disponible - faltan elementos');
        return;
    }

    console.log('[Productos] Configurando event listeners del modal...');
    btnCerrarConfirm.addEventListener('click', () => manejarEleccionConfirmacion(false));
    btnCancelarConfirm.addEventListener('click', () => manejarEleccionConfirmacion(false));
    btnAceptarConfirm.addEventListener('click', () => manejarEleccionConfirmacion(true));
    confirmModalElement.addEventListener('click', (e) => {
        if (e.target === confirmModalElement) manejarEleccionConfirmacion(false);
    });

    console.log('[Productos] ✓ Modal de confirmación inicializado correctamente');
}

/**
 * Maneja la elección del usuario en el modal de confirmación.
 */
function manejarEleccionConfirmacion(eleccion) {
    if (currentConfirmResolve) currentConfirmResolve(eleccion);
    currentConfirmResolve = null;
    cerrarModalConfirmacion();
}

/**
 * Cierra el modal de confirmación.
 */
function cerrarModalConfirmacion() {
    if (!confirmModalElement) return;
    confirmModalElement.classList.remove('is-visible');
    setTimeout(() => {
        if (!confirmModalElement.classList.contains('is-visible')) {
            confirmModalElement.style.display = 'none';
        }
    }, 250);
}

/**
 * Muestra el modal de confirmación y retorna una Promise.
 * @param {string} message - Mensaje a mostrar
 * @param {string} title - Título del modal
 * @param {string} confirmBtnTxt - Texto del botón de confirmar
 * @param {string} cancelBtnTxt - Texto del botón de cancelar
 * @param {boolean} isDestructive - Si es una acción destructiva (botón rojo)
 * @returns {Promise<boolean>}
 */
function mostrarModalConfirmacion(message, title = 'Confirmar', confirmBtnTxt = 'Confirmar', cancelBtnTxt = 'Cancelar', isDestructive = false) {
    console.log('[Productos] mostrarModalConfirmacion llamada');
    console.log('[Productos] Verificando elementos del modal...');
    console.log('[Productos] confirmModalElement:', !!confirmModalElement);
    console.log('[Productos] confirmModalTitle:', !!confirmModalTitle);
    console.log('[Productos] confirmModalMessage:', !!confirmModalMessage);
    console.log('[Productos] btnAceptarConfirm:', !!btnAceptarConfirm);
    console.log('[Productos] btnCancelarConfirm:', !!btnCancelarConfirm);

    if (!confirmModalElement || !confirmModalTitle || !confirmModalMessage || !btnAceptarConfirm || !btnCancelarConfirm) {
        console.error('[Productos] Modal de confirmación no disponible. Usando confirm() estándar.');
        return Promise.resolve(confirm(message));
    }

    console.log('[Productos] Configurando textos del modal...');
    confirmModalTitle.textContent = title;
    confirmModalMessage.textContent = message;
    btnAceptarConfirm.textContent = confirmBtnTxt;
    btnCancelarConfirm.textContent = cancelBtnTxt;

    console.log('[Productos] Aplicando estilos...');
    // Reset classes y aplicar estilo según tipo de acción
    btnAceptarConfirm.className = 'button';
    if (isDestructive) {
        btnAceptarConfirm.classList.add('button-danger');
    } else {
        btnAceptarConfirm.classList.add('button-primary');
    }

    console.log('[Productos] Mostrando modal...');
    confirmModalElement.style.display = 'flex';
    setTimeout(() => {
        console.log('[Productos] Activando modal (agregando clase is-visible)...');
        confirmModalElement.classList.add('is-visible');
    }, 10);

    console.log('[Productos] Retornando Promise...');
    return new Promise((resolve) => {
        currentConfirmResolve = resolve;
    });
}

// =========================================================================
// FUNCIONES PARA CARGAR DESPLEGABLES (Categorías, Marcas, Unidades)
// =========================================================================

/**
 * Carga las opciones de categorías, marcas y unidades de medida en los selectores.
 */
async function cargarDesplegablesProducto() {
    console.log('[Productos] ===== CARGANDO DESPLEGABLES =====');

    const selectCategoriaFiltro = document.getElementById('filtro-categoria-producto');
    const selectMarcaFiltro = document.getElementById('filtro-marca-producto');
    const selectCategoriaModal = document.getElementById('select-categoria-producto');
    const selectMarcaModal = document.getElementById('select-marca-producto');
    const selectUnidadMedidaModal = document.getElementById('select-unidad-medida-producto');

    try {
        // Obtener cliente de Supabase
        const client = getSupabaseClient();
        if (!client) {
            throw new Error('Cliente de Supabase no inicializado');
        }

        // Cargar Categorías
        console.log('[Productos] Cargando categorías...');
        const { data: categorias, error: errorCategorias } = await client
            .from('categorias')
            .select('id_categoria, nombre_categoria')
            .order('nombre_categoria', { ascending: true });

        if (errorCategorias) {
            console.error('[Productos] ✗ Error al cargar categorías:', errorCategorias);
        } else {
            console.log('[Productos] ✓ Categorías cargadas:', categorias?.length || 0);
            poblarSelect(selectCategoriaFiltro, categorias || [], 'Todas las Categorías', 'id_categoria', 'nombre_categoria');
            poblarSelect(selectCategoriaModal, categorias || [], '-- Seleccione --', 'id_categoria', 'nombre_categoria');
        }

        // Cargar Marcas
        console.log('[Productos] Cargando marcas...');
        const { data: marcas, error: errorMarcas } = await client
            .from('marcas')
            .select('id_marca, nombre_marca')
            .order('nombre_marca', { ascending: true });

        if (errorMarcas) {
            console.error('[Productos] ✗ Error al cargar marcas:', errorMarcas);
        } else {
            console.log('[Productos] ✓ Marcas cargadas:', marcas?.length || 0);
            poblarSelect(selectMarcaFiltro, marcas || [], 'Todas las Marcas', 'id_marca', 'nombre_marca');
            poblarSelect(selectMarcaModal, marcas || [], '-- Seleccione --', 'id_marca', 'nombre_marca');
        }

        // Cargar Unidades de Medida
        console.log('[Productos] Cargando unidades de medida...');
        const { data: unidades, error: errorUnidades } = await client
            .from('unidades_medida')
            .select('id, nombre, abreviatura')
            .order('nombre', { ascending: true });

        if (errorUnidades) {
            console.error('[Productos] ✗ Error al cargar unidades:', errorUnidades);
        } else {
            console.log('[Productos] ✓ Unidades de medida cargadas:', unidades?.length || 0);

            // Ordenar: "Unidad" primero, luego el resto
            const unidadesOrdenadas = (unidades || []).sort((a, b) => {
                const esUnidadA = a.nombre.toLowerCase() === 'unidad' || a.abreviatura.toUpperCase() === 'UND';
                const esUnidadB = b.nombre.toLowerCase() === 'unidad' || b.abreviatura.toUpperCase() === 'UND';

                if (esUnidadA && !esUnidadB) return -1;
                if (!esUnidadA && esUnidadB) return 1;
                return a.nombre.localeCompare(b.nombre);
            });

            poblarSelectUnidadesMedida(selectUnidadMedidaModal, unidadesOrdenadas, '-- Seleccione --');

            // Seleccionar "Unidad" por defecto
            const unidadPorDefecto = unidadesOrdenadas.find(u =>
                u.nombre.toLowerCase() === 'unidad' || u.abreviatura.toUpperCase() === 'UND'
            );
            if (unidadPorDefecto) {
                selectUnidadMedidaModal.value = unidadPorDefecto.id;
            }
        }

        console.log('[Productos] ✓ Desplegables cargados correctamente');

    } catch (error) {
        console.error('[Productos] ❌ Error al cargar desplegables:', error);
        showNotification('Error al cargar desplegables: ' + error.message, 'error');
    }
}

/**
 * Función auxiliar para poblar un elemento <select> con opciones.
 */
function poblarSelect(selectElement, datos, textoOpcionDefault, valorKey, textoKey) {
    if (!selectElement) {
        console.warn('[Productos] ⚠ Select element no encontrado al intentar poblar');
        return;
    }
    if (!datos) {
        console.warn('[Productos] ⚠ No hay datos para poblar el select');
        return;
    }

    const defaultOptionHTML = '<option value="">' + escapeHtml(textoOpcionDefault) + '</option>';
    selectElement.innerHTML = defaultOptionHTML;

    datos.forEach(item => {
        const option = document.createElement('option');
        option.value = item[valorKey];
        option.textContent = item[textoKey];
        selectElement.appendChild(option);
    });

    console.log('[Productos] ✓ Select poblado con ' + datos.length + ' opciones');
}

/**
 * Función auxiliar para poblar el select de unidades de medida con formato "Nombre (Abreviatura)".
 */
function poblarSelectUnidadesMedida(selectElement, datos, textoOpcionDefault) {
    if (!selectElement || !datos) return;

    selectElement.innerHTML = '<option value="">' + escapeHtml(textoOpcionDefault) + '</option>';

    datos.forEach(unidad => {
        const option = document.createElement('option');
        option.value = unidad.id;
        option.textContent = unidad.nombre + ' (' + unidad.abreviatura + ')';
        selectElement.appendChild(option);
    });
}

/**
 * Función auxiliar para escapar HTML y prevenir XSS.
 */
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// =========================================================================
// FUNCIONES PARA LISTAR Y PAGINAR PRODUCTOS
// =========================================================================

/**
 * Obtiene y renderiza los datos de los productos con filtros y paginación.
 */
async function cargarDatosTablaProductos() {
    console.log('[Productos] ===== OBTENIENDO LISTA DE PRODUCTOS =====');

    const tbodyProductos = document.getElementById('tbody-productos');
    if (!tbodyProductos) {
        console.error('[Productos] ✗ Elemento tbody-productos no encontrado');
        return;
    }

    tbodyProductos.innerHTML = '<tr><td colspan="8" class="text-center loading-message">Obteniendo datos de productos...</td></tr>';

    try {
        // Obtener cliente de Supabase
        const client = getSupabaseClient();
        if (!client) {
            throw new Error('Cliente de Supabase no inicializado');
        }

        // Obtener valores de los filtros
        const searchTerm = document.getElementById('input-buscar-productos')?.value || '';
        const idCategoriaFiltro = document.getElementById('filtro-categoria-producto')?.value || '';
        const idMarcaFiltro = document.getElementById('filtro-marca-producto')?.value || '';
        const estadoFiltro = document.getElementById('filtro-estado-producto')?.value || '';

        // Calcular paginación
        const offset = (productos_currentPage - 1) * productos_rowsPerPage;

        // Construir query
        let query = client
            .from('productos')
            .select('id_producto, sku, nombre_producto, descripcion_producto, id_categoria, id_marca, id_unidad_medida, precio_compra_referencia, precio_venta_actual, stock_actual, stock_minimo_alerta, activo, categoria:id_categoria(nombre_categoria), marca:id_marca(nombre_marca), unidad_medida:id_unidad_medida(abreviatura)', { count: 'exact' })
            .order('nombre_producto', { ascending: true });

        // Aplicar filtros
        if (searchTerm.trim()) {
            query = query.or('sku.ilike.%' + searchTerm + '%,nombre_producto.ilike.%' + searchTerm + '%');
        }

        if (idCategoriaFiltro) {
            query = query.eq('id_categoria', idCategoriaFiltro);
        }

        if (idMarcaFiltro) {
            query = query.eq('id_marca', idMarcaFiltro);
        }

        if (estadoFiltro !== '') {
            const estadoBoolean = estadoFiltro === 'true';
            query = query.eq('activo', estadoBoolean);
        }

        // Aplicar paginación
        query = query.range(offset, offset + productos_rowsPerPage - 1);

        // Ejecutar query
        const { data: productos, error, count } = await query;

        if (error) {
            console.error('[Productos] ✗ Error al obtener productos:', error);
            throw new Error(error.message || 'Error al obtener productos');
        }

        console.log('[Productos] ✓ Productos obtenidos:', productos?.length || 0, 'de', count, 'total');

        // Renderizar tabla
        renderizarTablaProductos(productos || []);

        // Actualizar controles de paginación
        const totalPaginas = Math.ceil((count || 0) / productos_rowsPerPage);
        actualizarControlesPaginacionProductos(productos_currentPage, totalPaginas, count || 0);

    } catch (error) {
        console.error('[Productos] ❌ Error al cargar productos:', error);
        tbodyProductos.innerHTML = '<tr><td colspan="8" class="error-message text-center">Error al cargar productos: ' + error.message + '</td></tr>';
        actualizarControlesPaginacionProductos(1, 1, 0);
        showNotification('Error al cargar productos: ' + error.message, 'error');
    }
}

/**
 * Renderiza las filas de la tabla de productos.
 */
function renderizarTablaProductos(listaProductos) {
    const tbodyProductos = document.getElementById('tbody-productos');
    if (!tbodyProductos) return;

    tbodyProductos.innerHTML = '';

    if (!listaProductos || listaProductos.length === 0) {
        tbodyProductos.innerHTML = '<tr><td colspan="8" class="text-center info-message">No hay productos para mostrar con los filtros actuales.</td></tr>';
        return;
    }

    listaProductos.forEach(producto => {
        const tr = document.createElement('tr');
        tr.dataset.productoId = producto.id_producto;

        // Formatear stock con unidad de medida
        const stockActual = producto.stock_actual !== undefined ? producto.stock_actual : 0;
        const unidadMedida = producto.unidad_medida?.abreviatura || 'UND';
        const stockFormateado = stockActual + ' ' + unidadMedida;

        // Crear badge de estado
        const estadoActivo = producto.activo !== undefined ? producto.activo : true;
        const estadoBadge = estadoActivo
            ? '<span class="badge badge-success">Activo</span>'
            : '<span class="badge badge-danger">Inactivo</span>';

        tr.innerHTML = '<td>' + escapeHtml(producto.sku || '') + '</td>' +
            '<td>' + escapeHtml(producto.nombre_producto || '') + '</td>' +
            '<td>' + escapeHtml(producto.categoria?.nombre_categoria || 'N/A') + '</td>' +
            '<td>' + escapeHtml(producto.marca?.nombre_marca || 'N/A') + '</td>' +
            '<td class="text-right">' + (typeof producto.precio_venta_actual === 'number' ? producto.precio_venta_actual.toFixed(2) : '0.00') + '</td>' +
            '<td class="text-center">' + stockFormateado + '</td>' +
            '<td class="text-center">' + estadoBadge + '</td>' +
            '<td class="text-center">' +
                '<button class="button-icon button-icon-info btn-ver-producto" title="Ver Detalles"><i class="fas fa-eye"></i></button>' +
                '<button class="button-icon button-icon-warning btn-editar-producto" title="Editar Producto"><i class="fas fa-pencil-alt"></i></button>' +
                '<button class="button-icon button-icon-danger btn-eliminar-producto" title="Eliminar Producto"><i class="fas fa-trash-alt"></i></button>' +
            '</td>';

        tbodyProductos.appendChild(tr);
    });
}

/**
 * Actualiza los controles de paginación (botones, información de página).
 */
function actualizarControlesPaginacionProductos(paginaActual, totalPaginas, totalRegistros) {
    const pageInfo = document.getElementById('page-info-productos');
    const btnPrev = document.getElementById('btn-prev-page-productos');
    const btnNext = document.getElementById('btn-next-page-productos');

    if (pageInfo) {
        if (totalRegistros > 0) {
            pageInfo.textContent = 'Página ' + paginaActual + ' de ' + totalPaginas + ' (Total: ' + totalRegistros + ' productos)';
        } else {
            pageInfo.textContent = 'Página 0 de 0 (No hay productos)';
        }
    }

    if (btnPrev) {
        btnPrev.disabled = (paginaActual <= 1);
    }

    if (btnNext) {
        btnNext.disabled = (paginaActual >= totalPaginas);
    }
}

/**
 * Manejador para la búsqueda y cambios en filtros.
 */
function manejarBusquedaYFiltrosProductos() {
    productos_currentPage = 1;
    cargarDatosTablaProductos();
}

/**
 * Refresca la tabla de productos manteniendo la página actual.
 */
function refrescarTablaProductos() {
    console.log('[Productos] Refrescando datos de la tabla...');
    cargarDatosTablaProductos();
}

// =========================================================================
// MANEJADOR DE ACCIONES DE LA TABLA (Ver, Editar, Eliminar)
// =========================================================================

/**
 * Manejador para los botones de acción en la tabla de productos.
 */
function manejarAccionesTablaProductos(event) {
    const actionButton = event.target.closest('.button-icon');
    if (!actionButton) return;

    const tr = actionButton.closest('tr');
    const productoId = tr ? tr.dataset.productoId : null;
    if (!productoId) return;

    if (actionButton.classList.contains('btn-ver-producto')) {
        alert('Ver producto ID: ' + productoId + ' (funcionalidad pendiente)');
    } else if (actionButton.classList.contains('btn-editar-producto')) {
        editarProducto(productoId);
    } else if (actionButton.classList.contains('btn-eliminar-producto')) {
        confirmarYEliminarProducto(productoId);
    }
}

/**
 * Carga los datos de un producto y abre el modal en modo edición.
 */
async function editarProducto(productoId) {
    console.log('[Productos] Editando producto:', productoId);

    try {
        const client = getSupabaseClient();
        if (!client) {
            throw new Error('Cliente de Supabase no inicializado');
        }

        // Obtener producto por ID
        const { data: producto, error } = await client
            .from('productos')
            .select('*')
            .eq('id_producto', productoId)
            .single();

        if (error) {
            console.error('[Productos] ✗ Error al obtener producto:', error);
            throw new Error(error.message || 'Error al obtener producto');
        }

        if (!producto) {
            throw new Error('Producto no encontrado');
        }

        console.log('[Productos] ✓ Producto obtenido:', producto);
        abrirModalProducto('edit', producto);

    } catch (error) {
        console.error('[Productos] ❌ Error al cargar producto para editar:', error);
        showNotification('Error al cargar producto: ' + error.message, 'error');
    }
}

/**
 * Obtiene el nombre de un producto de la tabla (si es visible) para el mensaje de confirmación.
 * @param {string} idProducto - El ID del producto
 * @returns {string} El nombre del producto o un texto genérico
 */
function obtenerNombreProductoDeLaFilaPorId(idProducto) {
    const tbodyProductos = document.getElementById('tbody-productos');
    if (!tbodyProductos) return `el producto con ID ${idProducto}`;

    const fila = tbodyProductos.querySelector(`tr[data-producto-id="${idProducto}"]`);
    // Asumimos que el nombre del producto está en la segunda celda (índice 1), después del SKU (índice 0)
    if (fila && fila.cells[1]) {
        const nombreProducto = fila.cells[1].textContent.trim();
        return `"${nombreProducto}"`;
    }

    return `el producto con ID ${idProducto}`;
}

/**
 * Muestra confirmación y elimina (desactiva) el producto si se confirma.
 */
async function confirmarYEliminarProducto(productoId) {
    const nombreProductoParaMensaje = obtenerNombreProductoDeLaFilaPorId(productoId);

    const confirmado = confirm(`¿Estás seguro de que quieres desactivar ${nombreProductoParaMensaje}?\n\nEl producto pasará a estado 'Inactivo'. Podrás reactivarlo editándolo.`);

    if (!confirmado) {
        console.log('[Productos] Desactivación cancelada por el usuario');
        return;
    }

    console.log('[Productos] ===== DESACTIVANDO PRODUCTO =====');
    console.log('[Productos] Producto ID:', productoId);

    try {
        const client = getSupabaseClient();
        if (!client) {
            throw new Error('Cliente de Supabase no inicializado');
        }

        // Llamar a la función RPC para desactivar
        const { data, error } = await client
            .rpc('fn_desactivar_producto', {
                p_id_producto: productoId
            });

        if (error) {
            console.error('[Productos] ✗ Error de Supabase:', error);
            throw new Error(error.message || 'Error de comunicación con la base de datos');
        }

        console.log('[Productos] Respuesta RPC:', data);

        // Validar respuesta
        if (data && data.success === false) {
            console.log('[Productos] ❌ La función RPC rechazó la operación:', data.mensaje);

            const esErrorPermisos = data.codigo_error === 'PERMISO_DENEGADO' ||
                                   (data.mensaje && data.mensaje.toLowerCase().includes('no tienes permisos'));

            if (esErrorPermisos) {
                console.log('[Productos] ✅ Validación de permisos funcionó');
                showNotification(data.mensaje, 'error');
            } else if (data.codigo_error === 'YA_INACTIVO') {
                showNotification(data.mensaje || 'El producto ya está inactivo.', 'warning');
                refrescarTablaProductos();
            } else {
                showNotification(data.mensaje || 'Error al desactivar el producto.', 'error');
            }
            return;
        }

        // Operación exitosa
        if (data && data.success === true) {
            console.log('[Productos] ✓ Producto desactivado exitosamente');
            showNotification(data.mensaje || 'Producto desactivado con éxito.', 'success');
            refrescarTablaProductos();
        }

    } catch (error) {
        console.error('[Productos] ❌ Error al desactivar producto:', error);
        showNotification('Error al desactivar producto: ' + error.message, 'error');
    }
}

// =========================================================================
// FUNCIONES DEL MODAL DE PRODUCTO (AÑADIR/EDITAR)
// =========================================================================

/**
 * Inicializa el modal de producto y sus event listeners.
 */
function inicializarModalProducto() {
    console.log('[Productos] Inicializando modal de producto...');

    modalProducto = document.getElementById('modal-producto');
    formProducto = document.getElementById('form-producto');
    modalProductoTitulo = document.getElementById('modal-producto-titulo');
    const btnCerrar = document.getElementById('btn-cerrar-modal-producto');
    const btnCancelar = document.getElementById('btn-cancelar-operacion-producto');

    if (!modalProducto || !formProducto || !btnCerrar || !btnCancelar) {
        console.error('[Productos] Elementos clave del modal no encontrados');
        return;
    }

    // Event listeners del modal
    btnCerrar.addEventListener('click', cerrarModalProducto);
    btnCancelar.addEventListener('click', cerrarModalProducto);
    formProducto.addEventListener('submit', manejarGuardarProducto);
    modalProducto.addEventListener('click', (event) => {
        if (event.target === modalProducto) cerrarModalProducto();
    });

    // Listeners para formularios inline de categoría y marca
    const btnToggleCategoria = document.getElementById('btn-toggle-nueva-categoria');
    const btnCancelarCategoria = document.getElementById('btn-cancelar-inline-nueva-categoria');
    const btnGuardarCategoria = document.getElementById('btn-guardar-inline-nueva-categoria');

    if (btnToggleCategoria) btnToggleCategoria.addEventListener('click', () => toggleInlineAddForm('categoria'));
    if (btnCancelarCategoria) btnCancelarCategoria.addEventListener('click', () => toggleInlineAddForm('categoria', false));
    if (btnGuardarCategoria) btnGuardarCategoria.addEventListener('click', guardarNuevaEntidadInline('categoria'));

    const btnToggleMarca = document.getElementById('btn-toggle-nueva-marca');
    const btnCancelarMarca = document.getElementById('btn-cancelar-inline-nueva-marca');
    const btnGuardarMarca = document.getElementById('btn-guardar-inline-nueva-marca');

    if (btnToggleMarca) btnToggleMarca.addEventListener('click', () => toggleInlineAddForm('marca'));
    if (btnCancelarMarca) btnCancelarMarca.addEventListener('click', () => toggleInlineAddForm('marca', false));
    if (btnGuardarMarca) btnGuardarMarca.addEventListener('click', guardarNuevaEntidadInline('marca'));

    console.log('[Productos] ✓ Modal de producto inicializado');
}

/**
 * Abre el modal de producto en modo añadir o editar.
 * @param {string} modo - 'add' o 'edit'
 * @param {Object} productoParaEditar - Datos del producto (solo en modo edit)
 */
function abrirModalProducto(modo = 'add', productoParaEditar = null) {
    console.log('[Productos] Abriendo modal en modo:', modo);

    if (!modalProducto || !formProducto) {
        console.error('[Productos] Modal de producto no inicializado');
        return;
    }

    formProducto.reset();
    limpiarMensajesValidacionProducto();

    // Resetear y ocultar formularios inline
    toggleInlineAddForm('categoria', false, true);
    toggleInlineAddForm('marca', false, true);

    const inputIdProd = document.getElementById('input-id-producto');
    const inputSKU = document.getElementById('input-sku-producto');
    const btnGuardar = document.getElementById('btn-guardar-cambios-producto');
    const checkboxActivo = document.getElementById('input-activo-producto');
    const grupoCheckboxActivo = checkboxActivo.closest('.form-group');
    const stockInicialGroup = document.getElementById('input-stock-inicial-producto')?.closest('.form-group');

    if (modo === 'edit' && productoParaEditar) {
        // Modo EDITAR
        modalProductoTitulo.textContent = 'Editar Producto';
        inputIdProd.value = productoParaEditar.id_producto;
        inputSKU.value = productoParaEditar.sku || '';
        inputSKU.readOnly = true;
        document.getElementById('input-nombre-producto').value = productoParaEditar.nombre_producto || '';
        document.getElementById('input-descripcion-producto').value = productoParaEditar.descripcion_producto || '';
        document.getElementById('select-categoria-producto').value = productoParaEditar.id_categoria || '';
        document.getElementById('select-marca-producto').value = productoParaEditar.id_marca || '';
        document.getElementById('select-unidad-medida-producto').value = productoParaEditar.id_unidad_medida || '';
        document.getElementById('input-precio-compra-producto').value = productoParaEditar.precio_compra_referencia || '';
        document.getElementById('input-precio-venta-producto').value = productoParaEditar.precio_venta_actual || '';
        document.getElementById('input-stock-minimo-producto').value = productoParaEditar.stock_minimo_alerta || '0';

        // Lógica del checkbox "Producto Activo" al editar
        if (productoParaEditar.activo === false) {
            // Producto INACTIVO: mostrar checkbox para permitir reactivación
            grupoCheckboxActivo.style.display = 'block';
            checkboxActivo.checked = productoParaEditar.activo;
        } else {
            // Producto ACTIVO: ocultar checkbox
            grupoCheckboxActivo.style.display = 'none';
            checkboxActivo.checked = true;
        }

        // Ocultar stock inicial en modo edición
        if (stockInicialGroup) stockInicialGroup.style.display = 'none';

        btnGuardar.textContent = 'Actualizar Producto';
    } else {
        // Modo AÑADIR
        modalProductoTitulo.textContent = 'Añadir Nuevo Producto';
        inputIdProd.value = '';
        inputSKU.value = '';
        inputSKU.readOnly = true;
        inputSKU.closest('.form-group').style.display = 'none';

        // Mostrar stock inicial
        if (stockInicialGroup) stockInicialGroup.style.display = 'block';

        // Ocultar checkbox activo (siempre activo por defecto)
        grupoCheckboxActivo.style.display = 'none';
        checkboxActivo.checked = true;

        btnGuardar.textContent = 'Guardar Producto';
    }

    // Mostrar modal
    modalProducto.style.display = 'flex';

    // Resetear scroll del modal
    const modalBody = modalProducto.querySelector('.modal-body');
    if (modalBody) {
        modalBody.scrollTop = 0;
    }

    setTimeout(() => {
        modalProducto.classList.add('is-visible');
        document.getElementById('input-nombre-producto').focus();
    }, 10);
}

/**
 * Cierra el modal de producto.
 */
function cerrarModalProducto() {
    if (!modalProducto) return;
    modalProducto.classList.remove('is-visible');
    setTimeout(() => {
        if (!modalProducto.classList.contains('is-visible')) {
            modalProducto.style.display = 'none';
        }
    }, 250);
}

/**
 * Limpia los mensajes de validación del formulario.
 */
function limpiarMensajesValidacionProducto() {
    document.querySelectorAll('#form-producto .validation-message').forEach(el => el.textContent = '');
    document.querySelectorAll('#form-producto .form-input.is-invalid').forEach(el => el.classList.remove('is-invalid'));
}

/**
 * Valida el formulario de producto.
 * @returns {boolean} true si es válido, false si no
 */
function validarFormularioProducto() {
    limpiarMensajesValidacionProducto();
    let esValido = true;

    const nombre = document.getElementById('input-nombre-producto');
    const categoria = document.getElementById('select-categoria-producto');
    const marca = document.getElementById('select-marca-producto');
    const unidadMedida = document.getElementById('select-unidad-medida-producto');
    const precioCompra = document.getElementById('input-precio-compra-producto');
    const precioVenta = document.getElementById('input-precio-venta-producto');
    const stockInicial = document.getElementById('input-stock-inicial-producto');
    const idProducto = document.getElementById('input-id-producto').value;

    // Validar nombre
    if (!nombre.value.trim()) {
        nombre.classList.add('is-invalid');
        document.getElementById('error-nombre-producto').textContent = 'El nombre del producto es obligatorio.';
        esValido = false;
    }

    // Validar categoría
    if (!categoria.value) {
        categoria.classList.add('is-invalid');
        document.getElementById('error-categoria-producto').textContent = 'Debe seleccionar una categoría.';
        esValido = false;
    }

    // Validar marca
    if (!marca.value) {
        marca.classList.add('is-invalid');
        document.getElementById('error-marca-producto').textContent = 'Debe seleccionar una marca.';
        esValido = false;
    }

    // Validar unidad de medida
    if (!unidadMedida.value) {
        unidadMedida.classList.add('is-invalid');
        document.getElementById('error-unidad-medida-producto').textContent = 'Debe seleccionar una unidad de medida.';
        esValido = false;
    }

    // Validar precio de compra
    if (!precioCompra.value || precioCompra.value.trim() === '' || parseFloat(precioCompra.value) <= 0 || isNaN(parseFloat(precioCompra.value))) {
        precioCompra.classList.add('is-invalid');
        document.getElementById('error-precio-compra-producto').textContent = 'El precio de compra es obligatorio y debe ser mayor a cero.';
        esValido = false;
    }

    // Validar precio de venta
    if (!precioVenta.value || precioVenta.value.trim() === '' || parseFloat(precioVenta.value) <= 0 || isNaN(parseFloat(precioVenta.value))) {
        precioVenta.classList.add('is-invalid');
        document.getElementById('error-precio-venta-producto').textContent = 'El precio de venta es obligatorio y debe ser mayor a cero.';
        esValido = false;
    }

    // Validar stock inicial solo si el campo está visible (modo añadir)
    if (!idProducto && (!stockInicial.value.trim() || parseFloat(stockInicial.value) < 0 || isNaN(parseFloat(stockInicial.value)))) {
        stockInicial.classList.add('is-invalid');
        document.getElementById('error-stock-inicial-producto').textContent = 'El stock inicial es obligatorio y no puede ser negativo.';
        esValido = false;
    }

    return esValido;
}

/**
 * Maneja el evento de guardar/actualizar producto.
 * @param {Event} event - Evento del submit
 */
async function manejarGuardarProducto(event) {
    event.preventDefault();

    if (!validarFormularioProducto()) {
        console.log('[Productos] Validación fallida');
        return;
    }

    console.log('[Productos] ===== GUARDANDO PRODUCTO =====');

    const id = document.getElementById('input-id-producto').value;
    const datosProducto = {
        nombre_producto: document.getElementById('input-nombre-producto').value.trim(),
        descripcion_producto: document.getElementById('input-descripcion-producto').value.trim(),
        id_categoria: document.getElementById('select-categoria-producto').value,
        id_marca: document.getElementById('select-marca-producto').value,
        id_unidad_medida: parseInt(document.getElementById('select-unidad-medida-producto').value),
        precio_compra_referencia: parseFloat(document.getElementById('input-precio-compra-producto').value),
        precio_venta_actual: parseFloat(document.getElementById('input-precio-venta-producto').value),
        stock_minimo_alerta: parseInt(document.getElementById('input-stock-minimo-producto').value) || 0,
        activo: document.getElementById('input-activo-producto').checked
    };

    // Agregar stock inicial solo en modo añadir
    if (!id) {
        datosProducto.stock_inicial = parseFloat(document.getElementById('input-stock-inicial-producto').value);
    } else {
        datosProducto.id_producto = id;
    }

    const btnGuardar = document.getElementById('btn-guardar-cambios-producto');
    const originalButtonText = btnGuardar.textContent;
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        const client = getSupabaseClient();
        if (!client) {
            throw new Error('Cliente de Supabase no inicializado');
        }

        const funcionRPC = id ? 'fn_actualizar_producto' : 'crear_producto_con_stock_inicial';
        console.log('[Productos] Llamando a RPC:', funcionRPC);
        console.log('[Productos] Datos:', datosProducto);

        // Preparar parámetros según la función RPC
        let rpcParams;
        if (id) {
            // Actualizar producto
            rpcParams = {
                p_id_producto: datosProducto.id_producto,
                p_nombre_producto: datosProducto.nombre_producto,
                p_descripcion_producto: datosProducto.descripcion_producto,
                p_id_categoria: datosProducto.id_categoria,
                p_id_marca: datosProducto.id_marca,
                p_id_unidad_medida: datosProducto.id_unidad_medida,
                p_precio_compra_referencia: datosProducto.precio_compra_referencia,
                p_precio_venta_actual: datosProducto.precio_venta_actual,
                p_stock_minimo_alerta: datosProducto.stock_minimo_alerta,
                p_activo: datosProducto.activo
            };
        } else {
            // Crear producto nuevo
            rpcParams = {
                p_nombre_producto: datosProducto.nombre_producto,
                p_descripcion_producto: datosProducto.descripcion_producto,
                p_id_categoria: datosProducto.id_categoria,
                p_id_marca: datosProducto.id_marca,
                p_id_unidad_medida: datosProducto.id_unidad_medida,
                p_precio_compra_referencia: datosProducto.precio_compra_referencia,
                p_precio_venta_actual: datosProducto.precio_venta_actual,
                p_stock_minimo_alerta: datosProducto.stock_minimo_alerta,
                p_activo: datosProducto.activo,
                p_stock_inicial: datosProducto.stock_inicial
            };
        }

        const { data, error } = await client.rpc(funcionRPC, rpcParams);

        if (error) {
            console.error('[Productos] ✗ Error de Supabase:', error);
            throw new Error(error.message || 'Error de comunicación con la base de datos');
        }

        console.log('[Productos] Respuesta RPC:', data);

        // Validar respuesta
        if (data && data.success === false) {
            console.log('[Productos] ❌ La función RPC rechazó la operación:', data.mensaje);

            const esErrorPermisos = data.codigo_error === 'PERMISO_DENEGADO' ||
                                   (data.mensaje && data.mensaje.toLowerCase().includes('no tienes permisos'));

            if (esErrorPermisos) {
                console.log('[Productos] ✅ Validación de permisos funcionó');
                showNotification(data.mensaje, 'error');
            } else {
                showNotification(data.mensaje || 'Error al guardar el producto.', 'error');
            }
        } else if (data && data.success === true) {
            // Operación exitosa
            console.log('[Productos] ✓ Producto guardado exitosamente');
            showNotification(data.mensaje || 'Producto guardado con éxito.', 'success');
            cerrarModalProducto();
            refrescarTablaProductos();
        } else {
            // Respuesta inesperada
            showNotification('Respuesta inesperada del servidor.', 'warning');
        }

    } catch (error) {
        console.error('[Productos] ❌ Error al guardar producto:', error);
        showNotification('Error al guardar producto: ' + error.message, 'error');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = originalButtonText;
    }
}

// =========================================================================
// FUNCIONES INLINE PARA CREAR CATEGORÍAS Y MARCAS
// =========================================================================

/**
 * Muestra/oculta el formulario inline para agregar categoría o marca.
 * @param {string} type - 'categoria' o 'marca'
 * @param {boolean} show - true para mostrar, false para ocultar, undefined para toggle
 * @param {boolean} reset - true para resetear los campos del formulario
 */
function toggleInlineAddForm(type, show, reset = false) {
    const formElement = document.getElementById(`form-nueva-${type}-inline`);
    const selectElement = document.getElementById(`select-${type}-producto`);
    const toggleButton = document.getElementById(`btn-toggle-nueva-${type}`);

    if (!formElement || !selectElement || !toggleButton) return;

    if (reset) {
        document.getElementById(`input-inline-nueva-${type}-nombre`).value = '';
        if (type === 'categoria') {
            const descTextarea = document.getElementById('input-inline-nueva-categoria-descripcion');
            if (descTextarea) descTextarea.value = '';
        }
    }

    if (show === undefined) {
        // Toggle normal
        formElement.style.display = formElement.style.display === 'none' ? 'block' : 'none';
    } else {
        // Forzar mostrar u ocultar
        formElement.style.display = show ? 'block' : 'none';
    }

    // Deshabilitar/habilitar el select y cambiar texto del botón
    selectElement.disabled = formElement.style.display === 'block';
    toggleButton.innerHTML = formElement.style.display === 'block'
        ? '<i class="fas fa-times"></i>'
        : '<i class="fas fa-plus"></i>';

    if (formElement.style.display === 'block') {
        document.getElementById(`input-inline-nueva-${type}-nombre`).focus();
    }
}

/**
 * Guarda una nueva categoría o marca inline.
 * @param {string} type - 'categoria' o 'marca'
 * @returns {Function} Función para el event listener
 */
function guardarNuevaEntidadInline(type) {
    return async function() {
        console.log(`[Productos] ===== GUARDANDO NUEVA ${type.toUpperCase()} INLINE =====`);

        const nombreInput = document.getElementById(`input-inline-nueva-${type}-nombre`);
        const nombre = nombreInput.value.trim();
        let descripcion = '';

        if (type === 'categoria') {
            const descTextarea = document.getElementById('input-inline-nueva-categoria-descripcion');
            if (descTextarea) descripcion = descTextarea.value.trim();
        }

        if (!nombre) {
            showNotification(`El nombre para la nueva ${type} es obligatorio.`, 'warning');
            nombreInput.focus();
            return;
        }

        const selectElement = document.getElementById(`select-${type}-producto`);
        const botonGuardarInline = document.getElementById(`btn-guardar-inline-nueva-${type}`);
        const textoOriginalBoton = botonGuardarInline.textContent;

        botonGuardarInline.disabled = true;
        botonGuardarInline.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        try {
            const client = getSupabaseClient();
            if (!client) {
                throw new Error('Cliente de Supabase no inicializado');
            }

            // Preparar datos según el tipo (categoría o marca)
            const tableName = type === 'categoria' ? 'categorias' : 'marcas';
            const nombreCampo = type === 'categoria' ? 'nombre_categoria' : 'nombre_marca';
            const idCampo = type === 'categoria' ? 'id_categoria' : 'id_marca';

            const payload = {};
            payload[nombreCampo] = nombre;
            // Solo agregar descripción para categorías si está disponible
            if (type === 'categoria' && descripcion) {
                payload['descripcion_categoria'] = descripcion;
            }

            console.log(`[Productos] Insertando en tabla ${tableName}:`, payload);

            // Usar INSERT directo (no RPC) como en Apps Script
            const { data, error } = await client
                .from(tableName)
                .insert(payload)
                .select()
                .single();

            if (error) {
                console.error(`[Productos] ✗ Error de Supabase al guardar ${type}:`, error);
                throw new Error(error.message || `Error al guardar ${type}`);
            }

            console.log('[Productos] Respuesta INSERT:', data);

            if (data) {
                showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} "${data[nombreCampo]}" creada y seleccionada.`, 'success');

                // Añadir la nueva opción al select y seleccionarla
                const newOption = document.createElement('option');
                newOption.value = data[idCampo];
                newOption.textContent = data[nombreCampo];
                newOption.selected = true;
                selectElement.appendChild(newOption);

                // Ocultar el formulario inline
                toggleInlineAddForm(type, false, true);
                selectElement.value = newOption.value;
            } else {
                showNotification(`Error al guardar nueva ${type}: No se recibieron datos.`, 'error');
            }

        } catch (error) {
            console.error(`[Productos] ❌ Error al guardar nueva ${type}:`, error);
            showNotification(`Error al guardar ${type}: ` + error.message, 'error');
        } finally {
            botonGuardarInline.disabled = false;
            botonGuardarInline.textContent = textoOriginalBoton;
        }
    };
}

// Exportar función principal para ser llamada desde home.js
if (typeof window !== 'undefined') {
    window.cargarPaginaProductos = cargarPaginaProductos;
}

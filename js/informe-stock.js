// =========================================================================
// MÓDULO DE INFORME DE STOCK - VERCEL
// =========================================================================

// Variables globales del módulo
let stock_currentPage = 1;
const stock_rowsPerPage = 50;
let stock_allData = []; // Array completo de datos (para paginación client-side)
let stock_filteredData = []; // Datos después de aplicar filtros
let stock_isLoading = false;

// Filtros actuales
let stock_currentSearchTerm = "";
let stock_currentFilterMarca = "";
let stock_currentFilterEstado = "";

// Ordenamiento actual
let stock_currentSortKey = "NOMBRE"; // Valores: 'NOMBRE', 'MARCA', 'DISPONIBLE'
let stock_currentSortDirection = "ASC"; // Valores: 'ASC', 'DESC'

// =========================================================================
// FUNCIÓN DE INICIALIZACIÓN DEL MÓDULO
// =========================================================================

/**
 * Resetea todas las variables globales del módulo de informe de stock
 */
function resetearVariablesGlobalesStock() {
    console.log('[Informe Stock] Reseteando variables globales...');
    stock_currentPage = 1;
    stock_allData = [];
    stock_filteredData = [];
    stock_isLoading = false;
    stock_currentSearchTerm = "";
    stock_currentFilterMarca = "";
    stock_currentFilterEstado = "";
    stock_currentSortKey = "NOMBRE";
    stock_currentSortDirection = "ASC";
    console.log('[Informe Stock] Variables globales reseteadas');
}

/**
 * Función principal para cargar el módulo de informe de stock.
 * Se llama desde home.js cuando se navega a la página.
 */
async function cargarPaginaInformeStock() {
    console.log('[Informe Stock] ===== INICIALIZANDO MÓDULO DE INFORME DE STOCK =====');

    // Resetear variables globales
    resetearVariablesGlobalesStock();

    try {
        // Configurar event listeners
        configurarEventListenersInformeStock();

        // Cargar desplegables (marcas)
        await cargarDesplegablesInformeStock();

        // Cargar KPIs y datos
        await cargarDatosInformeStock();

        console.log('[Informe Stock] ✅ Módulo inicializado correctamente');
    } catch (error) {
        console.error('[Informe Stock] ❌ Error inicializando módulo:', error);
        showNotification('Error al cargar el informe de stock: ' + error.message, 'error');
    }
}

/**
 * Configura los listeners de eventos para el módulo
 */
function configurarEventListenersInformeStock() {
    console.log('[Informe Stock] Configurando event listeners...');

    // Botón de toggle de filtros
    const btnToggleFiltros = document.getElementById('btn-toggle-filtros-stock');
    if (btnToggleFiltros) {
        btnToggleFiltros.addEventListener('click', function() {
            const filtrosContent = document.getElementById('filtros-stock-content');
            const isExpanded = this.getAttribute('aria-expanded') === 'true';
            this.setAttribute('aria-expanded', !isExpanded);
            filtrosContent.classList.toggle('collapsed');
        });
    }

    // Input de búsqueda (con debounce)
    const inputBuscar = document.getElementById('input-buscar-stock');
    if (inputBuscar) {
        let debounceTimer;
        inputBuscar.addEventListener('input', function() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                stock_currentSearchTerm = this.value.trim();
                aplicarFiltrosYRecargar();
            }, 300);
        });
    }

    // Select de marca
    const selectMarca = document.getElementById('filtro-marca-stock');
    if (selectMarca) {
        selectMarca.addEventListener('change', function() {
            stock_currentFilterMarca = this.value;
            aplicarFiltrosYRecargar();
        });
    }

    // Select de estado
    const selectEstado = document.getElementById('filtro-estado-stock');
    if (selectEstado) {
        selectEstado.addEventListener('change', function() {
            stock_currentFilterEstado = this.value;
            aplicarFiltrosYRecargar();
        });
    }

    // Headers ordenables
    const sortableHeaders = document.querySelectorAll('.sortable-header');
    sortableHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const sortKey = this.getAttribute('data-sort-key');
            handleSortClick(sortKey);
        });
    });

    // Botones de paginación
    const btnPrev = document.getElementById('btn-prev-page-stock');
    const btnNext = document.getElementById('btn-next-page-stock');

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            if (stock_currentPage > 1) {
                stock_currentPage--;
                renderizarTablaPaginada();
            }
        });
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            const totalPages = Math.ceil(stock_filteredData.length / stock_rowsPerPage);
            if (stock_currentPage < totalPages) {
                stock_currentPage++;
                renderizarTablaPaginada();
            }
        });
    }

    // Botón de exportar CSV
    const btnExportar = document.getElementById('btn-exportar-csv-stock');
    if (btnExportar) {
        btnExportar.addEventListener('click', exportarStockCSV);
    }

    console.log('[Informe Stock] Event listeners configurados');
}

// =========================================================================
// CARGA DE DATOS INICIALES
// =========================================================================

/**
 * Carga los desplegables (select de marcas)
 */
async function cargarDesplegablesInformeStock() {
    console.log('[Informe Stock] Cargando desplegables...');

    const client = getSupabaseClient();
    if (!client) {
        console.error('[Informe Stock] Cliente de Supabase no inicializado');
        return;
    }

    try {
        // Cargar marcas
        const { data: marcas, error } = await client
            .from('marcas')
            .select('id_marca, nombre_marca')
            .order('nombre_marca', { ascending: true });

        if (error) throw error;

        const selectMarca = document.getElementById('filtro-marca-stock');
        if (selectMarca && marcas) {
            // Limpiar opciones actuales (excepto "Todas las marcas")
            selectMarca.innerHTML = '<option value="">Todas las marcas</option>';

            // Agregar marcas
            marcas.forEach(marca => {
                const option = document.createElement('option');
                option.value = marca.id_marca;
                option.textContent = marca.nombre_marca;
                selectMarca.appendChild(option);
            });

            console.log(`[Informe Stock] ${marcas.length} marcas cargadas`);
        }
    } catch (error) {
        console.error('[Informe Stock] Error cargando desplegables:', error);
        showNotification('Error al cargar los filtros', 'error');
    }
}

/**
 * Carga los KPIs y los datos de la tabla
 */
async function cargarDatosInformeStock() {
    if (stock_isLoading) {
        console.log('[Informe Stock] Ya hay una carga en proceso, ignorando...');
        return;
    }

    stock_isLoading = true;
    console.log('[Informe Stock] Cargando datos...');

    const client = getSupabaseClient();
    if (!client) {
        console.error('[Informe Stock] Cliente de Supabase no inicializado');
        stock_isLoading = false;
        return;
    }

    try {
        // Cargar KPIs y datos en paralelo
        const [kpisResult, dataResult] = await Promise.all([
            cargarKPIs(client),
            cargarDatosTabla(client)
        ]);

        if (kpisResult.success && dataResult.success) {
            console.log('[Informe Stock] ✅ Datos cargados exitosamente');
        }
    } catch (error) {
        console.error('[Informe Stock] ❌ Error cargando datos:', error);
        showNotification('Error al cargar el informe de stock', 'error');
    } finally {
        stock_isLoading = false;
    }
}

/**
 * Carga los KPIs (tarjetas superiores)
 */
async function cargarKPIs(client) {
    console.log('[Informe Stock] Cargando KPIs...');

    try {
        const { data, error } = await client.rpc('fn_reporte_stock_kpis', {
            p_busqueda: stock_currentSearchTerm || null,
            p_id_marca: stock_currentFilterMarca || null,
            p_filtro_estado: stock_currentFilterEstado || null
        });

        if (error) throw error;

        if (data) {
            // Actualizar valores en el DOM
            document.getElementById('kpi-valor-inventario').textContent =
                formatearMoneda(data.valor_inventario || 0);

            document.getElementById('kpi-total-productos').textContent =
                data.total_productos || 0;

            document.getElementById('kpi-bajo-stock').textContent =
                data.items_bajo_stock || 0;

            document.getElementById('kpi-agotados').textContent =
                data.items_agotados || 0;

            // Mostrar alerta de alta reserva si es necesario
            const porcentajeComprometido = data.porcentaje_comprometido || 0;
            const alertaAltaReserva = document.getElementById('alerta-alta-reserva');

            if (porcentajeComprometido > 50 && alertaAltaReserva) {
                document.getElementById('porcentaje-comprometido').textContent =
                    porcentajeComprometido.toFixed(1) + '%';
                alertaAltaReserva.style.display = 'flex';
            } else if (alertaAltaReserva) {
                alertaAltaReserva.style.display = 'none';
            }

            console.log('[Informe Stock] KPIs actualizados:', data);
        }

        return { success: true };
    } catch (error) {
        console.error('[Informe Stock] Error cargando KPIs:', error);
        showNotification('Error al cargar los indicadores', 'error');
        return { success: false };
    }
}

/**
 * Carga los datos de la tabla desde el RPC
 */
async function cargarDatosTabla(client) {
    console.log('[Informe Stock] Cargando datos de tabla...');

    try {
        const { data, error } = await client.rpc('fn_reporte_stock', {
            p_busqueda: stock_currentSearchTerm || null,
            p_id_marca: stock_currentFilterMarca || null,
            p_filtro_estado: stock_currentFilterEstado || null,
            p_ordenar_por: stock_currentSortKey,
            p_orden_direccion: stock_currentSortDirection
        });

        if (error) throw error;

        // Guardar datos completos
        stock_allData = data || [];
        stock_filteredData = data || [];

        console.log(`[Informe Stock] ${stock_allData.length} registros obtenidos`);

        // Resetear a página 1 y renderizar
        stock_currentPage = 1;
        renderizarTablaPaginada();

        return { success: true };
    } catch (error) {
        console.error('[Informe Stock] Error cargando datos de tabla:', error);

        // Mostrar mensaje de error en la tabla
        const tbody = document.getElementById('tbody-stock');
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

        return { success: false };
    }
}

// =========================================================================
// RENDERIZADO DE TABLA Y PAGINACIÓN
// =========================================================================

/**
 * Renderiza la tabla con paginación client-side
 */
function renderizarTablaPaginada() {
    console.log(`[Informe Stock] Renderizando página ${stock_currentPage}...`);

    const tbody = document.getElementById('tbody-stock');
    if (!tbody) {
        console.error('[Informe Stock] No se encontró el tbody');
        return;
    }

    // Calcular índices de paginación
    const startIndex = (stock_currentPage - 1) * stock_rowsPerPage;
    const endIndex = startIndex + stock_rowsPerPage;
    const paginatedData = stock_filteredData.slice(startIndex, endIndex);

    // Limpiar tabla
    tbody.innerHTML = '';

    // Si no hay datos
    if (paginatedData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center" style="padding: 40px; font-style: italic; color: #888;">
                    <i class="fas fa-inbox"></i> No se encontraron productos con los filtros seleccionados
                </td>
            </tr>
        `;
        actualizarControlesPaginacion();
        return;
    }

    // Renderizar filas
    paginatedData.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors';

        // Determinar clase del badge según estado
        let badgeClass = 'stock-normal';
        if (item.estado_calculado === 'AGOTADO') {
            badgeClass = 'stock-agotado';
        } else if (item.estado_calculado === 'BAJO') {
            badgeClass = 'stock-bajo';
        }

        // Clase especial si hay stock reservado
        const reservadoClass = item.stock_reservado > 0 ? 'text-reserved-active' : '';

        row.innerHTML = `
            <td>
                <div style="font-weight: 600; color: #1F2937;">${escapeHtml(item.nombre_producto)}</div>
                <div style="font-size: 0.75rem; color: #6B7280;">SKU: ${escapeHtml(item.sku)}</div>
            </td>
            <td>${escapeHtml(item.nombre_marca || '-')}</td>
            <td class="text-center">${escapeHtml(item.nombre_unidad || '-')}</td>
            <td class="text-right" style="font-weight: 500;">${formatearNumero(item.stock_fisico)}</td>
            <td class="text-right ${reservadoClass}">${formatearNumero(item.stock_reservado)}</td>
            <td class="text-right">
                <span class="stock-badge ${badgeClass}">
                    ${formatearNumero(item.stock_disponible)}
                </span>
            </td>
        `;

        tbody.appendChild(row);
    });

    // Actualizar controles de paginación
    actualizarControlesPaginacion();

    // Actualizar indicadores de ordenamiento
    actualizarIndicadoresOrdenamiento();

    console.log(`[Informe Stock] ${paginatedData.length} filas renderizadas`);
}

/**
 * Actualiza los controles de paginación
 */
function actualizarControlesPaginacion() {
    const totalPages = Math.ceil(stock_filteredData.length / stock_rowsPerPage);
    const btnPrev = document.getElementById('btn-prev-page-stock');
    const btnNext = document.getElementById('btn-next-page-stock');
    const pageInfo = document.getElementById('page-info-stock');

    // Habilitar/deshabilitar botones
    if (btnPrev) {
        btnPrev.disabled = stock_currentPage <= 1;
    }

    if (btnNext) {
        btnNext.disabled = stock_currentPage >= totalPages;
    }

    // Actualizar información de página
    if (pageInfo) {
        const start = (stock_currentPage - 1) * stock_rowsPerPage + 1;
        const end = Math.min(stock_currentPage * stock_rowsPerPage, stock_filteredData.length);

        if (stock_filteredData.length === 0) {
            pageInfo.textContent = 'No hay resultados';
        } else {
            pageInfo.textContent = `Mostrando ${start}-${end} de ${stock_filteredData.length} productos | Página ${stock_currentPage} de ${totalPages}`;
        }
    }
}

/**
 * Actualiza los indicadores visuales de ordenamiento en los headers
 */
function actualizarIndicadoresOrdenamiento() {
    // Remover todas las clases activas
    document.querySelectorAll('.sortable-header').forEach(header => {
        header.classList.remove('active', 'asc', 'desc');
    });

    // Agregar clase activa al header correspondiente
    const activeHeader = document.querySelector(`[data-sort-key="${stock_currentSortKey}"]`);
    if (activeHeader) {
        activeHeader.classList.add('active');
        activeHeader.classList.add(stock_currentSortDirection.toLowerCase());
    }
}

// =========================================================================
// FILTROS Y ORDENAMIENTO
// =========================================================================

/**
 * Aplica los filtros actuales y recarga los datos
 */
async function aplicarFiltrosYRecargar() {
    console.log('[Informe Stock] Aplicando filtros y recargando...');
    console.log('[Informe Stock] Filtros:', {
        busqueda: stock_currentSearchTerm,
        marca: stock_currentFilterMarca,
        estado: stock_currentFilterEstado
    });

    await cargarDatosInformeStock();
}

/**
 * Maneja el clic en un header ordenable
 */
function handleSortClick(sortKey) {
    console.log(`[Informe Stock] Ordenando por ${sortKey}...`);

    // Si es la misma columna, alternar dirección
    if (stock_currentSortKey === sortKey) {
        stock_currentSortDirection = stock_currentSortDirection === 'ASC' ? 'DESC' : 'ASC';
    } else {
        // Nueva columna, ordenar ascendente por defecto
        stock_currentSortKey = sortKey;
        stock_currentSortDirection = 'ASC';
    }

    // Recargar datos con nuevo ordenamiento
    aplicarFiltrosYRecargar();
}

// =========================================================================
// EXPORTACIÓN A CSV
// =========================================================================

/**
 * Exporta los datos actuales a CSV
 */
async function exportarStockCSV() {
    console.log('[Informe Stock] Iniciando exportación a CSV...');

    const btn = document.getElementById('btn-exportar-csv-stock');

    // Estado de carga
    if (btn) {
        btn.disabled = true;
        btn.classList.add('button-loading');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exportando...';

        try {
            // Usar los datos filtrados actuales (ya están en memoria)
            if (!stock_filteredData || stock_filteredData.length === 0) {
                showNotification('No hay datos para exportar con los filtros actuales', 'warning');
                return;
            }

            // Definir headers del CSV
            const headers = [
                'SKU',
                'Producto',
                'Marca',
                'Unidad',
                'Stock Físico',
                'Stock Reservado',
                'Stock Disponible',
                'Estado',
                'Costo Unitario'
            ];

            // Convertir datos a filas CSV
            const rows = stock_filteredData.map(item => {
                return [
                    cleanCsvValue(item.sku),
                    cleanCsvValue(item.nombre_producto),
                    cleanCsvValue(item.nombre_marca),
                    cleanCsvValue(item.nombre_unidad),
                    item.stock_fisico,
                    item.stock_reservado,
                    item.stock_disponible,
                    item.estado_calculado,
                    item.costo_unitario
                ];
            });

            // Crear string CSV
            const csvString = [
                headers.join(','),
                ...rows.map(row => row.join(','))
            ].join('\n');

            // Descargar archivo con BOM para UTF-8 (tildes y ñ en Excel)
            const blob = new Blob(["\uFEFF" + csvString], {
                type: 'text/csv;charset=utf-8;'
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');

            const fecha = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
            link.setAttribute('href', url);
            link.setAttribute('download', `informe_stock_${fecha}.csv`);

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showNotification(`${stock_filteredData.length} productos exportados exitosamente`, 'success');
            console.log('[Informe Stock] ✅ Exportación completada');

        } catch (error) {
            console.error('[Informe Stock] ❌ Error exportando:', error);
            showNotification('Error al exportar el archivo CSV', 'error');
        } finally {
            // Restaurar botón
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
function cleanCsvValue(value) {
    if (value === null || value === undefined) return '';
    const stringValue = value.toString();

    // Si contiene comas, comillas o saltos de línea, encerrar en comillas y escapar
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

// =========================================================================
// FUNCIONES HELPER
// =========================================================================

/**
 * Formatea un número con separadores de miles
 */
function formatearNumero(numero) {
    if (numero === null || numero === undefined) return '0';
    return Number(numero).toLocaleString('es-CO');
}

/**
 * Formatea un valor como moneda
 */
function formatearMoneda(valor) {
    if (valor === null || valor === undefined) return '$ 0';

    // Formato abreviado para valores grandes
    if (valor >= 1000000) {
        return '$ ' + (valor / 1000000).toFixed(1) + 'M';
    } else if (valor >= 1000) {
        return '$ ' + (valor / 1000).toFixed(1) + 'K';
    }

    return '$ ' + Number(valor).toLocaleString('es-CO');
}

/**
 * Escapa HTML para prevenir XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

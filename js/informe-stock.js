// =========================================================================
// MÓDULO DE INFORME DE STOCK
// =========================================================================

let informeStockModuloActivo = false;

let stock_currentPage = 1;
const stock_rowsPerPage = 50;
let stock_allData = [];
let stock_filteredData = [];
let stock_isLoading = false;
let stock_debounceTimer = null;

let stock_currentSearchTerm = "";
let stock_currentFilterMarca = "";
let stock_currentFilterEstado = "";

let stock_currentSortKey = "NOMBRE";
let stock_currentSortDirection = "ASC";

// =========================================================================
// INICIALIZACIÓN
// =========================================================================

function limpiarModuloInformeStock() {
    console.log('[Informe Stock] Limpiando timers y recursos del módulo...');
    if (stock_debounceTimer) {
        clearTimeout(stock_debounceTimer);
        stock_debounceTimer = null;
    }
    console.log('[Informe Stock] Módulo limpiado correctamente');
}

function resetearVariablesGlobalesStock() {
    console.log('[Informe Stock] Reseteando variables globales...');
    if (stock_debounceTimer) {
        clearTimeout(stock_debounceTimer);
        stock_debounceTimer = null;
    }
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

async function cargarPaginaInformeStock() {
    console.log('[Informe Stock] ===== INICIALIZANDO MÓDULO DE INFORME DE STOCK =====');

    if (typeof desactivarTodosLosModulos === 'function') {
        desactivarTodosLosModulos();
    }

    informeStockModuloActivo = true;
    resetearVariablesGlobalesStock();

    try {
        configurarEventListenersInformeStock();
        await cargarDesplegablesInformeStock();
        await cargarDatosInformeStock();
        console.log('[Informe Stock] ✅ Módulo inicializado correctamente');
    } catch (error) {
        console.error('[Informe Stock] ❌ Error inicializando módulo:', error);
        showNotification('Error al cargar el informe de stock: ' + error.message, 'error');
    }
}

function configurarEventListenersInformeStock() {
    console.log('[Informe Stock] Configurando event listeners...');

    const btnToggleFiltros = document.getElementById('btn-toggle-filtros-stock');
    if (btnToggleFiltros) {
        btnToggleFiltros.addEventListener('click', function() {
            const filtrosContent = document.getElementById('filtros-stock-content');
            const isExpanded = this.getAttribute('aria-expanded') === 'true';
            this.setAttribute('aria-expanded', !isExpanded);
            filtrosContent.classList.toggle('collapsed');
        });
    }

    const inputBuscar = document.getElementById('input-buscar-stock');
    if (inputBuscar) {
        inputBuscar.addEventListener('input', function() {
            if (stock_debounceTimer) clearTimeout(stock_debounceTimer);
            stock_debounceTimer = setTimeout(() => {
                stock_currentSearchTerm = this.value.trim();
                aplicarFiltrosYRecargar();
            }, 300);
        });
    }

    const selectMarca = document.getElementById('filtro-marca-stock');
    if (selectMarca) {
        selectMarca.addEventListener('change', function() {
            stock_currentFilterMarca = this.value;
            aplicarFiltrosYRecargar();
        });
    }

    const selectEstado = document.getElementById('filtro-estado-stock');
    if (selectEstado) {
        selectEstado.addEventListener('change', function() {
            stock_currentFilterEstado = this.value;
            aplicarFiltrosYRecargar();
        });
    }

    const sortableHeaders = document.querySelectorAll('.sortable-header');
    sortableHeaders.forEach(header => {
        header.addEventListener('click', function() {
            handleSortClick(this.getAttribute('data-sort-key'));
        });
    });

    const btnPrev = document.getElementById('btn-prev-page-stock');
    const btnNext = document.getElementById('btn-next-page-stock');

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            if (stock_currentPage > 1) {
                stock_currentPage--;
                renderizarTablaPaginadaStock();
            }
        });
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            const totalPages = Math.ceil(stock_filteredData.length / stock_rowsPerPage);
            if (stock_currentPage < totalPages) {
                stock_currentPage++;
                renderizarTablaPaginadaStock();
            }
        });
    }

    const btnExportar = document.getElementById('btn-exportar-csv-stock');
    if (btnExportar) {
        btnExportar.addEventListener('click', exportarStockCSV);
    }

    // ✅ NUEVO: Botón compartir por WhatsApp
    const btnWhatsApp = document.getElementById('btn-compartir-stock-whatsapp');
    if (btnWhatsApp) {
        btnWhatsApp.addEventListener('click', compartirStockWhatsApp);
    }

    console.log('[Informe Stock] Event listeners configurados');
}

// =========================================================================
// CARGA DE DATOS
// =========================================================================

async function cargarDesplegablesInformeStock() {
    const client = getSupabaseClient();
    if (!client) return;

    try {
        const { data: marcas, error } = await client
            .from('marcas')
            .select('id_marca, nombre_marca')
            .order('nombre_marca', { ascending: true });

        if (error) throw error;

        const selectMarca = document.getElementById('filtro-marca-stock');
        if (selectMarca && marcas) {
            selectMarca.innerHTML = '<option value="">Todas las marcas</option>';
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

async function cargarDatosInformeStock() {
    if (!informeStockModuloActivo) return;
    if (stock_isLoading) return;

    stock_isLoading = true;
    const client = getSupabaseClient();
    if (!client) { stock_isLoading = false; return; }

    try {
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

async function cargarKPIs(client) {
    try {
        const { data, error } = await client.rpc('fn_reporte_stock_kpis', {
            p_busqueda: stock_currentSearchTerm || null,
            p_id_marca: stock_currentFilterMarca || null,
            p_filtro_estado: stock_currentFilterEstado || null
        });

        if (error) throw error;
        if (!informeStockModuloActivo) return { success: false };

        if (data) {
            document.getElementById('kpi-valor-inventario').textContent =
                window.formatMoney(data.valor_inventario || 0, true);
            document.getElementById('kpi-total-productos').textContent = data.total_productos || 0;
            document.getElementById('kpi-bajo-stock').textContent = data.items_bajo_stock || 0;
            document.getElementById('kpi-agotados').textContent = data.items_agotados || 0;

            const porcentajeComprometido = data.porcentaje_comprometido || 0;
            const alertaAltaReserva = document.getElementById('alerta-alta-reserva');
            if (porcentajeComprometido > 50 && alertaAltaReserva) {
                document.getElementById('porcentaje-comprometido').textContent =
                    porcentajeComprometido.toFixed(1) + '%';
                alertaAltaReserva.style.display = 'flex';
            } else if (alertaAltaReserva) {
                alertaAltaReserva.style.display = 'none';
            }
        }
        return { success: true };
    } catch (error) {
        console.error('[Informe Stock] Error cargando KPIs:', error);
        showNotification('Error al cargar los indicadores', 'error');
        return { success: false };
    }
}

async function cargarDatosTabla(client) {
    try {
        const { data, error } = await client.rpc('fn_reporte_stock', {
            p_busqueda: stock_currentSearchTerm || null,
            p_id_marca: stock_currentFilterMarca || null,
            p_filtro_estado: stock_currentFilterEstado || null,
            p_ordenar_por: stock_currentSortKey,
            p_orden_direccion: stock_currentSortDirection
        });

        if (error) throw error;
        if (!informeStockModuloActivo) return { success: false };

        stock_allData = data || [];
        stock_filteredData = data || [];
        stock_currentPage = 1;
        renderizarTablaPaginadaStock();
        return { success: true };
    } catch (error) {
        console.error('[Informe Stock] Error cargando datos de tabla:', error);
        const tbody = document.getElementById('tbody-stock');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding:40px;color:#EF4444;">
                <i class="fas fa-exclamation-triangle"></i> Error: ${error.message}</td></tr>`;
        }
        return { success: false };
    }
}

// =========================================================================
// RENDERIZADO
// =========================================================================

function renderizarTablaPaginadaStock() {
    if (!informeStockModuloActivo) return;

    const tbody = document.getElementById('tbody-stock');
    if (!tbody) {
        stock_isLoading = false;
        informeStockModuloActivo = false;
        return;
    }

    const startIndex = (stock_currentPage - 1) * stock_rowsPerPage;
    const endIndex = startIndex + stock_rowsPerPage;
    const paginatedData = stock_filteredData.slice(startIndex, endIndex);

    tbody.innerHTML = '';

    if (paginatedData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding:40px;font-style:italic;color:#888;">
            <i class="fas fa-inbox"></i> No se encontraron productos con los filtros seleccionados</td></tr>`;
        actualizarControlesPaginacionStock();
        return;
    }

    paginatedData.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors';

        let badgeClass = 'stock-normal';
        if (item.estado_calculado === 'AGOTADO') badgeClass = 'stock-agotado';
        else if (item.estado_calculado === 'BAJO') badgeClass = 'stock-bajo';

        const reservadoClass = item.stock_reservado > 0 ? 'text-reserved-active' : '';

        row.innerHTML = `
            <td>
                <div style="font-weight:600;color:#1F2937;">${escapeHtml(item.nombre_producto)}</div>
                <div style="font-size:0.75rem;color:#6B7280;">SKU: ${escapeHtml(item.sku)}</div>
            </td>
            <td>${escapeHtml(item.nombre_marca || '-')}</td>
            <td class="text-center">${escapeHtml(item.nombre_unidad || '-')}</td>
            <td class="text-right" style="font-weight:500;">${formatearNumero(item.stock_fisico)}</td>
            <td class="text-right ${reservadoClass}">${formatearNumero(item.stock_reservado)}</td>
            <td class="text-right">
                <span class="stock-badge ${badgeClass}">${formatearNumero(item.stock_disponible)}</span>
            </td>
        `;
        tbody.appendChild(row);
    });

    actualizarControlesPaginacionStock();
    actualizarIndicadoresOrdenamiento();
    console.log(`[Informe Stock] ${paginatedData.length} filas renderizadas`);
}

function actualizarControlesPaginacionStock() {
    const totalPages = Math.ceil(stock_filteredData.length / stock_rowsPerPage);
    const btnPrev = document.getElementById('btn-prev-page-stock');
    const btnNext = document.getElementById('btn-next-page-stock');
    const pageInfo = document.getElementById('page-info-stock');

    if (btnPrev) btnPrev.disabled = stock_currentPage <= 1;
    if (btnNext) btnNext.disabled = stock_currentPage >= totalPages;

    if (pageInfo) {
        const start = (stock_currentPage - 1) * stock_rowsPerPage + 1;
        const end = Math.min(stock_currentPage * stock_rowsPerPage, stock_filteredData.length);
        pageInfo.textContent = stock_filteredData.length === 0
            ? 'No hay resultados'
            : `Mostrando ${start}-${end} de ${stock_filteredData.length} productos | Página ${stock_currentPage} de ${totalPages}`;
    }
}

function actualizarIndicadoresOrdenamiento() {
    document.querySelectorAll('.sortable-header').forEach(h => h.classList.remove('active','asc','desc'));
    const activeHeader = document.querySelector(`[data-sort-key="${stock_currentSortKey}"]`);
    if (activeHeader) {
        activeHeader.classList.add('active', stock_currentSortDirection.toLowerCase());
    }
}

// =========================================================================
// FILTROS Y ORDENAMIENTO
// =========================================================================

async function aplicarFiltrosYRecargar() {
    if (!informeStockModuloActivo) return;
    await cargarDatosInformeStock();
}

function handleSortClick(sortKey) {
    if (stock_currentSortKey === sortKey) {
        stock_currentSortDirection = stock_currentSortDirection === 'ASC' ? 'DESC' : 'ASC';
    } else {
        stock_currentSortKey = sortKey;
        stock_currentSortDirection = 'ASC';
    }
    aplicarFiltrosYRecargar();
}

// =========================================================================
// COMPARTIR POR WHATSAPP ✅
// =========================================================================

async function compartirStockWhatsApp() {
    console.log('[Informe Stock] Iniciando compartir por WhatsApp...');

    if (!stock_filteredData || stock_filteredData.length === 0) {
        showNotification('No hay datos para compartir con los filtros actuales', 'warning');
        return;
    }

    // 1. Obtener marcas únicas de los datos actuales
    const marcasUnicas = [...new Set(
        stock_filteredData
            .filter(p => p.stock_disponible > 0)
            .map(p => p.nombre_marca || 'Sin Marca')
    )].sort();

    if (marcasUnicas.length === 0) {
        showNotification('No hay productos con stock disponible para compartir', 'warning');
        return;
    }

    // 2. Generar checkboxes de marcas
    const checkboxesHtml = marcasUnicas.map(marca => `
        <label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer;font-size:14px;">
            <input type="checkbox" class="chk-marca-whatsapp" value="${marca}" checked
                   style="width:16px;height:16px;cursor:pointer;">
            <span>${marca}</span>
            <span style="margin-left:auto;color:#6b7280;font-size:12px;">
                (${stock_filteredData.filter(p => (p.nombre_marca||'Sin Marca') === marca && p.stock_disponible > 0).length} productos)
            </span>
        </label>
    `).join('');

    // 3. Mostrar modal de selección
    const result = await Swal.fire({
        title: '<i class="fab fa-whatsapp" style="color:#25d366;margin-right:8px;"></i> Compartir Inventario',
        html: `
            <div style="text-align:left;">
                <p style="margin-bottom:12px;color:#495057;font-size:14px;">
                    Selecciona las marcas que quieres incluir en el mensaje:
                </p>
                <div style="display:flex;gap:8px;margin-bottom:12px;">
                    <button type="button" id="btn-marcar-todos" class="swal2-confirm swal2-styled"
                            style="background:#6c757d;padding:4px 12px;font-size:12px;">
                        Marcar todos
                    </button>
                    <button type="button" id="btn-desmarcar-todos" class="swal2-confirm swal2-styled"
                            style="background:#6c757d;padding:4px 12px;font-size:12px;">
                        Desmarcar todos
                    </button>
                </div>
                <div style="max-height:280px;overflow-y:auto;border:1px solid #e9ecef;border-radius:6px;padding:8px 12px;">
                    ${checkboxesHtml}
                </div>
                <p style="margin-top:12px;color:#6b7280;font-size:12px;">
                    <i class="fas fa-info-circle"></i>
                    Solo se incluirán productos con stock disponible > 0
                </p>
            </div>
        `,
        width: '480px',
        showCancelButton: true,
        confirmButtonText: '<i class="fab fa-whatsapp"></i> Generar y Copiar',
        confirmButtonColor: '#25d366',
        cancelButtonText: 'Cancelar',
        didOpen: () => {
            document.getElementById('btn-marcar-todos')?.addEventListener('click', () => {
                document.querySelectorAll('.chk-marca-whatsapp').forEach(c => c.checked = true);
            });
            document.getElementById('btn-desmarcar-todos')?.addEventListener('click', () => {
                document.querySelectorAll('.chk-marca-whatsapp').forEach(c => c.checked = false);
            });
        },
        preConfirm: () => {
            const marcasSeleccionadas = [...document.querySelectorAll('.chk-marca-whatsapp:checked')]
                .map(c => c.value);
            if (marcasSeleccionadas.length === 0) {
                Swal.showValidationMessage('Debes seleccionar al menos una marca');
                return false;
            }
            return marcasSeleccionadas;
        }
    });

    if (!result.isConfirmed) return;

    const marcasSeleccionadas = result.value;

    // 4. Generar texto formateado para WhatsApp
    const fecha = new Date().toLocaleDateString('es-CO', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });

    let texto = `📦 *INVENTARIO DISPONIBLE*\n`;
    texto += `📅 ${fecha}\n`;
    texto += `─────────────────────\n\n`;

    let totalProductos = 0;

    marcasSeleccionadas.forEach(marca => {
        const productos = stock_filteredData
            .filter(p => (p.nombre_marca || 'Sin Marca') === marca && p.stock_disponible > 0)
            .sort((a, b) => a.nombre_producto.localeCompare(b.nombre_producto));

        if (productos.length === 0) return;

        texto += `🏷️ *${marca.toUpperCase()}*\n`;

        productos.forEach(p => {
            const nombre = p.nombre_producto.padEnd(22, ' ');
            const cantidad = `${formatearNumero(p.stock_disponible)} und`;
            texto += `• ${nombre} ${cantidad}\n`;
            totalProductos++;
        });

        texto += `\n`;
    });

    texto += `─────────────────────\n`;
    texto += `Total: *${totalProductos} productos*\n`;
    texto += `_Inventrack · Actualizado en tiempo real_`;

    // 5. Copiar al portapapeles
    try {
        await navigator.clipboard.writeText(texto);

        // 6. Confirmar y abrir WhatsApp
        await Swal.fire({
            icon: 'success',
            title: '¡Listo! 📋',
            html: `
                <p>El inventario fue <strong>copiado al portapapeles</strong>.</p>
                <p style="margin-top:8px;font-size:13px;color:#6b7280;">
                    ${totalProductos} productos de ${marcasSeleccionadas.length} marca(s)
                </p>
                <p style="margin-top:10px;">
                    Abre WhatsApp y haz <strong>Ctrl+V</strong> para pegar el mensaje.
                </p>
            `,
            confirmButtonText: 'Abrir WhatsApp',
            confirmButtonColor: '#25d366',
            showDenyButton: true,
            denyButtonText: 'Solo copiar',
            denyButtonColor: '#6c757d',
            showCancelButton: false
        }).then(r => {
            if (r.isConfirmed) {
                window.location.href = `whatsapp://send?text=${encodeURIComponent(texto)}`;
            }
        });

    } catch (clipErr) {
        console.error('[Informe Stock] Error al copiar:', clipErr);
        // Fallback: mostrar el texto para que lo copie manualmente
        await Swal.fire({
            title: 'Copia este texto',
            html: `<textarea style="width:100%;height:200px;font-family:monospace;font-size:12px;padding:8px;"
                             readonly onclick="this.select()">${texto}</textarea>
                   <p style="font-size:12px;color:#6b7280;margin-top:8px;">
                       Haz clic en el texto y presiona Ctrl+A, luego Ctrl+C para copiarlo.
                   </p>`,
            confirmButtonText: 'Cerrar',
            width: '500px'
        });
    }
}

// =========================================================================
// EXPORTACIÓN CSV
// =========================================================================

async function exportarStockCSV() {
    const btn = document.getElementById('btn-exportar-csv-stock');
    if (!btn) return;

    btn.disabled = true;
    btn.classList.add('button-loading');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Exportando...';

    try {
        if (!stock_filteredData || stock_filteredData.length === 0) {
            showNotification('No hay datos para exportar con los filtros actuales', 'warning');
            return;
        }

        const headers = ['SKU','Producto','Marca','Unidad','Stock Físico','Stock Reservado','Stock Disponible','Estado','Costo Unitario'];
        const rows = stock_filteredData.map(item => [
            cleanCsvValue(item.sku),
            cleanCsvValue(item.nombre_producto),
            cleanCsvValue(item.nombre_marca),
            cleanCsvValue(item.nombre_unidad),
            item.stock_fisico,
            item.stock_reservado,
            item.stock_disponible,
            item.estado_calculado,
            item.costo_unitario
        ]);

        const csvString = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const fecha = new Date().toISOString().slice(0, 10);
        link.setAttribute('href', url);
        link.setAttribute('download', `informe_stock_${fecha}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showNotification(`${stock_filteredData.length} productos exportados exitosamente`, 'success');
    } catch (error) {
        console.error('[Informe Stock] Error exportando:', error);
        showNotification('Error al exportar el archivo CSV', 'error');
    } finally {
        btn.disabled = false;
        btn.classList.remove('button-loading');
        btn.innerHTML = originalText;
    }
}

function cleanCsvValue(value) {
    if (value === null || value === undefined) return '';
    const s = value.toString();
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

// =========================================================================
// HELPERS
// =========================================================================

function formatearNumero(numero) {
    if (numero === null || numero === undefined) return '0';
    return Number(numero).toLocaleString('es-CO');
}

function formatearMoneda(valor, esCompacto = false) {
    return window.formatMoney(valor, esCompacto);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

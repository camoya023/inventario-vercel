// =========================================================================
// MÓDULO INICIO / DASHBOARD - INVENTRACK VERCEL
//
// Franjas 1 y 2 acordadas con el dueño: ventas de hoy y alertas de
// inventario. Sin franja de accesos/pendientes por ahora.
//
// No trae datos propios: reusa fn_reporte_ventas_kpis (con fecha = hoy) y
// fn_reporte_stock_kpis, las mismas RPC que ya usan Informe de Ventas e
// Informe de Stock. Ningún SQL nuevo.
// =========================================================================

// Variable global del módulo
let dashboard_isLoading = false;

// =========================================================================
// CAPA 1: DATOS
// =========================================================================

/**
 * Trae los KPIs de ventas del día. Misma RPC que Informe de Ventas, con
 * p_fecha_desde = p_fecha_hasta = hoy.
 * No lanza excepciones: devuelve el error dentro del objeto.
 */
async function obtenerKpisVentasHoyConSupabase() {
  try {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    const hoy = window.getTodayISO();

    const { data, error } = await client.rpc('fn_reporte_ventas_kpis', {
      p_fecha_desde: hoy,
      p_fecha_hasta: hoy,
      p_id_cliente: null
    });

    if (error) {
      console.error('[Dashboard] ✗ Error en fn_reporte_ventas_kpis:', error);
      return { datos: null, error: error.message || 'Error al obtener las ventas de hoy' };
    }

    console.log('[Dashboard] ✓ KPIs de ventas de hoy obtenidos:', data);
    return { datos: data, error: null };

  } catch (error) {
    console.error('[Dashboard] ✗ Excepción al obtener las ventas de hoy:', error);
    return { datos: null, error: error.message || 'Error desconocido' };
  }
}

/**
 * Trae los KPIs de inventario. Misma RPC que Informe de Stock, sin filtros:
 * es el estado actual completo, no una búsqueda.
 * No lanza excepciones: devuelve el error dentro del objeto.
 */
async function obtenerKpisStockConSupabase() {
  try {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    const { data, error } = await client.rpc('fn_reporte_stock_kpis', {
      p_busqueda: null,
      p_id_marca: null,
      p_filtro_estado: null
    });

    if (error) {
      console.error('[Dashboard] ✗ Error en fn_reporte_stock_kpis:', error);
      return { datos: null, error: error.message || 'Error al obtener las alertas de inventario' };
    }

    console.log('[Dashboard] ✓ KPIs de inventario obtenidos:', data);
    return { datos: data, error: null };

  } catch (error) {
    console.error('[Dashboard] ✗ Excepción al obtener las alertas de inventario:', error);
    return { datos: null, error: error.message || 'Error desconocido' };
  }
}

// =========================================================================
// CAPA 2: ORQUESTACIÓN
// =========================================================================

/**
 * Carga ambas franjas en paralelo y delega el pintado.
 *
 * Las dos peticiones son independientes a propósito: si una RPC falla, la
 * otra franja se pinta igual. `Promise.all` no rompe esto porque cada
 * `obtenerXConSupabase` captura su propio error y nunca lanza — lo que
 * puede fallar es la promesa nunca, solo el contenido que resuelve.
 */
async function fetchAndRenderDashboard() {
  if (dashboard_isLoading) {
    console.log('[Dashboard] Ya se está cargando, espera por favor...');
    return;
  }
  dashboard_isLoading = true;

  mostrarSpinnerFranjaDashboard('dashboard-franja-ventas');
  mostrarSpinnerFranjaDashboard('dashboard-franja-stock');

  const fechaHoy = document.getElementById('dashboard-fecha-hoy');
  if (fechaHoy) {
    fechaHoy.textContent = new Date().toLocaleDateString('es-CO', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  const [ventas, stock] = await Promise.all([
    obtenerKpisVentasHoyConSupabase(),
    obtenerKpisStockConSupabase()
  ]);

  dashboard_isLoading = false;

  renderizarFranjaVentasHoy(ventas.datos, ventas.error);
  renderizarFranjaAlertasStock(stock.datos, stock.error);
}

// =========================================================================
// CAPA 3: RENDERIZADO
// =========================================================================

/**
 * Deja los valores de una franja en "—" mientras carga, sin tocar la
 * estructura de las tarjetas.
 */
function mostrarSpinnerFranjaDashboard(idSeccion) {
  const seccion = document.getElementById(idSeccion);
  if (!seccion) return;

  seccion.querySelectorAll('.kpi-card-value').forEach((elemento) => {
    elemento.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  });
}

/**
 * Pinta la franja de ventas de hoy.
 *
 * Degradación elegante: si la RPC falla, las tarjetas quedan en 0 con un
 * aviso explícito arriba de la franja, en vez de dejar el spinner girando
 * para siempre o romper el resto de la pantalla.
 */
function renderizarFranjaVentasHoy(kpis, error) {
  const aviso = document.getElementById('dashboard-aviso-ventas');

  if (error) {
    if (aviso) {
      aviso.style.display = '';
      aviso.innerHTML = `<i class="fas fa-exclamation-triangle"></i> No se pudieron cargar las ventas de hoy: ${error}`;
    }
  } else if (aviso) {
    aviso.style.display = 'none';
  }

  // ⚠️ Un día sin ventas devuelve null SIN error, y el negocio cierra ~1 día
  // por semana: es el caso más frecuente, no un borde raro. Sin este
  // respaldo, un domingo rompía la pantalla entera con un TypeError.
  kpis = kpis || { total_dinero: 0, cantidad_ventas: 0, ticket_promedio: 0, ganancia_estimada: 0 };

  const asignarTexto = (id, texto) => {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = texto;
  };

  asignarTexto('dashboard-kpi-ventas-hoy', window.formatMoney(kpis.total_dinero || 0, true));
  asignarTexto('dashboard-kpi-cantidad-ventas', (kpis.cantidad_ventas || 0).toLocaleString('es-CO'));
  asignarTexto('dashboard-kpi-ticket-promedio', window.formatMoney(kpis.ticket_promedio || 0, true));
  asignarTexto('dashboard-kpi-ganancia-hoy', window.formatMoney(kpis.ganancia_estimada || 0, true));
}

/**
 * Pinta la franja de alertas de inventario.
 *
 * Degradación elegante: mismo criterio que la franja de ventas — un fallo
 * aquí no debe apagar la franja que sí cargó bien.
 */
function renderizarFranjaAlertasStock(kpis, error) {
  const aviso = document.getElementById('dashboard-aviso-stock');

  if (error) {
    if (aviso) {
      aviso.style.display = '';
      aviso.innerHTML = `<i class="fas fa-exclamation-triangle"></i> No se pudieron cargar las alertas de inventario: ${error}`;
    }
  } else if (aviso) {
    aviso.style.display = 'none';
  }

  // Mismo respaldo que en ventas: la RPC puede devolver null sin error.
  kpis = kpis || { valor_inventario: 0, total_productos: 0, items_bajo_stock: 0, items_agotados: 0 };

  const asignarTexto = (id, texto) => {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = texto;
  };

  asignarTexto('dashboard-kpi-valor-inventario', window.formatMoney(kpis.valor_inventario || 0, true));
  asignarTexto('dashboard-kpi-total-productos', (kpis.total_productos || 0).toLocaleString('es-CO'));
  asignarTexto('dashboard-kpi-bajo-stock', (kpis.items_bajo_stock || 0).toLocaleString('es-CO'));
  asignarTexto('dashboard-kpi-agotados', (kpis.items_agotados || 0).toLocaleString('es-CO'));
}

// =========================================================================
// CONFIGURACIÓN DE LA PÁGINA
// =========================================================================

/**
 * Configura los listeners de la vista Inicio.
 * Punto de entrada del módulo, invocado desde home.js al cargar la vista.
 */
function configurarPaginaDashboardYListeners() {
  console.log('[Dashboard] Configurando listeners...');

  dashboard_isLoading = false;

  const btnRefrescar = document.getElementById('btn-refrescar-dashboard');
  if (btnRefrescar) {
    btnRefrescar.addEventListener('click', fetchAndRenderDashboard);
  }

  // Cada tarjeta navega al informe completo. Delegación sobre el wrapper de
  // la vista: las dos franjas comparten el mismo criterio de destino.
  const vista = document.querySelector('.dashboard-vista');
  if (vista) {
    vista.addEventListener('click', (evento) => {
      const tarjeta = evento.target.closest('.dashboard-card-clickable');
      if (!tarjeta) return;

      if (tarjeta.dataset.destino === 'ventas' && typeof cargarPaginaInformeVentas === 'function') {
        cargarPaginaInformeVentas();
      } else if (tarjeta.dataset.destino === 'stock' && typeof cargarVistaInformeStock === 'function') {
        cargarVistaInformeStock();
      }
    });
  }

  fetchAndRenderDashboard();

  console.log('[Dashboard] ✓ Listeners configurados');
}

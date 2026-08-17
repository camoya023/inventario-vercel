// =========================================================================
// MÓDULO PEDIDOS GUARDADOS - INVENTRACK VERCEL
//
// Consulta de las actas de pedido que deja la Calculadora. SOLO LECTURA:
// no recalcula, no edita y no toca inventario ni la tabla compras. Su razón
// de ser es cotejar contra la mercancía cuando llega.
//
// Todo lo que se muestra viene congelado dentro del snapshot: los precios,
// el faltante y el sugerido son los del momento en que se envió el pedido,
// no los de hoy. Volver a calcularlos daría otro número y arruinaría el
// cotejo, que es justamente para lo que sirve esto.
// =========================================================================

// Variables globales del módulo
let pedidosGuardados_isLoading = false;
let pedidosGuardados_lista = [];
let pedidosGuardados_pedidoAbierto = null;

const pedidosGuardados_formatoMoneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
});

// =========================================================================
// CAPA DE DATOS
// =========================================================================

/**
 * Trae las cabeceras de los pedidos guardados.
 * No lanza excepciones: devuelve el error dentro del objeto.
 */
async function obtenerPedidosGuardadosConSupabase(opciones) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    const { data, error } = await client.rpc('fn_listar_pedidos_calculadora', {
      p_limit: (opciones && opciones.limite) || 50,
      p_offset: (opciones && opciones.desplazamiento) || 0
    });

    if (error) {
      console.error('[PedidosGuardados] ✗ Error en la RPC de listado:', error);
      return { datos: [], error: error.message || 'Error al listar los pedidos' };
    }

    // La RPC devuelve el error dentro del JSON conservando la forma, para no
    // romper al cliente. Hay que mirarlo explícitamente.
    if (data && data.error) {
      console.error('[PedidosGuardados] ✗ La RPC devolvió un error:', data.error);
      return { datos: [], error: data.error };
    }

    console.log('[PedidosGuardados] ✓ Pedidos obtenidos:', data?.pedidos?.length || 0);
    return { datos: (data && data.pedidos) || [], error: null };

  } catch (error) {
    console.error('[PedidosGuardados] ✗ Excepción al listar los pedidos:', error);
    return { datos: [], error: error.message || 'Error desconocido' };
  }
}

/**
 * Trae el snapshot completo de un pedido.
 * No lanza excepciones: devuelve el error dentro del objeto.
 */
async function obtenerPedidoGuardadoConSupabase(idPedido) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    const { data, error } = await client.rpc('fn_obtener_pedido_calculadora', {
      p_id: idPedido
    });

    if (error) {
      console.error('[PedidosGuardados] ✗ Error al obtener el pedido:', error);
      return { datos: null, error: error.message || 'Error al obtener el pedido' };
    }

    if (data && data.error) {
      console.error('[PedidosGuardados] ✗ La RPC devolvió un error:', data.error);
      return { datos: null, error: data.error };
    }

    console.log('[PedidosGuardados] ✓ Pedido obtenido:', idPedido);
    return { datos: data, error: null };

  } catch (error) {
    console.error('[PedidosGuardados] ✗ Excepción al obtener el pedido:', error);
    return { datos: null, error: error.message || 'Error desconocido' };
  }
}

// =========================================================================
// UTILIDADES
// =========================================================================

/**
 * Fecha larga en horario local. Las fechas llegan en ISO desde Postgres.
 */
function formatearFechaPedidoGuardado(iso) {
  if (!iso) return '—';

  try {
    return new Date(iso).toLocaleString('es-CO', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (error) {
    return String(iso);
  }
}

/**
 * El descuento puede ser null: el pedido no tenía unidades de sabores varios
 * contra las cuales aplicarlo. Un 0 diría otra cosa, así que se distingue.
 */
function formatearDescuentoPedido(valor) {
  if (valor === null || valor === undefined) return 'no aplica';
  return `${Number(valor).toFixed(2)} %`;
}

/**
 * Escapa texto libre antes de meterlo en innerHTML. Las notas las escribe
 * el usuario y el nombre del proveedor viene de la base.
 */
function escaparTextoPedido(texto) {
  const div = document.createElement('div');
  div.textContent = texto === null || texto === undefined ? '' : String(texto);
  return div.innerHTML;
}

// =========================================================================
// ORQUESTACIÓN
// =========================================================================

/**
 * Carga la lista de pedidos guardados y delega el pintado.
 */
async function fetchAndRenderPedidosGuardados() {
  if (pedidosGuardados_isLoading) {
    console.log('[PedidosGuardados] Ya se están cargando los pedidos, espera por favor...');
    return;
  }
  pedidosGuardados_isLoading = true;

  const tbody = document.getElementById('tbody-pedidos-guardados');
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding:20px; font-style:italic;">
      <i class="fas fa-spinner fa-spin"></i> Cargando pedidos guardados...</td></tr>`;
  }

  const respuesta = await obtenerPedidosGuardadosConSupabase({ limite: 50 });

  pedidosGuardados_isLoading = false;

  if (respuesta.error) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center error-message" style="padding:20px;">
        Error: ${escaparTextoPedido(respuesta.error)}</td></tr>`;
    }
    return;
  }

  pedidosGuardados_lista = respuesta.datos;
  renderizarListaPedidosGuardados(pedidosGuardados_lista);
}

/**
 * Abre un pedido y muestra el detalle congelado.
 */
async function abrirPedidoGuardado(idPedido) {
  const respuesta = await obtenerPedidoGuardadoConSupabase(idPedido);

  if (respuesta.error) {
    if (typeof toastr !== 'undefined') {
      toastr.error(respuesta.error, 'No se pudo abrir el pedido');
    }
    return;
  }

  pedidosGuardados_pedidoAbierto = respuesta.datos;
  renderizarDetallePedidoGuardado(respuesta.datos);
  mostrarSeccionPedidosGuardados('detalle');
}

/**
 * Alterna entre la lista y el detalle.
 */
function mostrarSeccionPedidosGuardados(cual) {
  const lista = document.getElementById('pedidos-guardados-lista');
  const detalle = document.getElementById('pedidos-guardados-detalle');

  if (lista) lista.style.display = cual === 'lista' ? '' : 'none';
  if (detalle) detalle.style.display = cual === 'detalle' ? '' : 'none';
}

// =========================================================================
// RENDERIZADO
// =========================================================================

/**
 * Pinta la lista de pedidos guardados.
 */
function renderizarListaPedidosGuardados(pedidos) {
  const tbody = document.getElementById('tbody-pedidos-guardados');
  if (!tbody) return;

  if (!pedidos || pedidos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding:40px; font-style:italic; color:#888;">
      Todavía no hay pedidos guardados. Se crean con <strong>Guardar pedido</strong>
      desde la Calculadora de Pedidos.</td></tr>`;
    return;
  }

  let filasHtml = '';

  pedidos.forEach((pedido) => {
    filasHtml += `
      <tr data-id="${escaparTextoPedido(pedido.id)}">
        <td>${formatearFechaPedidoGuardado(pedido.fecha)}</td>
        <td class="calculadora-nombre-producto">${escaparTextoPedido(pedido.proveedor_nombre || '—')}</td>
        <td class="text-right">${Number(pedido.cantidad_lineas || 0).toLocaleString('es-CO')}</td>
        <td class="text-right">${Number(pedido.total_unidades || 0).toLocaleString('es-CO')}</td>
        <td class="text-right">${pedidosGuardados_formatoMoneda.format(Number(pedido.total_valor) || 0)}</td>
        <td class="text-right">${Number(pedido.obsequio_unidades || 0).toLocaleString('es-CO')}</td>
        <td class="text-right">${formatearDescuentoPedido(pedido.descuento_pct)}</td>
        <td class="calculadora-proveedores">${escaparTextoPedido(pedido.notas || '')}</td>
        <td class="column-actions text-center">
          <button class="button button-secondary button-sm pedidos-btn-ver"
                  data-id="${escaparTextoPedido(pedido.id)}" title="Ver el pedido">
            <i class="fas fa-eye"></i>
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = filasHtml;
}

/**
 * Pinta el detalle de un pedido guardado.
 *
 * Todos los valores salen del snapshot, incluidos los totales: no se vuelven
 * a sumar desde las líneas. Si algún día el cálculo del obsequio cambiara, el
 * acta debe seguir mostrando lo que se envió, no lo que hoy daría.
 */
function renderizarDetallePedidoGuardado(pedido) {
  const snapshot = pedido.snapshot || {};
  const resumen = snapshot.resumen || {};
  const parametros = snapshot.parametros || {};
  const lineas = snapshot.lineas || [];

  const asignarTexto = (id, texto) => {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = texto;
  };

  asignarTexto('detalle-pedido-titulo',
    `Pedido del ${formatearFechaPedidoGuardado(pedido.fecha)}`);

  asignarTexto('detalle-kpi-unidades',
    Number(pedido.total_unidades || 0).toLocaleString('es-CO'));
  asignarTexto('detalle-kpi-valor',
    pedidosGuardados_formatoMoneda.format(Number(pedido.total_valor) || 0));
  asignarTexto('detalle-kpi-obsequio',
    Number(pedido.obsequio_unidades || 0).toLocaleString('es-CO'));
  asignarTexto('detalle-kpi-descuento',
    formatearDescuentoPedido(pedido.descuento_pct));

  // ----- Cabecera: proveedor, nota y parámetros con los que se calculó -----
  const cabecera = document.getElementById('detalle-pedido-cabecera');
  if (cabecera) {
    const precios = parametros.precios || {};

    const notaHtml = pedido.notas
      ? `<div style="margin-top:6px;"><strong>Nota:</strong> ${escaparTextoPedido(pedido.notas)}</div>`
      : '';

    const desperdicioHtml = Number(resumen.desperdicio) > 0
      ? `<div style="margin-top:6px; color:#856404;">
           <i class="fas fa-exclamation-triangle"></i>
           <small>${Number(resumen.desperdicio).toLocaleString('es-CO')} und por encima del último
           múltiplo de ${Number(parametros.unidadesPorObsequio || 0).toLocaleString('es-CO')}:
           no generaron obsequio adicional.</small>
         </div>`
      : '';

    cabecera.innerHTML = `
      <div><strong>Proveedor:</strong> ${escaparTextoPedido(pedido.proveedor_nombre || '—')}</div>
      <div style="margin-top:6px;">
        <strong>Recibes:</strong>
        ${(Number(pedido.total_unidades || 0) + Number(pedido.obsequio_unidades || 0)).toLocaleString('es-CO')} und
        (${Number(pedido.total_unidades || 0).toLocaleString('es-CO')} pedidas +
        ${Number(pedido.obsequio_unidades || 0).toLocaleString('es-CO')} de obsequio).
      </div>
      ${desperdicioHtml}
      ${notaHtml}
      <div style="margin-top:12px; padding-top:10px; border-top:1px solid #cdd9f0; color:#666;">
        <small>
          <strong>Calculado con:</strong>
          modelo ${escaparTextoPedido(parametros.modelo || '—')} ·
          ${Number(parametros.cobertura || 0)} días de cobertura ·
          ${Number(parametros.seguridad || 0)} % de seguridad ·
          obsequio 1 und c/ ${Number(parametros.unidadesPorObsequio || 0).toLocaleString('es-CO')} ·
          precios varios ${pedidosGuardados_formatoMoneda.format(Number(precios.varios) || 0)},
          frutos rojos ${pedidosGuardados_formatoMoneda.format(Number(precios.frutos_rojos) || 0)},
          sin azúcar ${pedidosGuardados_formatoMoneda.format(Number(precios.sin_azucar) || 0)}.
        </small>
      </div>
    `;
  }

  // ----- Líneas -----
  const tbody = document.getElementById('tbody-detalle-pedido-guardado');
  if (tbody) {
    if (lineas.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="padding:20px; font-style:italic;">
        Este pedido no tiene líneas.</td></tr>`;
    } else {
      let filasHtml = '';

      lineas.forEach((linea) => {
        // Bajo pedido guarda los pendientes desglosados; stock, uno solo.
        const pendiente = linea.bloque === 'Bajo pedido'
          ? Number(linea.pendiente_firme || 0) + Number(linea.pendiente_borrador || 0)
          : Number(linea.pendiente || 0);

        // Se marca la línea que se envió por debajo de sus compromisos: es
        // justo la que hay que revisar primero cuando llega la mercancía.
        const bajoFaltante = Number(linea.final || 0) < Number(linea.faltante || 0);
        const claseFaltante = bajoFaltante ? 'calculadora-stock-critico' : '';

        filasHtml += `
          <tr>
            <td class="calculadora-nombre-producto">${escaparTextoPedido(linea.nombre || 'Sin nombre')}</td>
            <td>${escaparTextoPedido(linea.bloque || '')}</td>
            <td class="text-right">${Number(linea.stock_disponible || 0).toLocaleString('es-CO')}</td>
            <td class="text-right">${pendiente.toLocaleString('es-CO')}</td>
            <td class="text-right ${claseFaltante}">${Number(linea.faltante || 0).toLocaleString('es-CO')}</td>
            <td class="text-right">${Number(linea.sugerido || 0).toLocaleString('es-CO')}</td>
            <td class="text-right calculadora-celda-sugerido">${Number(linea.final || 0).toLocaleString('es-CO')}</td>
            <td class="text-right">${pedidosGuardados_formatoMoneda.format(Number(linea.precio) || 0)}</td>
            <td class="text-right">${pedidosGuardados_formatoMoneda.format(Number(linea.subtotal) || 0)}</td>
          </tr>
        `;
      });

      tbody.innerHTML = filasHtml;
    }
  }

  asignarTexto('detalle-total-unidades',
    Number(pedido.total_unidades || 0).toLocaleString('es-CO'));
  asignarTexto('detalle-total-valor',
    pedidosGuardados_formatoMoneda.format(Number(pedido.total_valor) || 0));
}

/**
 * Abre el pedido en una ventana lista para imprimir, por si se quiere llevar
 * la hoja al momento de recibir la mercancía.
 */
function imprimirPedidoGuardado() {
  const pedido = pedidosGuardados_pedidoAbierto;
  if (!pedido) return;

  const snapshot = pedido.snapshot || {};
  const lineas = snapshot.lineas || [];

  const filasHtml = lineas.map((linea) => `
    <tr>
      <td>${escaparTextoPedido(linea.nombre || '')}</td>
      <td>${escaparTextoPedido(linea.bloque || '')}</td>
      <td class="derecha">${Number(linea.final || 0).toLocaleString('es-CO')}</td>
      <td class="derecha">${pedidosGuardados_formatoMoneda.format(Number(linea.precio) || 0)}</td>
      <td class="derecha">${pedidosGuardados_formatoMoneda.format(Number(linea.subtotal) || 0)}</td>
      <td style="width:70px;"></td>
    </tr>
  `).join('');

  const ventana = window.open('', '_blank');
  if (!ventana) {
    if (typeof toastr !== 'undefined') {
      toastr.warning('El navegador bloqueó la ventana de impresión.');
    }
    return;
  }

  ventana.document.write(`
    <html>
      <head>
        <title>Pedido del ${formatearFechaPedidoGuardado(pedido.fecha)}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          p.sub { color: #666; font-size: 12px; margin-top: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
          th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
          th { background: #f0f0f0; }
          .derecha { text-align: right; }
          tfoot td { font-weight: bold; background: #f7f7f7; }
        </style>
      </head>
      <body>
        <h1>Pedido del ${formatearFechaPedidoGuardado(pedido.fecha)}</h1>
        <p class="sub">
          ${escaparTextoPedido(pedido.proveedor_nombre || '')} ·
          ${Number(pedido.total_unidades || 0).toLocaleString('es-CO')} und ·
          ${pedidosGuardados_formatoMoneda.format(Number(pedido.total_valor) || 0)} ·
          obsequio ${Number(pedido.obsequio_unidades || 0).toLocaleString('es-CO')} und ·
          descuento ${formatearDescuentoPedido(pedido.descuento_pct)}
        </p>
        <table>
          <thead>
            <tr>
              <th>Producto</th><th>Bloque</th><th>Pedido</th>
              <th>Precio</th><th>Subtotal</th><th>Recibido</th>
            </tr>
          </thead>
          <tbody>${filasHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="2">TOTAL</td>
              <td class="derecha">${Number(pedido.total_unidades || 0).toLocaleString('es-CO')}</td>
              <td></td>
              <td class="derecha">${pedidosGuardados_formatoMoneda.format(Number(pedido.total_valor) || 0)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `);

  ventana.document.close();
  ventana.print();
}

// =========================================================================
// CONFIGURACIÓN DE LA PÁGINA
// =========================================================================

/**
 * Configura los listeners de la vista Pedidos Guardados.
 * Punto de entrada del módulo, invocado desde home.js al cargar la vista.
 */
function configurarPaginaPedidosGuardadosYListeners() {
  console.log('[PedidosGuardados] Configurando listeners...');

  // Estado limpio al entrar: la vista se reinyecta en cada navegación.
  pedidosGuardados_isLoading = false;
  pedidosGuardados_lista = [];
  pedidosGuardados_pedidoAbierto = null;

  mostrarSeccionPedidosGuardados('lista');

  const btnRefrescar = document.getElementById('btn-refrescar-pedidos-guardados');
  if (btnRefrescar) {
    btnRefrescar.addEventListener('click', fetchAndRenderPedidosGuardados);
  }

  const btnVolver = document.getElementById('btn-volver-pedidos-guardados');
  if (btnVolver) {
    btnVolver.addEventListener('click', () => {
      pedidosGuardados_pedidoAbierto = null;
      mostrarSeccionPedidosGuardados('lista');
    });
  }

  const btnImprimir = document.getElementById('btn-imprimir-pedido-guardado');
  if (btnImprimir) {
    btnImprimir.addEventListener('click', imprimirPedidoGuardado);
  }

  // Delegación: las filas se repintan en cada carga.
  const tbody = document.getElementById('tbody-pedidos-guardados');
  if (tbody) {
    tbody.addEventListener('click', (evento) => {
      const boton = evento.target.closest('.pedidos-btn-ver');
      if (!boton) return;
      abrirPedidoGuardado(boton.dataset.id);
    });
  }

  fetchAndRenderPedidosGuardados();

  console.log('[PedidosGuardados] ✓ Listeners configurados');
}

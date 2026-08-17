// =========================================================================
// MÓDULO CALCULADORA DE PEDIDOS - INVENTRACK VERCEL
//
// Reemplaza la calculadora HTML autónoma que cargaba 3 CSV a mano.
// Toda la información llega en una sola llamada a la RPC datos_pedido_compra.
//
// Dos bloques independientes, segun productos.se_maneja_bajo_pedido:
//   - modo 'stock'       -> pronóstico + reparto de capacidad
//   - modo 'bajo_pedido'  -> se compra exactamente lo pendiente (comprar_exacto)
// =========================================================================

// Variables globales del módulo
let calculadora_isLoading = false;
let calculadora_datosCrudos = null;
let calculadora_lineasStock = [];
let calculadora_lineasBajoPedido = [];
let calculadora_resultadoReparto = null;
let calculadora_sugeridos = {};
let calculadora_cantidadesFinales = {};
let calculadora_proveedoresCargados = false;
let calculadora_itemsStock = [];
let calculadora_opcionesPedido = [];
let calculadora_totalElegido = null;
let calculadora_idealPedido = 0;
let calculadora_pisoPedido = 0;
let calculadora_filasHistorial = 0;

// Clave única de localStorage. Centralizar aquí permite migrar después a
// configuracion_negocio.parametros_compra sin tocar el resto del módulo.
const CALCULADORA_CLAVE_PARAMETROS = 'calculadora_pedidos_parametros';

// Cuántos sabores de mayor demanda absorben el ajuste al total. Es lo que el
// usuario hacía a mano tras recortar líneas del pedido.
const CALCULADORA_SABORES_PARA_AJUSTE = 5;

const CALCULADORA_PARAMETROS_POR_DEFECTO = {
  proveedorId: '',
  diasHistorial: 120,
  modelo: 'hibrido',
  cobertura: 3,
  seguridad: 20,
  // Tope del almacén. 0 = sin tope. Solo limita qué opciones se ofrecen.
  capacidadMax: 400,
  // El proveedor regala 1 und por cada N compradas. El mismo N es el múltiplo
  // del pedido: pedir 241 da el mismo obsequio que 200 y desperdicia 41 und.
  unidadesPorObsequio: 100,
  precios: {
    varios: 3500,
    frutos_rojos: 4000,
    sin_azucar: 4000
  }
};

const calculadora_formatoMoneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
});

// =========================================================================
// PARÁMETROS (localStorage)
// =========================================================================

/**
 * Mezcla unos parámetros cualesquiera con los valores por defecto.
 * Aísla la fusión para que la base y localStorage la compartan.
 */
function normalizarParametrosCalculadora(parseado) {
  return {
    ...CALCULADORA_PARAMETROS_POR_DEFECTO,
    ...(parseado || {}),
    precios: {
      ...CALCULADORA_PARAMETROS_POR_DEFECTO.precios,
      ...((parseado || {}).precios || {})
    }
  };
}

/**
 * Lee los parámetros del caché local y los mezcla con los valores por defecto.
 * Degradación elegante: si el JSON está corrupto, devuelve los defaults.
 *
 * ⚠️ Esto ya NO es la fuente de verdad: lo es configuracion_negocio.parametros_compra.
 * localStorage quedó como caché para pintar el panel al instante y para
 * sobrevivir a una caída de red. Lee sincrónicamente a propósito: la vista se
 * pinta sin esperar a la base y sincronizarParametrosDesdeLaBase() la corrige
 * después si hay algo más nuevo.
 */
function cargarParametrosCalculadora() {
  try {
    const guardado = localStorage.getItem(CALCULADORA_CLAVE_PARAMETROS);
    if (!guardado) {
      return { ...CALCULADORA_PARAMETROS_POR_DEFECTO };
    }

    console.log('[Calculadora] ✓ Parámetros cargados desde el caché local');
    return normalizarParametrosCalculadora(JSON.parse(guardado));

  } catch (error) {
    console.warn('[Calculadora] ⚠ Parámetros corruptos, se usan los valores por defecto:', error);
    return { ...CALCULADORA_PARAMETROS_POR_DEFECTO };
  }
}

/**
 * Guarda los parámetros en la base y en el caché local.
 *
 * El caché se escribe primero y de forma síncrona para que el valor quede
 * disponible aunque la red falle. La base se actualiza en segundo plano: un
 * fallo se registra pero no interrumpe el cálculo que el usuario está haciendo.
 */
function guardarParametrosCalculadora(parametros) {
  try {
    localStorage.setItem(CALCULADORA_CLAVE_PARAMETROS, JSON.stringify(parametros));
  } catch (error) {
    console.warn('[Calculadora] ⚠ No se pudo escribir el caché local de parámetros:', error);
  }

  guardarParametrosCompraConSupabase(parametros).then((respuesta) => {
    if (respuesta.error) {
      console.warn('[Calculadora] ⚠ Los parámetros quedaron solo en el caché local:', respuesta.error);
    } else {
      console.log('[Calculadora] ✓ Parámetros guardados en la base');
    }
  });
}

/**
 * Trae los parámetros de la base y refresca el panel si difieren del caché.
 *
 * Se llama al abrir la vista, después de haber pintado con el caché. Así los
 * precios siguen al usuario entre equipos y navegadores: localStorage está
 * atado al origen, y entrar por el dominio propio o por *.vercel.app son dos
 * almacenamientos distintos.
 */
async function sincronizarParametrosDesdeLaBase() {
  const respuesta = await obtenerParametrosCompraConSupabase();

  if (respuesta.error || !respuesta.datos) {
    console.log('[Calculadora] Se mantienen los parámetros del caché local');
    return;
  }

  const parametros = normalizarParametrosCalculadora(respuesta.datos);
  aplicarParametrosAlFormulario(parametros);

  // El selector de proveedores puede haberse poblado ya o no; si el proveedor
  // guardado existe entre sus opciones, se restaura.
  const select = document.getElementById('filtro-proveedor-pedido');
  if (select && parametros.proveedorId) {
    select.value = parametros.proveedorId;
  }

  try {
    localStorage.setItem(CALCULADORA_CLAVE_PARAMETROS, JSON.stringify(parametros));
  } catch (error) {
    console.warn('[Calculadora] ⚠ No se pudo refrescar el caché local:', error);
  }

  console.log('[Calculadora] ✓ Parámetros sincronizados desde la base');
}

/**
 * Vuelca los parámetros en los controles del panel.
 */
function aplicarParametrosAlFormulario(parametros) {
  const asignar = (id, valor) => {
    const elemento = document.getElementById(id);
    if (elemento) elemento.value = valor;
  };

  asignar('input-dias-historial-pedido', parametros.diasHistorial);
  asignar('filtro-modelo-pronostico', parametros.modelo);
  asignar('input-cobertura-pedido', parametros.cobertura);
  asignar('input-seguridad-pedido', parametros.seguridad);
  asignar('input-capacidad-max-pedido', parametros.capacidadMax);
  asignar('input-unidades-obsequio', parametros.unidadesPorObsequio);
  asignar('input-precio-varios', parametros.precios.varios);
  asignar('input-precio-frutos-rojos', parametros.precios.frutos_rojos);
  asignar('input-precio-sin-azucar', parametros.precios.sin_azucar);
}

/**
 * Lee los controles del panel y devuelve el objeto de parámetros.
 */
function leerParametrosDelFormulario() {
  const leerNumero = (id, porDefecto) => {
    const elemento = document.getElementById(id);
    if (!elemento) return porDefecto;
    const valor = parseInt(elemento.value, 10);
    return isNaN(valor) ? porDefecto : valor;
  };

  const selectProveedor = document.getElementById('filtro-proveedor-pedido');
  const selectModelo = document.getElementById('filtro-modelo-pronostico');

  return {
    proveedorId: selectProveedor ? selectProveedor.value : '',
    diasHistorial: leerNumero('input-dias-historial-pedido', 120),
    modelo: selectModelo ? selectModelo.value : 'hibrido',
    cobertura: leerNumero('input-cobertura-pedido', 3),
    seguridad: leerNumero('input-seguridad-pedido', 20),
    capacidadMax: leerNumero('input-capacidad-max-pedido', 400),
    unidadesPorObsequio: leerNumero('input-unidades-obsequio', 100),
    precios: {
      varios: leerNumero('input-precio-varios', 3500),
      frutos_rojos: leerNumero('input-precio-frutos-rojos', 4000),
      sin_azucar: leerNumero('input-precio-sin-azucar', 4000)
    }
  };
}

// =========================================================================
// CAPA DE DATOS
// =========================================================================

/**
 * Obtiene todos los datos del pedido en una sola llamada a la RPC.
 * No lanza excepciones: devuelve el error dentro del objeto.
 */
async function obtenerDatosPedidoCompraConSupabase(opciones) {
  try {
    console.log('[Calculadora] ===== OBTENIENDO DATOS DEL PEDIDO =====');
    console.log('[Calculadora] Opciones:', opciones);

    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    const parametrosRpc = {
      p_proveedor_id: opciones.proveedorId || null,
      p_dias_historial: opciones.diasHistorial || 120
    };

    console.log('[Calculadora] Llamando a RPC datos_pedido_compra...', parametrosRpc);

    const { data, error } = await client.rpc('datos_pedido_compra', parametrosRpc);

    if (error) {
      console.error('[Calculadora] ✗ Error en RPC datos_pedido_compra:', error);
      return { datos: null, error: error.message || 'Error al obtener los datos del pedido' };
    }

    // La RPC devuelve el error dentro del JSON (conservando la forma) en vez
    // de lanzar, para no romper al cliente. Hay que mirarlo explícitamente.
    if (data && data.error) {
      console.error('[Calculadora] ✗ La RPC devolvió un error:', data.error);
      return { datos: null, error: data.error };
    }

    console.log('[Calculadora] ✓ Datos obtenidos:', {
      productos: data?.productos?.length || 0,
      ventas: data?.ventas?.length || 0,
      dias_operacion: data?.dias_operacion?.length || 0
    });

    return { datos: data, error: null };

  } catch (error) {
    console.error('[Calculadora] ✗ Excepción al obtener datos del pedido:', error);
    return { datos: null, error: error.message || 'Error desconocido' };
  }
}

/**
 * Obtiene los proveedores activos para el selector.
 * No lanza excepciones: devuelve el error dentro del objeto.
 */
async function obtenerProveedoresParaSelectorConSupabase() {
  try {
    console.log('[Calculadora] Obteniendo proveedores para el selector...');

    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    const { data, error } = await client
      .from('proveedores')
      .select('id, nombre_empresa')
      .eq('activo', true)
      .order('nombre_empresa', { ascending: true });

    if (error) {
      console.error('[Calculadora] ✗ Error al obtener proveedores:', error);
      return { datos: [], error: error.message || 'Error al obtener proveedores' };
    }

    console.log('[Calculadora] ✓ Proveedores obtenidos:', data?.length || 0);
    return { datos: data || [], error: null };

  } catch (error) {
    console.error('[Calculadora] ✗ Excepción al obtener proveedores:', error);
    return { datos: [], error: error.message || 'Error desconocido' };
  }
}

/**
 * Lee los parámetros de compra guardados en la base.
 * No lanza excepciones: devuelve el error dentro del objeto.
 *
 * Devuelve datos: null cuando la empresa todavía no ha guardado nada. No es
 * un error — significa "usa el fallback local".
 */
async function obtenerParametrosCompraConSupabase() {
  try {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    const { data, error } = await client.rpc('fn_obtener_parametros_compra');

    if (error) {
      console.warn('[Calculadora] ⚠ No se pudieron leer los parámetros de la base:', error.message);
      return { datos: null, error: error.message || 'Error al leer los parámetros' };
    }

    return { datos: data || null, error: null };

  } catch (error) {
    console.warn('[Calculadora] ⚠ Excepción al leer los parámetros de la base:', error);
    return { datos: null, error: error.message || 'Error desconocido' };
  }
}

/**
 * Guarda los parámetros de compra en la base.
 * No lanza excepciones: devuelve el error dentro del objeto.
 */
async function guardarParametrosCompraConSupabase(parametros) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    const { data, error } = await client.rpc('fn_guardar_parametros_compra', {
      p_parametros: parametros
    });

    if (error) {
      return { datos: null, error: error.message || 'Error al guardar los parámetros' };
    }

    if (data && data.exito === false) {
      return { datos: null, error: data.mensaje || 'Error al guardar los parámetros' };
    }

    return { datos: data, error: null };

  } catch (error) {
    return { datos: null, error: error.message || 'Error desconocido' };
  }
}

/**
 * Guarda el pedido enviado como un acta de solo lectura.
 * No lanza excepciones: devuelve el error dentro del objeto.
 */
async function guardarPedidoCalculadoraConSupabase(pedido) {
  try {
    const client = getSupabaseClient();
    if (!client) {
      throw new Error('Cliente de Supabase no inicializado');
    }

    console.log('[Calculadora] Guardando el pedido enviado...', {
      lineas: pedido.lineas.length,
      unidades: pedido.resumen.total_unidades
    });

    const { data, error } = await client.rpc('fn_guardar_pedido_calculadora', {
      p_pedido: pedido
    });

    if (error) {
      console.error('[Calculadora] ✗ Error al guardar el pedido:', error);
      return { datos: null, error: error.message || 'Error al guardar el pedido' };
    }

    if (data && data.exito === false) {
      console.error('[Calculadora] ✗ La RPC rechazó el pedido:', data.mensaje);
      return { datos: null, error: data.mensaje || 'Error al guardar el pedido' };
    }

    console.log('[Calculadora] ✓ Pedido guardado:', data);
    return { datos: data, error: null };

  } catch (error) {
    console.error('[Calculadora] ✗ Excepción al guardar el pedido:', error);
    return { datos: null, error: error.message || 'Error desconocido' };
  }
}

// =========================================================================
// LÓGICA DE PRONÓSTICO (funciones puras)
// =========================================================================

/**
 * Convierte 'YYYY-MM-DD' en una fecha local.
 * new Date('2026-01-07') se interpreta como UTC y en Colombia (UTC-5)
 * retrocede un día, lo que desplazaría el modelo por día de semana.
 */
function parsearFechaLocalCalculadora(valorFecha) {
  if (!valorFecha) return null;

  const texto = String(valorFecha).slice(0, 10);
  const partes = texto.split('-');
  if (partes.length !== 3) return null;

  const anio = parseInt(partes[0], 10);
  const mes = parseInt(partes[1], 10);
  const dia = parseInt(partes[2], 10);
  if (isNaN(anio) || isNaN(mes) || isNaN(dia)) return null;

  return new Date(anio, mes - 1, dia);
}

/**
 * Normaliza el historial crudo de la RPC a [{ fecha: Date, nombre, unidades }],
 * ordenado por fecha ascendente.
 */
function normalizarHistorialVentas(ventas) {
  const normalizadas = [];

  (ventas || []).forEach((registro) => {
    const fecha = parsearFechaLocalCalculadora(registro.fecha);
    const unidades = Number(registro.unidades);

    if (fecha && !isNaN(fecha.getTime()) && !isNaN(unidades)) {
      normalizadas.push({
        fecha,
        id_producto: registro.id_producto || null,
        nombre: registro.nombre,
        unidades
      });
    }
  });

  normalizadas.sort((a, b) => a.fecha - b.fecha);
  return normalizadas;
}

/**
 * Indexa el historial por producto, una sola vez.
 *
 * La llave correcta es `id_producto`. Si la RPC todavía no lo envía (versión
 * anterior de datos_pedido_compra), se cae al nombre — que es frágil: dos
 * productos activos homónimos comparten historial y ambos reciben la demanda
 * sumada, así que se pide de más para los dos sin que nada lo indique.
 */
function indexarHistorialPorProducto(historial) {
  const porId = {};
  const porNombre = {};
  let conId = 0;

  historial.forEach((venta) => {
    if (venta.id_producto) {
      if (!porId[venta.id_producto]) porId[venta.id_producto] = [];
      porId[venta.id_producto].push(venta);
      conId += 1;
    }
    if (!porNombre[venta.nombre]) porNombre[venta.nombre] = [];
    porNombre[venta.nombre].push(venta);
  });

  return {
    porId,
    porNombre,
    // Solo se cruza por id si TODAS las filas lo traen. Mezclar ambas llaves
    // reintroduciría el error en los productos sin ventas propias.
    cruzaPorId: historial.length > 0 && conId === historial.length
  };
}

/**
 * Devuelve la serie de ventas de un producto según el índice.
 */
function obtenerSerieDeVentas(indice, producto) {
  if (indice.cruzaPorId) {
    return indice.porId[producto.id_producto] || [];
  }
  return indice.porNombre[producto.nombre] || [];
}

/**
 * Calcula la demanda diaria de un producto con el modelo elegido.
 *
 * Portado tal cual desde calculadora_pedidos_9.html para mantener paridad.
 *
 * ⚠️ Sesgo conocido: el histórico no trae filas en cero (un día sin vender
 * un sabor simplemente no aparece), así que el filtro `unidades > 0` de los
 * modelos híbrido/conservador/día de semana no excluye nada y sobreestima
 * los productos de baja rotación. Corregirlo usando dias_operacion es el
 * punto 4 de Pendiente en CLAUDE.md; no se toca aquí a propósito.
 *
 * ventasProducto: serie de UN solo producto, ya filtrada por
 *   obtenerSerieDeVentas (que decide si cruza por id o por nombre).
 * fechaMasReciente: última fecha del historial completo
 */
function calcularDemandaDiaria(ventasProducto, modelo, fechaMasReciente) {
  if (!ventasProducto || ventasProducto.length === 0 || !fechaMasReciente) {
    return 0;
  }

  const promedio = (valores) =>
    valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;

  const fechaCorte = (dias) => {
    const corte = new Date(fechaMasReciente);
    corte.setDate(corte.getDate() - dias);
    return corte;
  };

  if (modelo === 'hibrido') {
    // Últimos 30 días, "excluyendo ceros".
    const corte = fechaCorte(30);
    const recientes = ventasProducto.filter((v) => v.fecha >= corte && v.unidades > 0);

    if (recientes.length > 0) {
      return promedio(recientes.map((v) => v.unidades));
    }

    // Fallback: si no hubo ventas en 30 días, usa todo el histórico.
    const todas = ventasProducto.filter((v) => v.unidades > 0);
    return promedio(todas.map((v) => v.unidades));
  }

  if (modelo === 'dia_semana') {
    // Promedia los promedios de cada día de la semana de los últimos 60 días.
    // ⚠️ No usa el día objetivo: es el comportamiento original. Revisar si
    // aporta algo es el punto 4 de Pendiente en CLAUDE.md.
    const corte = fechaCorte(60);
    const recientes = ventasProducto.filter((v) => v.fecha >= corte && v.unidades > 0);

    const porDiaSemana = {};
    recientes.forEach((v) => {
      const dia = v.fecha.getDay();
      if (!porDiaSemana[dia]) porDiaSemana[dia] = [];
      porDiaSemana[dia].push(v.unidades);
    });

    const promediosPorDia = Object.keys(porDiaSemana).map((dia) =>
      promedio(porDiaSemana[dia])
    );

    return promedio(promediosPorDia);
  }

  if (modelo === 'conservador') {
    // Últimos 60 días, "excluyendo ceros". Sin fallback, igual que el original.
    const corte = fechaCorte(60);
    const recientes = ventasProducto.filter((v) => v.fecha >= corte && v.unidades > 0);
    return promedio(recientes.map((v) => v.unidades));
  }

  // Modelo simple: últimos 9 registros de venta.
  const ventana = Math.min(9, ventasProducto.length);
  const ultimos = ventasProducto.slice(-ventana).map((v) => v.unidades);
  return promedio(ultimos);
}

// =========================================================================
// PRECIOS (funciones puras)
// =========================================================================

/**
 * Quita acentos y pasa a mayúsculas para comparar nombres de producto.
 */
function normalizarTextoCalculadora(texto) {
  return String(texto || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Determina la categoría de precio a partir del nombre del producto.
 * A diferencia del original (que comparaba contra el sabor exacto), aquí se
 * busca por coincidencia parcial porque en la app el nombre es el del
 * producto completo, no el sabor suelto.
 */
function clasificarCategoriaPrecio(nombreProducto) {
  const nombre = normalizarTextoCalculadora(nombreProducto);

  if (nombre.includes('SIN AZUCAR')) return 'sin_azucar';
  if (nombre.includes('FRUTOS ROJOS')) return 'frutos_rojos';
  return 'varios';
}

/**
 * Precio unitario de un producto según su categoría.
 */
function obtenerPrecioProducto(nombreProducto, precios) {
  const categoria = clasificarCategoriaPrecio(nombreProducto);
  return Number(precios[categoria]) || 0;
}

// =========================================================================
// OBSEQUIO Y DESCUENTO (funciones puras)
// =========================================================================

/**
 * Calcula el obsequio del proveedor y el descuento a aplicar en la compra.
 *
 * Reglas del negocio (confirmadas):
 * - El obsequio se gana sobre el TOTAL de unidades del pedido, sin importar
 *   el sabor: 1 unidad por cada N compradas.
 * - Pero las unidades regaladas siempre son del producto de MENOR valor
 *   (precio "varios"), así que el descuento solo puede aplicarse contra las
 *   líneas de esa categoría. Frutos rojos y sin azúcar quedan fuera.
 *
 *   descuento % = (obsequio × precio_varios) / Σ(cantidad_varios × precio)
 *
 * Se deja la fórmula larga a propósito: hoy el precio de "varios" es único y
 * se cancelaría (descuento = obsequio ÷ unidades_varios), pero si algún día
 * dos productos de esa categoría tuvieran precios distintos, la corta daría
 * un resultado equivocado.
 *
 * lineas: [{ nombre, cantidad }]
 */
function calcularObsequioYDescuento(lineas, parametros) {
  const porCada = Number(parametros.unidadesPorObsequio) || 0;

  let totalUnidades = 0;
  let unidadesVarios = 0;
  let valorVarios = 0;

  (lineas || []).forEach((linea) => {
    const cantidad = Number(linea.cantidad) || 0;
    if (cantidad <= 0) return;

    totalUnidades += cantidad;

    if (clasificarCategoriaPrecio(linea.nombre) === 'varios') {
      unidadesVarios += cantidad;
      valorVarios += cantidad * obtenerPrecioProducto(linea.nombre, parametros.precios);
    }
  });

  const obsequio = porCada > 0 ? Math.floor(totalUnidades / porCada) : 0;
  const valorObsequio = obsequio * (Number(parametros.precios.varios) || 0);

  // Sin líneas de "varios" no hay contra qué aplicar el descuento.
  const descuentoPct = valorVarios > 0 ? (valorObsequio / valorVarios) * 100 : null;

  // Unidades por encima del último múltiplo: no generan obsequio adicional.
  const desperdicio = porCada > 0 ? totalUnidades % porCada : 0;

  return {
    totalUnidades,
    obsequio,
    unidadesVarios,
    valorVarios,
    valorObsequio,
    descuentoPct,
    desperdicio
  };
}

/**
 * Suma unidades y valor por categoría de precio.
 *
 * lineas: [{ nombre, cantidad }]
 */
function calcularDesglosePorCategoria(lineas, parametros) {
  const desglose = {
    varios:       { unidades: 0, valor: 0 },
    frutos_rojos: { unidades: 0, valor: 0 },
    sin_azucar:   { unidades: 0, valor: 0 }
  };

  (lineas || []).forEach((linea) => {
    const cantidad = Number(linea.cantidad) || 0;
    if (cantidad <= 0) return;

    const categoria = clasificarCategoriaPrecio(linea.nombre);
    if (!desglose[categoria]) return;

    desglose[categoria].unidades += cantidad;
    desglose[categoria].valor += cantidad * obtenerPrecioProducto(linea.nombre, parametros.precios);
  });

  return desglose;
}

/**
 * Genera las opciones de pedido, en múltiplos del tamaño del obsequio.
 *
 * Pedir el ideal crudo (ej. 241) está dominado: da el mismo obsequio que 200
 * y desperdicia 41 unidades. Por eso solo se ofrecen múltiplos exactos.
 */
function calcularOpcionesDePedido(items, parametros, ideal, piso) {
  const paso = Number(parametros.unidadesPorObsequio) || 0;
  if (paso <= 0 || items.length === 0) return [];

  const techo = parametros.capacidadMax > 0
    ? Math.floor(parametros.capacidadMax / paso) * paso
    : Infinity;

  // Nunca por debajo de lo que exigen los compromisos ya adquiridos.
  let desde = Math.max(paso, Math.ceil(piso / paso) * paso);
  let hasta = Math.ceil(ideal / paso) * paso + paso;

  if (hasta < desde) hasta = desde;
  if (techo !== Infinity) {
    hasta = Math.min(hasta, techo);
    if (desde > hasta) desde = hasta;   // el techo del almacén manda
  }

  const opciones = [];

  for (let total = desde; total <= hasta && opciones.length < 8; total += paso) {
    if (total <= 0) continue;

    const reparto = repartirCapacidad(items, total, {
      coberturaObjetivo: parametros.cobertura,
      seguridad: parametros.seguridad / 100,
      permitirExcedente: true
    });

    const coberturas = reparto.lineas
      .filter((l) => l.coberturaResultante !== null)
      .map((l) => l.coberturaResultante);

    const bono = calcularObsequioYDescuento(
      reparto.lineas.map((l) => ({ nombre: l.nombre, cantidad: l.pedir })),
      parametros
    );

    const costo = reparto.lineas.reduce(
      (suma, l) => suma + l.pedir * obtenerPrecioProducto(l.nombre, parametros.precios), 0);

    const coberturaMin = coberturas.length > 0 ? Math.min(...coberturas) : null;

    opciones.push({
      total,
      obsequio: bono.obsequio,
      recibes: total + bono.obsequio,
      descuentoPct: bono.descuentoPct,
      unidadesVarios: bono.unidadesVarios,
      coberturaMin,
      costo,
      vsIdeal: total - ideal,
      cumpleCobertura: coberturaMin !== null && coberturaMin >= parametros.cobertura,
      cubreCompromisos: total >= piso,
      estado: reparto.estado
    });
  }

  return opciones;
}

/**
 * Elige la opción recomendada: el múltiplo más cercano al ideal.
 *
 * Se prefiere el más cercano y no el inmediatamente superior porque subir un
 * múltiplo cuesta N unidades para ganar 1 de obsequio (≈1% de retorno): el
 * obsequio no justifica inflar el pedido, solo evitar sobrantes sueltos.
 */
function elegirOpcionRecomendada(opciones, ideal) {
  if (!opciones || opciones.length === 0) return null;

  let mejor = opciones[0];
  opciones.forEach((opcion) => {
    if (Math.abs(opcion.total - ideal) < Math.abs(mejor.total - ideal)) {
      mejor = opcion;
    }
  });

  return mejor.total;
}

// =========================================================================
// ORQUESTACIÓN
// =========================================================================

/**
 * Carga el selector de proveedores.
 * Si falla, la vista sigue funcionando con "Todos los proveedores".
 */
async function cargarSelectorProveedores() {
  const select = document.getElementById('filtro-proveedor-pedido');
  if (!select) return;

  const respuesta = await obtenerProveedoresParaSelectorConSupabase();

  if (respuesta.error) {
    console.warn('[Calculadora] ⚠ No se pudo cargar el selector de proveedores, se continúa con "Todos"');
    return;
  }

  const parametros = cargarParametrosCalculadora();

  let opcionesHtml = '<option value="">Todos los proveedores</option>';
  respuesta.datos.forEach((proveedor) => {
    opcionesHtml += `<option value="${proveedor.id}">${proveedor.nombre_empresa || 'Sin nombre'}</option>`;
  });
  select.innerHTML = opcionesHtml;

  // Restaurar la última selección, si el proveedor sigue existiendo.
  if (parametros.proveedorId) {
    select.value = parametros.proveedorId;
  }

  calculadora_proveedoresCargados = true;
}

/**
 * Función principal: obtiene los datos, calcula el pedido y delega el pintado.
 */
function fetchAndRenderCalculadora() {
  if (calculadora_isLoading) {
    console.log('[Calculadora] Ya se está calculando el pedido, espera por favor...');
    return;
  }
  calculadora_isLoading = true;

  const parametros = leerParametrosDelFormulario();
  guardarParametrosCalculadora(parametros);

  const tbodyStock = document.getElementById('tbody-pedido-stock');
  const tbodyBajoPedido = document.getElementById('tbody-pedido-bajo-pedido');
  const btnCalcular = document.getElementById('btn-calcular-pedido');

  if (tbodyStock) {
    tbodyStock.innerHTML = `<tr><td colspan="12" class="text-center" style="padding:20px; font-style:italic;"><i class="fas fa-spinner fa-spin"></i> Calculando pedido...</td></tr>`;
  }
  if (tbodyBajoPedido) {
    tbodyBajoPedido.innerHTML = `<tr><td colspan="8" class="text-center" style="padding:20px; font-style:italic;"><i class="fas fa-spinner fa-spin"></i> Calculando pedido...</td></tr>`;
  }

  let textoOriginalBoton = '';
  if (btnCalcular) {
    textoOriginalBoton = btnCalcular.innerHTML;
    btnCalcular.disabled = true;
    btnCalcular.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculando...';
  }

  obtenerDatosPedidoCompraConSupabase(parametros)
    .then(function (respuesta) {
      calculadora_isLoading = false;

      if (btnCalcular) {
        btnCalcular.disabled = false;
        btnCalcular.innerHTML = textoOriginalBoton;
      }

      if (respuesta.error) {
        console.error('[Calculadora] ✗ Error al obtener los datos:', respuesta.error);
        if (tbodyStock) {
          tbodyStock.innerHTML = `<tr><td colspan="12" class="text-center error-message" style="padding:20px;">Error: ${respuesta.error}</td></tr>`;
        }
        if (tbodyBajoPedido) {
          tbodyBajoPedido.innerHTML = `<tr><td colspan="8" class="text-center error-message" style="padding:20px;">Error: ${respuesta.error}</td></tr>`;
        }
        return;
      }

      calculadora_datosCrudos = respuesta.datos;
      calcularYRenderizarPedido(parametros);
    })
    .catch(function (error) {
      calculadora_isLoading = false;

      if (btnCalcular) {
        btnCalcular.disabled = false;
        btnCalcular.innerHTML = textoOriginalBoton;
      }

      console.error('[Calculadora] ✗ Error inesperado al calcular el pedido:', error);
      if (tbodyStock) {
        tbodyStock.innerHTML = `<tr><td colspan="12" class="text-center error-message" style="padding:20px;">Error al cargar datos: ${error.message || 'Error desconocido'}</td></tr>`;
      }
    });
}

/**
 * Toma los datos crudos ya cargados y produce las dos tablas del pedido.
 * Separada de la red para poder recalcular sin volver a consultar.
 */
function calcularYRenderizarPedido(parametros) {
  const datos = calculadora_datosCrudos;
  if (!datos) return;

  const productos = datos.productos || [];
  const historial = normalizarHistorialVentas(datos.ventas);
  const fechaMasReciente = historial.length > 0 ? historial[historial.length - 1].fecha : null;

  // ----- Bloque A: modo stock -----
  const productosStock = productos.filter((p) => p.modo === 'stock');
  const indiceHistorial = indexarHistorialPorProducto(historial);
  calculadora_filasHistorial = historial.length;

  if (!indiceHistorial.cruzaPorId && historial.length > 0) {
    console.warn('[Calculadora] ⚠ El historial no trae id_producto: se cruza por nombre. ' +
      'Actualiza sql/datos_pedido_compra.sql — dos productos homónimos comparten demanda.');
  }

  const itemsParaReparto = productosStock.map((producto) => ({
    id_producto: producto.id_producto,
    nombre: producto.nombre,
    marca: producto.marca,
    stock_actual: Number(producto.stock_actual) || 0,
    stock_comprometido: Number(producto.stock_comprometido) || 0,
    // Los pendientes en Borrador SÍ cuentan: ya son un compromiso con cliente.
    pendiente: (Number(producto.pendiente_firme) || 0) + (Number(producto.pendiente_borrador) || 0),
    stockDisponible: Number(producto.stock_disponible) || 0,
    demandaDiaria: calcularDemandaDiaria(
      obtenerSerieDeVentas(indiceHistorial, producto),
      parametros.modelo,
      fechaMasReciente
    )
  }));

  calculadora_itemsStock = itemsParaReparto;

  // El ideal: lo que piden cobertura y seguridad, sin restricción de
  // capacidad. Es la referencia contra la que se ofrecen los múltiplos.
  const sinRestriccion = repartirCapacidad(itemsParaReparto, null, {
    coberturaObjetivo: parametros.cobertura,
    seguridad: parametros.seguridad / 100
  });

  calculadora_idealPedido = sinRestriccion.totalIdeal;
  calculadora_pisoPedido = sinRestriccion.totalPiso;

  calculadora_opcionesPedido = calcularOpcionesDePedido(
    itemsParaReparto, parametros, calculadora_idealPedido, calculadora_pisoPedido);

  // ----- Bloque B: modo bajo pedido -----
  calculadora_lineasBajoPedido = productos
    .filter((p) => p.modo === 'bajo_pedido')
    .map((producto) => ({
      id_producto: producto.id_producto,
      nombre: producto.nombre,
      proveedores: producto.proveedores || [],
      stockDisponible: Number(producto.stock_disponible) || 0,
      pendienteFirme: Number(producto.pendiente_firme) || 0,
      pendienteBorrador: Number(producto.pendiente_borrador) || 0,
      comprar: Number(producto.comprar_exacto) || 0
    }))
    .filter((linea) => linea.comprar > 0)
    .sort((a, b) => b.comprar - a.comprar);

  const totalRecomendado = elegirOpcionRecomendada(
    calculadora_opcionesPedido, calculadora_idealPedido);

  console.log('[Calculadora] ✓ Pedido calculado:', {
    ideal: calculadora_idealPedido,
    piso: calculadora_pisoPedido,
    opciones: calculadora_opcionesPedido.map((o) => o.total),
    recomendado: totalRecomendado,
    lineasBajoPedido: calculadora_lineasBajoPedido.length
  });

  aplicarTotalDePedido(totalRecomendado, parametros);
}

/**
 * Reparte un total concreto entre los productos de stock y repinta.
 *
 * Separada del cálculo para poder cambiar de opción sin volver a consultar
 * la RPC ni recalcular el pronóstico.
 */
function aplicarTotalDePedido(total, parametros) {
  calculadora_totalElegido = total;

  // permitirExcedente: dentro de un total ya fijado por el usuario, el
  // sobrante se reparte nivelando cobertura en vez de dejar cupo sin usar.
  calculadora_resultadoReparto = repartirCapacidad(calculadora_itemsStock, total, {
    coberturaObjetivo: parametros.cobertura,
    seguridad: parametros.seguridad / 100,
    permitirExcedente: true
  });

  // El reparto devuelve las líneas ordenadas por cantidad a pedir. Se
  // reincorporan los campos de inventario que no viajan en su salida.
  const porIdProducto = {};
  calculadora_itemsStock.forEach((item) => {
    porIdProducto[item.id_producto] = item;
  });

  calculadora_lineasStock = calculadora_resultadoReparto.lineas.map((linea) => {
    const item = porIdProducto[linea.id_producto] || {};
    return {
      ...linea,
      marca: item.marca,
      stock_actual: item.stock_actual || 0,
      stock_comprometido: item.stock_comprometido || 0
    };
  });

  // ----- Estado editable -----
  calculadora_sugeridos = {};
  calculadora_cantidadesFinales = {};

  calculadora_lineasStock.forEach((linea) => {
    calculadora_sugeridos[linea.id_producto] = linea.pedir;
    calculadora_cantidadesFinales[linea.id_producto] = linea.pedir;
  });
  calculadora_lineasBajoPedido.forEach((linea) => {
    calculadora_sugeridos[linea.id_producto] = linea.comprar;
    calculadora_cantidadesFinales[linea.id_producto] = linea.comprar;
  });

  // Un pronóstico en cero se ve igual que un pronóstico real: hay que avisarlo
  // explícitamente o pasa por dato bueno. El cruce producto/historial se hace
  // por nombre, así que una diferencia de texto lo deja todo en cero en silencio.
  const diagnosticoHistorial = {
    filasHistorial: calculadora_filasHistorial,
    productosStock: calculadora_lineasStock.length,
    sinDemanda: calculadora_lineasStock.filter((linea) => linea.demandaDiaria <= 0).length
  };

  if (diagnosticoHistorial.sinDemanda > 0) {
    console.warn('[Calculadora] ⚠ Productos de stock sin demanda calculada:',
      diagnosticoHistorial.sinDemanda, 'de', diagnosticoHistorial.productosStock,
      '| filas de historial recibidas:', diagnosticoHistorial.filasHistorial);
  }

  renderizarOpcionesPedido(calculadora_opcionesPedido, total, parametros);
  renderizarTablaPedidoStock(calculadora_lineasStock, parametros);
  renderizarTablaBajoPedido(calculadora_lineasBajoPedido);
  renderizarAvisosReparto(calculadora_resultadoReparto, parametros, diagnosticoHistorial);
  actualizarTotalesPedido();
  habilitarAccionesPedido(true);
}

// =========================================================================
// RENDERIZADO
// =========================================================================

/**
 * Pinta la tabla de opciones de pedido y el resumen del obsequio.
 */
function renderizarOpcionesPedido(opciones, totalElegido, parametros) {
  const tbody = document.getElementById('tbody-opciones-pedido');
  const hint = document.getElementById('hint-ideal-pedido');
  const resumen = document.getElementById('resumen-obsequio');

  if (hint) {
    hint.textContent = calculadora_idealPedido > 0
      ? `ideal ${calculadora_idealPedido.toLocaleString('es-CO')} und · compromisos ${calculadora_pisoPedido.toLocaleString('es-CO')} und`
      : '';
  }

  if (!tbody) return;

  if (!opciones || opciones.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding:20px;">No hay opciones que ofrecer. Revisa el tamaño del obsequio y la capacidad máxima.</td></tr>`;
    if (resumen) resumen.style.display = 'none';
    return;
  }

  let filasHtml = '';

  opciones.forEach((opcion) => {
    const esElegida = opcion.total === totalElegido;
    const clases = [];
    if (esElegida) clases.push('calculadora-opcion-elegida');
    if (!opcion.cumpleCobertura) clases.push('calculadora-opcion-corta');

    const cobertura = opcion.coberturaMin === null
      ? '—'
      : `${opcion.coberturaMin.toFixed(1)} d`;

    const descuento = opcion.descuentoPct === null
      ? 'n/a'
      : `${opcion.descuentoPct.toFixed(2)} %`;

    const vsIdeal = opcion.vsIdeal === 0
      ? '0'
      : `${opcion.vsIdeal > 0 ? '+' : ''}${opcion.vsIdeal.toLocaleString('es-CO')}`;

    const marcaCobertura = opcion.cumpleCobertura
      ? ''
      : ` <i class="fas fa-exclamation-triangle" title="No alcanza los ${parametros.cobertura} días de cobertura"></i>`;

    filasHtml += `
      <tr data-total="${opcion.total}" class="${clases.join(' ')}">
        <td class="text-right">${opcion.total.toLocaleString('es-CO')}</td>
        <td class="text-right">${opcion.obsequio.toLocaleString('es-CO')}</td>
        <td class="text-right">${opcion.recibes.toLocaleString('es-CO')}</td>
        <td class="text-right">${cobertura}${marcaCobertura}</td>
        <td class="text-right">${vsIdeal}</td>
        <td class="text-right">${calculadora_formatoMoneda.format(opcion.costo)}</td>
        <td class="text-right">${descuento}</td>
        <td class="column-actions text-center">
          ${esElegida
            ? '<i class="fas fa-check-circle" style="color:#28a745;" title="Opción activa"></i>'
            : `<button class="button button-secondary button-sm calculadora-btn-elegir" data-total="${opcion.total}">Elegir</button>`}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = filasHtml;
}

/**
 * Pinta el resumen del pedido real: obsequio, descuento y desglose por
 * categoría.
 *
 * Se calcula desde las cantidades finales EDITADAS, no desde la opción
 * elegida: en cuanto el usuario baja una línea, el obsequio y el descuento
 * cambian, y mostrar los de la opción teórica sería engañoso.
 */
function renderizarResumenPedidoFinal(parametros) {
  const resumen = document.getElementById('resumen-obsequio');
  if (!resumen) return;

  const lineas = calculadora_lineasStock.map((linea) => ({
    nombre: linea.nombre,
    cantidad: calculadora_cantidadesFinales[linea.id_producto] || 0
  }));

  if (lineas.length === 0) {
    resumen.style.display = 'none';
    return;
  }

  const bono = calcularObsequioYDescuento(lineas, parametros);
  const desglose = calcularDesglosePorCategoria(lineas, parametros);
  const precioVarios = Number(parametros.precios.varios) || 0;

  const descuentoHtml = bono.descuentoPct === null
    ? `<span class="calculadora-descuento-destacado">no aplica</span>
       <br><small>El pedido no tiene unidades de sabores varios contra las cuales aplicarlo.</small>`
    : `<span class="calculadora-descuento-destacado">${bono.descuentoPct.toFixed(2)} %</span>`;

  // Solo molesta con el desperdicio si de verdad lo hay.
  const avisoDesperdicio = bono.desperdicio > 0
    ? `<div style="margin-top:6px; color:#856404;">
         <i class="fas fa-exclamation-triangle"></i>
         <small>${bono.desperdicio.toLocaleString('es-CO')} und por encima del último múltiplo de
         ${Number(parametros.unidadesPorObsequio).toLocaleString('es-CO')}: no generan obsequio adicional.</small>
       </div>`
    : '';

  const fila = (etiqueta, dato) => `
    <div style="display:flex; justify-content:space-between; gap:16px; padding:3px 0;">
      <span>${etiqueta}</span>
      <span><strong>${dato.unidades.toLocaleString('es-CO')}</strong> und
        · ${calculadora_formatoMoneda.format(dato.valor)}</span>
    </div>`;

  resumen.style.display = '';
  resumen.innerHTML = `
    <div><strong><i class="fas fa-gift"></i> Obsequio del proveedor:</strong>
      ${bono.obsequio.toLocaleString('es-CO')} und
      (1 por cada ${Number(parametros.unidadesPorObsequio).toLocaleString('es-CO')}
      sobre ${bono.totalUnidades.toLocaleString('es-CO')} und pedidas).
      Recibes ${(bono.totalUnidades + bono.obsequio).toLocaleString('es-CO')} und en total.
    </div>
    ${avisoDesperdicio}
    <div style="margin-top:8px;">
      <strong>Descuento a aplicar al grabar la compra:</strong> ${descuentoHtml}
    </div>
    <div style="margin-top:6px; color:#666;">
      <small>
        ${bono.obsequio.toLocaleString('es-CO')} und × ${calculadora_formatoMoneda.format(precioVarios)}
        = ${calculadora_formatoMoneda.format(bono.valorObsequio)}, sobre
        ${bono.unidadesVarios.toLocaleString('es-CO')} und de sabores varios
        = ${calculadora_formatoMoneda.format(bono.valorVarios)}.
        Frutos rojos y sin azúcar quedan fuera de la base: las unidades de obsequio
        son del producto de menor valor.
      </small>
    </div>
    <div style="margin-top:12px; padding-top:10px; border-top:1px solid #cdd9f0;">
      <strong>Desglose del pedido de stock</strong>
      ${fila('Sabores varios', desglose.varios)}
      ${fila('Frutos rojos', desglose.frutos_rojos)}
      ${fila('Sin azúcar', desglose.sin_azucar)}
    </div>
  `;
}

/**
 * Pinta la tabla de productos de modo stock.
 */
function renderizarTablaPedidoStock(lineas, parametros) {
  const tbody = document.getElementById('tbody-pedido-stock');
  if (!tbody) return;

  if (lineas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" class="text-center" style="padding:20px;">No hay productos de stock para este proveedor.</td></tr>`;
    return;
  }

  let filasHtml = '';

  lineas.forEach((linea) => {
    // Semáforo sobre el stock real (disponible - pendiente).
    let claseEstado = 'calculadora-stock-ok';
    if (linea.stockReal <= 0) {
      claseEstado = 'calculadora-stock-critico';
    } else if (linea.demandaDiaria > 0 && linea.stockReal < linea.demandaDiaria * parametros.cobertura) {
      claseEstado = 'calculadora-stock-bajo';
    }

    const cobertura = linea.coberturaResultante === null
      ? '—'
      : `${linea.coberturaResultante} d`;

    filasHtml += `
      <tr data-id="${linea.id_producto}">
        <td class="calculadora-nombre-producto">${linea.nombre || 'Sin nombre'}</td>
        <td class="text-right">${(linea.stock_actual || 0).toLocaleString('es-CO')}</td>
        <td class="text-right">${(linea.stock_comprometido || 0).toLocaleString('es-CO')}</td>
        <td class="text-right">${linea.stockDisponible.toLocaleString('es-CO')}</td>
        <td class="text-right">${linea.pendiente.toLocaleString('es-CO')}</td>
        <td class="text-right">${linea.demandaDiaria.toFixed(1)}</td>
        <td class="text-right ${claseEstado}">${linea.piso.toLocaleString('es-CO')}</td>
        <td class="text-right">${linea.ideal.toLocaleString('es-CO')}</td>
        <td class="text-right calculadora-celda-sugerido">${linea.pedir.toLocaleString('es-CO')}</td>
        <td class="text-center">
          <input type="number" class="calculadora-input-final" data-id="${linea.id_producto}"
                 value="${linea.pedir}" min="0" step="1">
        </td>
        <td class="text-right">${cobertura}</td>
        <td class="column-actions text-center">
          <button class="button-icon button-icon-danger calculadora-btn-quitar"
                  data-id="${linea.id_producto}" title="Quitar del pedido">
            <i class="fas fa-times"></i>
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = filasHtml;
}

/**
 * Pinta la tabla de productos bajo pedido.
 */
function renderizarTablaBajoPedido(lineas) {
  const tbody = document.getElementById('tbody-pedido-bajo-pedido');
  if (!tbody) return;

  if (lineas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding:20px;">No hay pendientes por comprar bajo pedido.</td></tr>`;
    return;
  }

  let filasHtml = '';

  lineas.forEach((linea) => {
    // Un producto puede tener varios proveedores: se muestran todos y la
    // elección queda en manos de quien arma el pedido.
    const proveedores = (linea.proveedores || [])
      .map((p) => p.nombre)
      .filter(Boolean)
      .join(', ');

    filasHtml += `
      <tr data-id="${linea.id_producto}">
        <td class="calculadora-nombre-producto">${linea.nombre || 'Sin nombre'}</td>
        <td class="calculadora-proveedores">${proveedores || 'Sin proveedor asociado'}</td>
        <td class="text-right">${linea.stockDisponible.toLocaleString('es-CO')}</td>
        <td class="text-right">${linea.pendienteFirme.toLocaleString('es-CO')}</td>
        <td class="text-right">${linea.pendienteBorrador.toLocaleString('es-CO')}</td>
        <td class="text-right calculadora-celda-sugerido">${linea.comprar.toLocaleString('es-CO')}</td>
        <td class="text-center">
          <input type="number" class="calculadora-input-final" data-id="${linea.id_producto}"
                 value="${linea.comprar}" min="0" step="1">
        </td>
        <td class="column-actions text-center">
          <button class="button-icon button-icon-danger calculadora-btn-quitar"
                  data-id="${linea.id_producto}" title="Quitar del pedido">
            <i class="fas fa-times"></i>
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = filasHtml;
}

/**
 * Traduce el estado del reparto de capacidad a un aviso visible.
 */
function renderizarAvisosReparto(resultado, parametros, diagnostico) {
  const contenedor = document.getElementById('avisos-pedido');
  if (!contenedor || !resultado) return;

  const capacidadTexto = (calculadora_totalElegido || 0).toLocaleString('es-CO');
  let avisosHtml = '';

  // El pedido ya no puede quedar por debajo de los compromisos salvo que el
  // techo del almacén lo impida: las opciones arrancan en ese piso.
  if (parametros.capacidadMax > 0 && calculadora_pisoPedido > parametros.capacidadMax) {
    avisosHtml += `<div class="alert alert-danger">
      <i class="fas fa-exclamation-circle"></i> <strong>Los compromisos
      (${calculadora_pisoPedido.toLocaleString('es-CO')} und) superan la capacidad máxima
      (${parametros.capacidadMax.toLocaleString('es-CO')} und).</strong>
      Sube la capacidad o quedarán pedidos sin cubrir.
    </div>`;
  }

  // Aviso de historial ANTES que el del reparto: si el pronóstico está en cero,
  // el reparto queda apoyado solo en los compromisos y su resultado no es fiable.
  if (diagnostico && diagnostico.productosStock > 0) {
    if (diagnostico.filasHistorial === 0) {
      avisosHtml += `<div class="alert alert-danger">
        <i class="fas fa-exclamation-circle"></i> <strong>La consulta no devolvió historial de ventas.</strong>
        Toda la demanda diaria queda en 0 y el pedido se calcula solo con los compromisos
        pendientes, sin pronóstico. Revisa el rango de "Días de historial" o si hay ventas
        registradas en ese periodo.
      </div>`;
    } else if (diagnostico.sinDemanda === diagnostico.productosStock) {
      avisosHtml += `<div class="alert alert-danger">
        <i class="fas fa-exclamation-circle"></i> <strong>Ningún producto tiene demanda calculada</strong>
        pese a que sí llegó historial (${diagnostico.filasHistorial.toLocaleString('es-CO')} registros).
        El historial se cruza con los productos por nombre: probablemente no coinciden.
      </div>`;
    } else if (diagnostico.sinDemanda > 0) {
      avisosHtml += `<div class="alert alert-warning">
        <i class="fas fa-exclamation-triangle"></i> ${diagnostico.sinDemanda} de
        ${diagnostico.productosStock} productos de stock no tienen ventas en el periodo,
        así que su demanda queda en 0 y solo se pedirá lo comprometido.
      </div>`;
    }
  }

  switch (resultado.estado) {
    case 'sin_limite':
      avisosHtml += `<div class="alert alert-info">
        <i class="fas fa-info-circle"></i> Sin límite de capacidad: se muestra el pedido ideal
        (${resultado.totalIdeal.toLocaleString('es-CO')} und).
      </div>`;
      break;

    case 'ajustado':
      avisosHtml += `<div class="alert alert-success">
        <i class="fas fa-check-circle"></i> Pedido ajustado a la capacidad de ${capacidadTexto} und,
        nivelando los días de cobertura. Ideal sin restricción: ${resultado.totalIdeal.toLocaleString('es-CO')} und.
      </div>`;
      break;

    case 'excedente':
      avisosHtml += `<div class="alert alert-info">
        <i class="fas fa-info-circle"></i> La capacidad (${capacidadTexto} und) supera el pedido ideal
        (${resultado.totalIdeal.toLocaleString('es-CO')} und). El excedente se repartió entre los
        productos con menor cobertura.
      </div>`;
      break;

    case 'sobrante':
      avisosHtml += `<div class="alert alert-warning">
        <i class="fas fa-exclamation-triangle"></i> Sobran ${resultado.sobrante.toLocaleString('es-CO')} und
        de capacidad: ningún producto con demanda las necesita.
      </div>`;
      break;

    case 'piso_excede_capacidad':
      avisosHtml += `<div class="alert alert-danger">
        <i class="fas fa-exclamation-circle"></i> <strong>Los compromisos
        (${resultado.totalPiso.toLocaleString('es-CO')} und) superan la capacidad (${capacidadTexto} und).</strong>
        Se repartió proporcionalmente, así que quedarán pedidos sin cubrir.
      </div>`;
      break;
  }

  contenedor.innerHTML = avisosHtml;
}

/**
 * Recalcula totales, KPIs y la fila de totales de cada tabla.
 */
function actualizarTotalesPedido() {
  const parametros = leerParametrosDelFormulario();

  let totalSugeridoStock = 0;
  let totalFinalStock = 0;
  let totalSugeridoBajoPedido = 0;
  let totalFinalBajoPedido = 0;
  let valorTotal = 0;
  let criticos = 0;

  calculadora_lineasStock.forEach((linea) => {
    const final = calculadora_cantidadesFinales[linea.id_producto] || 0;
    totalSugeridoStock += linea.pedir;
    totalFinalStock += final;
    valorTotal += final * obtenerPrecioProducto(linea.nombre, parametros.precios);
    if (linea.piso > 0) criticos += 1;
  });

  calculadora_lineasBajoPedido.forEach((linea) => {
    const final = calculadora_cantidadesFinales[linea.id_producto] || 0;
    totalSugeridoBajoPedido += linea.comprar;
    totalFinalBajoPedido += final;
    valorTotal += final * obtenerPrecioProducto(linea.nombre, parametros.precios);
    // Bajo pedido: si hay que comprar, es porque el pendiente supera el stock.
    if (linea.comprar > 0) criticos += 1;
  });

  const asignarTexto = (id, texto) => {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = texto;
  };

  asignarTexto('total-sugerido-stock', totalSugeridoStock.toLocaleString('es-CO'));
  asignarTexto('total-final-stock', totalFinalStock.toLocaleString('es-CO'));
  asignarTexto('total-sugerido-bajo-pedido', totalSugeridoBajoPedido.toLocaleString('es-CO'));
  asignarTexto('total-final-bajo-pedido', totalFinalBajoPedido.toLocaleString('es-CO'));

  asignarTexto('kpi-pedido-unidades', (totalFinalStock + totalFinalBajoPedido).toLocaleString('es-CO'));
  asignarTexto('kpi-pedido-valor', calculadora_formatoMoneda.format(valorTotal));
  asignarTexto('kpi-pedido-bajo-pedido', totalFinalBajoPedido.toLocaleString('es-CO'));
  asignarTexto('kpi-pedido-criticos', criticos.toLocaleString('es-CO'));

  // Diferencia contra el total elegido, para que el botón "Ajustar al total"
  // se entienda sin tener que hacer la resta mentalmente.
  const diferencia = calcularDiferenciaConTotalElegido();
  const celdaDelta = document.getElementById('delta-total-stock');
  const btnAjustar = document.getElementById('btn-ajustar-pedido');

  if (celdaDelta) {
    if (calculadora_totalElegido === null) {
      celdaDelta.innerHTML = '';
    } else if (diferencia === 0) {
      celdaDelta.innerHTML = '<span style="color:#155724;"><i class="fas fa-check"></i> en el total</span>';
    } else if (diferencia > 0) {
      celdaDelta.innerHTML = `<span style="color:#856404;">faltan ${diferencia.toLocaleString('es-CO')} und para ${calculadora_totalElegido.toLocaleString('es-CO')}</span>`;
    } else {
      celdaDelta.innerHTML = `<span style="color:#721c24;">sobran ${Math.abs(diferencia).toLocaleString('es-CO')} und sobre ${calculadora_totalElegido.toLocaleString('es-CO')}</span>`;
    }
  }

  if (btnAjustar) {
    btnAjustar.disabled = calculadora_totalElegido === null || diferencia === 0;
  }

  renderizarResumenPedidoFinal(parametros);
}

/**
 * Habilita o deshabilita los botones que solo tienen sentido tras calcular.
 */
function habilitarAccionesPedido(habilitar) {
  const ids = [
    'btn-guardar-pedido',
    'btn-exportar-csv-pedido',
    'btn-compartir-pedido-whatsapp',
    'btn-imprimir-pedido',
    'btn-restaurar-pedido'
  ];

  ids.forEach((id) => {
    const boton = document.getElementById(id);
    if (boton) boton.disabled = !habilitar;
  });

  // "Ajustar al total" no entra en la lista: su estado depende de si hay
  // diferencia, y lo maneja actualizarTotalesPedido(). Aquí solo se apaga.
  if (!habilitar) {
    const btnAjustar = document.getElementById('btn-ajustar-pedido');
    if (btnAjustar) btnAjustar.disabled = true;
  }
}

// =========================================================================
// ACCIONES SOBRE EL PEDIDO
// =========================================================================

/**
 * Cuántas unidades faltan (o sobran) en el bloque de stock respecto al total
 * elegido. Positivo = faltan.
 */
function calcularDiferenciaConTotalElegido() {
  if (calculadora_totalElegido === null) return 0;

  const suma = calculadora_lineasStock.reduce(
    (total, linea) => total + (calculadora_cantidadesFinales[linea.id_producto] || 0), 0);

  return calculadora_totalElegido - suma;
}

/**
 * Reparte la diferencia hasta el total elegido entre los sabores de mayor
 * demanda que siguen en el pedido.
 *
 * Es lo que el usuario hacía a mano tras recortar líneas. Se usa el mismo
 * criterio que el reparto principal (la unidad va al de menor cobertura
 * resultante) en vez de repartir a partes iguales.
 *
 * ⚠️ Solo entran las líneas con cantidad > 0: si el usuario quitó un sabor,
 * no se le devuelven unidades por la puerta de atrás.
 */
function ajustarPedidoAlTotalElegido(cuantosSabores) {
  const tope = cuantosSabores || CALCULADORA_SABORES_PARA_AJUSTE;
  let diferencia = calcularDiferenciaConTotalElegido();

  if (diferencia === 0) {
    return { ajustada: 0, restante: 0, candidatos: 0 };
  }

  const candidatos = calculadora_lineasStock
    .filter((linea) =>
      linea.demandaDiaria > 0 &&
      (calculadora_cantidadesFinales[linea.id_producto] || 0) > 0)
    .sort((a, b) => b.demandaDiaria - a.demandaDiaria)
    .slice(0, tope);

  if (candidatos.length === 0) {
    return { ajustada: 0, restante: diferencia, candidatos: 0 };
  }

  const cobertura = (linea) =>
    (linea.stockReal + (calculadora_cantidadesFinales[linea.id_producto] || 0)) / linea.demandaDiaria;

  const objetivo = diferencia;

  // Faltan unidades: cada una al de menor cobertura resultante.
  while (diferencia > 0) {
    let peor = candidatos[0];
    candidatos.forEach((linea) => {
      if (cobertura(linea) < cobertura(peor)) peor = linea;
    });
    calculadora_cantidadesFinales[peor.id_producto] += 1;
    diferencia -= 1;
  }

  // Sobran unidades: se quitan al de mayor cobertura, sin bajar de cero.
  while (diferencia < 0) {
    const conUnidades = candidatos.filter(
      (linea) => (calculadora_cantidadesFinales[linea.id_producto] || 0) > 0);
    if (conUnidades.length === 0) break;

    let mejor = conUnidades[0];
    conUnidades.forEach((linea) => {
      if (cobertura(linea) > cobertura(mejor)) mejor = linea;
    });
    calculadora_cantidadesFinales[mejor.id_producto] -= 1;
    diferencia += 1;
  }

  return {
    ajustada: objetivo - diferencia,
    restante: diferencia,
    candidatos: candidatos.length
  };
}

/**
 * Vuelca las cantidades finales a los inputs de la tabla de stock.
 */
function sincronizarInputsConCantidades() {
  document.querySelectorAll('#tbody-pedido-stock .calculadora-input-final').forEach((input) => {
    const cantidad = calculadora_cantidadesFinales[input.dataset.id] || 0;
    input.value = cantidad;
    input.dataset.valorPrevio = cantidad;

    const fila = input.closest('tr');
    if (fila) fila.classList.toggle('calculadora-fila-excluida', cantidad === 0);

    marcarLineaBajoFaltante(input, cantidad, obtenerFaltanteDeLinea(input.dataset.id));
  });
}

/**
 * Devuelve las líneas con cantidad final > 0, listas para exportar.
 */
function obtenerLineasDelPedidoFinal() {
  const parametros = leerParametrosDelFormulario();
  const lineas = [];

  calculadora_lineasStock.forEach((linea) => {
    const final = calculadora_cantidadesFinales[linea.id_producto] || 0;
    if (final > 0) {
      const precio = obtenerPrecioProducto(linea.nombre, parametros.precios);
      lineas.push({
        bloque: 'Stock',
        nombre: linea.nombre,
        stockDisponible: linea.stockDisponible,
        pendiente: linea.pendiente,
        demandaDiaria: linea.demandaDiaria,
        sugerido: linea.pedir,
        final: final,
        precio: precio,
        subtotal: final * precio
      });
    }
  });

  calculadora_lineasBajoPedido.forEach((linea) => {
    const final = calculadora_cantidadesFinales[linea.id_producto] || 0;
    if (final > 0) {
      const precio = obtenerPrecioProducto(linea.nombre, parametros.precios);
      lineas.push({
        bloque: 'Bajo pedido',
        nombre: linea.nombre,
        stockDisponible: linea.stockDisponible,
        pendiente: linea.pendienteFirme + linea.pendienteBorrador,
        demandaDiaria: 0,
        sugerido: linea.comprar,
        final: final,
        precio: precio,
        subtotal: final * precio
      });
    }
  });

  return lineas;
}

// =========================================================================
// GUARDA DEL FALTANTE
//
// "Faltante" es el piso no negociable de una línea: las unidades que faltan
// para cumplir compromisos ya adquiridos (piso = max(0, pendiente − disponible),
// ver reparto_capacidad.js). Bajar de ahí significa aceptar que un pedido de
// cliente se quedará sin cubrir, así que no puede pasar en silencio.
// =========================================================================

/**
 * El faltante de una línea, buscando en los dos bloques.
 *
 * En el bloque de stock es la columna "Faltante" (linea.piso). El bloque bajo
 * pedido no tiene esa columna, pero su "Comprar" (comprar_exacto) es la misma
 * magnitud: pendiente − disponible. Ahí el pedido entero ES el faltante.
 */
function obtenerFaltanteDeLinea(idProducto) {
  const clave = String(idProducto);

  const enStock = calculadora_lineasStock.find(
    (linea) => String(linea.id_producto) === clave);
  if (enStock) return enStock.piso || 0;

  const enBajoPedido = calculadora_lineasBajoPedido.find(
    (linea) => String(linea.id_producto) === clave);
  if (enBajoPedido) return enBajoPedido.comprar || 0;

  return 0;
}

/**
 * El nombre de un producto, para poder nombrarlo en la advertencia.
 */
function obtenerNombreDeLinea(idProducto) {
  const clave = String(idProducto);
  const linea =
    calculadora_lineasStock.find((l) => String(l.id_producto) === clave) ||
    calculadora_lineasBajoPedido.find((l) => String(l.id_producto) === clave);

  return (linea && linea.nombre) || 'este producto';
}

/**
 * Pide confirmación para dejar una línea por debajo de su faltante.
 * Devuelve true si el usuario confirma.
 *
 * Degradación elegante: sin SweetAlert cae al confirm() del navegador.
 */
async function confirmarCantidadBajoFaltante(nombre, cantidad, faltante, esQuitar) {
  const descubierto = faltante - cantidad;

  const titulo = esQuitar
    ? '¿Quitar una línea con compromisos?'
    : '¿Pedir menos de lo comprometido?';

  const detalle =
    `${nombre}: ya hay pedidos de clientes que exigen ${faltante.toLocaleString('es-CO')} und ` +
    `y vas a pedir ${cantidad.toLocaleString('es-CO')}. ` +
    `Quedarían ${descubierto.toLocaleString('es-CO')} und sin cubrir.`;

  if (typeof Swal === 'undefined') {
    return window.confirm(`${titulo}\n\n${detalle}`);
  }

  const resultado = await Swal.fire({
    title: titulo,
    html: `<p>${detalle}</p>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: esQuitar ? 'Sí, quitar igual' : 'Sí, pedir menos',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#d33'
  });

  return resultado.isConfirmed;
}

/**
 * Marca visualmente un input cuya cantidad quedó por debajo del faltante.
 * Tras confirmar, la línea sigue señalada: el aviso no puede ser de un solo uso.
 */
function marcarLineaBajoFaltante(input, cantidad, faltante) {
  if (!input) return;

  const estaBajo = faltante > 0 && cantidad < faltante;
  input.classList.toggle('calculadora-input-bajo-faltante', estaBajo);
  input.title = estaBajo
    ? `Por debajo del faltante: los compromisos exigen ${faltante.toLocaleString('es-CO')} und.`
    : '';
}

/**
 * Punto único por el que pasa toda cantidad final ya aceptada.
 * Sincroniza estado, input, clases y totales.
 */
function aplicarCantidadFinal(idProducto, cantidad, input) {
  calculadora_cantidadesFinales[idProducto] = cantidad;

  if (input) {
    input.value = cantidad;
    // Se actualiza para que un segundo cambio cancelado vuelva a ESTE valor y
    // no al que había antes de tocar la fila por primera vez.
    input.dataset.valorPrevio = cantidad;

    const fila = input.closest('tr');
    if (fila) fila.classList.toggle('calculadora-fila-excluida', cantidad === 0);

    marcarLineaBajoFaltante(input, cantidad, obtenerFaltanteDeLinea(idProducto));
  }

  actualizarTotalesPedido();
}

// =========================================================================
// PEDIDO ENVIADO (acta de solo lectura)
// =========================================================================

/**
 * Congela el pedido tal como está en pantalla.
 *
 * Los números son los mismos que muestran los KPI y el resumen del obsequio,
 * calculados con las mismas funciones: el acta no puede discrepar de lo que
 * el usuario vio al enviarlo.
 *
 * ⚠️ El obsequio y el descuento se calculan SOLO sobre el bloque de stock.
 * Es la regla del negocio: el bloque bajo pedido va a otros proveedores.
 */
function construirPedidoParaGuardar() {
  const parametros = leerParametrosDelFormulario();

  const lineasStockParaBono = calculadora_lineasStock.map((linea) => ({
    nombre: linea.nombre,
    cantidad: calculadora_cantidadesFinales[linea.id_producto] || 0
  }));

  const bono = calcularObsequioYDescuento(lineasStockParaBono, parametros);
  const desglose = calcularDesglosePorCategoria(lineasStockParaBono, parametros);

  const lineas = [];
  let unidadesStock = 0;
  let unidadesBajoPedido = 0;
  let totalValor = 0;

  calculadora_lineasStock.forEach((linea) => {
    const final = calculadora_cantidadesFinales[linea.id_producto] || 0;
    if (final <= 0) return;

    const precio = obtenerPrecioProducto(linea.nombre, parametros.precios);
    unidadesStock += final;
    totalValor += final * precio;

    lineas.push({
      id_producto: linea.id_producto,
      nombre: linea.nombre,
      bloque: 'Stock',
      categoria_precio: clasificarCategoriaPrecio(linea.nombre),
      stock_actual: linea.stock_actual || 0,
      stock_comprometido: linea.stock_comprometido || 0,
      stock_disponible: linea.stockDisponible,
      pendiente: linea.pendiente,
      demanda_diaria: linea.demandaDiaria,
      faltante: linea.piso,
      ideal: linea.ideal,
      sugerido: linea.pedir,
      final: final,
      precio: precio,
      subtotal: final * precio,
      cobertura_resultante: linea.coberturaResultante
    });
  });

  calculadora_lineasBajoPedido.forEach((linea) => {
    const final = calculadora_cantidadesFinales[linea.id_producto] || 0;
    if (final <= 0) return;

    const precio = obtenerPrecioProducto(linea.nombre, parametros.precios);
    unidadesBajoPedido += final;
    totalValor += final * precio;

    lineas.push({
      id_producto: linea.id_producto,
      nombre: linea.nombre,
      bloque: 'Bajo pedido',
      categoria_precio: clasificarCategoriaPrecio(linea.nombre),
      proveedores: (linea.proveedores || []).map((p) => p.nombre).filter(Boolean),
      stock_disponible: linea.stockDisponible,
      pendiente_firme: linea.pendienteFirme,
      pendiente_borrador: linea.pendienteBorrador,
      faltante: linea.comprar,
      sugerido: linea.comprar,
      final: final,
      precio: precio,
      subtotal: final * precio
    });
  });

  const select = document.getElementById('filtro-proveedor-pedido');
  const proveedorNombre = parametros.proveedorId && select && select.selectedIndex >= 0
    ? select.options[select.selectedIndex].text
    : 'Todos los proveedores';

  return {
    version: 1,
    generado_en: new Date().toISOString(),
    proveedor_id: parametros.proveedorId || null,
    proveedor_nombre: proveedorNombre,
    parametros: parametros,
    total_elegido: calculadora_totalElegido,
    resumen: {
      total_unidades: unidadesStock + unidadesBajoPedido,
      // Se redondea a dos decimales: la columna de la tabla es numeric(14,2).
      total_valor: Math.round(totalValor * 100) / 100,
      unidades_stock: unidadesStock,
      unidades_bajo_pedido: unidadesBajoPedido,
      obsequio_unidades: bono.obsequio,
      // null cuando el pedido no tiene unidades de "varios" contra las cuales
      // aplicar el descuento. Se conserva el null: un 0 diría otra cosa.
      descuento_pct: bono.descuentoPct === null
        ? null
        : Math.round(bono.descuentoPct * 10000) / 10000,
      unidades_varios: bono.unidadesVarios,
      valor_varios: bono.valorVarios,
      valor_obsequio: bono.valorObsequio,
      desperdicio: bono.desperdicio,
      desglose: desglose
    },
    lineas: lineas
  };
}

/**
 * Guarda el pedido enviado. Pide una nota opcional, que es a la vez la
 * confirmación de la acción.
 */
async function guardarPedidoEnviado() {
  const pedido = construirPedidoParaGuardar();

  if (pedido.lineas.length === 0) {
    if (typeof toastr !== 'undefined') {
      toastr.warning('No hay líneas con cantidad mayor a cero.');
    }
    return;
  }

  const resumenHtml =
    `<p><strong>${pedido.resumen.total_unidades.toLocaleString('es-CO')} und</strong> · ` +
    `${calculadora_formatoMoneda.format(pedido.resumen.total_valor)} · ` +
    `${pedido.lineas.length} líneas</p>` +
    `<p style="font-size:0.9em;color:#666;">Obsequio ${pedido.resumen.obsequio_unidades.toLocaleString('es-CO')} und · ` +
    `descuento ${pedido.resumen.descuento_pct === null ? 'no aplica' : pedido.resumen.descuento_pct.toFixed(2) + ' %'}</p>` +
    `<p style="font-size:0.9em;color:#666;">Queda como acta de solo lectura para cotejar cuando llegue la mercancía.</p>`;

  let notas = '';

  if (typeof Swal !== 'undefined') {
    const resultado = await Swal.fire({
      title: 'Guardar el pedido enviado',
      html: resumenHtml,
      icon: 'question',
      input: 'text',
      inputPlaceholder: 'Nota opcional (ej. enviado por WhatsApp)',
      inputAttributes: { maxlength: 200 },
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar'
    });

    if (!resultado.isConfirmed) return;
    notas = (resultado.value || '').trim();

  } else if (!window.confirm(
      `Guardar el pedido enviado: ${pedido.resumen.total_unidades} und, ` +
      `${pedido.lineas.length} líneas.`)) {
    return;
  }

  pedido.notas = notas;

  const boton = document.getElementById('btn-guardar-pedido');
  let textoOriginal = '';
  if (boton) {
    textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
  }

  const respuesta = await guardarPedidoCalculadoraConSupabase(pedido);

  if (boton) {
    boton.disabled = false;
    boton.innerHTML = textoOriginal;
  }

  if (respuesta.error) {
    if (typeof toastr !== 'undefined') {
      toastr.error(respuesta.error, 'No se pudo guardar el pedido');
    }
    return;
  }

  if (typeof toastr !== 'undefined') {
    toastr.success(
      `${pedido.lineas.length} líneas · ${pedido.resumen.total_unidades.toLocaleString('es-CO')} und. ` +
      'Lo encuentras en Compras → Pedidos guardados.',
      'Pedido guardado');
  }
}

/**
 * Exporta el pedido final a CSV.
 */
function exportarPedidoCSV() {
  const lineas = obtenerLineasDelPedidoFinal();

  if (lineas.length === 0) {
    if (typeof toastr !== 'undefined') {
      toastr.warning('No hay líneas con cantidad mayor a cero.');
    }
    return;
  }

  const encabezados = [
    'Bloque', 'Producto', 'Disponible', 'Pendiente',
    'Demanda_Dia', 'Sugerido', 'Final', 'Precio', 'Subtotal'
  ];

  // Las comillas evitan que un nombre con coma rompa las columnas.
  const filas = lineas.map((linea) => [
    linea.bloque,
    `"${String(linea.nombre).replace(/"/g, '""')}"`,
    linea.stockDisponible,
    linea.pendiente,
    linea.demandaDiaria.toFixed(2),
    linea.sugerido,
    linea.final,
    linea.precio,
    linea.subtotal
  ]);

  const totalUnidades = lineas.reduce((suma, l) => suma + l.final, 0);
  const totalValor = lineas.reduce((suma, l) => suma + l.subtotal, 0);
  filas.push(['TOTAL', '', '', '', '', '', totalUnidades, '', totalValor]);

  const csvString = [encabezados.join(','), ...filas.map((f) => f.join(','))].join('\n');
  const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  const fecha = new Date().toISOString().slice(0, 10);

  enlace.setAttribute('href', url);
  enlace.setAttribute('download', `pedido_compra_${fecha}.csv`);
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);

  console.log('[Calculadora] ✓ CSV exportado con', lineas.length, 'líneas');
}

/**
 * Arma el texto del pedido, lo copia al portapapeles y ofrece abrir WhatsApp.
 */
async function compartirPedidoWhatsApp() {
  const lineas = obtenerLineasDelPedidoFinal();

  if (lineas.length === 0) {
    if (typeof toastr !== 'undefined') {
      toastr.warning('No hay líneas con cantidad mayor a cero.');
    }
    return;
  }

  const fechaEntrega = new Date();
  fechaEntrega.setDate(fechaEntrega.getDate() + 1);
  const fechaTexto = fechaEntrega.toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  let texto = `*PEDIDO DE COMPRA*\n`;
  texto += `Entrega: ${fechaTexto}\n`;
  texto += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  const lineasStock = lineas.filter((l) => l.bloque === 'Stock');
  const lineasBajoPedido = lineas.filter((l) => l.bloque === 'Bajo pedido');

  if (lineasStock.length > 0) {
    lineasStock.forEach((linea) => {
      texto += `*${linea.nombre}*  *${linea.final}* Und\n`;
    });
  }

  if (lineasBajoPedido.length > 0) {
    texto += `\n*BAJO PEDIDO*\n`;
    lineasBajoPedido.forEach((linea) => {
      texto += `*${linea.nombre}*  *${linea.final}* Und\n`;
    });
  }

  const totalUnidades = lineas.reduce((suma, l) => suma + l.final, 0);
  texto += `\n━━━━━━━━━━━━━━━━━━━━\n`;
  texto += `*TOTAL: ${totalUnidades} unidades*`;

  try {
    await navigator.clipboard.writeText(texto);

    const resultado = await Swal.fire({
      icon: 'success',
      title: 'Pedido copiado',
      html: `<p>El pedido está en el portapapeles.</p>
             <p style="margin-top:10px;">Abre WhatsApp y haz <strong>Ctrl+V</strong> para pegarlo.</p>`,
      showCancelButton: true,
      confirmButtonText: 'Abrir WhatsApp',
      cancelButtonText: 'Cerrar'
    });

    if (resultado.isConfirmed) {
      window.location.href = `whatsapp://send?text=${encodeURIComponent(texto)}`;
    }

    console.log('[Calculadora] ✓ Pedido copiado al portapapeles');

  } catch (error) {
    console.error('[Calculadora] ✗ Error al copiar al portapapeles:', error);
    if (typeof toastr !== 'undefined') {
      toastr.error('No se pudo copiar el pedido al portapapeles.');
    }
  }
}

/**
 * Abre una ventana con el pedido listo para imprimir.
 */
function imprimirPedido() {
  const lineas = obtenerLineasDelPedidoFinal();

  if (lineas.length === 0) {
    if (typeof toastr !== 'undefined') {
      toastr.warning('No hay líneas con cantidad mayor a cero.');
    }
    return;
  }

  const totalUnidades = lineas.reduce((suma, l) => suma + l.final, 0);
  const totalValor = lineas.reduce((suma, l) => suma + l.subtotal, 0);

  let filasHtml = '';
  lineas.forEach((linea) => {
    filasHtml += `<tr>
      <td>${linea.nombre}</td>
      <td>${linea.bloque}</td>
      <td class="derecha">${linea.final.toLocaleString('es-CO')}</td>
      <td class="derecha">${calculadora_formatoMoneda.format(linea.precio)}</td>
      <td class="derecha">${calculadora_formatoMoneda.format(linea.subtotal)}</td>
    </tr>`;
  });

  const ventana = window.open('', '', 'height=700,width=900');
  if (!ventana) {
    if (typeof toastr !== 'undefined') {
      toastr.error('El navegador bloqueó la ventana de impresión.');
    }
    return;
  }

  ventana.document.write(`
    <html>
      <head>
        <title>Pedido de Compra</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; }
          h1 { font-size: 1.4rem; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #333; padding: 8px; font-size: 0.9rem; }
          th { background: #eee; }
          .derecha { text-align: right; }
          .total td { font-weight: bold; background: #f0f0f0; }
        </style>
      </head>
      <body>
        <h1>Pedido de Compra</h1>
        <p><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-CO')}</p>
        <table>
          <thead>
            <tr>
              <th>Producto</th><th>Bloque</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th>
            </tr>
          </thead>
          <tbody>${filasHtml}</tbody>
          <tfoot>
            <tr class="total">
              <td colspan="2">TOTAL</td>
              <td class="derecha">${totalUnidades.toLocaleString('es-CO')}</td>
              <td></td>
              <td class="derecha">${calculadora_formatoMoneda.format(totalValor)}</td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `);

  ventana.document.close();
  ventana.print();
}

/**
 * Devuelve todas las cantidades finales a los valores sugeridos.
 */
function restaurarCantidadesSugeridas() {
  Object.keys(calculadora_sugeridos).forEach((idProducto) => {
    calculadora_cantidadesFinales[idProducto] = calculadora_sugeridos[idProducto];
  });

  document.querySelectorAll('.calculadora-input-final').forEach((input) => {
    const idProducto = input.dataset.id;
    if (idProducto in calculadora_sugeridos) {
      input.value = calculadora_sugeridos[idProducto];
      input.dataset.valorPrevio = input.value;
    }
    const fila = input.closest('tr');
    if (fila) fila.classList.remove('calculadora-fila-excluida');

    marcarLineaBajoFaltante(
      input,
      calculadora_cantidadesFinales[idProducto] || 0,
      obtenerFaltanteDeLinea(idProducto));
  });

  actualizarTotalesPedido();
  console.log('[Calculadora] ✓ Cantidades restauradas a los valores sugeridos');
}

// =========================================================================
// CONFIGURACIÓN DE LA PÁGINA
// =========================================================================

/**
 * Configura los listeners de la vista Calculadora de Pedidos.
 * Punto de entrada del módulo, invocado desde home.js al cargar la vista.
 */
function configurarPaginaCalculadoraPedidosYListeners() {
  console.log('[Calculadora] Configurando listeners de la calculadora de pedidos...');

  // Estado limpio al entrar: la vista se reinyecta en cada navegación.
  calculadora_isLoading = false;
  calculadora_datosCrudos = null;
  calculadora_lineasStock = [];
  calculadora_lineasBajoPedido = [];
  calculadora_resultadoReparto = null;
  calculadora_sugeridos = {};
  calculadora_cantidadesFinales = {};
  calculadora_proveedoresCargados = false;
  calculadora_itemsStock = [];
  calculadora_opcionesPedido = [];
  calculadora_totalElegido = null;
  calculadora_idealPedido = 0;
  calculadora_pisoPedido = 0;
  calculadora_filasHistorial = 0;

  // La función de reparto vive en js/reparto_capacidad.js.
  if (typeof repartirCapacidad !== 'function') {
    console.error('[Calculadora] ✗ repartirCapacidad no está disponible. ¿Falta cargar js/reparto_capacidad.js?');
  }

  // Se pinta primero con el caché local para que el panel aparezca lleno al
  // instante, y luego la base corrige si tiene algo distinto. Sin esperar:
  // los parámetros no bloquean nada hasta que se pulsa Calcular.
  aplicarParametrosAlFormulario(cargarParametrosCalculadora());
  habilitarAccionesPedido(false);

  // Encadenados a propósito: sincronizar restaura el proveedor guardado, y
  // asignar un value a un <select> vacío no hace nada. En paralelo, el orden
  // de llegada decidiría si el proveedor se restaura o no.
  cargarSelectorProveedores().then(sincronizarParametrosDesdeLaBase);

  // ===== TOGGLE DEL PANEL DE PARÁMETROS =====
  const toggleParametros = document.getElementById('btn-toggle-parametros-pedido');
  const panelParametros = document.getElementById('parametros-pedido-content');

  // El panel usa la convención genérica de components.css: nace cerrado y
  // 'is-visible' lo abre. La vista lo trae ya abierto. (Ojo: proveedores usa
  // 'is-collapsed', pero eso depende de un override atado a su propio id en
  // proveedores.css y no funciona fuera de esa vista.)
  if (toggleParametros && panelParametros) {
    toggleParametros.addEventListener('click', () => {
      const estaVisible = panelParametros.classList.toggle('is-visible');
      toggleParametros.setAttribute('aria-expanded', estaVisible);

      const chevron = toggleParametros.querySelector('i:last-child');
      if (chevron) {
        chevron.className = estaVisible ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
      }
    });
  }

  // ===== CALCULAR =====
  const btnCalcular = document.getElementById('btn-calcular-pedido');
  if (btnCalcular) {
    btnCalcular.addEventListener('click', fetchAndRenderCalculadora);
  }

  // ===== ELEGIR OPCIÓN DE PEDIDO =====
  // Cambiar de total no requiere volver a consultar: se reusa el pronóstico.
  const tbodyOpciones = document.getElementById('tbody-opciones-pedido');
  if (tbodyOpciones) {
    tbodyOpciones.addEventListener('click', (evento) => {
      const boton = evento.target.closest('.calculadora-btn-elegir');
      if (!boton) return;

      const total = parseInt(boton.dataset.total, 10);
      if (isNaN(total)) return;

      console.log('[Calculadora] Cambiando el total del pedido a', total, 'und');
      aplicarTotalDePedido(total, leerParametrosDelFormulario());
    });
  }

  // ===== PRECIOS: recalculan totales sin volver a consultar =====
  ['input-precio-varios', 'input-precio-frutos-rojos', 'input-precio-sin-azucar'].forEach((id) => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('change', () => {
        const actuales = leerParametrosDelFormulario();
        guardarParametrosCalculadora(actuales);

        // Los precios cambian el costo y el descuento de cada opción, así que
        // hay que repintarlas. No requiere volver a consultar la RPC.
        if (calculadora_totalElegido !== null) {
          calculadora_opcionesPedido = calcularOpcionesDePedido(
            calculadora_itemsStock, actuales, calculadora_idealPedido, calculadora_pisoPedido);
          renderizarOpcionesPedido(calculadora_opcionesPedido, calculadora_totalElegido, actuales);
        }
        actualizarTotalesPedido();
      });
    }
  });

  // ===== CANTIDAD FINAL Y QUITAR (delegación en ambas tablas) =====
  ['tbody-pedido-stock', 'tbody-pedido-bajo-pedido'].forEach((idTbody) => {
    const tbody = document.getElementById(idTbody);
    if (!tbody) return;

    // Se guarda el valor con el que entra a la celda: si la advertencia del
    // faltante se cancela, hay que devolver la cantidad a lo que era.
    tbody.addEventListener('focusin', (evento) => {
      const input = evento.target.closest('.calculadora-input-final');
      if (input) input.dataset.valorPrevio = input.value;
    });

    // 'input' mantiene los totales vivos mientras se teclea, sin validar.
    tbody.addEventListener('input', (evento) => {
      const input = evento.target.closest('.calculadora-input-final');
      if (!input) return;

      const idProducto = input.dataset.id;
      const cantidad = Math.max(0, parseInt(input.value, 10) || 0);
      calculadora_cantidadesFinales[idProducto] = cantidad;

      const fila = input.closest('tr');
      if (fila) fila.classList.toggle('calculadora-fila-excluida', cantidad === 0);

      actualizarTotalesPedido();
    });

    // La validación va en 'change' (al salir de la celda o pulsar Enter) y no
    // en 'input': este último dispara en cada tecla y preguntaría a media
    // digitación — al pasar de 150 a 50 el "5" intermedio ya sería inválido.
    tbody.addEventListener('change', async (evento) => {
      const input = evento.target.closest('.calculadora-input-final');
      if (!input) return;

      const idProducto = input.dataset.id;
      const cantidad = Math.max(0, parseInt(input.value, 10) || 0);
      const faltante = obtenerFaltanteDeLinea(idProducto);

      if (faltante <= 0 || cantidad >= faltante) {
        aplicarCantidadFinal(idProducto, cantidad, input);
        return;
      }

      const confirmado = await confirmarCantidadBajoFaltante(
        obtenerNombreDeLinea(idProducto), cantidad, faltante, false);

      if (confirmado) {
        console.warn('[Calculadora] ⚠ Cantidad por debajo del faltante aceptada:',
          obtenerNombreDeLinea(idProducto), cantidad, 'de', faltante);
        aplicarCantidadFinal(idProducto, cantidad, input);
        return;
      }

      const previo = parseInt(input.dataset.valorPrevio, 10);
      const restaurada = isNaN(previo)
        ? (calculadora_sugeridos[idProducto] || 0)
        : Math.max(0, previo);

      aplicarCantidadFinal(idProducto, restaurada, input);
    });

    tbody.addEventListener('click', async (evento) => {
      const boton = evento.target.closest('.calculadora-btn-quitar');
      if (!boton) return;

      const idProducto = boton.dataset.id;
      const fila = boton.closest('tr');
      const input = fila ? fila.querySelector('.calculadora-input-final') : null;
      const faltante = obtenerFaltanteDeLinea(idProducto);

      // Quitar la línea es dejarla en cero: si hay compromisos, es el caso más
      // grave de todos y merece la misma advertencia.
      if (faltante > 0) {
        const confirmado = await confirmarCantidadBajoFaltante(
          obtenerNombreDeLinea(idProducto), 0, faltante, true);

        if (!confirmado) return;

        console.warn('[Calculadora] ⚠ Línea con compromisos quitada del pedido:',
          obtenerNombreDeLinea(idProducto), 'faltante', faltante);
      }

      aplicarCantidadFinal(idProducto, 0, input);
    });
  });

  // ===== GUARDAR EL PEDIDO ENVIADO =====
  const btnGuardarPedido = document.getElementById('btn-guardar-pedido');
  if (btnGuardarPedido) btnGuardarPedido.addEventListener('click', guardarPedidoEnviado);

  // ===== ACCIONES DE EXPORTACIÓN =====
  const btnExportar = document.getElementById('btn-exportar-csv-pedido');
  if (btnExportar) btnExportar.addEventListener('click', exportarPedidoCSV);

  const btnWhatsApp = document.getElementById('btn-compartir-pedido-whatsapp');
  if (btnWhatsApp) btnWhatsApp.addEventListener('click', compartirPedidoWhatsApp);

  const btnImprimir = document.getElementById('btn-imprimir-pedido');
  if (btnImprimir) btnImprimir.addEventListener('click', imprimirPedido);

  const btnRestaurar = document.getElementById('btn-restaurar-pedido');
  if (btnRestaurar) btnRestaurar.addEventListener('click', restaurarCantidadesSugeridas);

  // ===== AJUSTAR AL TOTAL =====
  const btnAjustar = document.getElementById('btn-ajustar-pedido');
  if (btnAjustar) {
    btnAjustar.addEventListener('click', () => {
      const resultado = ajustarPedidoAlTotalElegido();

      if (resultado.candidatos === 0) {
        if (typeof toastr !== 'undefined') {
          toastr.warning('No hay sabores con demanda en el pedido para absorber el ajuste.');
        }
        return;
      }

      sincronizarInputsConCantidades();
      actualizarTotalesPedido();

      if (typeof toastr !== 'undefined') {
        const verbo = resultado.ajustada >= 0 ? 'repartidas' : 'retiradas';
        toastr.success(`${Math.abs(resultado.ajustada).toLocaleString('es-CO')} und ${verbo} entre ` +
          `${resultado.candidatos} sabores de mayor demanda.`);
      }

      console.log('[Calculadora] ✓ Pedido ajustado al total:', resultado);
    });
  }

  console.log('[Calculadora] ✓ Listeners configurados');
}

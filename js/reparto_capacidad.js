// =========================================================================
// REPARTO DE CAPACIDAD - INVENTRACK VERCEL
// =========================================================================

/**
 * Reparte una capacidad fija de unidades entre productos, nivelando
 * los dias de cobertura en vez de escalar proporcionalmente.
 *
 * Funcion pura: mismas entradas -> mismas salidas. Sin efectos secundarios.
 *
 * items: [{ nombre, demandaDiaria, stockDisponible, pendiente }]
 * capacidad: total de unidades a pedir. null = sin limite (calcula el ideal).
 */
function repartirCapacidad(items, capacidad, opts = {}) {
  const {
    coberturaObjetivo = 3,
    seguridad = 0.20,
    permitirExcedente = true,
  } = opts;

  const filas = items.map((it) => {
    const demanda = Math.max(0, Number(it.demandaDiaria) || 0);
    const pendiente = Math.max(0, Number(it.pendiente) || 0);
    const disponible = Number(it.stockDisponible) || 0;

    // Stock realmente libre despues de honrar lo comprometido.
    // Negativo = ya debes mas de lo que tienes.
    const stockReal = disponible - pendiente;

    // Piso no negociable: lo que falta para cumplir compromisos.
    const piso = Math.max(0, -stockReal);

    // Objetivo de cobertura y sugerido sin restriccion de capacidad.
    const objetivo = Math.ceil(demanda * coberturaObjetivo * (1 + seguridad));
    const ideal = Math.max(0, objetivo - stockReal);

    return {
      ...it,
      demanda,
      pendiente,
      disponible,
      stockReal,
      piso,
      objetivo,
      ideal,
      asignado: 0,
    };
  });

  const totalPiso = filas.reduce((s, f) => s + f.piso, 0);
  const totalIdeal = filas.reduce((s, f) => s + f.ideal, 0);

  // Sin capacidad definida: devolver el ideal tal cual.
  if (capacidad == null || capacidad <= 0) {
    filas.forEach((f) => { f.asignado = f.ideal; });
    return construirResultadoReparto(filas, totalIdeal, totalPiso, totalIdeal, 0, 'sin_limite');
  }

  const cupo = Math.floor(capacidad);

  // Caso critico: no alcanza ni para los compromisos.
  // Reparto proporcional sobre los pisos, con el residuo a los mayores.
  if (totalPiso > cupo) {
    let repartido = 0;
    filas.forEach((f) => {
      f.asignado = Math.floor((f.piso / totalPiso) * cupo);
      repartido += f.asignado;
    });
    const orden = [...filas].sort((a, b) => b.piso - a.piso);
    let i = 0;
    while (repartido < cupo && orden.length) {
      orden[i % orden.length].asignado += 1;
      repartido += 1;
      i += 1;
    }
    return construirResultadoReparto(filas, cupo, totalPiso, totalIdeal, 0, 'piso_excede_capacidad');
  }

  // 1. Cubrir los pisos.
  filas.forEach((f) => { f.asignado = f.piso; });
  let restante = cupo - totalPiso;

  // 2. Nivelacion: cada unidad va al producto con menor cobertura resultante.
  //    Los de demanda 0 quedan fuera (cobertura infinita).
  const cobertura = (f) =>
    f.demanda > 0 ? (f.stockReal + f.asignado) / f.demanda : Infinity;

  const faseUno = () => filas.filter((f) => f.demanda > 0 && f.asignado < f.ideal);
  const faseDos = () => filas.filter((f) => f.demanda > 0);

  let fase = 'ajustado';

  while (restante > 0) {
    let candidatos = faseUno();
    if (candidatos.length === 0) {
      if (!permitirExcedente) { fase = 'sobrante'; break; }
      candidatos = faseDos();
      if (candidatos.length === 0) { fase = 'sobrante'; break; }
      fase = 'excedente';
    }
    let peor = candidatos[0];
    for (const f of candidatos) {
      if (cobertura(f) < cobertura(peor)) peor = f;
    }
    peor.asignado += 1;
    restante -= 1;
  }

  return construirResultadoReparto(filas, cupo - restante, totalPiso, totalIdeal, restante, fase);
}

/**
 * Arma el objeto de salida del reparto. Helper interno de repartirCapacidad.
 */
function construirResultadoReparto(filas, totalAsignado, totalPiso, totalIdeal, sobrante, estado) {
  return {
    estado,           // sin_limite | ajustado | excedente | sobrante | piso_excede_capacidad
    totalAsignado,
    totalPiso,
    totalIdeal,
    sobrante,
    lineas: filas
      .map((f) => ({
        nombre: f.nombre,
        id_producto: f.id_producto,
        demandaDiaria: Number(f.demanda.toFixed(2)),
        stockDisponible: f.disponible,
        pendiente: f.pendiente,
        stockReal: f.stockReal,
        piso: f.piso,
        ideal: f.ideal,
        pedir: f.asignado,
        coberturaResultante: f.demanda > 0
          ? Number(((f.stockReal + f.asignado) / f.demanda).toFixed(1))
          : null,
      }))
      .sort((a, b) => b.pedir - a.pedir),
  };
}

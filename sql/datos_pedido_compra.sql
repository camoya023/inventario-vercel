-- =============================================================
-- datos_pedido_compra
--
-- Reemplaza los 3 CSV de la calculadora Y la consulta de compras
-- bajo pedido, en una sola llamada.
--
-- Cada producto viene etiquetado con su modo:
--   'stock'       -> se pronostica (Yogoyass y similares)
--   'bajo_pedido' -> se compra exactamente lo pendiente
--
-- El historial de ventas SOLO se calcula para los de modo stock,
-- porque los bajo pedido no usan pronostico.
--
-- p_proveedor_id NULL = todos los proveedores.
--
-- -------------------------------------------------------------
-- ⚠️ POR QUE ESTA FUNCION ES SECURITY DEFINER
-- -------------------------------------------------------------
-- La version anterior era SECURITY INVOKER. Devolvia 'ventas'
-- vacio SIEMPRE y por eso la Calculadora de Pedidos mostraba
-- Demanda/dia = 0.0 en todos los productos.
--
-- Causa: en esta app el usuario autenticado NO tiene acceso RLS
-- directo a 'ventas' ni a 'detalles_venta'. Ningun modulo las
-- consulta con .from(); todo pasa por RPC SECURITY DEFINER
-- (fn_obtener_lista_ventas, fn_obtener_venta_detalle, etc.).
-- En cambio 'productos' y 'clientes' si se leen directo.
--
-- Bajo INVOKER, RLS no lanza error: simplemente devuelve cero
-- filas. El fallo era silencioso.
--
-- ⚠️ CONSECUENCIA CRITICA: bajo SECURITY DEFINER **RLS deja de
-- acotar por empresa**. El filtro por empresa_id de aqui abajo
-- NO es opcional: sin el, esta funcion devolveria las ventas de
-- TODAS las empresas a cualquier usuario.
--
-- Por eso NO aplica aqui la regla general de CLAUDE.md que dice
-- "no filtrar por empresa_id manualmente: RLS lo resuelve". Esa
-- regla vale para INVOKER. Bajo DEFINER es justo al reves.
--
-- Se sigue el mismo patron que fn_obtener_lista_ventas:
-- empresa_id desde public.perfiles con auth.uid(), tablas
-- esquematizadas y search_path fijo.
-- =============================================================

-- -------------------------------------------------------------
-- ANTES DE EJECUTAR: confirmar que 'productos' tenga empresa_id.
-- Es la unica columna que esta funcion asume y no estaba
-- verificada. Si esta consulta no devuelve 'productos', avisar
-- antes de continuar.
--
--   select table_name, column_name
--   from information_schema.columns
--   where table_schema = 'public'
--     and column_name = 'empresa_id'
--     and table_name in ('productos', 'ventas', 'perfiles');
-- -------------------------------------------------------------

create or replace function public.datos_pedido_compra(
  p_proveedor_id   uuid default null,
  p_dias_historial int  default 120
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_empresa_id uuid;
  v_resultado  json;
begin
  -- 1. Empresa del usuario autenticado.
  --    auth.uid() funciona con search_path=public porque va
  --    con el prefijo 'auth.' explicito.
  select empresa_id into v_empresa_id
  from public.perfiles
  where id = auth.uid();

  -- Sin empresa no se devuelve nada. Se conserva la forma del
  -- JSON para que el cliente no rompa al leer las claves.
  if v_empresa_id is null then
    return json_build_object(
      'error',          'Usuario sin empresa asignada',
      'generado_en',    now(),
      'proveedor_id',   p_proveedor_id,
      'dias_historial', p_dias_historial,
      'productos',      '[]'::json,
      'ventas',         '[]'::json,
      'dias_operacion', '[]'::json
    );
  end if;

  -- 2. Consulta principal.
  with productos_sel as (
    select
      p.id_producto,
      p.nombre_producto,
      case when p.se_maneja_bajo_pedido then 'bajo_pedido' else 'stock' end as modo,
      prov.proveedores,
      m.nombre_marca as marca,
      p.stock_actual,
      p.stock_comprometido,
      p.stock_disponible
    from public.productos p
    left join public.marcas m on m.id_marca = p.id_marca
    left join lateral (
      -- Un producto puede tener varios proveedores. Se devuelven TODOS;
      -- elegir uno aqui haria que apareciera en el pedido equivocado.
      select coalesce(json_agg(json_build_object(
               'id',     pr.id,
               'nombre', pr.nombre_empresa
             ) order by pr.nombre_empresa), '[]'::json) as proveedores
      from public.proveedores_productos pp
      join public.proveedores pr on pr.id = pp.id_proveedor
      where pp.id_producto = p.id_producto
    ) prov on true
    where p.activo = true
      and p.empresa_id = v_empresa_id   -- obligatorio bajo DEFINER
      and (
        p_proveedor_id is null
        or exists (
          select 1 from public.proveedores_productos pp2
          where pp2.id_producto = p.id_producto
            and pp2.id_proveedor = p_proveedor_id
        )
      )
  ),

  -- Pendientes separados: firme vs borrador.
  -- Las lineas 'Anulada' conservan cantidad_pendiente, por eso el filtro
  -- por estado_item es obligatorio.
  pend as (
    select
      dv.id_producto,
      coalesce(sum(dv.cantidad_pendiente)
        filter (where v.estado not in ('Borrador', 'Anulada')), 0)::numeric as pendiente_firme,
      coalesce(sum(dv.cantidad_pendiente)
        filter (where v.estado = 'Borrador'), 0)::numeric as pendiente_borrador
    from public.detalles_venta dv
    join public.ventas v on v.id = dv.id_venta
    where dv.estado_item = 'Pendiente'
      and dv.cantidad_pendiente > 0
      and v.empresa_id = v_empresa_id   -- obligatorio bajo DEFINER
    group by 1
  ),

  -- Historial diario, solo modo stock.
  --
  -- ⚠️ Se agrupa por id_producto, NO por nombre. Agrupar por nombre hacia
  -- que dos productos activos homonimos (distinta marca o proveedor)
  -- sumaran sus ventas en una sola fila, y despues el cliente le asignaba
  -- esa demanda combinada a AMBOS: se pedia de mas para los dos, en
  -- silencio. El nombre viaja igual, solo para mostrar.
  ventas_hist as (
    select
      v.fecha_venta::date       as fecha,
      ps.id_producto,
      ps.nombre_producto,
      sum(dv.cantidad)::numeric as unidades
    from public.detalles_venta dv
    join public.ventas v   on v.id = dv.id_venta
    join productos_sel ps  on ps.id_producto = dv.id_producto
    where ps.modo = 'stock'
      and v.empresa_id = v_empresa_id   -- obligatorio bajo DEFINER
      and v.estado not in ('Anulada', 'Borrador')
      and dv.estado_item <> 'Anulada'
      and v.fecha_venta >= current_date - make_interval(days => p_dias_historial)
    group by 1, 2, 3
  ),

  -- Dias en que el negocio opero. Permite distinguir "cerrado" de
  -- "abierto pero sin vender ese sabor".
  dias_operacion as (
    select distinct v.fecha_venta::date as fecha
    from public.ventas v
    where v.empresa_id = v_empresa_id   -- obligatorio bajo DEFINER
      and v.estado not in ('Anulada', 'Borrador')
      and v.fecha_venta >= current_date - make_interval(days => p_dias_historial)
  )

  select json_build_object(
    'generado_en',    now(),
    'proveedor_id',   p_proveedor_id,
    'dias_historial', p_dias_historial,

    'productos', (
      select coalesce(json_agg(json_build_object(
        'id_producto',        ps.id_producto,
        'nombre',             ps.nombre_producto,
        'modo',               ps.modo,
        'proveedores',        ps.proveedores,
        'marca',              ps.marca,
        'stock_actual',       ps.stock_actual,
        'stock_comprometido', ps.stock_comprometido,
        'stock_disponible',   ps.stock_disponible,
        'pendiente_firme',    coalesce(pd.pendiente_firme, 0),
        'pendiente_borrador', coalesce(pd.pendiente_borrador, 0),
        -- Compra exacta para bajo pedido. Incluye pendientes en BORRADOR
        -- por decision de negocio: un borrador ya es un compromiso con cliente.
        -- Los dos componentes van separados arriba por si se quiere revisar.
        'comprar_exacto', greatest(
          coalesce(pd.pendiente_firme, 0)
          + coalesce(pd.pendiente_borrador, 0)
          - ps.stock_disponible, 0
        )
      ) order by ps.modo, ps.nombre_producto), '[]'::json)
      from productos_sel ps
      left join pend pd on pd.id_producto = ps.id_producto
    ),

    'ventas', (
      select coalesce(json_agg(json_build_object(
        'id_producto', id_producto,   -- llave real del cruce
        'fecha',       fecha,
        'nombre',      nombre_producto,
        'unidades',    unidades
      ) order by fecha, nombre_producto), '[]'::json)
      from ventas_hist
    ),

    'dias_operacion', (
      select coalesce(json_agg(fecha order by fecha), '[]'::json)
      from dias_operacion
    )
  )
  into v_resultado;

  return v_resultado;

exception
  when others then
    -- Se conserva la forma del JSON para que el cliente muestre el
    -- error en vez de romperse leyendo claves inexistentes.
    return json_build_object(
      'error',          SQLERRM,
      'generado_en',    now(),
      'proveedor_id',   p_proveedor_id,
      'dias_historial', p_dias_historial,
      'productos',      '[]'::json,
      'ventas',         '[]'::json,
      'dias_operacion', '[]'::json
    );
end;
$function$;

-- En una funcion SECURITY DEFINER conviene no dejarla abierta a public.
revoke execute on function public.datos_pedido_compra(uuid, int) from public;
grant  execute on function public.datos_pedido_compra(uuid, int) to authenticated;

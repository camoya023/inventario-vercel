-- =============================================================
-- parametros_y_pedidos_calculadora
--
-- Dos cosas que hoy viven fuera de la base y se pierden:
--
--   1. Los parametros de la Calculadora (precios, cobertura,
--      seguridad, capacidad, obsequio) estan en localStorage.
--      localStorage esta atado al ORIGEN: si se entra por el
--      dominio propio y por *.vercel.app, son dos almacenes
--      distintos y cada uno tiene sus propios precios. Tambien
--      se pierden al cambiar de equipo o de navegador.
--      -> pasan a configuracion_negocio.parametros_compra
--
--   2. El pedido enviado no queda registrado en ninguna parte.
--      -> tabla nueva pedidos_calculadora, SOLO LECTURA una vez
--         guardado: es el acta de lo que se pidio, para cotejar
--         contra lo que llegue. No recalcula ni se edita.
--
-- No toca 'compras' ni el inventario.
--
-- -------------------------------------------------------------
-- POR QUE TODO PASA POR SECURITY DEFINER
-- -------------------------------------------------------------
-- No sabemos que politicas RLS tiene configuracion_negocio, y en
-- esta app el fallo de RLS es SILENCIOSO: no lanza error, devuelve
-- cero filas. Ya paso con datos_pedido_compra, que nacio INVOKER y
-- mostraba Demanda/dia = 0.0 en todos los productos con cara de
-- dato valido.
--
-- Con DEFINER no dependemos de averiguarlo, pero entonces RLS deja
-- de acotar por empresa y el filtro empresa_id ES OBLIGATORIO. Va
-- resuelto a mano en cada funcion, leyendo el perfil del usuario.
--
-- Idempotente: se puede correr mas de una vez sin romper nada.
-- =============================================================


-- =============================================================
-- 1. PARAMETROS DE COMPRA
-- =============================================================

alter table public.configuracion_negocio
  add column if not exists parametros_compra jsonb;

comment on column public.configuracion_negocio.parametros_compra is
  'Parametros de la Calculadora de Pedidos: precios por categoria, dias de '
  'cobertura, % de seguridad, capacidad maxima, unidades por obsequio y modelo '
  'de pronostico. Reemplaza la clave calculadora_pedidos_parametros de localStorage.';


-- Guardar los parametros de una empresa exige un upsert, y el upsert
-- exige una restriccion unica sobre empresa_id. La PK de la tabla es
-- 'id', asi que hoy nada impide dos filas de configuracion para la
-- misma empresa.
--
-- Si las hubiera, el indice unico fallaria con un error de duplicados
-- dificil de leer. Este bloque revisa primero y aborta con un mensaje
-- que dice exactamente que pasa y que hacer.
do $$
declare
  v_duplicadas integer;
begin
  select count(*) into v_duplicadas
  from (
    select empresa_id
    from public.configuracion_negocio
    group by empresa_id
    having count(*) > 1
  ) d;

  if v_duplicadas > 0 then
    raise exception
      'No se puede crear el indice unico: hay % empresa(s) con mas de una fila '
      'en configuracion_negocio. Consolida esas filas en una sola y vuelve a '
      'correr este archivo.', v_duplicadas;
  end if;
end $$;

create unique index if not exists ux_configuracion_negocio_empresa
  on public.configuracion_negocio (empresa_id);


-- -------------------------------------------------------------
-- fn_obtener_parametros_compra
--
-- Devuelve el jsonb guardado, o NULL si la empresa todavia no ha
-- guardado nada. El cliente decide el fallback (localStorage y luego
-- los valores por defecto); aqui no se inventan datos.
-- -------------------------------------------------------------
create or replace function public.fn_obtener_parametros_compra()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_empresa_id uuid;
  v_parametros jsonb;
begin
  select empresa_id into v_empresa_id
  from public.perfiles
  where id = auth.uid();

  if v_empresa_id is null then
    return null;
  end if;

  select parametros_compra into v_parametros
  from public.configuracion_negocio
  where empresa_id = v_empresa_id;

  return v_parametros;

exception
  when others then
    return null;
end;
$function$;


-- -------------------------------------------------------------
-- fn_guardar_parametros_compra
--
-- Crea la fila de configuracion si la empresa aun no tiene. Las demas
-- columnas de configuracion_negocio traen default, asi que un insert
-- solo con empresa_id es valido.
-- -------------------------------------------------------------
create or replace function public.fn_guardar_parametros_compra(p_parametros jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_empresa_id uuid;
begin
  select empresa_id into v_empresa_id
  from public.perfiles
  where id = auth.uid();

  if v_empresa_id is null then
    return jsonb_build_object('exito', false, 'mensaje', 'El usuario no tiene empresa asociada.');
  end if;

  if p_parametros is null or jsonb_typeof(p_parametros) <> 'object' then
    return jsonb_build_object('exito', false, 'mensaje', 'Los parametros deben ser un objeto JSON.');
  end if;

  insert into public.configuracion_negocio (empresa_id, parametros_compra)
  values (v_empresa_id, p_parametros)
  on conflict (empresa_id) do update
    set parametros_compra = excluded.parametros_compra,
        updated_at        = now();

  return jsonb_build_object('exito', true, 'mensaje', 'Parametros guardados.');

exception
  when others then
    return jsonb_build_object('exito', false, 'mensaje', SQLERRM);
end;
$function$;


-- =============================================================
-- 2. PEDIDOS GUARDADOS
-- =============================================================

create table if not exists public.pedidos_calculadora (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null,
  creado_por         uuid,
  fecha              timestamptz not null default now(),
  proveedor_id       uuid,
  proveedor_nombre   text,
  -- Denormalizados desde el snapshot para poder listar sin abrirlo.
  total_unidades     integer not null default 0,
  total_valor        numeric(14,2) not null default 0,
  obsequio_unidades  integer not null default 0,
  descuento_pct      numeric(7,4),
  notas              text,
  -- El pedido congelado: parametros usados, resumen y lineas.
  snapshot           jsonb not null,
  created_at         timestamptz not null default now()
);

comment on table public.pedidos_calculadora is
  'Acta de un pedido enviado desde la Calculadora. Solo lectura una vez '
  'guardado: sirve para cotejar contra la mercancia cuando llega. No se '
  'recalcula ni se edita, y no afecta inventario ni la tabla compras.';

comment on column public.pedidos_calculadora.snapshot is
  'Pedido congelado tal como se envio: parametros, resumen (obsequio, '
  'descuento, desglose por categoria) y una linea por producto con su '
  'faltante, sugerido y cantidad final del momento.';

create index if not exists ix_pedidos_calculadora_empresa_fecha
  on public.pedidos_calculadora (empresa_id, fecha desc);

-- RLS activo y sin politicas: la tabla no se toca con .from() desde el
-- cliente. Todo el acceso pasa por las funciones DEFINER de abajo, que
-- filtran por empresa_id a mano. Es el modo mas cerrado posible.
alter table public.pedidos_calculadora enable row level security;


-- -------------------------------------------------------------
-- fn_guardar_pedido_calculadora
--
-- Recibe el pedido ya armado por el cliente. Los campos de cabecera se
-- extraen del propio snapshot para que no puedan discrepar de el.
-- -------------------------------------------------------------
create or replace function public.fn_guardar_pedido_calculadora(p_pedido jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_empresa_id uuid;
  v_id         uuid;
  v_lineas     integer;
begin
  select empresa_id into v_empresa_id
  from public.perfiles
  where id = auth.uid();

  if v_empresa_id is null then
    return jsonb_build_object('exito', false, 'mensaje', 'El usuario no tiene empresa asociada.');
  end if;

  if p_pedido is null or jsonb_typeof(p_pedido) <> 'object' then
    return jsonb_build_object('exito', false, 'mensaje', 'El pedido debe ser un objeto JSON.');
  end if;

  v_lineas := jsonb_array_length(coalesce(p_pedido -> 'lineas', '[]'::jsonb));

  if v_lineas = 0 then
    return jsonb_build_object('exito', false, 'mensaje', 'El pedido no tiene lineas con cantidad mayor a cero.');
  end if;

  insert into public.pedidos_calculadora (
    empresa_id, creado_por, proveedor_id, proveedor_nombre,
    total_unidades, total_valor, obsequio_unidades, descuento_pct,
    notas, snapshot
  )
  values (
    v_empresa_id,
    auth.uid(),
    nullif(p_pedido ->> 'proveedor_id', '')::uuid,
    p_pedido ->> 'proveedor_nombre',
    coalesce((p_pedido -> 'resumen' ->> 'total_unidades')::integer, 0),
    coalesce((p_pedido -> 'resumen' ->> 'total_valor')::numeric, 0),
    coalesce((p_pedido -> 'resumen' ->> 'obsequio_unidades')::integer, 0),
    (p_pedido -> 'resumen' ->> 'descuento_pct')::numeric,
    nullif(p_pedido ->> 'notas', ''),
    p_pedido
  )
  returning id into v_id;

  return jsonb_build_object(
    'exito',   true,
    'id',      v_id,
    'lineas',  v_lineas,
    'mensaje', 'Pedido guardado.'
  );

exception
  when others then
    return jsonb_build_object('exito', false, 'mensaje', SQLERRM);
end;
$function$;


-- -------------------------------------------------------------
-- fn_listar_pedidos_calculadora
--
-- Cabeceras para la lista. No devuelve el snapshot: en un pedido de 30
-- lineas pesa bastante y la lista no lo necesita.
-- -------------------------------------------------------------
create or replace function public.fn_listar_pedidos_calculadora(
  p_limit  integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_empresa_id uuid;
  v_total      integer;
  v_filas      jsonb;
begin
  select empresa_id into v_empresa_id
  from public.perfiles
  where id = auth.uid();

  if v_empresa_id is null then
    return jsonb_build_object('error', 'El usuario no tiene empresa asociada.',
                              'total', 0, 'pedidos', '[]'::jsonb);
  end if;

  select count(*) into v_total
  from public.pedidos_calculadora
  where empresa_id = v_empresa_id;

  select coalesce(jsonb_agg(f order by f.fecha desc), '[]'::jsonb)
  into v_filas
  from (
    select
      p.id,
      p.fecha,
      p.proveedor_nombre,
      p.total_unidades,
      p.total_valor,
      p.obsequio_unidades,
      p.descuento_pct,
      p.notas,
      jsonb_array_length(coalesce(p.snapshot -> 'lineas', '[]'::jsonb)) as cantidad_lineas
    from public.pedidos_calculadora p
    where p.empresa_id = v_empresa_id
    order by p.fecha desc
    limit  greatest(coalesce(p_limit, 50), 1)
    offset greatest(coalesce(p_offset, 0), 0)
  ) f;

  return jsonb_build_object('total', v_total, 'pedidos', v_filas);

exception
  when others then
    return jsonb_build_object('error', SQLERRM, 'total', 0, 'pedidos', '[]'::jsonb);
end;
$function$;


-- -------------------------------------------------------------
-- fn_obtener_pedido_calculadora
--
-- El snapshot completo de un pedido. El filtro por empresa_id no es
-- decorativo: bajo DEFINER es lo unico que impide leer el pedido de
-- otra empresa pasando su id.
-- -------------------------------------------------------------
create or replace function public.fn_obtener_pedido_calculadora(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_empresa_id uuid;
  v_resultado  jsonb;
begin
  select empresa_id into v_empresa_id
  from public.perfiles
  where id = auth.uid();

  if v_empresa_id is null then
    return jsonb_build_object('error', 'El usuario no tiene empresa asociada.');
  end if;

  select jsonb_build_object(
           'id',                p.id,
           'fecha',             p.fecha,
           'proveedor_nombre',  p.proveedor_nombre,
           'total_unidades',    p.total_unidades,
           'total_valor',       p.total_valor,
           'obsequio_unidades', p.obsequio_unidades,
           'descuento_pct',     p.descuento_pct,
           'notas',             p.notas,
           'snapshot',          p.snapshot
         )
  into v_resultado
  from public.pedidos_calculadora p
  where p.id = p_id
    and p.empresa_id = v_empresa_id;

  if v_resultado is null then
    return jsonb_build_object('error', 'El pedido no existe o no pertenece a esta empresa.');
  end if;

  return v_resultado;

exception
  when others then
    return jsonb_build_object('error', SQLERRM);
end;
$function$;


-- =============================================================
-- 3. PERMISOS
--
-- En funciones SECURITY DEFINER conviene no dejarlas abiertas a public.
-- =============================================================

revoke execute on function public.fn_obtener_parametros_compra()          from public;
revoke execute on function public.fn_guardar_parametros_compra(jsonb)     from public;
revoke execute on function public.fn_guardar_pedido_calculadora(jsonb)    from public;
revoke execute on function public.fn_listar_pedidos_calculadora(int, int) from public;
revoke execute on function public.fn_obtener_pedido_calculadora(uuid)     from public;

grant execute on function public.fn_obtener_parametros_compra()          to authenticated;
grant execute on function public.fn_guardar_parametros_compra(jsonb)     to authenticated;
grant execute on function public.fn_guardar_pedido_calculadora(jsonb)    to authenticated;
grant execute on function public.fn_listar_pedidos_calculadora(int, int) to authenticated;
grant execute on function public.fn_obtener_pedido_calculadora(uuid)     to authenticated;

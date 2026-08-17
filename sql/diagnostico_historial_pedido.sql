-- =============================================================
-- diagnostico_historial_pedido
--
-- SOLO LECTURA. No modifica nada.
--
-- Objetivo: averiguar por que la columna "Demanda/dia" de la
-- Calculadora de Pedidos sale en 0.0 para todos los productos.
--
-- Con el modelo hibrido (el que viene por defecto) eso solo puede
-- pasar si el array 'ventas' de la RPC llega vacio, o si los
-- nombres de 'ventas' no coinciden con los de 'productos'.
--
-- Ejecutar bloque por bloque y comparar los conteos: el primero
-- que caiga a 0 senala el filtro culpable.
-- =============================================================


-- -------------------------------------------------------------
-- 1. Que devuelve HOY la RPC. Si 'ventas' = 0, el problema es
--    de datos/filtros (bloques 3 a 7). Si trae filas, el
--    problema es de nombres (bloque 8).
-- -------------------------------------------------------------
select
  json_array_length(datos -> 'productos')     as total_productos,
  json_array_length(datos -> 'ventas')        as total_ventas,
  json_array_length(datos -> 'dias_operacion') as total_dias_operacion
from (select public.datos_pedido_compra(null, 120) as datos) t;


-- -------------------------------------------------------------
-- 2. Una muestra del historial tal como lo recibe el navegador.
--    Verificar que 'unidades' no sea 0 y que 'fecha' sea legible.
-- -------------------------------------------------------------
select value as fila_de_ventas
from (select public.datos_pedido_compra(null, 120) as datos) t,
     lateral json_array_elements(t.datos -> 'ventas')
limit 5;


-- -------------------------------------------------------------
-- 3. Hay productos en modo stock? Si es 0, no hay historial que
--    calcular: todo seria bajo pedido.
-- -------------------------------------------------------------
select
  count(*) filter (where not coalesce(se_maneja_bajo_pedido, false)) as productos_modo_stock,
  count(*) filter (where coalesce(se_maneja_bajo_pedido, false))     as productos_bajo_pedido
from productos
where activo = true;


-- -------------------------------------------------------------
-- 4. Filtros del historial, quitados de a uno.
--    La primera columna que se desplome indica el culpable.
-- -------------------------------------------------------------
select
  count(*)                                                          as sin_ningun_filtro,
  count(*) filter (where v.fecha_venta >= current_date - 120)        as pasa_filtro_fecha,
  count(*) filter (where v.estado not in ('Anulada', 'Borrador'))    as pasa_filtro_estado_venta,
  count(*) filter (where dv.estado_item <> 'Anulada')                as pasa_filtro_estado_item,
  count(*) filter (where v.estado is null)                           as ventas_con_estado_null,
  count(*) filter (where dv.estado_item is null)                     as items_con_estado_item_null,
  count(*) filter (where v.fecha_venta is null)                      as ventas_sin_fecha
from detalles_venta dv
join ventas v on v.id = dv.id_venta;
-- OJO: 'estado_item is null' y 'estado is null' son trampas silenciosas.
-- En SQL, NULL <> 'Anulada' da NULL (no true), asi que esas filas se
-- excluyen del historial sin avisar.


-- -------------------------------------------------------------
-- 5. Rango real del historial. Si la venta mas reciente es
--    anterior a (hoy - 120 dias), el filtro de fecha lo vacia.
-- -------------------------------------------------------------
select
  min(v.fecha_venta::date)                    as venta_mas_antigua,
  max(v.fecha_venta::date)                    as venta_mas_reciente,
  current_date                                as hoy,
  current_date - 120                          as corte_120_dias,
  max(v.fecha_venta::date) < current_date - 120 as historial_fuera_de_ventana
from ventas v
where v.estado not in ('Anulada', 'Borrador');


-- -------------------------------------------------------------
-- 6. El historial reproducido exactamente como lo arma la RPC.
--    Si esto devuelve 0 filas, ya esta localizado el problema.
-- -------------------------------------------------------------
select count(*) as filas_de_historial
from detalles_venta dv
join ventas v    on v.id = dv.id_venta
join productos p on p.id_producto = dv.id_producto
where p.activo = true
  and not coalesce(p.se_maneja_bajo_pedido, false)
  and v.estado not in ('Anulada', 'Borrador')
  and dv.estado_item <> 'Anulada'
  and v.fecha_venta >= current_date - make_interval(days => 120);


-- -------------------------------------------------------------
-- 7. Igual que el 6 pero sin el filtro de fecha, para aislarlo.
-- -------------------------------------------------------------
select count(*) as filas_sin_filtro_de_fecha
from detalles_venta dv
join ventas v    on v.id = dv.id_venta
join productos p on p.id_producto = dv.id_producto
where p.activo = true
  and not coalesce(p.se_maneja_bajo_pedido, false)
  and v.estado not in ('Anulada', 'Borrador')
  and dv.estado_item <> 'Anulada';


-- -------------------------------------------------------------
-- 8b. RLS. ⚠️ CLAVE: el SQL Editor corre con un rol privilegiado
--     que SE SALTA el RLS. La RPC es 'security invoker', o sea
--     que corre como el usuario de la app CON RLS aplicado.
--     Por eso el editor puede ver miles de ventas y la app cero.
--
--     Si esta consulta devuelve numeros grandes pero la app
--     sigue en 0, el SQL es correcto y el culpable es una
--     politica de RLS sobre 'ventas' / 'detalles_venta'.
-- -------------------------------------------------------------
select
  json_array_length(public.datos_pedido_compra(null, 120) -> 'ventas')         as ventas_desde_editor,
  json_array_length(public.datos_pedido_compra(null, 120) -> 'dias_operacion') as dias_desde_editor;


-- -------------------------------------------------------------
-- 8c. Las politicas, lado a lado. Comparar 'productos' (que si
--     se lee desde la app) contra 'ventas' y 'detalles_venta'
--     (que no). Revisar que incluyan el rol 'authenticated' y
--     que la condicion USING no exija algo que el usuario de la
--     app no cumple.
-- -------------------------------------------------------------
select
  tablename,
  policyname,
  roles::text  as roles,
  cmd          as operacion,
  qual::text   as condicion_using,
  with_check::text as condicion_with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('ventas', 'detalles_venta', 'productos')
order by tablename, policyname;


-- Confirmar que RLS este realmente activo y si alguna tabla lo fuerza.
select relname as tabla, relrowsecurity as rls_activo, relforcerowsecurity as rls_forzado
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('ventas', 'detalles_venta', 'productos');


-- -------------------------------------------------------------
-- 9. Cruce de nombres. La calculadora empareja producto e
--    historial POR NOMBRE. Si aparece cualquier fila aqui, hay
--    productos de modo stock sin historial que los respalde.
--    Revisar espacios al inicio/final y mayusculas.
-- -------------------------------------------------------------
with productos_stock as (
  select p.id_producto, p.nombre_producto
  from productos p
  where p.activo = true
    and not coalesce(p.se_maneja_bajo_pedido, false)
),
con_historial as (
  select distinct dv.id_producto
  from detalles_venta dv
  join ventas v on v.id = dv.id_venta
  where v.estado not in ('Anulada', 'Borrador')
    and dv.estado_item <> 'Anulada'
    and v.fecha_venta >= current_date - make_interval(days => 120)
)
select
  ps.nombre_producto,
  '['   || ps.nombre_producto || ']'          as con_delimitadores,
  length(ps.nombre_producto)                  as largo,
  ps.nombre_producto <> trim(ps.nombre_producto) as tiene_espacios_sobrantes
from productos_stock ps
left join con_historial ch on ch.id_producto = ps.id_producto
where ch.id_producto is null
order by ps.nombre_producto;

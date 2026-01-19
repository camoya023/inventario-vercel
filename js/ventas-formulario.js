/**
 * =========================================================================
 * MÓDULO DE VENTAS - FORMULARIO
 * Gestión de formulario para crear/editar ventas
 * =========================================================================
 */

// ========================================
// VARIABLES GLOBALES
// ========================================
let totalesVentaActual = {
  subtotal: 0,
  cantidad: 0,
  envio: 0,
  impuestos: 0,
  descuento: 0,
  total: 0,
};

let modoEdicionVentas = {
  activo: false,
  idVenta: null,
};

let flatpickrInstance = null;
let cuentasBancariasDisponibles = [];

// ========================================
// FUNCIÓN PRINCIPAL DE CARGA
// ========================================
/**
 * Carga la vista del formulario de ventas
 * @param {string} modo - 'create' o 'edit'
 * @param {string} idVenta - UUID de la venta (solo para modo 'edit')
 */
async function cargarVistaFormularioVenta(modo = "create", idVenta = null) {
  console.log("[Ventas] Cargando formulario en modo:", modo);

  try {
    const workArea = document.querySelector(".work-area");
    if (!workArea) {
      throw new Error("No se encontró el área de trabajo");
    }

    // Mostrar indicador de carga
    workArea.innerHTML =
      '<div class="loading-spinner-container"><div class="loading-spinner"></div><p>Cargando formulario...</p></div>';

    // Cargar HTML del formulario
    const response = await fetch("/views/ventas-formulario.html");
    if (!response.ok)
      throw new Error("Error al cargar la vista del formulario");

    const html = await response.text();
    workArea.innerHTML = html;

    // Configurar modo de edición
    if (modo === "edit" && idVenta) {
      modoEdicionVentas = { activo: true, idVenta: idVenta };
      document.getElementById("titulo-formulario-venta").textContent =
        "Editar Venta";
    } else {
      modoEdicionVentas = { activo: false, idVenta: null };
      document.getElementById("titulo-formulario-venta").textContent =
        "Crear Nueva Venta";
    }

    // Inicializar formulario
    await inicializarFormularioVenta();

    // Si es modo edición, cargar datos
    if (modoEdicionVentas.activo) {
      await cargarDatosVentaParaEditar(idVenta);
    }
  } catch (error) {
    console.error("[Ventas] Error al cargar formulario:", error);
    toastr.error("Error al cargar formulario: " + error.message);
  }
}

/**
 * Inicializa el formulario de venta
 */
async function inicializarFormularioVenta() {
  console.log("[Ventas] Inicializando formulario...");

  try {
    // 1. Cargar datos necesarios
    await cargarDatosIniciales();

    // 2. Configurar event listeners
    configurarEventListenersFormularioVenta();

    // 3. Inicializar componentes (Select2, Flatpickr)
    inicializarComponentesExternosFormularioVenta();

    // 4. Disparar evento change del selector de estado
    $("#venta-estado").trigger("change");

    console.log("[Ventas] Formulario inicializado correctamente");
  } catch (error) {
    console.error("[Ventas] Error al inicializar formulario:", error);
    toastr.error("Error al inicializar formulario: " + error.message);
  }
}

// ========================================
// CARGAR DATOS
// ========================================
/**
 * Carga todos los datos iniciales necesarios
 */
async function cargarDatosIniciales() {
  console.log("[Ventas] Cargando datos iniciales (cuentas bancarias)...");

  try {
    const client = getSupabaseClient();

    // Consultar cuentas bancarias activas
    const { data, error } = await client
      .from("cuentas_bancarias_empresa")
      .select("*")
      .eq("activa", true)
      .order("nombre_cuenta", { ascending: true });

    if (error) throw error;

    cuentasBancariasDisponibles = data || [];
    console.log(
      "[Ventas] Cuentas bancarias cargadas:",
      cuentasBancariasDisponibles.length
    );
  } catch (error) {
    console.error("[Ventas] Error al cargar cuentas bancarias:", error);
    toastr.error("Error al cargar cuentas bancarias. Recarga la página.");
    cuentasBancariasDisponibles = [];
  }
}

/**
 * Carga los datos de una venta para editarla
 * Usa la RPC rpc_obtener_venta_para_editar que incluye datos en tiempo real del inventario
 */
async function cargarDatosVentaParaEditar(idVenta) {
  try {
    console.log("[Ventas] Cargando datos de venta para editar:", idVenta);

    const client = getSupabaseClient();
    const { data, error } = await client.rpc("rpc_obtener_venta_para_editar", {
      p_id_venta: idVenta,
    });

    if (error) throw error;
    if (!data) throw new Error("No se encontraron datos de la venta");

    console.log("[Ventas] Datos de venta recibidos:", data);

    // Poblar formulario con los datos extraídos (nueva estructura: data.venta, data.detalles)
    await poblarFormularioVentaEdicion(data);
  } catch (error) {
    console.error("[Ventas] Error al cargar datos:", error);
    toastr.error("Error al cargar datos de la venta: " + error.message);
    cargarPaginaVentas();
  }
}

/**
 * Pobla el formulario con los datos de una venta existente
 */
async function poblarFormularioVenta(datos) {
  console.log("[Ventas] Poblando formulario con datos...");

  // Cliente
  if (datos.clientes) {
    const nombreCliente =
      datos.clientes.razon_social ||
      `${datos.clientes.nombres} ${datos.clientes.apellidos}`.trim();
    const option = new Option(nombreCliente, datos.clientes.id, true, true);
    $("#select-cliente").append(option).trigger("change");

    // Cargar datos del cliente (incluyendo direcciones) y esperar a que termine
    const response = await obtenerDetallesClienteSupabase(datos.clientes.id);
    // Pasar la dirección de la venta para que se seleccione en lugar de la predeterminada
    renderizarDatosClienteEnFormularioVenta(
      response,
      datos.id_direccion_entrega
    );
  }

  // Fecha
  if (flatpickrInstance) {
    flatpickrInstance.setDate(moment(datos.fecha_venta).toDate());
  }

  // Estado
  $("#venta-estado").val(datos.estado).trigger("change");

  // Tipo de envío
  $("#venta-tipo-envio")
    .val(datos.tipo_envio || "Recogen")
    .trigger("change");

  // Nota: La dirección de entrega se selecciona automáticamente en renderizarDatosClienteEnFormularioVenta()

  // Costo de envío
  $("#venta-costo-envio").val(datos.costo_envio || 0);

  // Observaciones
  $("#venta-observaciones").val(datos.observaciones || "");

  // Detalles (productos)
  if (datos.detalles_venta && datos.detalles_venta.length > 0) {
    $("#carrito-tbody").find(".empty-cart-row").remove();

    for (const detalle of datos.detalles_venta) {
      // Usar el operador spread para copiar todos los campos del producto
      // incluyendo id_producto que está en detalle.productos
      const productoData = {
        ...detalle.productos,
        precio_venta_actual: detalle.precio_unitario_venta,
        costo_promedio: detalle.costo_unitario_venta || 0,
      };

      agregarProductoAlCarrito(productoData, detalle.cantidad);

      // Actualizar valores específicos (descuento)
      const fila = $(
        `#carrito-tbody tr[data-id-producto="${productoData.id_producto}"]`
      );
      fila.find(".input-descuento").val(detalle.porcentaje_descuento || 0);
    }

    actualizarResumenGeneral();
  }

  // Pagos (si existen)
  if (datos.pagos_venta && datos.pagos_venta.length > 0) {
    $("#payments-container").empty();
    datos.pagos_venta.forEach((pago) => {
      agregarFilaDePago(
        pago.monto,
        pago.metodo_pago,
        pago.id_cuenta_bancaria_destino
      );
    });
  }

  console.log("[Ventas] Formulario poblado correctamente");
}

/**
 * Pobla el formulario con datos de la RPC rpc_obtener_venta_para_editar
 * Esta función maneja la nueva estructura que incluye datos de stock en tiempo real
 * @param {Object} data - { venta: {..., cliente: {...}}, detalles: [...] }
 */
async function poblarFormularioVentaEdicion(data) {
  console.log("[Ventas] Poblando formulario con datos de edición...");

  const venta = data.venta;
  const detalles = data.detalles;

  // Determinar si mostrar detalles logísticos según estado de la venta
  const estadosActivos = ["Borrador", "Pendiente"];
  const mostrarDetallesLogisticos = estadosActivos.includes(venta.estado);

  // Cliente (viene anidado en venta.cliente)
  if (venta.cliente) {
    const nombreCliente =
      venta.cliente.razon_social ||
      `${venta.cliente.nombres || ""} ${venta.cliente.apellidos || ""}`.trim() ||
      venta.cliente.nombre;
    const option = new Option(nombreCliente, venta.id_cliente, true, true);
    $("#select-cliente").append(option).trigger("change");

    // Cargar datos del cliente (incluyendo direcciones)
    const response = await obtenerDetallesClienteSupabase(venta.id_cliente);
    renderizarDatosClienteEnFormularioVenta(response, venta.id_direccion_entrega);
  }

  // Fecha
  if (flatpickrInstance && venta.fecha_venta) {
    flatpickrInstance.setDate(moment(venta.fecha_venta).toDate());
  }

  // Estado
  if (venta.estado) {
    $("#venta-estado").val(venta.estado).trigger("change");
  }

  // Tipo de envío
  $("#venta-tipo-envio")
    .val(venta.tipo_envio || "Recogen")
    .trigger("change");

  // Costo de envío
  $("#venta-costo-envio").val(venta.costo_envio || 0);

  // Observaciones
  $("#venta-observaciones").val(venta.observaciones || "");

  // Detalles (productos) con información de stock pendiente
  if (detalles && detalles.length > 0) {
    $("#carrito-tbody").find(".empty-cart-row").remove();

    for (const detalle of detalles) {
      // Construir objeto producto con datos del detalle
      const productoData = {
        id_producto: detalle.id_producto,
        nombre_producto: detalle.nombre_producto || detalle.productos?.nombre_producto,
        precio_venta_actual: detalle.precio_unitario_venta,
        costo_promedio: detalle.costo_unitario_venta || 0,
        id_tipo_impuesto: detalle.id_tipo_impuesto,
        tipos_impuesto: detalle.tipos_impuesto || { porcentaje: detalle.porcentaje_impuesto || 0 },
      };

      // Agregar producto al carrito (mostrar logística solo si estado activo)
      agregarProductoAlCarritoEdicion(productoData, detalle, mostrarDetallesLogisticos);
    }

    actualizarResumenGeneral();
  }

  // Pagos (si existen en la respuesta)
  if (venta.pagos_venta && venta.pagos_venta.length > 0) {
    $("#payments-container").empty();
    venta.pagos_venta.forEach((pago) => {
      agregarFilaDePago(
        pago.monto,
        pago.metodo_pago,
        pago.id_cuenta_bancaria_destino
      );
    });
  }

  console.log("[Ventas] Formulario de edición poblado correctamente");
}

/**
 * Agrega un producto al carrito en modo edición, mostrando información de cantidades y alertas
 * @param {Object} producto - Datos del producto
 * @param {Object} detalle - Detalle con cantidad_solicitada, cantidad_reservada, cantidad_pendiente, alerta_stock
 * @param {boolean} mostrarDetallesLogisticos - Si true, muestra badges de stock (solo para estados activos)
 */
function agregarProductoAlCarritoEdicion(producto, detalle, mostrarDetallesLogisticos = true) {
  const carritoBody = $("#carrito-tbody");
  const idProducto = producto.id_producto;

  // Eliminar fila vacía si existe
  carritoBody.find(".empty-cart-row").remove();

  const porcentajeImpuesto = producto.tipos_impuesto?.porcentaje || 0;
  const idTipoImpuesto = producto.id_tipo_impuesto || null;

  // Extraer datos de cantidades
  const cantidadSolicitada = detalle.cantidad_solicitada || detalle.cantidad || 0;
  const stockDisponibleActual = detalle.stock_disponible_actual || 0;
  const cantidadReservadaBD = detalle.cantidad_reservada || 0;

  // Usar contenedor dinámico para que los badges se actualicen al cambiar cantidad
  const nuevaFilaHtml = `
    <tr data-id-producto="${idProducto}" data-id-tipo-impuesto="${idTipoImpuesto || ""}" data-costo-unitario="${producto.costo_promedio || 0}" data-stock-disponible="${stockDisponibleActual}" data-reservada-bd="${cantidadReservadaBD}">
      <td>
        <div class="producto-nombre-carrito">${producto.nombre_producto}</div>
        <div class="reserva-control-container"></div>
      </td>
      <td><input type="number" class="form-input-table text-right input-cantidad" value="${cantidadSolicitada}" min="1"></td>
      <td><input type="number" class="form-input-table text-right input-precio" value="${producto.precio_venta_actual}" step="0.01" min="0"></td>
      <td><input type="number" class="form-input-table text-right input-descuento" value="${detalle.porcentaje_descuento || 0}" min="0" max="100" step="0.01"></td>
      <td><input type="number" class="form-input-table text-right input-impuesto" value="${porcentajeImpuesto}" min="0" max="100" step="0.01"></td>
      <td class="text-right total-linea">$0.00</td>
      <td class="text-center">
        <button class="button-icon-danger delete-item-btn"><i class="fas fa-trash-alt"></i></button>
      </td>
    </tr>
  `;
  carritoBody.prepend(nuevaFilaHtml);

  // Si se deben mostrar detalles logísticos, actualizar switch/badges dinámicamente
  if (mostrarDetallesLogisticos) {
    const nuevaFila = carritoBody.find(`tr[data-id-producto="${idProducto}"]`);
    actualizarSwitchReserva(nuevaFila);
  }
}

/**
 * Genera el HTML de los badges de estado de stock para mostrar debajo del nombre del producto
 * Diseño compacto sin separadores verticales, mostrando stock real de bodega
 * @param {number} reservada - Cantidad ya reservada
 * @param {number} pendiente - Cantidad pendiente de reservar
 * @param {number} stockDisponible - Stock libre en bodega actualmente
 * @returns {string} HTML con los badges
 */
function generarBadgesEstadoStock(reservada, pendiente, stockDisponible) {
  // Si no hay pendientes, mostrar solo reservado con check verde
  if (pendiente <= 0) {
    return `
      <div class="stock-info-line">
        <span class="stock-text stock-text-reservado">
          <i class="fas fa-check-circle"></i> Res: <strong>${reservada}</strong>
        </span>
      </div>
    `;
  }

  // Hay cantidades pendientes - determinar color del stock en bodega
  const haySuficienteStock = stockDisponible >= pendiente;
  const stockColor = haySuficienteStock ? "stock-text-disponible" : "stock-text-sin-stock";
  const stockIcon = haySuficienteStock
    ? '<i class="fas fa-check-circle"></i>'
    : '<i class="fas fa-times-circle"></i>';

  return `
    <div class="stock-info-line">
      <span class="stock-text stock-text-muted">
        <i class="fas fa-box"></i> Res: <strong>${reservada}</strong>
      </span>
      <span class="stock-text stock-text-pendiente">
        <i class="fas fa-clock"></i> Pend: <strong>${pendiente}</strong>
      </span>
      <span class="stock-text ${stockColor}">
        ${stockIcon} Disp: <strong>${stockDisponible}</strong>
      </span>
    </div>
  `;
}

// ========================================
// EVENT LISTENERS
// ========================================
function configurarEventListenersFormularioVenta() {
  console.log("[Ventas] Configurando event listeners del formulario...");

  // Botón Guardar
  const btnGuardar = document.getElementById("btn-guardar-venta");
  if (btnGuardar) {
    btnGuardar.addEventListener("click", guardarVenta);
  }

  // Botón Cancelar
  const btnCancelar = document.getElementById("btn-cancelar-venta");
  if (btnCancelar) {
    btnCancelar.addEventListener("click", () => {
      mostrarModalConfirmacion(
        "Se perderán todos los datos no guardados de esta venta.",
        () => {
          cargarPaginaVentas();
        },
        "¿Cancelar operación?"
      );
    });
  }

  // Listener para Select2 de Cliente
  $("#select-cliente").on("select2:select", async function (e) {
    const clienteId = e.params.data.id;

    // Resetear campos
    resetearCamposDeVenta();

    const infoCard = document.getElementById("cliente-info-card");

    if (clienteId && clienteId !== "mostrador") {
      infoCard.style.display = "block";
      infoCard.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Cargando datos del cliente...';

      const response = await obtenerDetallesClienteSupabase(clienteId);
      renderizarDatosClienteEnFormularioVenta(response);
    } else {
      infoCard.style.display = "none";
      infoCard.innerHTML = "";
      $("#direccion-container").hide();
      $("#venta-direccion")
        .empty()
        .append("<option>Seleccione una dirección...</option>");
    }
  });

  $("#select-cliente").on("select2:clear", function () {
    resetearFormularioCompleto();
  });

  // Listener para tipo de envío
  $("#venta-tipo-envio")
    .off("change")
    .on("change", function () {
      const esDomicilio = this.value === "Domicilio";
      const direccionContainer = $("#direccion-container");
      const costoEnvioContainer = $("#costo-envio-container");

      costoEnvioContainer.toggle(esDomicilio);

      if (esDomicilio) {
        const idCliente = $("#select-cliente").val();
        if (!idCliente || idCliente === "mostrador") {
          toastr.warning("Por favor, selecciona un cliente válido primero.");
          $(this).val("Recogen");
          costoEnvioContainer.hide();
          return;
        }
        direccionContainer.show();
      } else {
        direccionContainer.hide();
        $("#venta-costo-envio").val(0).trigger("input");
        $("#venta-direccion").val(null);
      }
    });

  // Listener para estado de venta
  $("#venta-estado").on("change", function () {
    const esCompletado = this.value === "Completado";
    const paymentsContainer = $("#payments-container");

    $("#seccion-pagos").css("display", esCompletado ? "block" : "none");

    if (esCompletado && paymentsContainer.children().length === 0) {
      agregarFilaDePago();
    }

    let textoBoton = "Guardar Venta";
    if (this.value === "Borrador") {
      textoBoton = "Guardar Borrador";
    } else if (esCompletado) {
      textoBoton = "Finalizar y Guardar Venta";
    }
    $("#btn-guardar-venta").text(textoBoton);

    // Actualizar switches de reserva en todas las filas del carrito
    actualizarTodosSwitchesReserva();
  });

  // Listener para costo de envío
  $("#venta-costo-envio").on("input", function () {
    console.log("Costo de envío ha cambiado, recalculando totales...");
    actualizarResumenGeneral();
  });

  // Listener para búsqueda de productos
  $("#buscar-producto").on("keyup", buscarYRenderizarProductos);

  // Listener para hacer clic en un resultado
  $("#product-search-results").on("click", ".result-item", function () {
    const productoData = $(this).data("producto");
    if (productoData) {
      agregarProductoAlCarrito(productoData);
    }
  });

  // Listener para las interacciones dentro del carrito
  $("#carrito-tbody").on("click input change", function (event) {
    const target = $(event.target);

    if (target.closest(".delete-item-btn").length) {
      target.closest("tr").remove();
      if ($("#carrito-tbody tr").not(".empty-cart-row").length === 0) {
        $("#carrito-tbody").html(
          '<tr class="empty-cart-row"><td colspan="7">Aún no has agregado productos.</td></tr>'
        );
      }
      actualizarResumenGeneral();
    }

    if (
      target.is(
        ".input-cantidad, .input-precio, .input-descuento, .input-impuesto"
      )
    ) {
      actualizarResumenGeneral();

      // Si cambió la cantidad, actualizar switch de reserva
      if (target.is(".input-cantidad")) {
        const fila = target.closest("tr");
        actualizarSwitchReserva(fila);
      }
    }

    // Listener para switch de reservar stock
    if (target.is(".switch-reservar-stock")) {
      const fila = target.closest("tr");
      const reservarDisponibles = target.prop("checked");
      recalcularDistribucionFila(fila, reservarDisponibles);
    }
  });

  // Auto-seleccionar texto al hacer foco
  $("#carrito-tbody").on("focus", "input", function () {
    $(this).select();
  });

  // Configurar listeners de pagos
  configurarListenersDePagos();

  console.log("[Ventas] Event listeners configurados");
}

/**
 * Configura todos los listeners relacionados con la sección de pagos
 */
function configurarListenersDePagos() {
  console.log("Configurando listeners para la sección de Pagos...");

  const paymentsContainer = $("#payments-container");
  const btnAgregarPago = $("#btn-agregar-pago");

  // Listener delegado para las filas de pago
  if (paymentsContainer.length > 0) {
    paymentsContainer.on("input click change", function (event) {
      const target = $(event.target);

      // Caso A: Cambio en monto de pago
      if (event.type === "input" && target.hasClass("payment-amount-input")) {
        console.log("Monto de pago modificado. Recalculando...");
        target.attr("data-edited", "true");

        const totalVenta =
          parseFloat(
            $("#summary-total")
              .text()
              .replace(/[^0-9]+/g, "")
          ) || 0;
        let totalPagadoActual = 0;
        paymentsContainer.find(".payment-amount-input").each(function () {
          totalPagadoActual += parseFloat($(this).val()) || 0;
        });

        if (totalPagadoActual > totalVenta) {
          const excedente = totalPagadoActual - totalVenta;
          const valorActualInput = parseFloat(target.val()) || 0;
          target.val(valorActualInput - excedente);
          toastr.warning(
            "El monto pagado no puede exceder el total de la venta.",
            "Monto Ajustado"
          );
        }

        actualizarResumenDePagos();
      }

      // Caso B: Eliminar pago
      else if (
        event.type === "click" &&
        target.closest(".delete-payment-btn").length
      ) {
        console.log("Eliminando fila de pago y recalculando...");
        target.closest(".payment-row").remove();
        actualizarResumenDePagos();
      }

      // Caso C: Cambio de método de pago
      else if (
        event.type === "change" &&
        target.hasClass("metodo-pago-select")
      ) {
        console.log("Método de pago cambiado a:", target.val());
        const filaActual = target.closest(".payment-row");
        const contenedorCuenta = filaActual.find(".cuenta-destino-container");
        const metodosConCuenta = ["Transferencia"];

        if (metodosConCuenta.includes(target.val())) {
          if (cuentasBancariasDisponibles.length > 0) {
            contenedorCuenta.show();
          } else {
            toastr.warning(
              "No hay cuentas bancarias configuradas para recibir este tipo de pago."
            );
            target.val("Efectivo");
          }
        } else {
          contenedorCuenta.hide();
        }
      }
    });
  }

  // Listener para agregar otro pago
  if (btnAgregarPago.length > 0) {
    btnAgregarPago.on("click", function () {
      console.log("Botón 'Agregar otro pago' presionado.");
      agregarFilaDePago();
    });
  }
}

// ========================================
// INICIALIZACIÓN DE COMPONENTES
// ========================================
function inicializarComponentesExternosFormularioVenta() {
  console.log("[Ventas] Inicializando componentes externos...");

  // Flatpickr para fecha
  if (typeof flatpickr !== "undefined") {
    flatpickrInstance = flatpickr("#venta-fecha", {
      locale: "es",
      enableTime: false,
      dateFormat: "Y-m-d",
      altInput: true,
      altFormat: "d/m/Y",
      defaultDate: "today",
    });
  }

  // Select2 para Clientes
  if (typeof $.fn.select2 !== "undefined") {
    $("#select-cliente").select2({
      placeholder: "Busque un cliente (mínimo 3 letras)...",
      allowClear: true,
      minimumInputLength: 3,
      language: {
        inputTooShort: function () {
          return "Por favor, escribe 3 o más caracteres para buscar...";
        },
        searching: function () {
          return "Buscando clientes...";
        },
        noResults: function () {
          return "No se encontraron clientes";
        },
      },
      ajax: {
        delay: 350,
        transport: async function (params, success, failure) {
          try {
            const termino = params.data.term || "";
            console.log(`[Ventas] Buscando clientes con término: "${termino}"`);

            const client = getSupabaseClient();

            const { data, error } = await client
              .from("clientes")
              .select("id, codigo_cliente, nombres, apellidos, razon_social")
              .or(
                `nombres.ilike.%${termino}%,apellidos.ilike.%${termino}%,razon_social.ilike.%${termino}%,codigo_cliente.ilike.%${termino}%`
              )
              .eq("estado", "Activo")
              .order("nombres", { ascending: true })
              .limit(20);

            if (error) {
              console.error("[Ventas] Error al buscar clientes:", error);
              failure();
              return;
            }

            const resultados = (data || []).map((cliente) => ({
              id: cliente.id,
              text:
                cliente.razon_social ||
                `${cliente.nombres} ${cliente.apellidos}`.trim(),
              codigo: cliente.codigo_cliente,
            }));

            console.log("[Ventas] Clientes encontrados:", resultados.length);
            success({ results: resultados });
          } catch (error) {
            console.error("[Ventas] Error en búsqueda de clientes:", error);
            failure();
          }
          return { abort: () => {} };
        },
      },
    });

    // Auto-focus en Select2
    $("#select-cliente").on("select2:open", function () {
      setTimeout(() => {
        const searchField = document.querySelector(".select2-search__field");
        if (searchField) searchField.focus();
      }, 100);
    });
  }

  console.log("[Ventas] Componentes externos inicializados");
}

// ========================================
// GESTIÓN DE CLIENTE
// ========================================
/**
 * Obtiene los detalles de un cliente usando Supabase
 */
async function obtenerDetallesClienteSupabase(clienteId) {
  try {
    console.log("[Ventas] Obteniendo detalles del cliente:", clienteId);

    const client = getSupabaseClient();

    const { data: cliente, error } = await client
      .from("clientes")
      .select(
        `
                *,
                direcciones_cliente(
                    id,
                    nombre_referencia_direccion,
                    direccion_completa,
                    barrio,
                    ciudad_municipio,
                    departamento_estado,
                    indicaciones_adicionales,
                    es_direccion_envio_predeterminada
                )
            `
      )
      .eq("id", clienteId)
      .single();

    if (error) {
      console.error("[Ventas] Error al obtener cliente:", error);
      return {
        exito: false,
        mensaje: "No se pudo cargar la información del cliente",
      };
    }

    console.log("[Ventas] Cliente obtenido:", cliente);

    return {
      exito: true,
      datos: cliente,
    };
  } catch (error) {
    console.error("[Ventas] Error en obtenerDetallesClienteSupabase:", error);
    return {
      exito: false,
      mensaje: "Error al cargar los datos del cliente",
    };
  }
}

/**
 * Renderiza los datos del cliente en la tarjeta de información
 * @param {Object} response - Respuesta con los datos del cliente
 * @param {string} idDireccionASeleccionar - ID de la dirección a seleccionar (opcional)
 */
function renderizarDatosClienteEnFormularioVenta(
  response,
  idDireccionASeleccionar = null
) {
  const infoCard = document.getElementById("cliente-info-card");

  if (!response.exito) {
    infoCard.innerHTML = `<p class="text-danger">${response.mensaje}</p>`;
    return;
  }

  const cliente = response.datos;
  const nombreCompleto =
    cliente.razon_social ||
    `${cliente.nombres || ""} ${cliente.apellidos || ""}`.trim();

  const infoCardHtml = `
        <div class="info-grid">
            <div class="info-item"><strong>Cliente:</strong><span>${nombreCompleto}</span></div>
            <div class="info-item"><strong>Código:</strong><span>${
              cliente.codigo_cliente || "N/A"
            }</span></div>
            <div class="info-item"><strong>Saldo:</strong><span class="text-danger">${formatearMoneda(
              cliente.saldo_pendiente || 0
            )}</span></div>
            <div class="info-item"><strong>Celular:</strong><span>${
              cliente.telefono_principal || "N/A"
            }</span></div>
            ${
              cliente.notas_internas
                ? `
                <div class="info-item-full">
                    <strong>Notas sobre el cliente:</strong>
                    <span>${cliente.notas_internas}</span>
                </div>
            `
                : ""
            }
        </div>
    `;
  infoCard.innerHTML = infoCardHtml;

  // Poblar direcciones
  const selectDireccion = $("#venta-direccion");
  selectDireccion
    .empty()
    .append('<option value="">Seleccione una dirección...</option>');

  console.log(
    "[Ventas] Renderizando direcciones. Total:",
    cliente.direcciones_cliente?.length || 0
  );

  if (cliente.direcciones_cliente && cliente.direcciones_cliente.length > 0) {
    let idDireccionPredeterminada = null;

    cliente.direcciones_cliente.forEach((dir) => {
      const textoOpcion = `${dir.nombre_referencia_direccion || "Dirección"}: ${
        dir.direccion_completa
      }, ${dir.barrio || ""} (${dir.ciudad_municipio})`;
      const opcion = new Option(textoOpcion, dir.id);
      selectDireccion.append(opcion);

      if (dir.es_direccion_envio_predeterminada) {
        idDireccionPredeterminada = dir.id;
      }
    });

    // Si se especificó una dirección a seleccionar (modo edición), usar esa
    // De lo contrario, usar la predeterminada (modo creación)
    const direccionASeleccionar =
      idDireccionASeleccionar || idDireccionPredeterminada;
    if (direccionASeleccionar) {
      selectDireccion.val(direccionASeleccionar).trigger("change");
      console.log("[Ventas] Dirección seleccionada:", direccionASeleccionar);
    }
  } else {
    selectDireccion.append(
      '<option value="" disabled>Este cliente no tiene direcciones registradas.</option>'
    );
  }
}

// ========================================
// BÚSQUEDA DE PRODUCTOS
// ========================================
/**
 * Función de debounce para búsqueda
 */
function debounce(func, delay) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}

/**
 * Busca y renderiza productos
 */
const buscarYRenderizarProductos = debounce(async function () {
  console.log("[Ventas] Iniciando búsqueda de productos...");
  const termino = $("#buscar-producto").val();
  const resultsContainer = $("#product-search-results");

  if (termino.length < 3) {
    resultsContainer.hide().empty();
    console.log("[Ventas] Término muy corto, búsqueda cancelada.");
    return;
  }

  resultsContainer.show().html('<div class="result-item">Buscando...</div>');

  try {
    const client = getSupabaseClient();

    const { data: productos, error } = await client
      .from("productos")
      .select(
        `
                id_producto,
                nombre_producto,
                sku,
                stock_disponible,
                precio_venta_actual,
                costo_promedio,
                id_tipo_impuesto,
                tipos_impuesto(porcentaje)
            `
      )
      .or(`nombre_producto.ilike.%${termino}%,sku.ilike.%${termino}%`)
      .eq("activo", true)
      .order("nombre_producto", { ascending: true })
      .limit(20);

    console.log("[Ventas] Productos encontrados:", productos);

    if (error) {
      console.error("[Ventas] Error al buscar productos:", error);
      resultsContainer.html(
        '<div class="result-item">Error al buscar productos.</div>'
      );
      return;
    }

    resultsContainer.empty();

    if (productos && productos.length > 0) {
      productos.forEach((producto) => {
        const productoDataString = JSON.stringify(producto).replace(
          /'/g,
          "&apos;"
        );
        const itemHtml = `
                    <div class='result-item' data-producto='${productoDataString}'>
                        <div class="product-name">${
                          producto.nombre_producto
                        }</div>
                        <div class="product-details">SKU: ${
                          producto.sku
                        } | Disponible: ${producto.stock_disponible || 0}</div>
                    </div>
                `;
        resultsContainer.append(itemHtml);
      });
    } else {
      resultsContainer.html(
        '<div class="result-item">No se encontraron productos.</div>'
      );
    }
  } catch (error) {
    console.error("[Ventas] Error en búsqueda de productos:", error);
    resultsContainer.html(
      '<div class="result-item">Error al buscar productos.</div>'
    );
  }
}, 350);

// ========================================
// GESTIÓN DEL CARRITO
// ========================================
/**
 * Agrega un producto al carrito
 * Incluye lógica de switch para reservar stock cuando estado=Pendiente
 */
function agregarProductoAlCarrito(producto, cantidadInicial = 1) {
  const carritoBody = $("#carrito-tbody");
  const idProducto = producto.id_producto;
  const stockDisponible = producto.stock_disponible || 0;

  const filaExistente = carritoBody.find(
    `tr[data-id-producto="${idProducto}"]`
  );

  if (filaExistente.length > 0) {
    console.log("Producto ya existe, incrementando cantidad...");
    const inputCantidad = filaExistente.find(".input-cantidad");
    let cantidadActual = parseInt(inputCantidad.val()) || 0;
    inputCantidad.val(cantidadActual + 1);
    inputCantidad.trigger("input");
    inputCantidad.focus().select();
    // Actualizar switch de reserva si es necesario
    actualizarSwitchReserva(filaExistente);
  } else {
    console.log("Producto nuevo, agregando al carrito...");
    carritoBody.find(".empty-cart-row").remove();

    const porcentajeImpuesto = producto.tipos_impuesto?.porcentaje || 0;
    const idTipoImpuesto = producto.id_tipo_impuesto || null;

    const nuevaFilaHtml = `
            <tr data-id-producto="${idProducto}" data-id-tipo-impuesto="${
      idTipoImpuesto || ""
    }" data-costo-unitario="${producto.costo_promedio || 0}" data-stock-disponible="${stockDisponible}">
                <td>
                  <div class="producto-nombre-carrito">${producto.nombre_producto}</div>
                  <div class="reserva-control-container"></div>
                </td>
                <td><input type="number" class="form-input-table text-right input-cantidad" value="${cantidadInicial}" min="1"></td>
                <td><input type="number" class="form-input-table text-right input-precio" value="${
                  producto.precio_venta_actual
                }" step="0.01" min="0"></td>
                <td><input type="number" class="form-input-table text-right input-descuento" value="0" min="0" max="100" step="0.01"></td>
                <td><input type="number" class="form-input-table text-right input-impuesto" value="${porcentajeImpuesto}" min="0" max="100" step="0.01"></td>
                <td class="text-right total-linea">$0.00</td>
                <td class="text-center">
                    <button class="button-icon-danger delete-item-btn"><i class="fas fa-trash-alt"></i></button>
                </td>
            </tr>
        `;
    carritoBody.prepend(nuevaFilaHtml);

    const nuevaFila = carritoBody.find(`tr[data-id-producto="${idProducto}"]`);
    const inputCantidadNuevo = nuevaFila.find(".input-cantidad");
    inputCantidadNuevo.focus().select();

    // Verificar si mostrar switch de reserva
    actualizarSwitchReserva(nuevaFila);
  }

  $("#product-search-results").hide().empty();
  $("#buscar-producto").val("");

  actualizarResumenGeneral();
}

/**
 * Actualiza el switch de reserva según estado de venta y cantidad vs stock
 */
function actualizarSwitchReserva(fila) {
  const estadoVenta = $("#venta-estado").val();
  const esEstadoPendiente = estadoVenta === "Pendiente";
  const cantidad = parseInt(fila.find(".input-cantidad").val()) || 0;
  const stockDisponible = parseInt(fila.attr("data-stock-disponible")) || 0;
  const container = fila.find(".reserva-control-container");
  const idProducto = fila.attr("data-id-producto");

  // Obtener cantidad reservada guardada en BD (solo existe en modo edición)
  const reservadaBDAttr = fila.attr("data-reservada-bd");
  const esProductoDeEdicion = reservadaBDAttr !== undefined;
  const cantidadReservadaBD = parseFloat(reservadaBDAttr) || 0;

  // Limpiar contenedor
  container.empty();

  // Solo mostrar si estado=Pendiente y cantidad > stock
  if (esEstadoPendiente && cantidad > stockDisponible) {

    // CASO 1: Stock = 0, no mostrar switch, solo aviso
    if (stockDisponible <= 0) {
      container.html(`
        <div class="stock-info-line">
          <span class="stock-text stock-text-sin-stock">
            <i class="fas fa-exclamation-circle"></i> Sin stock (Quedará pendiente)
          </span>
        </div>
      `);
      // Guardar valores: todo pendiente
      fila.attr("data-cantidad-reservar", 0);
      fila.attr("data-cantidad-pendiente", cantidad);
      return;
    }

    // CASO 2: Hay stock parcial, mostrar switch solo y badges debajo
    // Determinar estado inicial del switch:
    // - Si es producto de edición: ON solo si cantidadReservadaBD > 0
    // - Si es producto nuevo: ON por defecto (hay stock disponible)
    let switchChecked = true;
    if (esProductoDeEdicion) {
      switchChecked = cantidadReservadaBD > 0;
    }

    const switchId = `switch-reservar-${idProducto}`;
    const switchHtml = `
      <div class="form-check form-switch reserva-switch-solo">
        <input class="form-check-input switch-reservar-stock" type="checkbox" id="${switchId}" ${switchChecked ? 'checked' : ''}>
      </div>
      <div class="stock-badges-dinamicos"></div>
    `;
    container.html(switchHtml);

    // Actualizar badges inicial según estado del switch
    recalcularDistribucionFila(fila, switchChecked);

  } else if (esEstadoPendiente && cantidad > 0 && stockDisponible >= cantidad) {
    // Hay suficiente stock
    container.html(`
      <div class="stock-info-line">
        <span class="stock-text stock-text-reservado">
          <i class="fas fa-check-circle"></i> Res: <strong>${cantidad}</strong>
        </span>
      </div>
    `);
    // Guardar valores: todo reservado
    fila.attr("data-cantidad-reservar", cantidad);
    fila.attr("data-cantidad-pendiente", 0);
  }
}

/**
 * Recalcula la distribución de reserva para una fila específica
 * Actualiza los badges dinámicos en lugar de texto largo
 */
function recalcularDistribucionFila(fila, reservarDisponibles) {
  const cantidad = parseInt(fila.find(".input-cantidad").val()) || 0;
  const stockDisponible = parseInt(fila.attr("data-stock-disponible")) || 0;
  const badgesContainer = fila.find(".stock-badges-dinamicos");

  let cantidadReservar, cantidadPendiente;

  if (reservarDisponibles) {
    // Switch ON: reservar lo disponible
    cantidadReservar = Math.min(stockDisponible, cantidad);
    cantidadPendiente = cantidad - cantidadReservar;
  } else {
    // Switch OFF: no reservar nada
    cantidadReservar = 0;
    cantidadPendiente = cantidad;
  }

  // Guardar valores en data attributes para usar al guardar
  fila.attr("data-cantidad-reservar", cantidadReservar);
  fila.attr("data-cantidad-pendiente", cantidadPendiente);

  // Actualizar badges con Disp, Res y Pend
  const badgesHtml = `
    <div class="stock-info-line">
      <span class="stock-text stock-text-disponible">
        <i class="fas fa-warehouse"></i> Disp: <strong>${stockDisponible}</strong>
      </span>
      <span class="stock-text ${cantidadReservar > 0 ? 'stock-text-reservado' : 'stock-text-muted'}">
        <i class="fas fa-box"></i> Res: <strong>${cantidadReservar}</strong>
      </span>
      <span class="stock-text stock-text-pendiente">
        <i class="fas fa-clock"></i> Pend: <strong>${cantidadPendiente}</strong>
      </span>
    </div>
  `;
  badgesContainer.html(badgesHtml);
}

/**
 * Actualiza todos los switches de reserva en el carrito
 * Se llama cuando cambia el estado de la venta
 */
function actualizarTodosSwitchesReserva() {
  $("#carrito-tbody tr").not(".empty-cart-row").each(function () {
    actualizarSwitchReserva($(this));
  });
}

// ========================================
// CÁLCULO DE TOTALES (SIN DESCUENTO GLOBAL)
// ========================================
/**
 * Calcula todos los totales de la venta y actualiza la UI
 * IMPORTANTE: NO incluye descuento global, solo descuentos por línea
 */
function actualizarResumenGeneral() {
  console.log("Recalculando todos los totales...");
  const carritoBody = $("#carrito-tbody");
  let subtotalGeneral = 0;
  let impuestosGeneral = 0;
  let cantidadTotal = 0;
  let descuentosLineas = 0;

  // Recorremos el carrito para calcular totales de productos
  carritoBody
    .find("tr")
    .not(".empty-cart-row")
    .each(function () {
      const fila = $(this);
      const cantidad = parseFloat(fila.find(".input-cantidad").val()) || 0;
      const precioUnitario = parseFloat(fila.find(".input-precio").val()) || 0;
      const porcentajeDescuento =
        parseFloat(fila.find(".input-descuento").val()) || 0;
      const porcentajeImpuesto =
        parseFloat(fila.find(".input-impuesto").val()) || 0;

      // Cálculos:
      // 1. Subtotal línea = Precio × Cantidad
      const subtotalLinea = cantidad * precioUnitario;

      // 2. Descuento línea = Subtotal × % descuento ÷ 100
      const montoDescuentoLinea =
        Math.round(((subtotalLinea * porcentajeDescuento) / 100) * 100) / 100;

      // 3. Base gravable = Subtotal - Descuento
      const baseGravable = subtotalLinea - montoDescuentoLinea;

      // 4. Impuesto línea = Base gravable × % impuesto ÷ 100
      const montoImpuestoLinea =
        Math.round(((baseGravable * porcentajeImpuesto) / 100) * 100) / 100;

      // 5. Total línea = Base gravable + Impuesto
      const totalLinea = baseGravable + montoImpuestoLinea;

      // Actualizar UI de la línea
      fila.find(".total-linea").text(formatearMoneda(totalLinea));

      // Acumular totales generales
      subtotalGeneral += subtotalLinea;
      impuestosGeneral += montoImpuestoLinea;
      cantidadTotal += cantidad;
      descuentosLineas += montoDescuentoLinea;
    });

  // Obtener costo de envío
  const costoEnvio = parseFloat($("#venta-costo-envio").val()) || 0;

  // Calcular gran total
  // TOTAL = Subtotal - Descuentos por línea + Impuestos + Envío
  const granTotal =
    subtotalGeneral - descuentosLineas + impuestosGeneral + costoEnvio;

  // Guardar en objeto global
  totalesVentaActual = {
    subtotal: subtotalGeneral,
    cantidad: cantidadTotal,
    envio: costoEnvio,
    impuestos: impuestosGeneral,
    descuento: descuentosLineas, // Solo descuentos por línea
    total: granTotal,
  };

  // Actualizar interfaz visual
  $("#summary-subtotal").text(formatearMoneda(totalesVentaActual.subtotal));
  $("#summary-cantidad").text(totalesVentaActual.cantidad);
  $("#summary-descuento").text(
    "-" + formatearMoneda(totalesVentaActual.descuento)
  );
  $("#summary-envio").text(formatearMoneda(totalesVentaActual.envio));
  $("#summary-impuestos").text(formatearMoneda(totalesVentaActual.impuestos));
  $("#summary-total").text(formatearMoneda(totalesVentaActual.total));

  // Actualizar resumen de pagos
  actualizarResumenDePagos();
}

// ========================================
// GESTIÓN DE PAGOS
// ========================================
/**
 * Agrega una nueva fila de pago
 */
function agregarFilaDePago(
  montoInicial = 0,
  metodoPago = "Efectivo",
  idCuentaBancaria = null
) {
  console.log("Añadiendo una nueva fila de pago...");

  const paymentsContainer = document.getElementById("payments-container");

  // Si no se especifica monto y es la primera fila, auto-rellenar con el total
  if (montoInicial === 0 && paymentsContainer.childElementCount === 0) {
    console.log("Es la primera fila de pago. Auto-rellenando el total.");
    const totalVentaSpan = document.getElementById("summary-total");
    montoInicial =
      parseFloat(totalVentaSpan.textContent.replace(/[^0-9]+/g, "")) || 0;
  }

  const paymentRow = document.createElement("div");
  paymentRow.className = "payment-row";

  let opcionesDeCuentas = '<option value="">Seleccione Cuenta...</option>';
  cuentasBancariasDisponibles.forEach((cuenta) => {
    const selected = cuenta.id === idCuentaBancaria ? "selected" : "";
    opcionesDeCuentas += `<option value="${cuenta.id}" ${selected}>${cuenta.nombre_cuenta}</option>`;
  });

  const mostrarCuenta = metodoPago === "Transferencia" ? "block" : "none";

  paymentRow.innerHTML = `
        <select class="form-input-select metodo-pago-select">
            <option value="Efectivo" ${
              metodoPago === "Efectivo" ? "selected" : ""
            }>Efectivo</option>
            <option value="Transferencia" ${
              metodoPago === "Transferencia" ? "selected" : ""
            }>Transferencia</option>
            <option value="Tarjeta" ${
              metodoPago === "Tarjeta" ? "selected" : ""
            }>Tarjeta</option>
        </select>
        <div class="cuenta-destino-container" style="display:${mostrarCuenta};">
             <select class="form-input-select cuenta-destino-select">${opcionesDeCuentas}</select>
        </div>
        <input type="number" class="form-input text-right payment-amount-input" value="${montoInicial}" placeholder="0.00" data-edited="false">
        <button class="button-icon-danger delete-payment-btn" title="Eliminar este pago">
            <i class="fas fa-trash-alt"></i>
        </button>
    `;

  if (paymentsContainer.childElementCount === 0) {
    const montoInput = paymentRow.querySelector(".payment-amount-input");
    if (montoInput) {
      montoInput.setAttribute("data-edited", "false");
    }
  }

  paymentsContainer.appendChild(paymentRow);
  actualizarResumenDePagos();
}

/**
 * Actualiza el resumen de pagos
 */
function actualizarResumenDePagos() {
  console.log("Actualizando resumen de pagos...");
  const paymentsContainer = $("#payments-container");
  const totalVentaSpan = $("#summary-total");
  const totalPagadoSpan = $("#summary-pagado");
  const saldoSpan = $("#summary-saldo");
  const btnAgregarPago = $("#btn-agregar-pago");

  const filasDePago = paymentsContainer.find(".payment-row");
  const totalVenta =
    parseFloat(totalVentaSpan.text().replace(/[^0-9]+/g, "")) || 0;

  // Auto-actualizar primera fila si no ha sido editada
  if (filasDePago.length === 1) {
    const unicoInputMonto = filasDePago.find(".payment-amount-input");

    if (unicoInputMonto.attr("data-edited") === "false") {
      console.log(
        "Auto-actualizando el monto del pago único para que coincida con el total de la venta."
      );
      unicoInputMonto.val(totalVenta);
    }
  }

  let totalPagado = 0;
  paymentsContainer.find(".payment-amount-input").each(function () {
    totalPagado += parseFloat($(this).val()) || 0;
  });

  let saldoPendiente = totalVenta - totalPagado;
  if (saldoPendiente < 0) {
    saldoPendiente = 0;
  }

  totalPagadoSpan.text(formatearMoneda(totalPagado));
  saldoSpan.text(formatearMoneda(saldoPendiente));

  if (saldoPendiente > 0) {
    saldoSpan.removeClass("saldo-cero").addClass("saldo-positivo");
  } else {
    saldoSpan.removeClass("saldo-positivo").addClass("saldo-cero");
  }

  if (saldoPendiente <= 0) {
    console.log("Saldo es cero o menos. Deshabilitando botón de agregar pago.");
    btnAgregarPago.prop("disabled", true);
  } else {
    console.log("Aún hay saldo pendiente. Habilitando botón de agregar pago.");
    btnAgregarPago.prop("disabled", false);
  }
}

// ========================================
// VALIDACIÓN Y GUARDADO
// ========================================
/**
 * Valida los campos del formulario antes de guardar
 */
function validarFormularioVenta() {
  if (!$("#select-cliente").val()) {
    toastr.error("Debe seleccionar un cliente.");
    return false;
  }
  if (!$("#venta-estado").val()) {
    toastr.error("Debe seleccionar un estado para la venta.");
    return false;
  }
  if (!$("#venta-tipo-envio").val()) {
    toastr.error("Debe seleccionar un tipo de entrega.");
    return false;
  }
  if ($("#venta-tipo-envio").val() === "Domicilio") {
    if (
      !$("#venta-direccion").val() ||
      $("#venta-direccion").val() === "Seleccione una dirección..."
    ) {
      toastr.error(
        "Debe seleccionar una dirección de envío para entregas a domicilio."
      );
      return false;
    }
  }
  if (
    $("#carrito-tbody .empty-cart-row").length > 0 ||
    $("#carrito-tbody tr").not(".empty-cart-row").length === 0
  ) {
    toastr.error("Debe agregar al menos un producto a la venta.");
    return false;
  }
  return true;
}

/**
 * Recopila todos los datos del formulario
 */
function recopilarDatosDelFormulario() {
  const flatpickrInstanceLocal =
    document.getElementById("venta-fecha")._flatpickr;
  const fechaSeleccionada =
    flatpickrInstanceLocal.selectedDates[0] || new Date();
  const idDireccionSeleccionada = $("#venta-direccion").val();

  // Recopilar productos del carrito
  const productos = [];
  const estadoVenta = $("#venta-estado").val();
  const esEstadoPendiente = estadoVenta === "Pendiente";

  $("#carrito-tbody tr").each(function () {
    const fila = $(this);
    if (fila.hasClass("empty-cart-row")) return;

    const idTipoImpuesto = fila.data("id-tipo-impuesto");
    const costoUnitario = parseFloat(fila.data("costo-unitario")) || 0;
    const cantidad = parseFloat(fila.find(".input-cantidad").val()) || 0;
    const stockDisponible = parseInt(fila.attr("data-stock-disponible")) || 0;

    // Calcular cantidades de reserva
    let cantidadAReservar = cantidad;
    let cantidadPendiente = 0;

    if (esEstadoPendiente) {
      // Si hay switch activo, usar los valores calculados
      const switchReserva = fila.find(".switch-reservar-stock");
      if (switchReserva.length > 0) {
        cantidadAReservar = parseInt(fila.attr("data-cantidad-reservar")) || 0;
        cantidadPendiente = parseInt(fila.attr("data-cantidad-pendiente")) || 0;
      } else if (cantidad > stockDisponible) {
        // No hay switch pero falta stock (reservar todo lo disponible por defecto)
        cantidadAReservar = stockDisponible;
        cantidadPendiente = cantidad - stockDisponible;
      }
    }

    productos.push({
      id_producto: fila.data("id-producto"),
      cantidad: cantidad,
      cantidad_a_reservar: cantidadAReservar,
      cantidad_pendiente: cantidadPendiente,
      precio_unitario_venta: parseFloat(fila.find(".input-precio").val()) || 0,
      costo_unitario_venta: costoUnitario,
      porcentaje_descuento:
        parseFloat(fila.find(".input-descuento").val()) || 0,
      id_tipo_impuesto: idTipoImpuesto || null,
      porcentaje_impuesto: parseFloat(fila.find(".input-impuesto").val()) || 0,
    });
  });

  // Recopilación de pagos
  const pagos = [];
  $("#payments-container .payment-row").each(function () {
    const fila = $(this);
    const montoPago = parseFloat(fila.find(".payment-amount-input").val()) || 0;

    if (montoPago > 0) {
      pagos.push({
        monto: montoPago,
        metodo_pago: fila.find(".metodo-pago-select").val(),
        id_cuenta_bancaria_destino:
          fila.find(".cuenta-destino-select").val() || null,
        fecha_pago_in: fechaSeleccionada.toISOString(),
      });
    }
  });

  // Construir objeto principal
  const datosVenta = {
    id_cliente: $("#select-cliente").val() || null,
    fecha_venta: fechaSeleccionada.toISOString(),
    estado: $("#venta-estado").val(),
    tipo_envio: $("#venta-tipo-envio").val() || null,
    id_direccion_entrega:
      idDireccionSeleccionada &&
      idDireccionSeleccionada !== "" &&
      idDireccionSeleccionada !== "Seleccione una dirección..."
        ? idDireccionSeleccionada
        : null,
    costo_envio: parseFloat($("#venta-costo-envio").val()) || 0,
    observaciones: $("#venta-observaciones").val(),
    monto_subtotal: totalesVentaActual.subtotal,
    porcentaje_descuento_global: 0, // ✅ Ya no se usa descuento global por porcentaje
    monto_descuento_global: totalesVentaActual.descuento, // ✅ Suma de descuentos por línea
    impuestos: totalesVentaActual.impuestos,
    monto_total: totalesVentaActual.total,
    productos: productos,
    pagos: pagos,
  };

  console.log("Datos de venta finales listos para enviar:", datosVenta);
  return datosVenta;
}

/**
 * Guarda la venta (crear o actualizar)
 */
async function guardarVenta(event) {
  event.preventDefault();

  if (!validarFormularioVenta()) {
    return;
  }

  const botonGuardar = $(event.currentTarget);
  botonGuardar
    .prop("disabled", true)
    .html('<i class="fas fa-spinner fa-spin"></i> Guardando...');

  try {
    const client = getSupabaseClient();
    const datosParaGuardar = recopilarDatosDelFormulario();

    if (modoEdicionVentas.activo) {
      // MODO EDICIÓN
      console.log(
        `[Ventas] Modo Edición para Venta ID: ${modoEdicionVentas.idVenta}`
      );

      const { data, error } = await client.rpc("fn_actualizar_venta_completa", {
        p_id_venta: modoEdicionVentas.idVenta,
        p_venta: datosParaGuardar,
        p_detalles: datosParaGuardar.productos,
        p_pagos: datosParaGuardar.pagos || [],
      });

      if (error) throw error;

      botonGuardar.prop("disabled", false).text("Finalizar y Guardar Venta");

      if (data && data.success) {
        toastr.success("¡Venta actualizada correctamente!", "Éxito");
        setTimeout(() => cargarPaginaVentas(), 2000);
      } else {
        const mensaje =
          data?.mensaje || "Error desconocido al actualizar la venta";

        // Detectar si es error de stock
        const esErrorStock = /stock|inventario|insuficiente|disponible/i.test(mensaje);

        Swal.fire({
          icon: esErrorStock ? "warning" : "error",
          title: esErrorStock ? "Stock Insuficiente" : "Error al Actualizar",
          text: mensaje,
          confirmButtonText: "Entendido",
          confirmButtonColor: esErrorStock ? "#f39c12" : "#d33"
        });
      }
    } else {
      // MODO CREACIÓN
      console.log(
        "[Ventas] Modo Creación. Llamando a fn_crear_venta_completa..."
      );

      const { data, error } = await client.rpc("fn_crear_venta_completa", {
        p_venta: {
          id_cliente: datosParaGuardar.id_cliente,
          fecha_venta: datosParaGuardar.fecha_venta,
          estado: datosParaGuardar.estado,
          tipo_envio: datosParaGuardar.tipo_envio,
          id_direccion_entrega: datosParaGuardar.id_direccion_entrega,
          monto_subtotal: datosParaGuardar.monto_subtotal,
          porcentaje_descuento_global:
            datosParaGuardar.porcentaje_descuento_global,
          monto_descuento_global: datosParaGuardar.monto_descuento_global,
          impuestos: datosParaGuardar.impuestos,
          costo_envio: datosParaGuardar.costo_envio,
          monto_total: datosParaGuardar.monto_total,
          observaciones: datosParaGuardar.observaciones,
        },
        p_detalles: datosParaGuardar.productos,
        p_pagos: datosParaGuardar.pagos || [],
      });

      if (error) throw error;

      botonGuardar.prop("disabled", false).text("Finalizar y Guardar Venta");

      if (data && data.success) {
        toastr.success(
          `¡Venta ${data.codigo_venta} creada exitosamente!`,
          "Éxito"
        );
        setTimeout(resetearFormularioCompleto, 2000);
      } else {
        const mensaje =
          data?.mensaje || "Error desconocido al guardar la venta";

        // Detectar si es error de stock
        const esErrorStock = /stock|inventario|insuficiente|disponible/i.test(mensaje);

        Swal.fire({
          icon: esErrorStock ? "warning" : "error",
          title: esErrorStock ? "Stock Insuficiente" : "Error al Guardar",
          text: mensaje,
          confirmButtonText: "Entendido",
          confirmButtonColor: esErrorStock ? "#f39c12" : "#d33"
        });
      }
    }
  } catch (error) {
    console.error("[Ventas] Error en guardarVenta:", error);
    botonGuardar.prop("disabled", false).text("Finalizar y Guardar Venta");
    const mensaje =
      error?.message || error?.msg || "Error de comunicación con el servidor";

    // Detectar si es error de stock
    const esErrorStock = /stock|inventario|insuficiente|disponible/i.test(mensaje);

    Swal.fire({
      icon: esErrorStock ? "warning" : "error",
      title: esErrorStock ? "Stock Insuficiente" : "Error de Comunicación",
      text: mensaje,
      confirmButtonText: "Entendido",
      confirmButtonColor: esErrorStock ? "#f39c12" : "#d33"
    });
  }
}

// ========================================
// UTILIDADES
// ========================================
/**
 * Resetea los campos de estado y tipo de envío
 */
function resetearCamposDeVenta() {
  console.log("Reseteando campos de Estado y Entrega...");
  $("#venta-estado").val("").trigger("change");
  $("#venta-tipo-envio").val("").trigger("change");
}

/**
 * Resetea todo el formulario a su estado inicial
 */
function resetearFormularioCompleto() {
  console.log("Ejecutando reseteo completo del formulario...");

  $("#select-cliente").val(null).trigger("change");
  $("#cliente-info-card").hide().html("");
  $("#venta-estado").val("");
  $("#venta-tipo-envio").val("");
  $("#direccion-container").hide();
  $("#costo-envio-container").hide();
  $("#seccion-pagos").hide();

  const filaVaciaHtml =
    '<tr class="empty-cart-row"><td colspan="7">Aún no has agregado productos.</td></tr>';
  $("#carrito-tbody").html(filaVaciaHtml);

  $("#payments-container").empty();
  $("#venta-observaciones").val("");
  $("#buscar-producto").val("");
  $("#venta-costo-envio").val(0);

  actualizarResumenGeneral();

  $("html, body").animate({ scrollTop: 0 }, "slow");
  toastr.info("Formulario listo para una nueva venta.");
}

/**
 * Formatea un número como moneda
 * @deprecated Usar window.formatMoney() de utils.js en su lugar
 * Esta función se mantiene por compatibilidad temporal
 */
function formatearMoneda(valor) {
  const numero = valor || 0;
  const numeroRedondeado = Math.round(numero);
  // Usar window.formatMoney sin formato compacto para mostrar valores exactos en formularios
  return window.formatMoney(numeroRedondeado);
}

console.log("[Ventas Formulario] Módulo cargado correctamente");

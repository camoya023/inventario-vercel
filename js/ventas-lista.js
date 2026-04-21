/**
 * =========================================================================
 * MÓDULO DE VENTAS - LISTA
 * =========================================================================
 */

const estadoPaginacionVentas = {
  paginaActual: 1,
  filasPorPagina: 10,
  totalRegistros: 0,
  totalPages: 1,
  filtros: {},
};

let flatpickrRangoFechasVentas = null;
let select2ClienteVentas = null;
let restaurandoFiltros = false;

async function cargarPaginaVentas() {
  console.log("[Ventas] ===== INICIALIZANDO MÓDULO DE VENTAS =====");
  try {
    const workArea = document.querySelector(".work-area");
    if (!workArea) throw new Error("No se encontró el área de trabajo");
    workArea.innerHTML =
      '<div class="loading-spinner-container"><div class="loading-spinner"></div><p>Cargando módulo de ventas...</p></div>';
    const response = await fetch("/views/ventas-lista.html");
    if (!response.ok) throw new Error("Error al cargar la vista de ventas");
    workArea.innerHTML = await response.text();
    await inicializarVistaListaVentas();
    console.log("[Ventas] ✅ Módulo inicializado correctamente");
  } catch (error) {
    console.error("[Ventas] ❌ Error al inicializar:", error);
    toastr.error("Error al cargar módulo de ventas: " + error.message, "Error");
  }
}

async function inicializarVistaListaVentas() {
  try {
    configurarEventListenersListaVentas();
    inicializarComponentesFiltrosVentas();
    setTimeout(() => {
      restaurarFiltrosGuardadosVentas();
      ejecutarBusquedaDeVentas();
      setTimeout(() => actualizarEfectosVisualesFiltros(), 100);
    }, 300);
  } catch (error) {
    console.error("[Ventas] Error al inicializar vista:", error);
    toastr.error(
      "Error al inicializar el módulo de ventas. Recarga la página.",
      "Error",
    );
  }
}

function configurarEventListenersListaVentas() {
  const btnNuevaVenta = document.getElementById("btn-agregar-venta");
  if (btnNuevaVenta)
    btnNuevaVenta.addEventListener("click", () =>
      cargarVistaFormularioVenta("create"),
    );

  const btnLimpiarFiltros = document.getElementById(
    "btn-limpiar-filtros-ventas",
  );
  if (btnLimpiarFiltros)
    btnLimpiarFiltros.addEventListener("click", limpiarFiltrosVentas);

  const btnToggleFiltros = document.getElementById("btn-toggle-filtros-ventas");
  if (btnToggleFiltros)
    btnToggleFiltros.addEventListener("click", toggleFiltrosVentas);

  const inputBuscar = document.getElementById("input-buscar-ventas");
  if (inputBuscar) {
    inputBuscar.addEventListener(
      "input",
      debounce(() => {
        estadoPaginacionVentas.filtros.busqueda = inputBuscar.value.trim();
        estadoPaginacionVentas.paginaActual = 1;
        guardarFiltrosEnStorage();
        ejecutarBusquedaDeVentas();
      }, 400),
    );
  }

  [
    "filtro-estado-venta",
    "filtro-tipo-entrega",
    "filtro-estado-pago-ventas",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("change", () => {
        if (id === "filtro-estado-venta")
          estadoPaginacionVentas.filtros.estadoVenta = el.value;
        else if (id === "filtro-tipo-entrega")
          estadoPaginacionVentas.filtros.tipoEntrega = el.value;
        else estadoPaginacionVentas.filtros.estadoPago = el.value;
        estadoPaginacionVentas.paginaActual = 1;
        guardarFiltrosEnStorage();
        ejecutarBusquedaDeVentas();
      });
    }
  });

  const btnRangoHoy = document.getElementById("btn-rango-hoy");
  if (btnRangoHoy)
    btnRangoHoy.addEventListener("click", () => {
      const hoy = new Date();
      if (flatpickrRangoFechasVentas) {
        flatpickrRangoFechasVentas.setDate([hoy, hoy]);
        marcarBotonRangoActivo(btnRangoHoy);
        guardarFiltrosEnStorage();
        ejecutarBusquedaDeVentas();
      }
    });

  const btnRango7Dias = document.getElementById("btn-rango-7dias");
  if (btnRango7Dias)
    btnRango7Dias.addEventListener("click", () => {
      const hoy = new Date();
      const hace7 = new Date();
      hace7.setDate(hoy.getDate() - 7);
      if (flatpickrRangoFechasVentas) {
        flatpickrRangoFechasVentas.setDate([hace7, hoy]);
        marcarBotonRangoActivo(btnRango7Dias);
        guardarFiltrosEnStorage();
        ejecutarBusquedaDeVentas();
      }
    });

  const btnRangoMes = document.getElementById("btn-rango-mes");
  if (btnRangoMes)
    btnRangoMes.addEventListener("click", () => {
      const hoy = new Date();
      const primer = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      if (flatpickrRangoFechasVentas) {
        flatpickrRangoFechasVentas.setDate([primer, hoy]);
        marcarBotonRangoActivo(btnRangoMes);
        guardarFiltrosEnStorage();
        ejecutarBusquedaDeVentas();
      }
    });

  const btnPrev = document.getElementById("btn-anterior");
  const btnNext = document.getElementById("btn-siguiente");
  if (btnPrev)
    btnPrev.addEventListener("click", () => {
      if (estadoPaginacionVentas.paginaActual > 1) {
        estadoPaginacionVentas.paginaActual--;
        ejecutarBusquedaDeVentas();
      }
    });
  if (btnNext)
    btnNext.addEventListener("click", () => {
      const tp = Math.ceil(
        estadoPaginacionVentas.totalRegistros /
          estadoPaginacionVentas.filasPorPagina,
      );
      if (estadoPaginacionVentas.paginaActual < tp) {
        estadoPaginacionVentas.paginaActual++;
        ejecutarBusquedaDeVentas();
      }
    });

  const tbodyVentas = document.getElementById("tbody-ventas");
  if (tbodyVentas) {
    tbodyVentas.addEventListener("click", async (e) => {
      const btnAcciones = e.target.closest(".actions-menu-container .button");
      if (btnAcciones) {
        e.preventDefault();
        e.stopPropagation();
        const menu = btnAcciones
          .closest(".actions-menu-container")
          .querySelector(".actions-menu");
        document.querySelectorAll(".actions-menu").forEach((m) => {
          if (m !== menu) m.classList.remove("show");
        });
        menu.classList.toggle("show");
        return;
      }
      const opcionMenu = e.target.closest(".actions-menu-item");
      if (opcionMenu) {
        e.preventDefault();
        const accion = opcionMenu.dataset.action;
        const fila = opcionMenu.closest("tr");
        const idVenta = fila.dataset.idVenta;
        const codigoVenta = fila.dataset.codigoVenta;
        const nombreCliente = fila.dataset.nombreCliente;
        const saldoPendiente = parseFloat(fila.dataset.saldoPendiente) || 0;
        const estado = fila.dataset.estado;
        opcionMenu.closest(".actions-menu").classList.remove("show");
        switch (accion) {
          case "ver_detalles":
            await cargarVistaDetalleVenta(idVenta);
            break;
          case "imprimir_factura":
            await imprimirFacturaVenta(idVenta, codigoVenta);
            break;
          case "editar_venta":
            await cargarVistaFormularioVenta("edit", idVenta);
            break;
          case "editar_estado":
            await mostrarDialogoCambiarEstado(
              idVenta,
              codigoVenta,
              nombreCliente,
              saldoPendiente,
            );
            break;
          case "anular_venta":
            await confirmarAnularVenta(idVenta, codigoVenta, nombreCliente);
            break;
          case "agregar_pago":
            if (saldoPendiente <= 0) {
              toastr.info("Esta venta ya está completamente pagada.");
              return;
            }
            await mostrarDialogoAgregarPago(
              idVenta,
              codigoVenta,
              nombreCliente,
              saldoPendiente,
            );
            break;
          case "ver_pagos":
            await mostrarDialogoGestionarPagos(
              idVenta,
              codigoVenta,
              nombreCliente,
              estado,
            );
            break;
          case "borrar_venta":
            await confirmarBorrarVenta(idVenta, codigoVenta, nombreCliente);
            break;
          case "whatsapp":
            await compartirTicketWhatsApp(idVenta, codigoVenta);
            break;
          default:
            toastr.info("Función en desarrollo");
        }
      }
    });
  }

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".actions-menu-container")) {
      document
        .querySelectorAll(".actions-menu")
        .forEach((m) => m.classList.remove("show"));
    }
  });
}

function inicializarComponentesFiltrosVentas() {
  const inputRangoFechas = document.getElementById(
    "filtro-rango-fechas-ventas",
  );
  if (inputRangoFechas && typeof flatpickr !== "undefined") {
    flatpickrRangoFechasVentas = flatpickr(inputRangoFechas, {
      mode: "range",
      dateFormat: "d/m/Y",
      locale: "es",
      onClose: () => {
        if (!restaurandoFiltros) {
          guardarFiltrosEnStorage();
          ejecutarBusquedaDeVentas();
        }
      },
    });
  }

  const selectCliente = $("#filtro-cliente-ventas");
  if (selectCliente.length && typeof $.fn.select2 !== "undefined") {
    select2ClienteVentas = selectCliente.select2({
      placeholder: "Buscar cliente (mínimo 3 letras)...",
      allowClear: true,
      minimumInputLength: 3,
      ajax: {
        delay: 400,
        transport: async function (params, success, failure) {
          try {
            const termino = params.data.term || "";
            if (termino.length < 3) {
              success({ results: [{ id: "", text: "Todos los clientes" }] });
              return { abort: () => {} };
            }
            const client = getSupabaseClient();
            const { data, error } = await client
              .from("clientes")
              .select("id, codigo_cliente, nombres, apellidos, razon_social")
              .eq("estado", "Activo")
              .or(
                `nombres.ilike.%${termino}%,apellidos.ilike.%${termino}%,razon_social.ilike.%${termino}%,codigo_cliente.ilike.%${termino}%`,
              )
              .order("nombres")
              .limit(20);
            if (error) throw error;
            success({
              results: [
                { id: "", text: "Todos los clientes" },
                ...(data || []).map((c) => ({
                  id: c.id,
                  text:
                    c.razon_social ||
                    `${c.nombres || ""} ${c.apellidos || ""}`.trim(),
                })),
              ],
            });
          } catch (e) {
            failure(e);
          }
          return { abort: () => {} };
        },
      },
    });
    selectCliente.on("select2:open", () =>
      setTimeout(() => {
        const sf = document.querySelector(".select2-search__field");
        if (sf) sf.focus();
      }, 100),
    );
    selectCliente.on("select2:select select2:clear", function () {
      if (!restaurandoFiltros) {
        estadoPaginacionVentas.filtros.clienteId = $(this).val() || null;
        estadoPaginacionVentas.paginaActual = 1;
        guardarFiltrosEnStorage();
        ejecutarBusquedaDeVentas();
      }
    });
  }
}

function formatearFechaLocal(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

function debounce(func, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

function formatCurrency(valor) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(valor || 0);
}

async function ejecutarBusquedaDeVentas() {
  const tbody = document.getElementById("tbody-ventas");
  if (!tbody) return;
  try {
    tbody.innerHTML =
      '<tr><td colspan="8" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Cargando ventas...</td></tr>';
    const client = getSupabaseClient();
    let fechaInicio = null,
      fechaFin = null;
    if (
      flatpickrRangoFechasVentas &&
      flatpickrRangoFechasVentas.selectedDates.length > 0
    ) {
      fechaInicio = formatearFechaLocal(
        flatpickrRangoFechasVentas.selectedDates[0],
      );
      fechaFin =
        flatpickrRangoFechasVentas.selectedDates.length > 1
          ? formatearFechaLocal(flatpickrRangoFechasVentas.selectedDates[1])
          : fechaInicio;
    }
    const { data, error } = await client.rpc("fn_obtener_lista_ventas", {
      p_page: estadoPaginacionVentas.paginaActual,
      p_limit: estadoPaginacionVentas.filasPorPagina,
      p_busqueda: estadoPaginacionVentas.filtros.busqueda || null,
      p_cliente_id: estadoPaginacionVentas.filtros.clienteId || null,
      p_estado_venta: estadoPaginacionVentas.filtros.estadoVenta || null,
      p_tipo_entrega: estadoPaginacionVentas.filtros.tipoEntrega || null,
      p_estado_pago: estadoPaginacionVentas.filtros.estadoPago || null,
      p_fecha_inicio: fechaInicio,
      p_fecha_fin: fechaFin,
    });
    if (error) throw error;
    if (data?.exito === false) {
      if (data.codigo_error === "PERMISO_DENEGADO") {
        tbody.innerHTML =
          '<tr><td colspan="8" style="text-align:center;color:red;">No tienes permisos para ver ventas.</td></tr>';
        return;
      }
      if (data.codigo_error === "SIN_EMPRESA") {
        tbody.innerHTML =
          '<tr><td colspan="8" style="text-align:center;color:red;">Usuario no asociado a una empresa.</td></tr>';
        return;
      }
      throw new Error(data.mensaje || "Error al cargar ventas");
    }
    estadoPaginacionVentas.totalRegistros = data.total || 0;
    renderizarTablaVentas(data.datos || []);
    renderizarPaginacionVentas();
  } catch (error) {
    console.error("[Ventas] Error:", error);
    if (error.message?.includes("sesión")) {
      setTimeout(() => location.reload(), 2000);
    } else {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:red;">Error: ${error.message}</td></tr>`;
    }
  }
}

function renderizarTablaVentas(ventas) {
  const tbody = document.getElementById("tbody-ventas");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!ventas || ventas.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" style="text-align:center;">No se encontraron ventas con los filtros aplicados.</td></tr>';
    return;
  }
  ventas.forEach((venta) => {
    const row = document.createElement("tr");
    row.dataset.idVenta = venta.id;
    row.dataset.codigoVenta = venta.codigo_venta;
    row.dataset.nombreCliente = venta.nombre_cliente || "Ventas Mostrador";
    row.dataset.saldoPendiente = venta.saldo_pendiente || 0;
    row.dataset.estado = venta.estado;
    row.dataset.estadoPago = venta.estado_pago;

    // ✅ FIX: usar moment.utc para fecha de la lista
    const fecha = moment.utc(venta.fecha_venta).format("DD/MM/YYYY");
    const nombreCliente = venta.nombre_cliente || "Ventas Mostrador";

    let opcionesMenu = `
      <a href="#" class="actions-menu-item" data-action="ver_detalles"><i class="fas fa-eye"></i> Ver Detalles</a>
      <a href="#" class="actions-menu-item" data-action="imprimir_factura"><i class="fas fa-print"></i> Imprimir Factura</a>
      <a href="#" class="actions-menu-item" data-action="whatsapp" style="color:#25d366;"><i class="fab fa-whatsapp"></i> Enviar por WhatsApp</a>
    `;
    if (venta.estado !== "Completado" && venta.estado !== "Anulada") {
      opcionesMenu += `
        <a href="#" class="actions-menu-item" data-action="editar_venta"><i class="fas fa-pencil-alt"></i> Editar</a>
        <a href="#" class="actions-menu-item" data-action="editar_estado"><i class="fas fa-sync-alt"></i> Cambiar Estado</a>
      `;
    }
    if (venta.estado === "Completado") {
      opcionesMenu += `<div class="divider"></div><a href="#" class="actions-menu-item text-warning" data-action="anular_venta"><i class="fas fa-ban"></i> Anular Venta</a>`;
    }
    opcionesMenu += `<div class="divider"></div>`;
    if (venta.estado_pago !== "Pagada" && venta.estado !== "Anulada") {
      opcionesMenu += `<a href="#" class="actions-menu-item" data-action="agregar_pago"><i class="fas fa-dollar-sign"></i> Agregar Pago</a>`;
    }
    opcionesMenu += `<a href="#" class="actions-menu-item" data-action="ver_pagos"><i class="fas fa-list-ul"></i> Ver Pagos</a>`;
    if (venta.estado !== "Completado" && venta.estado !== "Anulada") {
      opcionesMenu += `<div class="divider"></div><a href="#" class="actions-menu-item text-danger" data-action="borrar_venta"><i class="fas fa-trash-alt"></i> Borrar</a>`;
    }

    row.innerHTML = `
      <td class="text-center"><div class="actions-menu-container"><button class="button button-secondary">Acciones</button><div class="actions-menu">${opcionesMenu}</div></div></td>
      <td><strong>${venta.codigo_venta}</strong></td>
      <td>${nombreCliente}</td>
      <td>${fecha}</td>
      <td>${obtenerBadgeEstadoVenta(venta.estado)}</td>
      <td>${obtenerBadgeEstadoPagoVenta(venta.estado_pago)}</td>
      <td>${venta.tipo_envio || "N/A"}</td>
      <td class="text-right">${formatCurrency(venta.monto_total)}</td>
    `;
    tbody.appendChild(row);
  });
}

function obtenerBadgeEstadoVenta(estado) {
  const badges = {
    Borrador: '<span class="badge badge-secondary">Borrador</span>',
    Pendiente: '<span class="badge badge-warning-pendiente">Pendiente</span>',
    "En Proceso": '<span class="badge badge-info">En Proceso</span>',
    Completado: '<span class="badge badge-success">Completado</span>',
    Cancelada: '<span class="badge badge-danger">Cancelada</span>',
    Anulada: '<span class="badge badge-danger">Anulada</span>',
  };
  return badges[estado] || `<span class="badge">${estado}</span>`;
}

function obtenerBadgeEstadoPagoVenta(estadoPago) {
  const badges = {
    "Pendiente de Pago": '<span class="badge badge-danger">Pendiente</span>',
    Abonada: '<span class="badge badge-warning">Abonada</span>',
    Pagada: '<span class="badge badge-success">Pagada</span>',
  };
  return badges[estadoPago] || `<span class="badge">${estadoPago}</span>`;
}

function renderizarPaginacionVentas() {
  const totalPages = Math.ceil(
    estadoPaginacionVentas.totalRegistros /
      estadoPaginacionVentas.filasPorPagina,
  );
  const pageInfo = document.getElementById("info-pagina");
  const btnPrev = document.getElementById("btn-anterior");
  const btnNext = document.getElementById("btn-siguiente");
  if (pageInfo)
    pageInfo.textContent = `Página ${estadoPaginacionVentas.paginaActual} de ${totalPages || 1} (Total: ${estadoPaginacionVentas.totalRegistros} ventas)`;
  if (btnPrev) btnPrev.disabled = estadoPaginacionVentas.paginaActual <= 1;
  if (btnNext)
    btnNext.disabled = estadoPaginacionVentas.paginaActual >= totalPages;
}

function toggleFiltrosVentas() {
  const filtrosContent = document.getElementById("filtros-ventas-content");
  const btnToggle = document.getElementById("btn-toggle-filtros-ventas");
  const chevronIcon = btnToggle?.querySelector(".filter-chevron");
  if (filtrosContent.classList.contains("is-visible")) {
    filtrosContent.classList.remove("is-visible");
    btnToggle?.setAttribute("aria-expanded", "false");
    chevronIcon?.classList.remove("rotated");
  } else {
    filtrosContent.classList.add("is-visible");
    btnToggle?.setAttribute("aria-expanded", "true");
    chevronIcon?.classList.add("rotated");
  }
}

function limpiarFiltrosVentas() {
  restaurandoFiltros = true;
  estadoPaginacionVentas.filtros = {};
  estadoPaginacionVentas.paginaActual = 1;
  const ids = [
    "input-buscar-ventas",
    "filtro-estado-venta",
    "filtro-tipo-entrega",
    "filtro-estado-pago-ventas",
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  if (select2ClienteVentas) select2ClienteVentas.val("").trigger("change");
  if (flatpickrRangoFechasVentas) flatpickrRangoFechasVentas.clear();
  document
    .querySelectorAll(".filter-quick-actions .button")
    .forEach((btn) => btn.classList.remove("active"));
  localStorage.removeItem("ventas_filtros");
  setTimeout(() => {
    restaurandoFiltros = false;
    ejecutarBusquedaDeVentas();
    actualizarEfectosVisualesFiltros();
  }, 100);
}

function marcarBotonRangoActivo(boton) {
  document
    .querySelectorAll(".filter-quick-actions .button")
    .forEach((btn) => btn.classList.remove("active"));
  if (boton) boton.classList.add("active");
}

function guardarFiltrosEnStorage() {
  if (restaurandoFiltros) return;
  const filtros = {
    busqueda: document.getElementById("input-buscar-ventas")?.value || "",
    clienteId: estadoPaginacionVentas.filtros.clienteId || null,
    estadoVenta: document.getElementById("filtro-estado-venta")?.value || "",
    tipoEntrega: document.getElementById("filtro-tipo-entrega")?.value || "",
    estadoPago:
      document.getElementById("filtro-estado-pago-ventas")?.value || "",
    fechaInicio: null,
    fechaFin: null,
  };
  if (flatpickrRangoFechasVentas?.selectedDates.length > 0) {
    filtros.fechaInicio = flatpickrRangoFechasVentas.selectedDates[0]
      .toISOString()
      .split("T")[0];
    filtros.fechaFin =
      flatpickrRangoFechasVentas.selectedDates.length > 1
        ? flatpickrRangoFechasVentas.selectedDates[1]
            .toISOString()
            .split("T")[0]
        : filtros.fechaInicio;
  }
  localStorage.setItem("ventas_filtros", JSON.stringify(filtros));
}

function restaurarFiltrosGuardadosVentas() {
  const filtrosStr = localStorage.getItem("ventas_filtros");
  if (!filtrosStr) return false;
  try {
    restaurandoFiltros = true;
    const f = JSON.parse(filtrosStr);
    if (f.busqueda) {
      const el = document.getElementById("input-buscar-ventas");
      if (el) el.value = f.busqueda;
    }
    if (f.estadoVenta) {
      const el = document.getElementById("filtro-estado-venta");
      if (el) el.value = f.estadoVenta;
    }
    if (f.tipoEntrega) {
      const el = document.getElementById("filtro-tipo-entrega");
      if (el) el.value = f.tipoEntrega;
    }
    if (f.estadoPago) {
      const el = document.getElementById("filtro-estado-pago-ventas");
      if (el) el.value = f.estadoPago;
    }
    if (f.clienteId && select2ClienteVentas)
      select2ClienteVentas.val(f.clienteId).trigger("change");
    if (f.fechaInicio && f.fechaFin && flatpickrRangoFechasVentas) {
      const fi = new Date(f.fechaInicio + "T00:00:00"),
        ff = new Date(f.fechaFin + "T00:00:00");
      if (!isNaN(fi.getTime()) && !isNaN(ff.getTime()))
        flatpickrRangoFechasVentas.setDate([fi, ff], false);
    }
    estadoPaginacionVentas.filtros = {
      busqueda: f.busqueda || null,
      clienteId: f.clienteId || null,
      estadoVenta: f.estadoVenta || null,
      tipoEntrega: f.tipoEntrega || null,
      estadoPago: f.estadoPago || null,
    };
    setTimeout(() => {
      restaurandoFiltros = false;
    }, 500);
    return true;
  } catch (e) {
    localStorage.removeItem("ventas_filtros");
    restaurandoFiltros = false;
    return false;
  }
}

function actualizarEfectosVisualesFiltros() {}

async function confirmarAnularVenta(idVenta, codigoVenta, nombreCliente) {
  const result = await Swal.fire({
    title: "¡ACCIÓN CRÍTICA! - Anular Venta",
    html: `<p>Venta: <strong>${codigoVenta}</strong> | Cliente: <strong>${nombreCliente}</strong></p><p>Esta acción es irreversible y devolverá los productos al stock.</p>`,
    icon: "warning",
    input: "text",
    inputPlaceholder: "Motivo de anulación...",
    inputAttributes: { autocapitalize: "off", autocomplete: "off" },
    showCancelButton: true,
    confirmButtonText: "Sí, Anular",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#d33",
    inputValidator: (v) => {
      if (!v || v.trim().length < 5)
        return "Ingresa un motivo descriptivo (mínimo 5 caracteres)";
    },
  });
  if (result.isConfirmed) {
    try {
      Swal.fire({
        title: "Procesando...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });
      const client = getSupabaseClient();
      const { data, error } = await client.rpc("fn_anular_venta", {
        p_id_venta: idVenta,
        p_motivo: result.value.trim(),
      });
      if (error) throw new Error(error.message);
      if (data?.exito === false) {
        Swal.fire({ icon: "error", title: "Error", text: data.mensaje });
        return;
      }
      Swal.fire({
        icon: "success",
        title: "Venta Anulada",
        text: data.mensaje || "La venta se anuló exitosamente.",
      });
      await ejecutarBusquedaDeVentas();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    }
  }
}

async function confirmarBorrarVenta(idVenta, codigoVenta, nombreCliente) {
  const result = await Swal.fire({
    title: `¿Borrar la venta ${codigoVenta}?`,
    html: `<p>Cliente: <strong>${nombreCliente}</strong></p><p>¡Esta acción no se puede deshacer!</p>`,
    icon: "error",
    showCancelButton: true,
    confirmButtonText: "Sí, ¡bórrala!",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#d33",
  });
  if (result.isConfirmed) {
    try {
      Swal.fire({
        title: "Procesando...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });
      const client = getSupabaseClient();
      const {
        data: { session },
      } = await client.auth.getSession();
      if (!session?.user?.id) throw new Error("No se pudo obtener la sesión");
      const { data, error } = await client.rpc("fn_eliminar_venta", {
        id_venta_a_eliminar: idVenta,
        id_usuario_responsable: session.user.id,
      });
      if (error) throw new Error(error.message);
      if (data?.exito === false)
        throw new Error(data.mensaje || "Error al borrar");
      Swal.fire({
        icon: "success",
        title: "Venta Borrada",
        text: data.mensaje || "La venta se borró correctamente.",
      });
      await ejecutarBusquedaDeVentas();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    }
  }
}

async function imprimirFacturaVenta(idVenta, codigoVenta) {
  try {
    toastr.info("Generando factura...");
    const client = getSupabaseClient();
    const { data, error } = await client.rpc("fn_obtener_venta_detalle", {
      p_id_venta: idVenta,
    });
    if (error) throw new Error(error.message);
    if (!data?.exito)
      throw new Error(data?.mensaje || "No se pudo obtener la venta");
    imprimirFacturaPOSVer(generarContenidoFacturaPOS(data.datos));
    toastr.success("Factura generada exitosamente");
  } catch (e) {
    toastr.error("Error al generar la factura: " + e.message);
  }
}

function generarContenidoFacturaPOS(venta) {
  const W = 36,
    SEP = "=".repeat(W),
    LIN = "-".repeat(W);
  const centrar = (t) =>
    t.padStart(Math.floor((W + t.length) / 2), " ").padEnd(W, " ");
  const alinear = (i, d) => i + d.padStart(W - i.length, " ");
  const envolver = (texto, max) => {
    const lineas = [];
    const palabras = texto.split(" ");
    let actual = "";
    palabras.forEach((p) => {
      if ((actual + p).length > max) {
        lineas.push(actual.trim());
        actual = "";
      }
      actual += p + " ";
    });
    lineas.push(actual.trim());
    return lineas;
  };

  let c = "";
  const fechaVenta = new Date(venta.fecha_venta).toLocaleDateString("es-CO", {
    timeZone: "UTC",
  });
  c +=
    alinear(`Remisión: ${venta.codigo_venta}`, `Fecha: ${fechaVenta}`) + "\n";
  const nc = venta.clientes
    ? venta.clientes.razon_social ||
      `${venta.clientes.nombres} ${venta.clientes.apellidos}`
    : "Ventas Mostrador";
  c += `Cliente: ${nc}\n`;
  if (venta.clientes) c += `ID: ${venta.clientes.codigo_cliente}\n`;
  if (venta.tipo_envio === "Domicilio" && venta.direccion_entrega) {
    c += `Tel: ${venta.clientes?.telefono_principal || ""}\n`;
    if (venta.direccion_entrega.direccion_completa) {
      const l = envolver(
        `Dirección: ${venta.direccion_entrega.direccion_completa}`,
        W,
      );
      c += l[0] + "\n";
      for (let i = 1; i < l.length; i++) c += `           ${l[i]}\n`;
    }
    if (venta.direccion_entrega.barrio) {
      const l = envolver(
        `${venta.direccion_entrega.barrio}, ${venta.direccion_entrega.ciudad_municipio}`,
        W - 11,
      );
      c += `           ${l[0]}\n`;
      for (let i = 1; i < l.length; i++) c += `           ${l[i]}\n`;
    }
  }

  // ── Agrupar detalles por categoría ──────────────────────────────────────
  const grupos = {};
  (venta.detalles_venta || []).forEach((d) => {
    const cat = d.productos?.nombre_categoria || "Sin Categoría";
    const orden = d.productos?.orden_categoria ?? 99;
    const key = `${String(orden).padStart(4, "0")}_${cat}`;
    if (!grupos[key]) grupos[key] = { nombre: cat, orden, items: [] };
    grupos[key].items.push(d);
  });

  // Ordenar grupos por orden_categoria
  const gruposOrdenados = Object.values(grupos).sort(
    (a, b) => a.orden - b.orden,
  );

  c += SEP + "\nProducto        Cant Precio Subtotal\n" + LIN + "\n";

  let ta = 0;

  gruposOrdenados.forEach((grupo) => {
    // Encabezado de categoría
    const tituloCat = grupo.nombre.toUpperCase();
    const tituloLineas = envolver(tituloCat, W);
    tituloLineas.forEach((l) => {
      c += l + "\n";
    });
    c += LIN + "\n";

    let totalUnidadesGrupo = 0;

    grupo.items.forEach((d) => {
      ta += d.cantidad;
      totalUnidadesGrupo += d.cantidad;
      const np = d.productos?.nombre_producto || "Producto";
      const pu = d.precio_unitario_venta || 0;
      const tl = d.total_linea || d.cantidad * pu;
      const l = envolver(np, 15);
      c += `${l[0].padEnd(15)} ${d.cantidad.toString().padStart(4)} ${Math.round(pu).toLocaleString("es-CO").padStart(6)} ${Math.round(tl).toLocaleString("es-CO").padStart(9)}\n`;
      for (let i = 1; i < l.length; i++) c += `${l[i].padEnd(15)}\n`;
    });

    // Subtotal de unidades del grupo
    c +=
      alinear(`  Subtotal ${grupo.nombre}:`, `${totalUnidadesGrupo} und`) +
      "\n";
    c += LIN + "\n";
  });

  const fm = (v) => `$${Math.round(v || 0).toLocaleString("es-CO")}`;
  c += SEP + "\n" + alinear(`Total Artículos: ${ta}`, "") + "\n\n";
  c += alinear("Subtotal:", fm(venta.subtotal)) + "\n";
  c += alinear("Descuentos:", `-${fm(venta.total_descuentos)}`) + "\n";
  c += alinear("Impuestos:", fm(venta.total_impuestos)) + "\n";
  c += alinear("Envío:", fm(venta.costo_envio)) + "\n";
  c +=
    SEP + "\n" + alinear("TOTAL:", fm(venta.monto_total)) + "\n" + SEP + "\n\n";
  c +=
    alinear(
      "Total Pagado:",
      fm((venta.monto_total || 0) - (venta.saldo_pendiente || 0)),
    ) + "\n";
  c += alinear("Saldo Pendiente:", fm(venta.saldo_pendiente)) + "\n";
  if (venta.observaciones) c += `\nObservaciones: ${venta.observaciones}\n`;
  c += "\n" + centrar("Gracias por su compra") + "\n";
  return c;
}

function imprimirFacturaPOSVer(factura) {
  if (!factura) return;
  const w = window.open("", "_blank");
  if (!w) {
    toastr.error("Permita las ventanas emergentes para imprimir.");
    return;
  }
  w.document.write(
    `<html><head><title>Factura</title><style>body{font-family:monospace;font-size:26px;}.titulo{font-size:30px;font-weight:bold;text-align:center;}</style></head><body><div class="titulo">REMISION</div><pre>${factura}</pre><script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script></body></html>`,
  );
  w.document.close();
}

async function mostrarDialogoCambiarEstado(
  idVenta,
  codigoVenta,
  nombreCliente,
  saldoPendiente,
) {
  const result = await Swal.fire({
    title: `Cambiar estado de ${codigoVenta}`,
    html: `<p>Cliente: <strong>${nombreCliente}</strong></p>`,
    input: "select",
    inputOptions: {
      Borrador: "Borrador",
      "En Proceso": "En Proceso",
      Pendiente: "Pendiente",
      Completado: "Completado",
    },
    inputPlaceholder: "Seleccione un nuevo estado",
    showCancelButton: true,
    confirmButtonText: "Actualizar Estado",
    cancelButtonText: "Cancelar",
    inputValidator: (v) => {
      if (!v) return "¡Necesitas seleccionar un estado!";
    },
  });
  if (result.isConfirmed) {
    const nuevoEstado = result.value;
    try {
      Swal.fire({
        title: "Procesando...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });
      const client = getSupabaseClient();
      const {
        data: { session },
      } = await client.auth.getSession();
      if (!session?.user?.id) throw new Error("No se pudo obtener la sesión");
      const { data, error } = await client.rpc("fn_cambiar_estado_venta", {
        id_venta_a_cambiar: idVenta,
        nuevo_estado: nuevoEstado,
        id_usuario_responsable: session.user.id,
      });
      if (error) throw new Error(error.message);
      if (data?.exito === false)
        throw new Error(data.mensaje || "Error al cambiar estado");
      Swal.fire({
        icon: "success",
        title: "Estado Actualizado",
        text: `Estado cambiado a "${nuevoEstado}" exitosamente.`,
      });
      if (nuevoEstado === "Completado" && saldoPendiente > 0) {
        const rp = await Swal.fire({
          title: `Venta ${codigoVenta} Completada`,
          html: `<p>¿Deseas registrar un pago ahora?</p>`,
          icon: "success",
          showCancelButton: true,
          confirmButtonText: "Sí, registrar pago",
          cancelButtonText: "No, más tarde",
        });
        if (rp.isConfirmed)
          await mostrarDialogoAgregarPago(
            idVenta,
            codigoVenta,
            nombreCliente,
            saldoPendiente,
          );
      }
      await ejecutarBusquedaDeVentas();
    } catch (e) {
      const esStock = /stock|inventario|insuficiente|disponible/i.test(
        e.message,
      );
      Swal.fire({
        icon: esStock ? "warning" : "error",
        title: esStock ? "Stock Insuficiente" : "Error",
        text: e.message,
        confirmButtonColor: esStock ? "#f39c12" : "#d33",
      });
    }
  }
}

async function mostrarDialogoAgregarPago(
  idVenta,
  codigoVenta,
  nombreCliente,
  saldoPendiente,
) {
  const client = getSupabaseClient();
  let cuentasBancarias = [];
  try {
    const { data: cuentas } = await client
      .from("cuentas_bancarias_empresa")
      .select("id, nombre_cuenta, numero_cuenta")
      .order("nombre_cuenta");
    if (cuentas) cuentasBancarias = cuentas;
  } catch (e) {}

  const opcionesCuentas = cuentasBancarias
    .map(
      (c) =>
        `<option value="${c.id}">${c.nombre_cuenta} - ${c.numero_cuenta || ""}</option>`,
    )
    .join("");

  const result = await Swal.fire({
    title: `Registrar Pago - ${codigoVenta}`,
    width: "600px",
    html: `
      <div style="max-width:500px;margin:0 auto;padding:10px;">
        <div style="background:#f8f9fa;border-radius:8px;padding:15px;margin-bottom:20px;display:flex;justify-content:space-between;">
          <div><div style="font-size:12px;color:#6c757d;">Cliente</div><div style="font-weight:600;">${nombreCliente}</div></div>
          <div style="text-align:right;"><div style="font-size:12px;color:#6c757d;">Saldo Pendiente</div><div style="font-size:18px;font-weight:bold;color:#dc3545;">${formatCurrency(saldoPendiente)}</div></div>
        </div>
        <div style="margin-bottom:15px;"><label style="display:block;margin-bottom:5px;font-weight:500;">Fecha del Pago *</label>
          <input type="text" id="swal-fecha-pago" class="swal2-input" style="width:100%;margin:0;padding:12px;border:2px solid #e0e0e0;border-radius:6px;"></div>
        <div style="margin-bottom:15px;"><label style="display:block;margin-bottom:5px;font-weight:500;">Método de Pago *</label>
          <select id="swal-metodo" class="swal2-input" style="width:100%;margin:0;padding:12px;border:2px solid #e0e0e0;border-radius:6px;">
            <option value="Efectivo" selected>Efectivo</option><option value="Transferencia">Transferencia</option><option value="Pago Mixto">Pago Mixto</option></select></div>
        <div id="campos-simple">
          <div style="margin-bottom:15px;"><label style="display:block;margin-bottom:5px;font-weight:500;">Monto *</label>
            <input type="number" id="swal-monto" class="swal2-input" step="0.01" min="0" max="${saldoPendiente}" value="${saldoPendiente}" style="width:100%;margin:0;padding:12px;border:2px solid #e0e0e0;border-radius:6px;"></div>
          <div id="campo-cuenta" style="display:none;">
            <div style="margin-bottom:15px;"><label style="display:block;margin-bottom:5px;font-weight:500;">Cuenta Destino *</label>
              <select id="swal-cuenta" class="swal2-input" style="width:100%;margin:0;padding:12px;border:2px solid #e0e0e0;border-radius:6px;"><option value="">Seleccione Cuenta...</option>${opcionesCuentas}</select></div>
            <div style="margin-bottom:15px;"><label style="display:block;margin-bottom:5px;font-weight:500;">Referencia <span style="color:#999;font-size:12px;">(opcional)</span></label>
              <input type="text" id="swal-referencia" class="swal2-input" placeholder="# de transacción" style="width:100%;margin:0;padding:12px;border:2px solid #e0e0e0;border-radius:6px;"></div></div></div>
        <div id="campos-mixto" style="display:none;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:15px;">
            <div><label style="display:block;margin-bottom:5px;font-weight:500;font-size:13px;">Monto Efectivo *</label>
              <input type="number" id="swal-monto-efectivo" class="swal2-input" placeholder="0.00" step="0.01" min="0" value="0" style="width:100%;margin:0;padding:10px;border:2px solid #e0e0e0;border-radius:6px;"></div>
            <div><label style="display:block;margin-bottom:5px;font-weight:500;font-size:13px;">Monto Transferencia *</label>
              <input type="number" id="swal-monto-transferencia" class="swal2-input" placeholder="0.00" step="0.01" min="0" value="0" style="width:100%;margin:0;padding:10px;border:2px solid #e0e0e0;border-radius:6px;"></div></div>
          <div style="margin-bottom:15px;"><label style="display:block;margin-bottom:5px;font-weight:500;">Cuenta (Transferencia) *</label>
            <select id="swal-cuenta-mixto" class="swal2-input" style="width:100%;margin:0;padding:12px;border:2px solid #e0e0e0;border-radius:6px;"><option value="">Seleccione Cuenta...</option>${opcionesCuentas}</select></div>
          <div style="margin-bottom:10px;"><label style="display:block;margin-bottom:5px;font-weight:500;">Referencia <span style="color:#999;font-size:12px;">(opcional)</span></label>
            <input type="text" id="swal-referencia-mixto" class="swal2-input" placeholder="# de transacción" style="width:100%;margin:0;padding:12px;border:2px solid #e0e0e0;border-radius:6px;"></div></div>
      </div>`,
    showCancelButton: true,
    confirmButtonText: "Registrar Pago",
    cancelButtonText: "Cancelar",
    didOpen: () => {
      const selectMetodo = document.getElementById("swal-metodo"),
        camposSimple = document.getElementById("campos-simple"),
        camposMixto = document.getElementById("campos-mixto"),
        campoCuenta = document.getElementById("campo-cuenta");
      if (typeof flatpickr !== "undefined") {
        const now = new Date(),
          fl = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        flatpickr("#swal-fecha-pago", {
          locale: "es",
          enableTime: false,
          dateFormat: "Y-m-d",
          altInput: true,
          altFormat: "d/m/Y",
          defaultDate: fl,
          maxDate: "today",
        });
      }
      selectMetodo.addEventListener("change", function () {
        const m = this.value;
        if (m === "Pago Mixto") {
          camposSimple.style.display = "none";
          camposMixto.style.display = "block";
        } else {
          camposSimple.style.display = "block";
          camposMixto.style.display = "none";
          campoCuenta.style.display = m === "Transferencia" ? "block" : "none";
        }
      });
    },
    preConfirm: () => {
      const metodo = document.getElementById("swal-metodo").value,
        fechaPago = document.getElementById("swal-fecha-pago").value;
      if (!fechaPago) {
        Swal.showValidationMessage("Debe seleccionar una fecha");
        return false;
      }
      if (metodo === "Pago Mixto") {
        const me =
            parseFloat(document.getElementById("swal-monto-efectivo").value) ||
            0,
          mt =
            parseFloat(
              document.getElementById("swal-monto-transferencia").value,
            ) || 0;
        const cm = document.getElementById("swal-cuenta-mixto").value,
          rm = document.getElementById("swal-referencia-mixto").value;
        if (me + mt <= 0) {
          Swal.showValidationMessage("Ingrese al menos un monto");
          return false;
        }
        if (me + mt > saldoPendiente) {
          Swal.showValidationMessage("El total excede el saldo pendiente");
          return false;
        }
        if (mt > 0 && !cm) {
          Swal.showValidationMessage(
            "Seleccione una cuenta para la transferencia",
          );
          return false;
        }
        return {
          metodo: "Pago Mixto",
          montoEfectivo: me,
          montoTransferencia: mt,
          cuenta: cm,
          referencia: rm,
          fechaPago,
        };
      } else {
        const monto = parseFloat(document.getElementById("swal-monto").value),
          cuenta = document.getElementById("swal-cuenta")?.value || null,
          referencia =
            document.getElementById("swal-referencia")?.value || null;
        if (!monto || monto <= 0) {
          Swal.showValidationMessage("Ingrese un monto válido");
          return false;
        }
        if (monto > saldoPendiente) {
          Swal.showValidationMessage("El monto excede el saldo pendiente");
          return false;
        }
        if (metodo === "Transferencia" && !cuenta) {
          Swal.showValidationMessage("Seleccione una cuenta destino");
          return false;
        }
        return { metodo, monto, cuenta, referencia, fechaPago };
      }
    },
  });

  if (result.isConfirmed) {
    try {
      Swal.fire({
        title: "Procesando...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });
      const {
        data: { session },
      } = await client.auth.getSession();
      if (!session?.user?.id) throw new Error("No se pudo obtener la sesión");
      const uid = session.user.id;

      if (result.value.metodo === "Pago Mixto") {
        if (result.value.montoEfectivo > 0) {
          const { data: de, error: ee } = await client.rpc(
            "fn_agregar_pago_venta",
            {
              id_venta: idVenta,
              monto: result.value.montoEfectivo,
              metodo_pago: "Efectivo",
              id_cuenta_bancaria_destino: null,
              referencia_pago: null,
              fecha_pago: result.value.fechaPago,
              id_usuario_responsable: uid,
              empresa_id: null,
            },
          );
          if (ee) {
            Swal.fire({ icon: "error", title: "Error", text: ee.message });
            return;
          }
          if (de?.exito === false) {
            Swal.fire({ icon: "error", title: "Error", text: de.mensaje });
            return;
          }
        }
        if (result.value.montoTransferencia > 0) {
          const { data: dt, error: et } = await client.rpc(
            "fn_agregar_pago_venta",
            {
              id_venta: idVenta,
              monto: result.value.montoTransferencia,
              metodo_pago: "Transferencia",
              id_cuenta_bancaria_destino: result.value.cuenta || null,
              referencia_pago: result.value.referencia || null,
              fecha_pago: result.value.fechaPago,
              id_usuario_responsable: uid,
              empresa_id: null,
            },
          );
          if (et) {
            Swal.fire({ icon: "error", title: "Error", text: et.message });
            return;
          }
          if (dt?.exito === false) {
            Swal.fire({ icon: "error", title: "Error", text: dt.mensaje });
            return;
          }
        }
        Swal.fire({
          icon: "success",
          title: "Pagos Registrados",
          html: `<ul style="text-align:left;display:inline-block;">${result.value.montoEfectivo > 0 ? `<li>Efectivo: ${formatCurrency(result.value.montoEfectivo)}</li>` : ""}${result.value.montoTransferencia > 0 ? `<li>Transferencia: ${formatCurrency(result.value.montoTransferencia)}</li>` : ""}</ul><p><strong>Total: ${formatCurrency(result.value.montoEfectivo + result.value.montoTransferencia)}</strong></p>`,
        });
      } else {
        const { data, error } = await client.rpc("fn_agregar_pago_venta", {
          id_venta: idVenta,
          monto: result.value.monto,
          metodo_pago: result.value.metodo,
          id_cuenta_bancaria_destino: result.value.cuenta || null,
          referencia_pago: result.value.referencia || null,
          fecha_pago: result.value.fechaPago,
          id_usuario_responsable: uid,
          empresa_id: null,
        });
        if (error) {
          Swal.fire({ icon: "error", title: "Error", text: error.message });
          return;
        }
        if (data?.exito === false) {
          Swal.fire({ icon: "error", title: "Error", text: data.mensaje });
          return;
        }
        Swal.fire({
          icon: "success",
          title: "Pago Registrado",
          text: `Pago de ${formatCurrency(result.value.monto)} registrado exitosamente.`,
        });
      }
      await ejecutarBusquedaDeVentas();
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    }
  }
}

async function mostrarDialogoGestionarPagos(
  idVenta,
  codigoVenta,
  nombreCliente,
  estado,
) {
  const ventaAnulada = estado === "Anulada";
  try {
    Swal.fire({
      title: "Cargando pagos...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    const client = getSupabaseClient();
    const { data, error } = await client.rpc("fn_obtener_venta_detalle", {
      p_id_venta: idVenta,
    });
    if (error) throw new Error(error.message);
    if (!data?.exito)
      throw new Error(data?.mensaje || "No se pudieron obtener los pagos");

    const venta = data.datos;
    const pagos = venta.pagos_venta || [];
    const totalPagado = pagos.reduce(
      (s, p) => s + (parseFloat(p.monto) || 0),
      0,
    );
    const saldoPendiente = venta.monto_total - totalPagado;

    // ── Tarjetas de resumen ──────────────────────────────────────────────────
    const resumenHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:16px 0;">
        <div style="background:#f8f9fa;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:11px;color:#6c757d;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">TOTAL</div>
          <div style="font-size:18px;font-weight:700;color:#212529;">${formatCurrency(venta.monto_total)}</div>
        </div>
        <div style="background:#f8f9fa;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:11px;color:#6c757d;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">PAGADO</div>
          <div style="font-size:18px;font-weight:700;color:#28a745;">${formatCurrency(totalPagado)}</div>
        </div>
        <div style="background:#f8f9fa;border-radius:8px;padding:12px;text-align:center;">
          <div style="font-size:11px;color:#6c757d;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">SALDO</div>
          <div style="font-size:18px;font-weight:700;color:${saldoPendiente > 0 ? "#dc3545" : "#28a745"};">${formatCurrency(saldoPendiente)}</div>
        </div>
      </div>`;

    // ── Alerta venta anulada ─────────────────────────────────────────────────
    const mensajeAnulada = ventaAnulada
      ? `
      <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
        <i class="fas fa-exclamation-triangle" style="color:#856404;font-size:16px;flex-shrink:0;"></i>
        <span style="color:#856404;font-size:13px;"><strong>Venta Anulada</strong> — No se pueden realizar movimientos de pagos.</span>
      </div>`
      : "";

    // ── Tarjetas de pagos ────────────────────────────────────────────────────
    let htmlPagos = "";
    if (pagos.length > 0) {
      htmlPagos = pagos
        .map((p, idx) => {
          // ✅ FIX fecha UTC
          const fechaPago = moment.utc(p.fecha_pago).format("DD/MM/YYYY");

          // Icono y color según método
          const iconoMetodo =
            p.metodo_pago === "Transferencia"
              ? `<i class="fas fa-university" style="color:#3498db;margin-right:5px;"></i>`
              : p.metodo_pago === "Pago Mixto"
                ? `<i class="fas fa-layer-group" style="color:#9b59b6;margin-right:5px;"></i>`
                : `<i class="fas fa-money-bill-wave" style="color:#27ae60;margin-right:5px;"></i>`;

          // Cuenta y referencia
          let cuentaRefHTML = "";
          if (
            (p.metodo_pago === "Transferencia" ||
              p.metodo_pago === "Pago Mixto") &&
            (p.nombre_cuenta_destino || p.referencia_pago)
          ) {
            cuentaRefHTML = `
            <div style="margin-top:6px;padding:6px 8px;background:#f0f4ff;border-radius:4px;font-size:12px;">
              ${
                p.nombre_cuenta_destino
                  ? `<span style="font-weight:600;color:#2c3e50;"><i class="fas fa-credit-card" style="margin-right:4px;color:#3498db;"></i>${p.nombre_cuenta_destino}</span>`
                  : ""
              }
              ${
                p.referencia_pago
                  ? `<span style="color:#7f8c8d;margin-left:8px;"><i class="fas fa-hashtag" style="margin-right:2px;"></i>${p.referencia_pago}</span>`
                  : ""
              }
            </div>`;
          }

          const dis = ventaAnulada ? "disabled" : "";
          const cur = ventaAnulada ? "not-allowed" : "pointer";
          const op = ventaAnulada ? "0.4" : "1";

          return `
          <div style="background:#fff;border:1px solid #e9ecef;border-radius:8px;padding:12px 14px;margin-bottom:10px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">

              <!-- Columna izquierda: fecha + método + cuenta -->
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
                  <span style="font-size:13px;color:#495057;white-space:nowrap;">
                    <i class="fas fa-calendar-alt" style="color:#adb5bd;margin-right:4px;"></i>${fechaPago}
                  </span>
                  <span style="font-size:13px;font-weight:600;white-space:nowrap;">
                    ${iconoMetodo}${p.metodo_pago}
                  </span>
                </div>
                ${cuentaRefHTML}
              </div>

              <!-- Columna derecha: monto + acciones -->
              <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
                <span style="font-size:16px;font-weight:700;color:#212529;white-space:nowrap;">
                  ${formatCurrency(p.monto)}
                </span>
                <div style="display:flex;gap:4px;">
                  <button class="btn-accion-pago" data-accion="editar" data-index="${idx}"
                          style="background:none;border:1px solid #3498db;border-radius:5px;cursor:${cur};padding:5px 8px;opacity:${op};color:#3498db;"
                          title="Editar pago" ${dis}>
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn-accion-pago" data-accion="borrar" data-index="${idx}"
                          style="background:none;border:1px solid #e74c3c;border-radius:5px;cursor:${cur};padding:5px 8px;opacity:${op};color:#e74c3c;"
                          title="Eliminar pago" ${dis}>
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>

            </div>
          </div>`;
        })
        .join("");
    } else {
      htmlPagos = `
        <div style="text-align:center;padding:30px 0;color:#adb5bd;">
          <i class="fas fa-receipt" style="font-size:36px;margin-bottom:10px;display:block;"></i>
          <p style="margin:0;font-size:14px;">No se han registrado pagos para esta venta.</p>
        </div>`;
    }

    await Swal.fire({
      title: "Gestión de Pagos",
      width: "560px",
      showConfirmButton: false,
      showCloseButton: true,
      customClass: { popup: "swal-pagos-popup" },
      willClose: () => ejecutarBusquedaDeVentas(),
      html: `
        <div style="text-align:center;margin-bottom:4px;">
          <p style="font-size:15px;margin:0;">Venta <strong>${codigoVenta}</strong></p>
          <p style="font-size:13px;color:#6c757d;margin:4px 0 0;">${nombreCliente}</p>
        </div>
        ${resumenHTML}
        ${mensajeAnulada}
        <div style="max-height:340px;overflow-y:auto;padding-right:2px;">
          ${htmlPagos}
        </div>
        <div style="margin-top:14px;border-top:1px solid #e9ecef;padding-top:14px;">
          <button id="btn-registrar-pago" class="swal2-confirm swal2-styled"
                  style="background-color:#3498db;width:100%;justify-content:center;">
            <i class="fas fa-plus" style="margin-right:6px;"></i> Registrar Nuevo Pago
          </button>
        </div>`,
      didOpen: () => {
        const btnRP = document.getElementById("btn-registrar-pago");
        if (btnRP && ventaAnulada) {
          btnRP.disabled = true;
          btnRP.style.opacity = "0.5";
          btnRP.style.cursor = "not-allowed";
          btnRP.title = "No se pueden registrar pagos (venta anulada)";
        } else if (btnRP && saldoPendiente > 0) {
          btnRP.addEventListener("click", async () => {
            Swal.close();
            await mostrarDialogoAgregarPago(
              idVenta,
              codigoVenta,
              nombreCliente,
              saldoPendiente,
            );
            await mostrarDialogoGestionarPagos(
              idVenta,
              codigoVenta,
              nombreCliente,
              estado,
            );
          });
        } else if (btnRP) {
          btnRP.disabled = true;
          btnRP.style.opacity = "0.5";
          btnRP.title = "La venta está completamente pagada";
        }

        document.querySelectorAll(".btn-accion-pago").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const accion = btn.dataset.accion;
            const idx = parseInt(btn.dataset.index);
            const pago = pagos[idx];
            if (accion === "editar") {
              Swal.close();
              await editarPago(pago, idVenta, codigoVenta, nombreCliente);
              await mostrarDialogoGestionarPagos(
                idVenta,
                codigoVenta,
                nombreCliente,
                estado,
              );
            } else if (accion === "borrar") {
              await borrarPago(
                pago,
                idVenta,
                codigoVenta,
                nombreCliente,
                estado,
              );
            }
          });
        });
      },
    });
  } catch (e) {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "Error al cargar los pagos: " + e.message,
    });
  }
}

async function editarPago(pago, idVenta, codigoVenta, nombreCliente) {
  const client = getSupabaseClient();
  let montoMax = 0;
  try {
    const { data } = await client.rpc("fn_obtener_venta_detalle", {
      p_id_venta: idVenta,
    });
    if (data?.exito) {
      montoMax =
        data.datos.monto_total -
        (data.datos.pagos_venta || [])
          .filter((p) => p.id !== pago.id)
          .reduce((s, p) => s + parseFloat(p.monto), 0);
    }
  } catch (e) {}

  let cuentasBancarias = [];
  try {
    const { data: c } = await client
      .from("cuentas_bancarias_empresa")
      .select("id,nombre_cuenta,numero_cuenta")
      .order("nombre_cuenta");
    if (c) cuentasBancarias = c;
  } catch (e) {}

  const opcionesCuentas = cuentasBancarias
    .map(
      (c) =>
        `<option value="${c.id}" ${c.id === pago.id_cuenta_bancaria_destino ? "selected" : ""}>${c.nombre_cuenta}</option>`,
    )
    .join("");

  const result = await Swal.fire({
    title: `Editar Pago - ${codigoVenta}`,
    width: "500px",
    html: `<div style="text-align:left;padding:0 20px;">
      <p style="margin-bottom:15px;color:#666;font-size:14px;">Monto máximo: <strong style="color:#27ae60;">${formatCurrency(montoMax)}</strong></p>
      <label style="display:block;margin-bottom:5px;font-weight:500;">Fecha del Pago:</label>
      <input type="text" id="edit-fecha-pago" class="swal2-input" style="margin-bottom:15px;">
      <label style="display:block;margin-bottom:5px;font-weight:500;">Monto:</label>
      <input type="number" id="edit-monto" class="swal2-input" value="${pago.monto}" step="0.01" min="0" max="${montoMax}" style="margin-bottom:15px;">
      <label style="display:block;margin-bottom:5px;font-weight:500;">Método de Pago:</label>
      <select id="edit-metodo" class="swal2-input" style="margin-bottom:15px;">
        <option value="Efectivo" ${pago.metodo_pago === "Efectivo" ? "selected" : ""}>Efectivo</option>
        <option value="Transferencia" ${pago.metodo_pago === "Transferencia" ? "selected" : ""}>Transferencia</option>
      </select>
      <div id="edit-campo-cuenta" style="display:${pago.metodo_pago === "Transferencia" ? "block" : "none"};">
        <label style="display:block;margin-bottom:5px;font-weight:500;">Cuenta Destino:</label>
        <select id="edit-cuenta" class="swal2-input" style="margin-bottom:15px;"><option value="">Seleccione Cuenta...</option>${opcionesCuentas}</select>
      </div>
      <label style="display:block;margin-bottom:5px;font-weight:500;">Referencia (Opcional):</label>
      <input type="text" id="edit-referencia" class="swal2-input" value="${pago.referencia_pago || ""}" placeholder="# de transacción">
    </div>`,
    showCancelButton: true,
    confirmButtonText: "Guardar Cambios",
    cancelButtonText: "Cancelar",
    didOpen: () => {
      const sm = document.getElementById("edit-metodo"),
        cc = document.getElementById("edit-campo-cuenta");
      if (typeof flatpickr !== "undefined") {
        // ✅ FIX: extraer fecha sin conversión UTC
        const fp = pago.fecha_pago ? pago.fecha_pago.split("T")[0] : null;
        flatpickr("#edit-fecha-pago", {
          locale: "es",
          enableTime: false,
          dateFormat: "Y-m-d",
          altInput: true,
          altFormat: "d/m/Y",
          defaultDate: fp,
          maxDate: "today",
        });
      }
      sm.addEventListener("change", function () {
        cc.style.display = this.value === "Transferencia" ? "block" : "none";
      });
    },
    preConfirm: () => {
      const fechaPago = document.getElementById("edit-fecha-pago").value,
        metodo = document.getElementById("edit-metodo").value;
      const monto = parseFloat(document.getElementById("edit-monto").value),
        cuenta = document.getElementById("edit-cuenta")?.value || null;
      const referencia = document.getElementById("edit-referencia").value;
      if (!fechaPago) {
        Swal.showValidationMessage("Seleccione una fecha");
        return false;
      }
      if (!monto || monto <= 0) {
        Swal.showValidationMessage("Ingrese un monto válido");
        return false;
      }
      if (monto > montoMax) {
        Swal.showValidationMessage(
          `El monto no puede exceder ${formatCurrency(montoMax)}`,
        );
        return false;
      }
      if (metodo === "Transferencia" && !cuenta) {
        Swal.showValidationMessage("Seleccione una cuenta");
        return false;
      }
      return { fechaPago, monto, metodo, cuenta, referencia };
    },
  });

  if (result.isConfirmed) {
    try {
      Swal.fire({
        title: "Actualizando...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });
      const { data, error } = await client.rpc("fn_editar_pago_venta", {
  id_pago: pago.id,
  monto: result.value.monto,
  metodo_pago: result.value.metodo,
  id_cuenta_bancaria_destino: result.value.cuenta || null,
  referencia_pago: result.value.referencia || null,
  p_fecha_pago: result.value.fechaPago
    ? new Date(result.value.fechaPago + "T12:00:00").toISOString()
    : null,
});
      if (error) {
        Swal.fire({ icon: "error", title: "Error", text: error.message });
        return;
      }
      if (data?.exito === false) {
        Swal.fire({ icon: "error", title: "Error", text: data.mensaje });
        return;
      }
      Swal.fire({
        icon: "success",
        title: "Pago Actualizado",
        text: "El pago se actualizó correctamente",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    }
  }
}

async function borrarPago(pago, idVenta, codigoVenta, nombreCliente, estado) {
  const result = await Swal.fire({
    title: "¿Eliminar este pago?",
    html: `<p>Venta: <strong>${codigoVenta}</strong></p><p>Monto: <strong>${formatCurrency(pago.monto)}</strong></p><p>Método: <strong>${pago.metodo_pago}</strong></p><p style="color:#e74c3c;margin-top:15px;">Esta acción no se puede deshacer.</p>`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#e74c3c",
  });
  if (result.isConfirmed) {
    try {
      Swal.fire({
        title: "Eliminando...",
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });
      const client = getSupabaseClient();
      const { data, error } = await client.rpc("fn_eliminar_pago_venta", {
        id_pago: pago.id,
      });
      if (error || data?.exito === false)
        throw new Error(data?.mensaje || error?.message || "Error al eliminar");
      Swal.fire({
        icon: "success",
        title: "Pago Eliminado",
        text: "El pago se eliminó correctamente",
        timer: 1500,
        showConfirmButton: false,
      });
      setTimeout(
        () =>
          mostrarDialogoGestionarPagos(
            idVenta,
            codigoVenta,
            nombreCliente,
            estado,
          ),
        1500,
      );
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error", text: e.message });
    }
  }
}

// ========================================
// COMPARTIR TICKET POR WHATSAPP
// ========================================
async function compartirTicketWhatsApp(idVenta, codigoVenta) {
  try {
    toastr.info("Preparando ticket para WhatsApp...");

    // 1. Obtener datos de la venta
    const client = getSupabaseClient();
    const { data, error } = await client.rpc("fn_obtener_venta_detalle", {
      p_id_venta: idVenta,
    });
    if (error) throw new Error(error.message);
    if (!data?.exito)
      throw new Error(data?.mensaje || "No se pudo obtener la venta");

    const venta = data.datos;

    // 2. Generar contenido del ticket
    const contenidoTicket = generarContenidoFacturaPOS(venta);

    // 3. Crear elemento HTML temporal del ticket para renderizar como imagen
    const ticketEl = document.createElement("div");
    ticketEl.style.cssText = `
      position: fixed;
      left: -9999px;
      top: 0;
      background: white;
      padding: 20px 24px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      line-height: 1.5;
      width: 380px;
      color: #000;
      white-space: pre;
    `;
    ticketEl.textContent = contenidoTicket;
    document.body.appendChild(ticketEl);

    // 4. Renderizar a canvas con html2canvas
    const canvas = await html2canvas(ticketEl, {
      backgroundColor: "#ffffff",
      scale: 2, // Alta resolución para que se vea nítido en WhatsApp
      useCORS: true,
      logging: false,
    });

    // 5. Limpiar elemento temporal
    document.body.removeChild(ticketEl);

    // 6. Convertir canvas a blob y copiar al portapapeles
    canvas.toBlob(async (blob) => {
      try {
        // Copiar imagen al portapapeles
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);

        // 7. Obtener teléfono del cliente
        const telefono = venta.clientes?.telefono_principal || "";
        const telefonoLimpio = telefono.replace(/\D/g, ""); // quitar caracteres no numéricos
        const telefonoColombia = telefonoLimpio.startsWith("57")
          ? telefonoLimpio
          : `57${telefonoLimpio}`;

        // 8. Mensaje de texto para WhatsApp
        const mensaje = encodeURIComponent(
          `Hola! 👋 Adjunto el pedido *${venta.codigo_venta}*.
Por favor revisalo y confirma si está correcto.`,
        );

        // 9. Mostrar instrucción y abrir WhatsApp
        await Swal.fire({
          icon: "success",
          title: "¡Listo! 📋",
          html: `
            <p>La imagen del ticket fue <strong>copiada al portapapeles</strong>.</p>
            <p style="margin-top:10px;">WhatsApp se abrirá ahora.<br>
            Solo haz <strong>Ctrl+V</strong> en el chat para pegar la imagen.</p>
          `,
          confirmButtonText: "Abrir WhatsApp",
          confirmButtonColor: "#25d366",
          showCancelButton: true,
          cancelButtonText: "Cerrar",
        }).then((result) => {
          if (result.isConfirmed) {
            // Abrir WhatsApp Desktop con el número del cliente
            if (telefonoLimpio) {
              window.location.href = `whatsapp://send?phone=${telefonoColombia}&text=${mensaje}`;
            } else {
              // Sin teléfono: abrir WhatsApp sin número
              window.location.href = `whatsapp://send?text=${mensaje}`;
              toastr.warning(
                "El cliente no tiene teléfono registrado. Se abrió WhatsApp sin número.",
                "Sin teléfono",
              );
            }
          }
        });
      } catch (clipErr) {
        console.error("[WhatsApp] Error al copiar al portapapeles:", clipErr);
        // Fallback: ofrecer descarga si falla el clipboard
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ticket-${codigoVenta}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toastr.warning(
          "No se pudo copiar al portapapeles. La imagen fue descargada.",
          "Descargada",
        );
      }
    }, "image/png");
  } catch (err) {
    console.error("[WhatsApp] Error:", err);
    toastr.error("Error al preparar el ticket: " + err.message, "Error");
  }
}

console.log("[Ventas Lista] ✅ Módulo cargado");

// =========================================================================
// MÓDULO DE CATEGORÍAS - GESTIÓN COMPLETA
// =========================================================================

// Variables globales
let modalCategoria;
let formCategoria;
let modalCategoriaTitulo;

let estadoInicialFormularioCategoria = {};

// =========================================================================
// FUNCIÓN DE INICIALIZACIÓN DEL MÓDULO
// =========================================================================

async function cargarPaginaCategorias() {
  console.log("[Categorías] ===== INICIALIZANDO MÓDULO DE CATEGORÍAS =====");
  try {
    configurarPaginaCategoriasYListeners();
    await cargarDatosTablaCategorias();
    console.log("[Categorías] ✓ Módulo inicializado correctamente");
  } catch (error) {
    console.error("[Categorías] Error al inicializar módulo:", error);
    toastr.error(
      "Error al cargar el módulo de categorías: " + error.message,
      "Error de Inicialización",
    );
  }
}

function configurarPaginaCategoriasYListeners() {
  console.log("[Categorías] Configurando event listeners...");

  if (typeof inicializarModalCategoria === "function") {
    inicializarModalCategoria();
  }

  const btnAbrirModal = document.getElementById(
    "btn-abrir-modal-nueva-categoria",
  );
  if (btnAbrirModal) {
    btnAbrirModal.addEventListener("click", () => abrirModalCategoria("add"));
  }

  const searchBar = document.getElementById("input-buscar-categorias");
  if (searchBar) {
    searchBar.addEventListener("input", manejarBusquedaCategorias);
  }

  const tableContainer = document.querySelector(".data-table-default");
  if (tableContainer) {
    tableContainer.addEventListener("click", manejarAccionesTablaCategorias);
  }

  console.log("[Categorías] ✓ Event listeners configurados");
}

// =========================================================================
// MODAL
// =========================================================================

function inicializarModalCategoria() {
  console.log("[Categorías] Inicializando modal...");

  modalCategoria = document.getElementById("modal-categoria");
  formCategoria = document.getElementById("form-categoria");
  modalCategoriaTitulo = document.getElementById("modal-categoria-titulo");

  if (!modalCategoria || !formCategoria) {
    console.error("[Categorías] Modal no encontrado en el DOM");
    return;
  }

  const btnCerrarX = document.getElementById("btn-cerrar-modal-categoria-x");
  if (btnCerrarX) btnCerrarX.addEventListener("click", cerrarModalCategoria);

  const btnCancelar = document.getElementById(
    "btn-cancelar-operacion-categoria",
  );
  if (btnCancelar) btnCancelar.addEventListener("click", cerrarModalCategoria);

  modalCategoria.addEventListener("click", (e) => {
    if (e.target === modalCategoria) cerrarModalCategoria();
  });

  formCategoria.addEventListener("submit", manejarGuardarCategoria);

  console.log("[Categorías] ✓ Modal inicializado");
}

function abrirModalCategoria(modo = "add", categoriaParaEditar = null) {
  console.log("[Categorías] Abriendo modal en modo:", modo);

  if (!modalCategoria || !formCategoria) {
    console.error("[Categorías] Modal no inicializado");
    return;
  }

  formCategoria.reset();
  limpiarMensajesValidacionCategoria();

  const inputId = document.getElementById("input-id-categoria");
  const btnGuardar = document.getElementById("btn-guardar-cambios-categoria");
  const inputOrden = document.getElementById("input-orden-impresion-categoria");

  if (modo === "edit" && categoriaParaEditar) {
    modalCategoriaTitulo.textContent = "Editar Categoría";
    inputId.value = categoriaParaEditar.id;
    document.getElementById("input-nombre-categoria").value =
      categoriaParaEditar.nombre || "";
    document.getElementById("input-descripcion-categoria").value =
      categoriaParaEditar.descripcion || "";
    if (inputOrden)
      inputOrden.value = categoriaParaEditar.orden_impresion ?? 99;
    btnGuardar.textContent = "Actualizar Categoría";
  } else {
    modalCategoriaTitulo.textContent = "Añadir Nueva Categoría";
    inputId.value = "";
    if (inputOrden) inputOrden.value = 99;
    btnGuardar.textContent = "Guardar Categoría";
  }

  modalCategoria.style.display = "flex";
  setTimeout(() => {
    modalCategoria.classList.add("is-visible");
    document.getElementById("input-nombre-categoria").focus();
  }, 10);

  setTimeout(() => guardarEstadoInicialFormularioCategoria(), 100);
}

function cerrarModalCategoria() {
  if (!modalCategoria) return;

  if (verificarCambiosEnFormularioCategoria()) {
    mostrarModalConfirmacion(
      "Hay cambios sin guardar que se perderán.",
      function () {
        modalCategoria.classList.remove("is-visible");
        setTimeout(() => {
          if (!modalCategoria.classList.contains("is-visible")) {
            modalCategoria.style.display = "none";
          }
        }, 250);
      },
      "¿Cancelar sin guardar?",
    );
  } else {
    modalCategoria.classList.remove("is-visible");
    setTimeout(() => {
      if (!modalCategoria.classList.contains("is-visible")) {
        modalCategoria.style.display = "none";
      }
    }, 250);
  }
}

// =========================================================================
// DIRTY FORM
// =========================================================================

function obtenerValoresActualesFormularioCategoria() {
  return {
    nombre_categoria:
      document.getElementById("input-nombre-categoria")?.value || "",
    descripcion_categoria:
      document.getElementById("input-descripcion-categoria")?.value || "",
    orden_impresion:
      document.getElementById("input-orden-impresion-categoria")?.value || "99",
  };
}

function guardarEstadoInicialFormularioCategoria() {
  estadoInicialFormularioCategoria =
    obtenerValoresActualesFormularioCategoria();
}

function verificarCambiosEnFormularioCategoria() {
  const actual = obtenerValoresActualesFormularioCategoria();
  return (
    actual.nombre_categoria !==
      estadoInicialFormularioCategoria.nombre_categoria ||
    actual.descripcion_categoria !==
      estadoInicialFormularioCategoria.descripcion_categoria ||
    actual.orden_impresion !== estadoInicialFormularioCategoria.orden_impresion
  );
}

// =========================================================================
// CARGA Y RENDERIZADO
// =========================================================================

async function cargarDatosTablaCategorias() {
  const tbodyCategorias = document.getElementById("tbody-categorias");
  if (!tbodyCategorias) return;

  tbodyCategorias.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;font-style:italic;">Obteniendo datos de categorías...</td></tr>`;

  try {
    const client = getSupabaseClient();
    if (!client) throw new Error("Cliente de Supabase no inicializado");

    const { data, error } = await client
      .from("categorias")
      .select(
        "id_categoria, nombre_categoria, descripcion_categoria, orden_impresion, productos(count)",
      )
      .order("orden_impresion", { ascending: true })
      .order("nombre_categoria", { ascending: true });

    if (error) {
      tbodyCategorias.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:red;">Error: ${error.message}</td></tr>`;
      return;
    }

    const processedData = data.map((categoria) => {
      const count =
        categoria.productos &&
        Array.isArray(categoria.productos) &&
        categoria.productos.length > 0 &&
        categoria.productos[0].hasOwnProperty("count")
          ? categoria.productos[0].count
          : 0;
      const { productos, ...rest } = categoria;
      return { ...rest, cantidad_productos: count };
    });

    renderizarTablaCategorias(processedData);
  } catch (error) {
    console.error("[Categorías] Error:", error);
    tbodyCategorias.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:red;">Error: ${error.message}</td></tr>`;
  }
}

function renderizarTablaCategorias(listaCategorias) {
  const tbodyCategorias = document.getElementById("tbody-categorias");
  if (!tbodyCategorias) return;

  tbodyCategorias.innerHTML = "";

  if (!listaCategorias || listaCategorias.length === 0) {
    tbodyCategorias.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;font-style:italic;">No hay categorías registradas.</td></tr>`;
    return;
  }

  listaCategorias.forEach((categoria) => {
    const tr = document.createElement("tr");
    tr.dataset.categoryId = categoria.id_categoria;

    // Nombre
    const tdNombre = document.createElement("td");
    tdNombre.textContent = categoria.nombre_categoria || "(Sin nombre)";
    tr.appendChild(tdNombre);

    // Descripción
    const tdDescripcion = document.createElement("td");
    tdDescripcion.textContent = categoria.descripcion_categoria || "";
    tr.appendChild(tdDescripcion);

    // Orden de impresión
    const tdOrden = document.createElement("td");
    tdOrden.style.textAlign = "center";
    const ordenValor = categoria.orden_impresion ?? 99;
    tdOrden.innerHTML = `
            <span style="
                display: inline-block;
                background: ${ordenValor < 99 ? "#e8f4fd" : "#f5f5f5"};
                color: ${ordenValor < 99 ? "#1a73e8" : "#999"};
                border: 1px solid ${ordenValor < 99 ? "#bdd7f5" : "#e0e0e0"};
                border-radius: 12px;
                padding: 2px 10px;
                font-size: 0.85rem;
                font-weight: 600;
            ">${ordenValor === 99 ? "—" : ordenValor}</span>
        `;
    tr.appendChild(tdOrden);

    // Nº Productos
    const tdNumProductos = document.createElement("td");
    tdNumProductos.textContent = categoria.cantidad_productos || "0";
    tdNumProductos.style.textAlign = "center";
    tr.appendChild(tdNumProductos);

    // Acciones
    const tdAcciones = document.createElement("td");
    tdAcciones.classList.add("cell-actions");
    tdAcciones.innerHTML = `
            <button class="action-button action-button-edit" title="Editar Categoría">
                <i class="fas fa-pencil-alt"></i>
            </button>
            <button class="action-button action-button-delete" title="Eliminar Categoría">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
    tr.appendChild(tdAcciones);

    tbodyCategorias.appendChild(tr);
  });
}

function refrescarTablaCategorias() {
  cargarDatosTablaCategorias();
}

// =========================================================================
// ACCIONES EN TABLA
// =========================================================================

function manejarAccionesTablaCategorias(event) {
  const actionButton = event.target.closest(".action-button");
  if (!actionButton) return;

  const tr = actionButton.closest("tr");
  const categoryId = tr ? tr.dataset.categoryId : null;
  if (!categoryId) return;

  if (actionButton.classList.contains("action-button-edit")) {
    obtenerCategoriaParaEditar(categoryId);
  } else if (actionButton.classList.contains("action-button-delete")) {
    confirmarYEliminarCategoria(categoryId);
  }
}

async function obtenerCategoriaParaEditar(idCategoria) {
  try {
    const client = getSupabaseClient();
    if (!client) throw new Error("Cliente de Supabase no inicializado");

    const { data, error } = await client
      .from("categorias")
      .select("*")
      .eq("id_categoria", idCategoria)
      .single();

    if (error) {
      toastr.error(
        "Error al obtener datos de la categoría: " + error.message,
        "Error",
      );
      return;
    }

    if (!data) {
      toastr.warning("No se encontraron datos de la categoría.", "Advertencia");
      return;
    }

    abrirModalCategoria("edit", {
      id: data.id_categoria,
      nombre: data.nombre_categoria,
      descripcion: data.descripcion_categoria || "",
      orden_impresion: data.orden_impresion ?? 99,
    });
  } catch (error) {
    toastr.error("Error de comunicación: " + error.message, "Error");
  }
}

async function confirmarYEliminarCategoria(idCategoria) {
  const nombreCategoria = obtenerNombreCategoriaDeLaFilaPorId(idCategoria);

  mostrarModalConfirmacion(
    `¿Estás realmente seguro de que quieres eliminar ${nombreCategoria}?\nEsta acción no se puede deshacer.`,
    async function () {
      try {
        const client = getSupabaseClient();
        if (!client) throw new Error("Cliente de Supabase no inicializado");

        const { data, error } = await client.rpc("fn_eliminar_categoria", {
          p_categoria_id: idCategoria,
        });

        if (error) throw error;
        if (!data.exito) throw new Error(data.mensaje);

        toastr.success(data.mensaje, "Éxito");
        refrescarTablaCategorias();
      } catch (error) {
        toastr.error(
          error.message || "Error al eliminar la categoría",
          "Error al Eliminar",
        );
      }
    },
    "Confirmar Eliminación",
  );
}

function obtenerNombreCategoriaDeLaFilaPorId(idCategoria) {
  const tbody = document.getElementById("tbody-categorias");
  if (!tbody) return `ID: ${idCategoria}`;
  const fila = tbody.querySelector(`tr[data-category-id="${idCategoria}"]`);
  if (fila && fila.cells[0]) return `"${fila.cells[0].textContent.trim()}"`;
  return `la categoría seleccionada`;
}

// =========================================================================
// BÚSQUEDA
// =========================================================================

function manejarBusquedaCategorias(event) {
  const searchTerm = quitarAcentos(event.target.value.toLowerCase().trim());
  const tbodyCategorias = document.getElementById("tbody-categorias");
  if (!tbodyCategorias) return;

  const tableRows = tbodyCategorias.querySelectorAll("tr");
  let hayResultados = false;

  tableRows.forEach((row) => {
    if (row.cells.length === 1 && row.cells[0].getAttribute("colspan")) return;

    const nombre = quitarAcentos(row.cells[0]?.textContent.toLowerCase() || "");
    const descripcion = quitarAcentos(
      row.cells[1]?.textContent.toLowerCase() || "",
    );

    if (nombre.includes(searchTerm) || descripcion.includes(searchTerm)) {
      row.style.display = "";
      hayResultados = true;
    } else {
      row.style.display = "none";
    }
  });

  let noResultsRow = tbodyCategorias.querySelector(
    ".no-results-row-categorias",
  );
  if (!hayResultados && searchTerm !== "") {
    if (!noResultsRow) {
      noResultsRow = document.createElement("tr");
      noResultsRow.classList.add("no-results-row-categorias");
      const cell = document.createElement("td");
      cell.setAttribute("colspan", "5");
      cell.textContent =
        "No se encontraron categorías que coincidan con la búsqueda.";
      cell.style.cssText = "text-align:center;padding:15px;font-style:italic;";
      noResultsRow.appendChild(cell);
      tbodyCategorias.appendChild(noResultsRow);
    } else {
      noResultsRow.style.display = "";
    }
  } else if (noResultsRow) {
    noResultsRow.style.display = "none";
  }
}

// =========================================================================
// GUARDAR CATEGORÍA
// =========================================================================

async function manejarGuardarCategoria(event) {
  event.preventDefault();
  limpiarMensajesValidacionCategoria();

  const btnGuardar = document.getElementById("btn-guardar-cambios-categoria");
  const btnCancelar = document.getElementById(
    "btn-cancelar-operacion-categoria",
  );
  const textoOriginal = btnGuardar.textContent;

  try {
    btnGuardar.disabled = true;
    btnCancelar.disabled = true;
    btnGuardar.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    const idCategoria = document
      .getElementById("input-id-categoria")
      .value.trim();
    const nombreCategoria = document
      .getElementById("input-nombre-categoria")
      .value.trim();
    const descripcionCategoria = document
      .getElementById("input-descripcion-categoria")
      .value.trim();
    const ordenImpresion =
      parseInt(
        document.getElementById("input-orden-impresion-categoria")?.value,
      ) || 99;

    // Validaciones
    if (!nombreCategoria) {
      mostrarErrorValidacion(
        "nombre-categoria",
        "El nombre de la categoría es obligatorio",
      );
      return;
    }
    if (nombreCategoria.length > 100) {
      mostrarErrorValidacion(
        "nombre-categoria",
        "El nombre no puede exceder 100 caracteres",
      );
      return;
    }
    if (descripcionCategoria.length > 500) {
      mostrarErrorValidacion(
        "descripcion-categoria",
        "La descripción no puede exceder 500 caracteres",
      );
      return;
    }
    if (isNaN(ordenImpresion) || ordenImpresion < 1 || ordenImpresion > 999) {
      mostrarErrorValidacion(
        "orden-impresion-categoria",
        "El orden debe ser un número entre 1 y 999",
      );
      return;
    }

    const client = getSupabaseClient();
    if (!client) throw new Error("Cliente de Supabase no inicializado");

    let resultado;

    if (idCategoria) {
      // EDITAR
      const { data, error } = await client.rpc("fn_actualizar_categoria", {
        p_categoria_data: {
          id_categoria: idCategoria,
          nombre_categoria: nombreCategoria,
          descripcion_categoria: descripcionCategoria,
          orden_impresion: ordenImpresion,
        },
      });
      if (error) throw error;
      resultado = data;
    } else {
      // CREAR
      const { data, error } = await client.rpc("fn_crear_categoria", {
        p_categoria_data: {
          nombre_categoria: nombreCategoria,
          descripcion_categoria: descripcionCategoria,
          orden_impresion: ordenImpresion,
        },
      });
      if (error) throw error;
      resultado = data;
    }

    if (!resultado.exito) throw new Error(resultado.mensaje);

    toastr.success(resultado.mensaje, "Éxito");

    modalCategoria.classList.remove("is-visible");
    setTimeout(() => {
      if (!modalCategoria.classList.contains("is-visible")) {
        modalCategoria.style.display = "none";
      }
    }, 250);

    refrescarTablaCategorias();
  } catch (error) {
    console.error("[Categorías] Error al guardar:", error);
    toastr.error(error.message || "Error al guardar la categoría", "Error");
  } finally {
    btnGuardar.disabled = false;
    btnCancelar.disabled = false;
    btnGuardar.textContent = textoOriginal;
  }
}

// =========================================================================
// VALIDACIÓN
// =========================================================================

function mostrarErrorValidacion(fieldId, mensaje) {
  const input = document.getElementById("input-" + fieldId);
  const errorDiv = document.getElementById("error-" + fieldId);
  if (input) {
    input.classList.add("is-invalid");
    input.focus();
  }
  if (errorDiv) {
    errorDiv.textContent = mensaje;
    errorDiv.style.display = "block";
  }
}

function limpiarMensajesValidacionCategoria() {
  if (!formCategoria) return;
  formCategoria
    .querySelectorAll(".form-input")
    .forEach((i) => i.classList.remove("is-invalid"));
  formCategoria.querySelectorAll(".validation-message").forEach((m) => {
    m.textContent = "";
    m.style.display = "none";
  });
}

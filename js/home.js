// ========================================
// VALIDACION DE SESION
// ========================================

/**
 * Función principal para inicializar el Home
 * Debe ser llamada manualmente cuando se muestre la vista home
 */
async function inicializarHome() {
  console.log('========== HOME PAGE LOADED ==========');
  configurarLogout();
  configurarEventListenersMenu();
  await inicializarYVerificar();
}

async function inicializarYVerificar() {
  console.log('[HOME] Iniciando proceso de autenticacion...');

  // El cliente ya debe estar inicializado por la app principal
  const client = getSupabaseClient();
  if (!client) {
    console.error('[HOME] Cliente de Supabase no inicializado');
    return;
  }

  await verificarSesion();
}

function mostrarErrorAutenticacion(error) {
  console.error('[HOME] Error de autenticacion:', error);
  // No mostrar alert, solo redirigir silenciosamente
  redirigirALogin();
}

async function verificarSesion() {
  console.log('[HOME] ========== VERIFICANDO SESION ==========');
  console.log('[HOME] URL actual:', window.location.href);

  const client = getSupabaseClient();

  if (!client) {
    console.error('[HOME] Cliente de Supabase no inicializado');
    redirigirALogin();
    return;
  }

  try {
    // Primero buscar sesion guardada localmente
    let sessionData = localStorage.getItem('user_session') || sessionStorage.getItem('user_session');

    if (sessionData) {
      try {
        const session = JSON.parse(sessionData);
        console.log('[HOME] Sesion local encontrada para:', session.user ? session.user.email : 'desconocido');

        // Verificar si no ha expirado
        const ahora = new Date().getTime();
        const tiempoTranscurrido = ahora - session.timestamp;

        if (tiempoTranscurrido < 86400000) { // 24 horas
          console.log('[HOME] Sesion local valida');

          // Restaurar sesion en Supabase si existe
          if (session.supabaseSession) {
            console.log('[HOME] Restaurando sesion en Supabase...');
            const { error: setSessionError } = await client.auth.setSession({
              access_token: session.supabaseSession.access_token,
              refresh_token: session.supabaseSession.refresh_token
            });

            if (setSessionError) {
              console.error('[HOME] Error restaurando sesion en Supabase:', setSessionError);
            } else {
              console.log('[HOME] Sesion restaurada en Supabase');
            }
          }

          // Mostrar informacion del usuario
          if (session.user) {
            mostrarInformacionUsuario(session.user);
            console.log('[HOME] Usuario autenticado:', session.user.email);
            return;
          }
        } else {
          console.log('[HOME] Sesion local expirada');
        }
      } catch (e) {
        console.error('[HOME] Error parseando sesion local:', e);
      }
    }

    // No hay sesion local valida, verificar en Supabase
    console.log('[HOME] No hay sesion local, verificando en Supabase...');
    const { data: { session: supabaseSession }, error: sessionError } = await client.auth.getSession();

    if (supabaseSession && !sessionError) {
      console.log('[HOME] Sesion activa en Supabase, obteniendo perfil completo...');

      // Obtener perfil del usuario con JOIN de empresa y rol
      const { data: perfil, error: perfilError } = await client
        .from('perfiles')
        .select(`
          *,
          empresa:empresas(id, nombre_empresa),
          rol:roles(id, nombre, descripcion)
        `)
        .eq('id', supabaseSession.user.id)
        .single();

      if (perfilError || !perfil) {
        console.error('[HOME] Error obteniendo perfil:', perfilError);
        limpiarSesion();
        redirigirALogin();
        return;
      }

      console.log('[HOME] Perfil obtenido:');
      console.log('[HOME]   Nombre:', perfil.nombre_completo);
      console.log('[HOME]   Empresa:', perfil.empresa?.nombre_empresa);

      // Crear datos de usuario completos
      const userData = {
        id: supabaseSession.user.id,
        email: supabaseSession.user.email,
        nombre_completo: perfil.nombre_completo || supabaseSession.user.email,
        empresa_id: perfil.empresa_id,
        empresa_nombre: perfil.empresa?.nombre_empresa || '',
        rol_id: perfil.rol_id,
        rol_nombre: perfil.rol?.nombre || ''
      };

      console.log('[HOME] Usuario obtenido de Supabase:', userData.email);
      mostrarInformacionUsuario(userData);

      // Guardar sesion localmente
      const sessionData = {
        user: userData,
        timestamp: new Date().getTime(),
        rememberMe: true,
        supabaseSession: supabaseSession
      };
      localStorage.setItem('user_session', JSON.stringify(sessionData));
      console.log('[HOME] Sesion guardada localmente');

      return;
    }

    // No hay sesion valida en ninguna parte
    console.log('[HOME] No se encontro sesion activa, redirigiendo a login...');
    limpiarSesion();
    redirigirALogin();

  } catch (error) {
    console.error('[HOME] Error verificando sesion:', error);
    limpiarSesion();
    redirigirALogin();
  }
}

function mostrarInformacionUsuario(user) {
  console.log('[HOME] Mostrando informacion del usuario:', user.email);

  // Mostrar nombre de usuario
  const loggedUserElement = document.getElementById('loggedUser');
  if (loggedUserElement) {
    loggedUserElement.textContent = user.nombre_completo || user.email;
  }

  // Mostrar nombre de empresa
  const empresaNombreElement = document.getElementById('empresa-nombre');
  if (empresaNombreElement) {
    // Intentar obtener el nombre de la empresa del usuario
    const empresaNombre = user.empresa_nombre || user.user_metadata?.empresa_nombre || '';
    if (empresaNombre) {
      empresaNombreElement.textContent = empresaNombre;
      console.log('[HOME] Nombre de empresa mostrado:', empresaNombre);
    }
  }

  // Mostrar fecha actual
  const currentDateElement = document.getElementById('currentDate');
  if (currentDateElement) {
    const fecha = new Date();
    const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
    currentDateElement.textContent = fecha.toLocaleDateString('es-ES', opciones);
  }
}

function configurarLogout() {
  const logoutButton = document.getElementById('logout-button');
  if (logoutButton) {
    logoutButton.addEventListener('click', function() {
      cerrarSesion();
    });
  }
}

function configurarEventListenersMenu() {
  console.log('[HOME] Configurando event listeners del menú...');

  // Enlace de Clientes
  const clientesLink = document.getElementById('clientes-link');
  if (clientesLink) {
    clientesLink.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('[HOME] Navegando a módulo de clientes...');
      cargarVistaClientes();
    });
    console.log('[HOME] Event listener de Clientes configurado');
  } else {
    console.warn('[HOME] Enlace #clientes-link no encontrado');
  }

  // Enlace de Proveedores
  const proveedoresLink = document.getElementById('proveedores-link');
  if (proveedoresLink) {
    proveedoresLink.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('[HOME] Navegando a módulo de proveedores...');
      cargarVistaProveedores();
    });
    console.log('[HOME] Event listener de Proveedores configurado');
  } else {
    console.warn('[HOME] Enlace #proveedores-link no encontrado');
  }

  // Enlace de Productos (Lista de productos)
  const productosLink = document.getElementById('link-lista-productos');
  if (productosLink) {
    productosLink.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('[HOME] Navegando a módulo de productos...');
      cargarVistaProductos();
    });
    console.log('[HOME] Event listener de Productos configurado');
  } else {
    console.warn('[HOME] Enlace #link-lista-productos no encontrado');
  }

  // Enlace de Agregar Producto (abre modal directamente)
  const agregarProductoLink = document.getElementById('link-agregar-producto');
  if (agregarProductoLink) {
    agregarProductoLink.addEventListener('click', async function(e) {
      e.preventDefault();
      console.log('[HOME] Navegando a Agregar Producto...');

      // Primero cargar la vista de productos
      await cargarVistaProductos();

      // Esperar un momento para que el DOM esté listo
      setTimeout(() => {
        // Verificar que la función existe antes de llamarla
        if (typeof abrirModalProducto === 'function') {
          console.log('[HOME] Abriendo modal de nuevo producto...');
          abrirModalProducto('add');
        } else {
          console.error('[HOME] Función abrirModalProducto no encontrada');
        }
      }, 300);
    });
    console.log('[HOME] Event listener de Agregar Producto configurado');
  } else {
    console.warn('[HOME] Enlace #link-agregar-producto no encontrado');
  }

  // Enlace de Categorías
  const categoriasLink = document.getElementById('link-categorias');
  if (categoriasLink) {
    categoriasLink.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('[HOME] Navegando a módulo de categorías...');
      cargarVistaCategorias();
    });
    console.log('[HOME] Event listener de Categorías configurado');
  } else {
    console.warn('[HOME] Enlace #link-categorias no encontrado');
  }

  // Enlace de Marcas
  const marcasLink = document.getElementById('link-marcas');
  if (marcasLink) {
    marcasLink.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('[HOME] Navegando a módulo de marcas...');
      cargarVistaMarcas();
    });
    console.log('[HOME] Event listener de Marcas configurado');
  } else {
    console.warn('[HOME] Enlace #link-marcas no encontrado');
  }

  // TODO: Agregar más enlaces del menú aquí
}

async function cerrarSesion() {
  console.log('[HOME] ===== CERRANDO SESIÓN =====');

  // Verificar si debe recordar el email antes de limpiar
  const debeRecordar = localStorage.getItem('remembered_email') !== null;
  console.log('[HOME] ¿Debe recordar email?', debeRecordar);

  // Cerrar sesión en Supabase
  const client = getSupabaseClient();
  if (client) {
    try {
      await client.auth.signOut();
      console.log('[HOME] ✓ Sesión de Supabase cerrada');
    } catch (error) {
      console.error('[HOME] Error al cerrar sesión en Supabase:', error);
    }
  }

  // Limpiar sesión local
  localStorage.removeItem('user_session');
  sessionStorage.removeItem('user_session');
  console.log('[HOME] ✓ Sesión local limpiada');

  // Solo limpiar email si NO debe recordar
  if (!debeRecordar) {
    localStorage.removeItem('remembered_email');
    console.log('[HOME] Email NO recordado - datos limpiados');
  } else {
    console.log('[HOME] Email recordado - se mantiene para próximo login');
  }

  // Reiniciar estado global
  currentUser = null;

  // Limpiar el contenido de la work-area para evitar que persista entre sesiones
  const workArea = document.querySelector('.work-area');
  if (workArea) {
    workArea.innerHTML = '';
    console.log('[HOME] ✓ Work-area limpiada');
  }

  // Limpiar campos de login si NO debe recordar
  if (!debeRecordar) {
    setTimeout(() => {
      const emailInput = document.getElementById('email');
      const passwordInput = document.getElementById('password');
      const rememberCheckbox = document.getElementById('remember-me');

      if (emailInput) emailInput.value = '';
      if (passwordInput) passwordInput.value = '';
      if (rememberCheckbox) rememberCheckbox.checked = false;

      console.log('[HOME] ✓ Campos de login limpiados');
    }, 100);
  }

  // Mostrar vista de login
  console.log('[HOME] Redirigiendo a login...');
  if (typeof mostrarVista === 'function') {
    mostrarVista('login');
  } else {
    // Fallback: recargar página
    window.location.replace(window.location.href.split('?')[0]);
  }

  console.log('[HOME] ===== SESIÓN CERRADA CORRECTAMENTE =====');
}

// Mantener funciones heredadas por compatibilidad (ya no se usan internamente)
async function limpiarSesion() {
  localStorage.removeItem('user_session');
  sessionStorage.removeItem('user_session');

  const client = getSupabaseClient();

  if (client) {
    try {
      await client.auth.signOut();
      console.log('[HOME] Sesion de Supabase cerrada');
    } catch (error) {
      console.error('[HOME] Error al cerrar sesion de Supabase:', error);
    }
  }
}

function redirigirALogin() {
  console.log('[HOME] Redirigiendo a login...');
  // En SPA, no recargar la página, solo cambiar la vista
  if (typeof mostrarVista === 'function') {
    mostrarVista('login');
  } else {
    // Fallback: recargar página
    window.location.replace(window.location.href.split('?')[0]);
  }
}

// ========================================
// FUNCIONES UTILITARIAS
// ========================================

function toggleSubMenu(clickedMenuItem) {
  const targetSubmenu = clickedMenuItem.nextElementSibling;

  if (!targetSubmenu || !targetSubmenu.classList.contains('sidebar__submenu')) {
    document.querySelectorAll('.sidebar__item.active').forEach(activeItem => {
        if (activeItem !== clickedMenuItem) {
            activeItem.classList.remove('active');
            const otherSubmenu = activeItem.nextElementSibling;
            if (otherSubmenu && otherSubmenu.classList.contains('sidebar__submenu')) {
                otherSubmenu.style.display = 'none';
            }
        }
    });
    return;
  }

  const isClickedItemActive = clickedMenuItem.classList.contains('active');

  document.querySelectorAll('.sidebar__item').forEach(item => {
    item.classList.remove('active');
    const submenu = item.nextElementSibling;
    if (submenu && submenu.classList.contains('sidebar__submenu')) {
      submenu.style.display = 'none';
    }
  });

  if (!isClickedItemActive) {
    clickedMenuItem.classList.add('active');
    targetSubmenu.style.display = 'flex';
  }
}

function navegarA(idVistaAMostrar) {
    console.log('[HOME] Navegando a vista:', idVistaAMostrar);

    $('.page-view').removeClass('is-active');

    const elemento = $('#' + idVistaAMostrar);
    if (elemento.length > 0) {
        elemento.addClass('is-active');
        console.log('[HOME] Vista activada:', idVistaAMostrar);
    } else {
        console.warn('[HOME] No se encontro el elemento con ID:', idVistaAMostrar);

        setTimeout(() => {
            const elementoRetry = $('#' + idVistaAMostrar);
            if (elementoRetry.length > 0) {
                elementoRetry.addClass('is-active');
                console.log('[HOME] Vista activada en retry:', idVistaAMostrar);
            } else {
                console.error('[HOME] No se pudo activar la vista:', idVistaAMostrar);
            }
        }, 100);
    }
}

// ========================================
// CARGA DINÁMICA DE VISTAS
// ========================================

/**
 * Carga dinámicamente la vista de lista de clientes
 */
async function cargarVistaClientes() {
    console.log('[HOME] Cargando vista de clientes...');

    const workArea = document.querySelector('.work-area');
    if (!workArea) {
        console.error('[HOME] No se encontró el área de trabajo');
        return;
    }

    // Mostrar mensaje de carga
    workArea.innerHTML = '<div style="padding:20px; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Cargando módulo de clientes...</div>';

    try {
        // Cargar el HTML de la vista
        const response = await fetch('/views/clientes-lista.html');
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const html = await response.text();

        // Insertar el HTML en el área de trabajo
        workArea.innerHTML = html;

        // Inicializar la vista de clientes
        if (typeof inicializarVistaClientes === 'function') {
            inicializarVistaClientes();
            console.log('[HOME] Vista de clientes cargada e inicializada');
        } else {
            console.error('[HOME] Función inicializarVistaClientes no encontrada');
        }

    } catch (error) {
        console.error('[HOME] Error al cargar vista de clientes:', error);
        workArea.innerHTML = `<div style="padding:20px; text-align:center; color:red;">Error al cargar el módulo de clientes: ${error.message}</div>`;
    }
}

/**
 * Carga dinámicamente la vista de lista de proveedores
 */
async function cargarVistaProveedores() {
    console.log('[HOME] Cargando vista de proveedores...');

    const workArea = document.querySelector('.work-area');
    if (!workArea) {
        console.error('[HOME] No se encontró el área de trabajo');
        return;
    }

    // Mostrar mensaje de carga
    workArea.innerHTML = '<div style="padding:20px; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Cargando módulo de proveedores...</div>';

    try {
        // Cargar el HTML de la vista
        const response = await fetch('/views/proveedores-lista.html');
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const html = await response.text();

        // Insertar el HTML en el área de trabajo
        workArea.innerHTML = html;

        // Inicializar la vista de proveedores
        if (typeof configurarPaginaProveedoresYListeners === 'function') {
            configurarPaginaProveedoresYListeners();
            console.log('[HOME] Vista de proveedores cargada e inicializada');
        } else {
            console.error('[HOME] Función configurarPaginaProveedoresYListeners no encontrada');
        }

    } catch (error) {
        console.error('[HOME] Error al cargar vista de proveedores:', error);
        workArea.innerHTML = `<div style="padding:20px; text-align:center; color:red;">Error al cargar el módulo de proveedores: ${error.message}</div>`;
    }
}

/**
 * Carga dinámicamente la vista de lista de productos
 */
async function cargarVistaProductos() {
    console.log('[HOME] Cargando vista de productos...');

    const workArea = document.querySelector('.work-area');
    if (!workArea) {
        console.error('[HOME] No se encontró el área de trabajo');
        return;
    }

    // Mostrar mensaje de carga
    workArea.innerHTML = '<div style="padding:20px; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Cargando módulo de productos...</div>';

    try {
        // Cargar el HTML de la vista
        const response = await fetch('/views/productos-lista.html');
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const html = await response.text();

        // Insertar el HTML en el área de trabajo
        workArea.innerHTML = html;

        // Cargar el script del módulo de productos
        await cargarScriptSiNoExiste('/js/productos-lista.js', 'productos-lista-script');

        // Inicializar la vista de productos
        if (typeof cargarPaginaProductos === 'function') {
            await cargarPaginaProductos();
            console.log('[HOME] Vista de productos cargada e inicializada');
        } else {
            console.error('[HOME] Función cargarPaginaProductos no encontrada');
        }

    } catch (error) {
        console.error('[HOME] Error al cargar vista de productos:', error);
        workArea.innerHTML = `<div style="padding:20px; text-align:center; color:red;">Error al cargar el módulo de productos: ${error.message}</div>`;
    }
}

async function cargarVistaCategorias() {
    console.log('[HOME] Cargando vista de categorías...');

    const workArea = document.querySelector('.work-area');
    if (!workArea) {
        console.error('[HOME] No se encontró el área de trabajo');
        return;
    }

    // Mostrar mensaje de carga
    workArea.innerHTML = '<div style="padding:20px; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Cargando módulo de categorías...</div>';

    try {
        // Cargar el HTML de la vista
        const response = await fetch('/views/categorias-lista.html');
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const html = await response.text();

        // Insertar el HTML en el área de trabajo
        workArea.innerHTML = html;

        // Cargar el script del módulo de categorías
        await cargarScriptSiNoExiste('/js/categorias-lista.js', 'categorias-lista-script');

        // Inicializar la vista de categorías
        if (typeof cargarPaginaCategorias === 'function') {
            await cargarPaginaCategorias();
            console.log('[HOME] Vista de categorías cargada e inicializada');
        } else {
            console.error('[HOME] Función cargarPaginaCategorias no encontrada');
        }

    } catch (error) {
        console.error('[HOME] Error al cargar vista de categorías:', error);
        workArea.innerHTML = `<div style="padding:20px; text-align:center; color:red;">Error al cargar el módulo de categorías: ${error.message}</div>`;
    }
}

async function cargarVistaMarcas() {
    console.log('[HOME] Cargando vista de marcas...');

    const workArea = document.querySelector('.work-area');
    if (!workArea) {
        console.error('[HOME] No se encontró el área de trabajo');
        return;
    }

    // Mostrar mensaje de carga
    workArea.innerHTML = '<div style="padding:20px; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Cargando módulo de marcas...</div>';

    try {
        // Cargar el HTML de la vista
        const response = await fetch('/views/marcas-lista.html');
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const html = await response.text();

        // Insertar el HTML en el área de trabajo
        workArea.innerHTML = html;

        // Cargar el script del módulo de marcas
        await cargarScriptSiNoExiste('/js/marcas-lista.js', 'marcas-lista-script');

        // Inicializar la vista de marcas
        if (typeof cargarPaginaMarcas === 'function') {
            await cargarPaginaMarcas();
            console.log('[HOME] Vista de marcas cargada e inicializada');
        } else {
            console.error('[HOME] Función cargarPaginaMarcas no encontrada');
        }

    } catch (error) {
        console.error('[HOME] Error al cargar vista de marcas:', error);
        workArea.innerHTML = `<div style="padding:20px; text-align:center; color:red;">Error al cargar el módulo de marcas: ${error.message}</div>`;
    }
}

// ========================================
// CARGA DINÁMICA DE FORMULARIOS
// ========================================

/**
 * Carga dinámicamente el formulario de nuevo cliente
 */
async function cargarFormularioNuevoCliente() {
    console.log('[HOME] Cargando formulario de nuevo cliente...');

    const workArea = document.querySelector('.work-area');
    if (!workArea) {
        console.error('[HOME] No se encontró el área de trabajo');
        return;
    }

    workArea.innerHTML = '<div style="padding:20px; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Cargando formulario...</div>';

    try {
        const response = await fetch('/views/clientes-formulario.html');
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const html = await response.text();
        workArea.innerHTML = html;

        if (typeof inicializarFormularioNuevoCliente === 'function') {
            inicializarFormularioNuevoCliente();
            console.log('[HOME] Formulario nuevo cliente inicializado');
        } else {
            console.error('[HOME] Función inicializarFormularioNuevoCliente no encontrada');
        }

    } catch (error) {
        console.error('[HOME] Error al cargar formulario:', error);
        workArea.innerHTML = `<div style="padding:20px; text-align:center; color:red;">Error: ${error.message}</div>`;
    }
}

/**
 * Carga dinámicamente el formulario para editar cliente
 */
async function cargarFormularioEditarCliente(clienteId, clienteNombre) {
    console.log('[HOME] Cargando formulario para editar cliente:', clienteId);

    const workArea = document.querySelector('.work-area');
    if (!workArea) {
        console.error('[HOME] No se encontró el área de trabajo');
        return;
    }

    workArea.innerHTML = '<div style="padding:20px; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Cargando formulario...</div>';

    try {
        const response = await fetch('/views/clientes-formulario.html');
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const html = await response.text();
        workArea.innerHTML = html;

        if (typeof inicializarFormularioEditarCliente === 'function') {
            await inicializarFormularioEditarCliente(clienteId, clienteNombre);
            console.log('[HOME] Formulario editar cliente inicializado');
        } else {
            console.error('[HOME] Función inicializarFormularioEditarCliente no encontrada');
        }

    } catch (error) {
        console.error('[HOME] Error al cargar formulario:', error);
        workArea.innerHTML = `<div style="padding:20px; text-align:center; color:red;">Error: ${error.message}</div>`;
    }
}

/**
 * Carga dinámicamente la vista de detalle del cliente
 */
async function cargarVistaDetalleCliente(clienteId) {
    console.log('[HOME] Cargando vista de detalle de cliente:', clienteId);

    const workArea = document.querySelector('.work-area');
    if (!workArea) {
        console.error('[HOME] No se encontró el área de trabajo');
        return;
    }

    workArea.innerHTML = '<div style="padding:20px; text-align:center;"><i class="fas fa-spinner fa-spin"></i> Cargando detalles...</div>';

    try {
        const response = await fetch('/views/clientes-detalle.html');
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const html = await response.text();
        workArea.innerHTML = html;

        if (typeof inicializarVistaDetalleCliente === 'function') {
            await inicializarVistaDetalleCliente(clienteId);
            console.log('[HOME] Vista de detalle inicializada');
        } else {
            console.error('[HOME] Función inicializarVistaDetalleCliente no encontrada');
        }

    } catch (error) {
        console.error('[HOME] Error al cargar vista de detalle:', error);
        workArea.innerHTML = `<div style="padding:20px; text-align:center; color:red;">Error: ${error.message}</div>`;
    }
}

// ========================================
// FUNCIONES AUXILIARES
// ========================================

/**
 * Carga un script dinámicamente si no existe ya en el DOM
 * @param {string} src - URL del script a cargar
 * @param {string} id - ID único para el elemento script
 * @returns {Promise} - Promesa que se resuelve cuando el script se carga
 */
function cargarScriptSiNoExiste(src, id) {
    return new Promise((resolve, reject) => {
        // Verificar si el script ya existe
        if (document.getElementById(id)) {
            console.log('[HOME] Script ya cargado:', src);
            resolve();
            return;
        }

        // Crear elemento script
        const script = document.createElement('script');
        script.id = id;
        script.src = src;
        script.async = true;

        script.onload = () => {
            console.log('[HOME] Script cargado exitosamente:', src);
            resolve();
        };

        script.onerror = () => {
            console.error('[HOME] Error al cargar script:', src);
            reject(new Error(`No se pudo cargar el script: ${src}`));
        };

        document.head.appendChild(script);
    });
}

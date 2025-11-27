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

async function cerrarSesion() {
  console.log('[HOME] Cerrando sesion...');
  await limpiarSesion();
  redirigirALogin();
}

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

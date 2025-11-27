// ========================================
// VALIDACION DE SESION
// ========================================

// Verificar sesion al cargar la pagina
document.addEventListener('DOMContentLoaded', function() {
  console.log('========== HOME PAGE LOADED ==========');
  configurarLogout();
  inicializarYVerificar();
});

async function inicializarYVerificar() {
  try {
    console.log('[HOME] Iniciando proceso de autenticacion...');
    await inicializarSupabaseClient();
    await verificarSesion();
  } catch (error) {
    console.error('[HOME] Error en inicializacion:', error);
    mostrarErrorAutenticacion(error);
  }
}

function mostrarErrorAutenticacion(error) {
  console.error('[HOME] Error de autenticacion:', error);
  alert('Error de autenticacion. Por favor, inicia sesion nuevamente.');
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
      console.log('[HOME] Sesion activa en Supabase');

      // Crear datos de usuario desde la sesión de Supabase
      const userData = {
        id: supabaseSession.user.id,
        email: supabaseSession.user.email,
        nombre_completo: supabaseSession.user.user_metadata?.nombre_completo || supabaseSession.user.email
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

  const loggedUserElement = document.getElementById('loggedUser');
  if (loggedUserElement) {
    loggedUserElement.textContent = user.nombre_completo || user.email;
  }

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
  const currentUrl = window.location.href;
  const baseUrl = currentUrl.split('?')[0];
  console.log('[HOME] Redirigiendo a login:', baseUrl);
  window.location.replace(baseUrl);
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

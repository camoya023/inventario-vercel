// ========================================
// CONFIGURACIÓN INICIAL
// ========================================

// Solo ejecutar DOMContentLoaded si NO estamos en modo SPA
// En modo SPA, se llamará manualmente a inicializarLogin() cuando sea necesario
if (typeof window.onLoginSuccess === 'undefined') {
  // Modo standalone - inicializar automáticamente
  document.addEventListener('DOMContentLoaded', function() {
    inicializarLogin();
  });
}

async function inicializarLogin() {
  console.log('[LOGIN] Inicializando página de login...');

  // Inicializar cliente de Supabase
  await inicializarSupabaseClient();

  // Configurar event listeners
  configurarEventListeners();

  // Solo verificar sesión si estamos en modo standalone
  // En modo SPA, la app principal ya verificó la sesión
  if (typeof window.onLoginSuccess === 'undefined') {
    console.log('[LOGIN] Modo standalone - verificando sesión local');
    verificarSesionLocalSolamente();
  } else {
    console.log('[LOGIN] Modo SPA - omitiendo verificación de sesión (ya verificada por app principal)');
  }

  // Cargar email guardado si existe
  cargarEmailGuardado();
}

function verificarSesionLocalSolamente() {
  console.log('[LOGIN] Verificando sesión local...');

  // Solo verificar localStorage/sessionStorage, NO Supabase
  let sessionData = localStorage.getItem('user_session') || sessionStorage.getItem('user_session');

  if (sessionData) {
    try {
      const session = JSON.parse(sessionData);
      const ahora = new Date().getTime();
      const tiempoTranscurrido = ahora - session.timestamp;

      // Si hay sesión válida con datos de usuario
      if (tiempoTranscurrido < 86400000 && session.user) {
        console.log('[LOGIN] Sesión local válida encontrada');

        // Si existe el callback (modo SPA), usarlo
        if (typeof window.onLoginSuccess === 'function') {
          console.log('[LOGIN] Usando callback onLoginSuccess');
          window.onLoginSuccess(session.user);
        } else {
          // Si no, redirigir (standalone)
          console.log('[LOGIN] Redirigiendo a home...');
          redirigirAHome();
        }
        return;
      } else {
        console.log('[LOGIN] Sesión local expirada o sin datos de usuario');
        limpiarSesion();
      }
    } catch (e) {
      console.error('[LOGIN] Error parseando sesión:', e);
      limpiarSesion();
    }
  } else {
    console.log('[LOGIN] No hay sesión local guardada');
  }
}

// ========================================
// EVENT LISTENERS
// ========================================

function configurarEventListeners() {
  const loginForm = document.getElementById('login-form');
  const togglePassword = document.getElementById('toggle-password');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  // Evento de submit del formulario
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // Toggle para mostrar/ocultar contraseña
  if (togglePassword) {
    togglePassword.addEventListener('click', togglePasswordVisibility);
  }

  // Limpiar errores al escribir
  if (emailInput) {
    emailInput.addEventListener('input', function() {
      limpiarError('email');
    });
  }

  if (passwordInput) {
    passwordInput.addEventListener('input', function() {
      limpiarError('password');
    });
  }
}

// ========================================
// FUNCIONES DE LOGIN
// ========================================

function handleLogin(event) {
  event.preventDefault();

  // Limpiar errores previos
  limpiarTodosLosErrores();

  // Obtener valores del formulario
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const rememberMe = document.getElementById('remember-me').checked;

  // Validar campos
  if (!validarFormulario(email, password)) {
    return;
  }

  // Mostrar estado de carga
  mostrarCargando(true);

  // Realizar login
  realizarLogin(email, password, rememberMe);
}

function validarFormulario(email, password) {
  let isValid = true;

  // Validar email
  if (!email) {
    mostrarError('email', 'El correo electrónico es requerido');
    isValid = false;
  } else if (!validarEmail(email)) {
    mostrarError('email', 'El correo electrónico no es válido');
    isValid = false;
  }

  // Validar password
  if (!password) {
    mostrarError('password', 'La contraseña es requerida');
    isValid = false;
  } else if (password.length < 6) {
    mostrarError('password', 'La contraseña debe tener al menos 6 caracteres');
    isValid = false;
  }

  return isValid;
}

function validarEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function realizarLogin(email, password, rememberMe) {
  const client = getSupabaseClient();

  if (!client) {
    console.error('[LOGIN] Cliente de Supabase no inicializado');
    mostrarErrorLogin('Error de configuración. Por favor, recarga la página.');
    mostrarCargando(false);
    return;
  }

  try {
    console.log('[LOGIN] ===== INICIANDO AUTENTICACIÓN =====');
    console.log('[LOGIN] Email:', email);

    // Autenticar directamente con Supabase
    const { data, error } = await client.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      console.error('[LOGIN] ✗ Error de autenticación de Supabase:', error);
      console.error('[LOGIN] Código de error:', error.code);
      console.error('[LOGIN] Mensaje de error:', error.message);

      // Traducir mensajes de error comunes
      let mensajeError = error.message;
      if (error.message.includes('Invalid login credentials') || error.message.includes('invalid') || error.status === 400) {
        mensajeError = 'Correo electrónico o contraseña incorrectos';
      } else if (error.message.includes('Email not confirmed')) {
        mensajeError = 'Debes confirmar tu correo electrónico antes de iniciar sesión';
      } else if (error.message.includes('User not found')) {
        mensajeError = 'No existe una cuenta con este correo electrónico';
      }

      console.log('[LOGIN] Mostrando error traducido:', mensajeError);
      handleLoginError(mensajeError);
      return;
    }

    // Verificar que tenemos datos válidos
    if (!data || !data.user || !data.session) {
      console.error('[LOGIN] ✗ Respuesta de Supabase inválida - faltan datos');
      handleLoginError('Error en la respuesta del servidor. Por favor, intenta de nuevo.');
      return;
    }

    console.log('[LOGIN] ✓ Autenticación exitosa');
    console.log('[LOGIN] User ID:', data.user.id);
    console.log('[LOGIN] User Email:', data.user.email);

    // Crear datos de usuario desde la información de Supabase Auth
    const userData = {
      id: data.user.id,
      email: data.user.email,
      nombre_completo: data.user.user_metadata?.nombre_completo || data.user.email
    };

    console.log('[LOGIN] Datos de usuario creados:', userData);

    // Login exitoso, guardar sesión
    handleLoginSuccess({
      success: true,
      user: userData,
      session: data.session
    }, email, rememberMe);

  } catch (error) {
    console.error('[LOGIN] ✗ Excepción en realizarLogin:', error);
    console.error('[LOGIN] Stack trace:', error.stack);
    handleLoginError('Error al conectar con el servidor. Por favor, intenta de nuevo.');
  }
}

function handleLoginSuccess(response, email, rememberMe) {
  console.log('[LOGIN] handleLoginSuccess llamado con:', {
    success: response.success,
    hasUser: !!response.user
  });

  mostrarCargando(false);

  if (!response.success || !response.user) {
    console.error('[LOGIN] Login fallido - respuesta inválida:', response);
    mostrarErrorLogin(response.message || 'Credenciales inválidas');
    return;
  }

  console.log('[LOGIN] ✓ Login exitoso para:', response.user.email);

  // Guardar sesión en localStorage (incluyendo tokens de Supabase)
  guardarSesion(response.user, rememberMe, response.session);

  // Guardar email si "Recordarme" está activado
  if (rememberMe) {
    localStorage.setItem('remembered_email', email);
  } else {
    localStorage.removeItem('remembered_email');
  }

  console.log('[LOGIN] ✓ Sesión guardada correctamente');

  // Verificar que la sesión se guardó
  const verificarSesion = localStorage.getItem('user_session') || sessionStorage.getItem('user_session');
  if (!verificarSesion) {
    console.error('[LOGIN] ✗ ERROR: La sesión no se guardó correctamente');
    mostrarErrorLogin('Error al guardar la sesión. Por favor, intenta de nuevo.');
    return;
  }

  console.log('[LOGIN] Llamando a onLoginSuccess...');

  // Llamar al callback global si existe (para modo SPA)
  if (typeof window.onLoginSuccess === 'function') {
    console.log('[LOGIN] Usando callback de app principal');
    window.onLoginSuccess(response.user);
  } else {
    // Fallback: redirigir a home (para cuando se usa login standalone)
    console.log('[LOGIN] Modo standalone - redirigiendo a home');
    redirigirAHome();
  }
}

function handleLoginError(mensajeError) {
  console.log('[LOGIN] ===== MANEJANDO ERROR DE LOGIN =====');
  console.error('[LOGIN] Mensaje de error:', mensajeError);

  // Asegurarse de que el botón vuelva a su estado normal
  mostrarCargando(false);

  // Mostrar el error en la UI
  mostrarErrorLogin(mensajeError);

  // IMPORTANTE: NO llamar a window.onLoginSuccess ni redirigir
  // La vista debe permanecer en login
  console.log('[LOGIN] Permaneciendo en vista de login');
}

// ========================================
// GESTIÓN DE SESIÓN
// ========================================

function guardarSesion(userData, rememberMe, supabaseSession) {
  const sessionData = {
    user: userData,
    timestamp: new Date().getTime(),
    rememberMe: rememberMe,
    supabaseSession: supabaseSession // Guardar la sesión de Supabase (incluye access_token y refresh_token)
  };

  // Guardar en localStorage o sessionStorage según "Recordarme"
  if (rememberMe) {
    localStorage.setItem('user_session', JSON.stringify(sessionData));
  } else {
    sessionStorage.setItem('user_session', JSON.stringify(sessionData));
  }

  console.log('Sesión guardada (incluyendo tokens de Supabase)');
}

async function verificarSesionExistente() {
  const client = getSupabaseClient();

  if (!client) {
    console.log('Cliente de Supabase no inicializado aún');
    return;
  }

  try {
    // Verificar si hay una sesión activa en Supabase
    const { data: { session }, error } = await client.auth.getSession();

    if (session && !error) {
      console.log('Sesión de Supabase activa encontrada, redirigiendo a home...');
      redirigirAHome();
      return;
    }

    // También verificar la sesión guardada localmente
    let sessionData = localStorage.getItem('user_session');

    // Si no está en localStorage, verificar en sessionStorage
    if (!sessionData) {
      sessionData = sessionStorage.getItem('user_session');
    }

    if (sessionData) {
      try {
        const localSession = JSON.parse(sessionData);
        const ahora = new Date().getTime();
        const tiempoTranscurrido = ahora - localSession.timestamp;

        // Sesión válida por 24 horas (86400000 ms)
        if (tiempoTranscurrido < 86400000 && localSession.supabaseSession) {
          // Restaurar la sesión en Supabase
          const { error: setSessionError } = await client.auth.setSession({
            access_token: localSession.supabaseSession.access_token,
            refresh_token: localSession.supabaseSession.refresh_token
          });

          if (!setSessionError) {
            console.log('Sesión restaurada desde localStorage, redirigiendo...');
            redirigirAHome();
            return;
          }
        }

        // Sesión expirada o inválida, limpiar
        limpiarSesion();
      } catch (e) {
        console.error('Error al parsear sesión:', e);
        limpiarSesion();
      }
    }
  } catch (error) {
    console.error('Error verificando sesión:', error);
  }
}

async function limpiarSesion() {
  // Limpiar sesión local
  localStorage.removeItem('user_session');
  sessionStorage.removeItem('user_session');

  // Cerrar sesión en Supabase si el cliente está inicializado
  const client = getSupabaseClient();

  if (client) {
    try {
      await client.auth.signOut();
      console.log('Sesión de Supabase cerrada');
    } catch (error) {
      console.error('Error al cerrar sesión de Supabase:', error);
    }
  }
}

function cargarEmailGuardado() {
  const rememberedEmail = localStorage.getItem('remembered_email');
  if (rememberedEmail) {
    document.getElementById('email').value = rememberedEmail;
    document.getElementById('remember-me').checked = true;
  }
}

// ========================================
// FUNCIONES DE UI
// ========================================

function mostrarCargando(mostrar) {
  const button = document.getElementById('login-button');
  const buttonText = document.getElementById('login-button-text');
  const spinner = document.getElementById('login-button-spinner');

  if (mostrar) {
    button.disabled = true;
    buttonText.textContent = 'Iniciando sesión...';
    spinner.style.display = 'inline-block';
  } else {
    button.disabled = false;
    buttonText.textContent = 'Iniciar Sesión';
    spinner.style.display = 'none';
  }
}

function mostrarError(campo, mensaje) {
  const errorElement = document.getElementById(campo + '-error');
  const inputElement = document.getElementById(campo);

  if (errorElement) {
    errorElement.textContent = mensaje;
  }

  if (inputElement) {
    inputElement.classList.add('error');
  }
}

function limpiarError(campo) {
  const errorElement = document.getElementById(campo + '-error');
  const inputElement = document.getElementById(campo);

  if (errorElement) {
    errorElement.textContent = '';
  }

  if (inputElement) {
    inputElement.classList.remove('error');
  }
}

function limpiarTodosLosErrores() {
  limpiarError('email');
  limpiarError('password');
  ocultarErrorLogin();
}

function mostrarErrorLogin(mensaje) {
  const errorContainer = document.getElementById('login-error');
  const errorMessage = document.getElementById('login-error-message');

  if (errorContainer && errorMessage) {
    errorMessage.textContent = mensaje;
    errorContainer.style.display = 'flex';
  }
}

function ocultarErrorLogin() {
  const errorContainer = document.getElementById('login-error');
  if (errorContainer) {
    errorContainer.style.display = 'none';
  }
}

function togglePasswordVisibility() {
  const passwordInput = document.getElementById('password');
  const toggleIcon = document.querySelector('#toggle-password i');

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleIcon.classList.remove('fa-eye');
    toggleIcon.classList.add('fa-eye-slash');
  } else {
    passwordInput.type = 'password';
    toggleIcon.classList.remove('fa-eye-slash');
    toggleIcon.classList.add('fa-eye');
  }
}

function redirigirAHome() {
  console.log('[LOGIN] Redirigiendo a home...');

  // Verificar que la sesión se guardó correctamente
  const sessionGuardada = localStorage.getItem('user_session') || sessionStorage.getItem('user_session');
  console.log('[LOGIN] Sesión guardada antes de redirigir:', sessionGuardada ? 'SÍ' : 'NO');

  // Construir URL de home
  const currentUrl = window.location.href;
  const baseUrl = currentUrl.split('?')[0].split('#')[0];
  const homeUrl = baseUrl + '?page=home';

  console.log('[LOGIN] URL de home:', homeUrl);

  // Redirigir
  window.location.replace(homeUrl);
}

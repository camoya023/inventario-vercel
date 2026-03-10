// ========================================
// MÓDULO DE RECUPERACIÓN DE CONTRASEÑA
// reset-password.js - Inventrack v2.0
// ========================================

// ========================================
// PASO 1 — SOLICITAR RESET (enviar email)
// ========================================

async function inicializarSolicitarReset() {
  console.log('[RESET] Inicializando formulario de solicitud...');
  configurarEventListenersSolicitarReset();
  console.log('[RESET] Módulo inicializado');
}

function configurarEventListenersSolicitarReset() {
  const form = document.getElementById('forgot-password-form');
  const btnVolver = document.getElementById('btn-volver-login-desde-forgot');

  if (form) form.addEventListener('submit', handleSolicitarReset);

  if (btnVolver) {
    btnVolver.addEventListener('click', () => mostrarVista('login'));
  }

  const emailInput = document.getElementById('forgot-email');
  if (emailInput) {
    emailInput.addEventListener('input', () => limpiarErrorReset('forgot-email'));
  }
}

async function handleSolicitarReset(event) {
  event.preventDefault();
  limpiarAlertaReset();

  const email = document.getElementById('forgot-email').value.trim();

  if (!email) {
    mostrarErrorReset('forgot-email', 'El correo electrónico es requerido');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    mostrarErrorReset('forgot-email', 'El correo electrónico no es válido');
    return;
  }

  mostrarCargandoReset(true);

  try {
    const client = getSupabaseClient();

    // Determinar la URL de redirección según el entorno
    const redirectUrl = window.location.origin + window.location.pathname;

    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });

    if (error) {
      console.error('[RESET] Error al enviar email:', error);
      let msg = 'Error al enviar el correo. Intenta de nuevo.';
      if (error.message && error.message.includes('rate limit')) {
        msg = 'Has solicitado demasiados correos en poco tiempo. Espera unos minutos e intenta de nuevo.';
      } else if (error.message && error.message.includes('not found')) {
        msg = 'No existe una cuenta registrada con ese correo electrónico.';
      }
      mostrarAlertaReset(msg, 'error');
      mostrarCargandoReset(false);
      return;
    }

    mostrarCargandoReset(false);
    mostrarAlertaReset(
      `✓ Se envió un link de recuperación a <strong>${email}</strong>.<br>
       Revisa tu bandeja de entrada y sigue las instrucciones.<br>
       <small>Si no lo ves, revisa la carpeta de spam.</small>`,
      'success'
    );

    // Deshabilitar el botón para evitar múltiples envíos
    const btn = document.getElementById('forgot-button');
    if (btn) btn.disabled = true;

  } catch (err) {
    console.error('[RESET] Excepción:', err);
    mostrarAlertaReset('Error inesperado. Por favor intenta de nuevo.', 'error');
    mostrarCargandoReset(false);
  }
}

// ========================================
// PASO 2 — DEFINIR NUEVA CLAVE (con token)
// ========================================

async function inicializarNuevaClave() {
  console.log('[RESET] Inicializando formulario de nueva clave...');

  // Limpiar formulario
  const form = document.getElementById('new-password-form');
  if (form) form.reset();
  limpiarAlertaNuevaClave();
  actualizarIndicadorFortalezaReset('');

  configurarEventListenersNuevaClave();
  console.log('[RESET] Formulario nueva clave inicializado');
}

function configurarEventListenersNuevaClave() {
  const form = document.getElementById('new-password-form');
  if (form) form.addEventListener('submit', handleNuevaClave);

  // Toggles visibilidad
  const toggleMap = {
    'toggle-np-password':  'np-password',
    'toggle-np-confirm':   'np-confirm-password'
  };

  Object.entries(toggleMap).forEach(([btnId, inputId]) => {
    const btn = document.getElementById(btnId);
    if (btn) btn.addEventListener('click', () => togglePasswordVisibilidadReset(inputId, btnId));
  });

  // Limpiar errores al escribir
  ['np-password', 'np-confirm-password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => limpiarErrorNuevaClave(id));
  });

  // Indicador de fortaleza
  const newPwd = document.getElementById('np-password');
  if (newPwd) {
    newPwd.addEventListener('input', function() {
      actualizarIndicadorFortalezaReset(this.value);
    });
  }
}

async function handleNuevaClave(event) {
  event.preventDefault();
  limpiarAlertaNuevaClave();

  const password = document.getElementById('np-password').value;
  const confirmPassword = document.getElementById('np-confirm-password').value;

  // Validaciones
  if (!password) {
    mostrarErrorNuevaClave('np-password', 'La contraseña es requerida');
    return;
  }
  if (password.length < 6) {
    mostrarErrorNuevaClave('np-password', 'La contraseña debe tener al menos 6 caracteres');
    return;
  }
  if (!confirmPassword) {
    mostrarErrorNuevaClave('np-confirm-password', 'Confirma la nueva contraseña');
    return;
  }
  if (password !== confirmPassword) {
    mostrarErrorNuevaClave('np-confirm-password', 'Las contraseñas no coinciden');
    return;
  }

  mostrarCargandoNuevaClave(true);

  try {
    const client = getSupabaseClient();

    const { error } = await client.auth.updateUser({ password });

    if (error) {
      console.error('[RESET] Error al actualizar clave:', error);
      let msg = error.message;
      if (msg.includes('same password')) {
        msg = 'La nueva contraseña no puede ser igual a la anterior';
      }
      mostrarAlertaNuevaClave(msg, 'error');
      mostrarCargandoNuevaClave(false);
      return;
    }

    mostrarCargandoNuevaClave(false);
    mostrarAlertaNuevaClave('✓ Contraseña actualizada correctamente. Redirigiendo al login...', 'success');

    // Cerrar sesión temporal del token y redirigir al login
    setTimeout(async () => {
      await client.auth.signOut();
      // Limpiar el hash de la URL
      history.replaceState(null, '', window.location.pathname);
      mostrarVista('login');
    }, 2500);

  } catch (err) {
    console.error('[RESET] Excepción:', err);
    mostrarAlertaNuevaClave('Error inesperado. Por favor intenta de nuevo.', 'error');
    mostrarCargandoNuevaClave(false);
  }
}

// ========================================
// DETECTOR DE TOKEN EN URL
// Supabase redirige con #access_token=... en la URL
// ========================================

// Supabase v2 procesa el token del hash automáticamente y dispara
// onAuthStateChange con event = 'PASSWORD_RECOVERY'.
// Esta función registra ese listener y resuelve una promesa cuando ocurre.
function detectarTokenResetPassword() {
  return new Promise((resolve) => {
    const hash = window.location.hash;

    if (!hash || !hash.includes('type=recovery')) {
      resolve(false);
      return;
    }

    console.log('[RESET] Hash de recovery detectado, esperando sesión de Supabase...');

    const client = getSupabaseClient();

    const timeout = setTimeout(() => {
      console.warn('[RESET] Timeout — verificando sesión activa directamente...');
      unsubscribe();
      client.auth.getSession().then(({ data }) => {
        if (data?.session) {
          console.log('[RESET] ✓ Sesión activa encontrada por getSession()');
          resolve(true);
        } else {
          resolve(false);
        }
      });
    }, 5000);

    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      console.log('[RESET] Auth event:', event, '| session:', !!session);

      if (event === 'PASSWORD_RECOVERY') {
        console.log('[RESET] ✓ Evento PASSWORD_RECOVERY recibido');
        clearTimeout(timeout);
        unsubscribe();
        resolve(true);
        return;
      }

      if (event === 'INITIAL_SESSION' && session) {
        console.log('[RESET] ✓ INITIAL_SESSION con sesión — tratando como recovery');
        clearTimeout(timeout);
        unsubscribe();
        resolve(true);
        return;
      }
    });

    function unsubscribe() {
      try { subscription.unsubscribe(); } catch(e) {}
    }
  });
}

// ========================================
// INDICADOR DE FORTALEZA
// ========================================

function actualizarIndicadorFortalezaReset(password) {
  const barEl = document.getElementById('np-strength-bar');
  const textEl = document.getElementById('np-strength-text');
  if (!barEl || !textEl) return;

  if (!password) {
    barEl.style.width = '0%';
    barEl.className = 'strength-bar';
    textEl.textContent = '';
    return;
  }

  let score = 0;
  if (password.length >= 6)  score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { pct: '20%',  cls: 'strength-bar weak',   label: 'Muy débil' },
    { pct: '40%',  cls: 'strength-bar weak',   label: 'Débil' },
    { pct: '60%',  cls: 'strength-bar fair',   label: 'Regular' },
    { pct: '80%',  cls: 'strength-bar good',   label: 'Buena' },
    { pct: '100%', cls: 'strength-bar strong', label: 'Muy fuerte' }
  ];

  const level = levels[Math.min(score - 1, 4)] || levels[0];
  barEl.style.width = level.pct;
  barEl.className = level.cls;
  textEl.textContent = level.label;
}

// ========================================
// FUNCIONES DE UI — SOLICITAR RESET
// ========================================

function mostrarCargandoReset(mostrar) {
  const btn = document.getElementById('forgot-button');
  const btnText = document.getElementById('forgot-button-text');
  const spinner = document.getElementById('forgot-button-spinner');
  if (btn) btn.disabled = mostrar;
  if (btnText) btnText.textContent = mostrar ? 'Enviando...' : 'Enviar Link de Recuperación';
  if (spinner) spinner.style.display = mostrar ? 'inline-block' : 'none';
}

function mostrarErrorReset(campo, mensaje) {
  const errorEl = document.getElementById(campo + '-error');
  const inputEl = document.getElementById(campo);
  if (errorEl) errorEl.textContent = mensaje;
  if (inputEl) inputEl.classList.add('error');
}

function limpiarErrorReset(campo) {
  const errorEl = document.getElementById(campo + '-error');
  const inputEl = document.getElementById(campo);
  if (errorEl) errorEl.textContent = '';
  if (inputEl) inputEl.classList.remove('error');
}

function mostrarAlertaReset(mensaje, tipo) {
  const alerta = document.getElementById('forgot-alert');
  const alertaMsg = document.getElementById('forgot-alert-message');
  if (!alerta || !alertaMsg) return;
  alerta.className = `alert alert-${tipo === 'success' ? 'success' : 'error'}`;
  alertaMsg.innerHTML = mensaje;
  alerta.style.display = 'flex';
}

function limpiarAlertaReset() {
  const alerta = document.getElementById('forgot-alert');
  if (alerta) alerta.style.display = 'none';
}

// ========================================
// FUNCIONES DE UI — NUEVA CLAVE
// ========================================

function mostrarCargandoNuevaClave(mostrar) {
  const btn = document.getElementById('np-button');
  const btnText = document.getElementById('np-button-text');
  const spinner = document.getElementById('np-button-spinner');
  if (btn) btn.disabled = mostrar;
  if (btnText) btnText.textContent = mostrar ? 'Guardando...' : 'Guardar Nueva Contraseña';
  if (spinner) spinner.style.display = mostrar ? 'inline-block' : 'none';
}

function mostrarErrorNuevaClave(campo, mensaje) {
  const errorEl = document.getElementById(campo + '-error');
  const inputEl = document.getElementById(campo);
  if (errorEl) errorEl.textContent = mensaje;
  if (inputEl) inputEl.classList.add('error');
}

function limpiarErrorNuevaClave(campo) {
  const errorEl = document.getElementById(campo + '-error');
  const inputEl = document.getElementById(campo);
  if (errorEl) errorEl.textContent = '';
  if (inputEl) inputEl.classList.remove('error');
}

function mostrarAlertaNuevaClave(mensaje, tipo) {
  const alerta = document.getElementById('np-alert');
  const alertaMsg = document.getElementById('np-alert-message');
  if (!alerta || !alertaMsg) return;
  alerta.className = `alert alert-${tipo === 'success' ? 'success' : 'error'}`;
  alertaMsg.innerHTML = mensaje;
  alerta.style.display = 'flex';
}

function limpiarAlertaNuevaClave() {
  const alerta = document.getElementById('np-alert');
  if (alerta) alerta.style.display = 'none';
}

function togglePasswordVisibilidadReset(inputId, buttonId) {
  const input = document.getElementById(inputId);
  const icon = document.querySelector(`#${buttonId} i`);
  if (!input || !icon) return;
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
}

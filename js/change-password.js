// ========================================
// MÓDULO DE CAMBIO DE CONTRASEÑA
// change-password.js - Inventrack v2.0
// ========================================

async function inicializarCambioPassword() {
  console.log('[CHANGE-PWD] Inicializando cambio de contraseña...');

  // Limpiar formulario y mensajes anteriores cada vez que se abre la vista
  const form = document.getElementById('change-password-form');
  if (form) form.reset();
  limpiarTodosLosErroresCP();
  actualizarIndicadorFortaleza('');

  configurarEventListenersCambioPassword();
  console.log('[CHANGE-PWD] Módulo inicializado correctamente');
}

// ========================================
// EVENT LISTENERS
// ========================================

function configurarEventListenersCambioPassword() {
  const form = document.getElementById('change-password-form');
  const btnVolver = document.getElementById('btn-volver-home');

  if (form) form.addEventListener('submit', handleCambioPassword);

  if (btnVolver) {
    btnVolver.addEventListener('click', () => mostrarVista('home'));
  }

  // Toggle visibilidad contraseñas
  ['toggle-current-password', 'toggle-cp-new-password', 'toggle-cp-confirm-password'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      const inputId = id.replace('toggle-', '').replace('toggle-cp-', 'cp-');
      // Mapeo manual de toggle -> input
      const map = {
        'toggle-current-password': 'current-password',
        'toggle-cp-new-password': 'cp-new-password',
        'toggle-cp-confirm-password': 'cp-confirm-password'
      };
      btn.addEventListener('click', () => togglePasswordVisibilidadCP(map[id], id));
    }
  });

  // Limpiar errores al escribir
  ['current-password', 'cp-new-password', 'cp-confirm-password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => limpiarErrorCP(id));
  });

  // Indicador de fortaleza de contraseña
  const newPwdInput = document.getElementById('cp-new-password');
  if (newPwdInput) {
    newPwdInput.addEventListener('input', function () {
      actualizarIndicadorFortaleza(this.value);
    });
  }
}

// ========================================
// LÓGICA DE CAMBIO DE CONTRASEÑA
// ========================================

async function handleCambioPassword(event) {
  event.preventDefault();
  limpiarTodosLosErroresCP();

  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('cp-new-password').value;
  const confirmPassword = document.getElementById('cp-confirm-password').value;

  if (!validarFormularioCP(currentPassword, newPassword, confirmPassword)) return;

  mostrarCargandoCP(true);

  try {
    const client = getSupabaseClient();
    if (!client) throw new Error('Cliente de Supabase no inicializado');

    // Obtener email del usuario actual desde la sesión
    const sessionData = localStorage.getItem('user_session') || sessionStorage.getItem('user_session');
    if (!sessionData) {
      mostrarAlertaCP('No hay sesión activa. Por favor, inicia sesión nuevamente.', 'error');
      mostrarCargandoCP(false);
      return;
    }

    const session = JSON.parse(sessionData);
    const email = session.user?.email;

    if (!email) {
      mostrarAlertaCP('No se pudo obtener el usuario actual.', 'error');
      mostrarCargandoCP(false);
      return;
    }

    // Paso 1: Verificar contraseña actual re-autenticando
    console.log('[CHANGE-PWD] Verificando contraseña actual...');
    const { error: reAuthError } = await client.auth.signInWithPassword({
      email: email,
      password: currentPassword
    });

    if (reAuthError) {
      console.error('[CHANGE-PWD] Contraseña actual incorrecta:', reAuthError);
      mostrarErrorCP('current-password', 'La contraseña actual es incorrecta');
      mostrarCargandoCP(false);
      return;
    }

    console.log('[CHANGE-PWD] ✓ Contraseña actual verificada');

    // Paso 2: Actualizar contraseña
    const { error: updateError } = await client.auth.updateUser({
      password: newPassword
    });

    if (updateError) {
      console.error('[CHANGE-PWD] Error al actualizar contraseña:', updateError);
      let msg = updateError.message;
      if (msg.includes('same password')) {
        msg = 'La nueva contraseña no puede ser igual a la actual';
      }
      mostrarAlertaCP(msg, 'error');
      mostrarCargandoCP(false);
      return;
    }

    console.log('[CHANGE-PWD] ✓ Contraseña actualizada exitosamente');
    mostrarCargandoCP(false);
    mostrarAlertaCP('✓ Contraseña actualizada correctamente. Redirigiendo...', 'success');

    // Limpiar formulario
    document.getElementById('change-password-form').reset();
    actualizarIndicadorFortaleza('');

    // Volver al home después de 2 segundos
    setTimeout(() => mostrarVista('home'), 2000);

  } catch (err) {
    console.error('[CHANGE-PWD] Excepción:', err);
    mostrarAlertaCP('Error inesperado. Por favor, intenta de nuevo.', 'error');
    mostrarCargandoCP(false);
  }
}

// ========================================
// VALIDACIONES
// ========================================

function validarFormularioCP(currentPassword, newPassword, confirmPassword) {
  let isValid = true;

  if (!currentPassword) {
    mostrarErrorCP('current-password', 'Ingresa tu contraseña actual');
    isValid = false;
  }

  if (!newPassword) {
    mostrarErrorCP('cp-new-password', 'Ingresa la nueva contraseña');
    isValid = false;
  } else if (newPassword.length < 6) {
    mostrarErrorCP('cp-new-password', 'La contraseña debe tener al menos 6 caracteres');
    isValid = false;
  } else if (newPassword === currentPassword) {
    mostrarErrorCP('cp-new-password', 'La nueva contraseña debe ser diferente a la actual');
    isValid = false;
  }

  if (!confirmPassword) {
    mostrarErrorCP('cp-confirm-password', 'Confirma la nueva contraseña');
    isValid = false;
  } else if (newPassword !== confirmPassword) {
    mostrarErrorCP('cp-confirm-password', 'Las contraseñas no coinciden');
    isValid = false;
  }

  return isValid;
}

// ========================================
// INDICADOR DE FORTALEZA
// ========================================

function actualizarIndicadorFortaleza(password) {
  const barEl = document.getElementById('strength-bar');
  const textEl = document.getElementById('strength-text');
  if (!barEl || !textEl) return;

  if (!password) {
    barEl.style.width = '0%';
    barEl.className = 'strength-bar';
    textEl.textContent = '';
    return;
  }

  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { pct: '20%', cls: 'strength-bar weak',   label: 'Muy débil' },
    { pct: '40%', cls: 'strength-bar weak',   label: 'Débil' },
    { pct: '60%', cls: 'strength-bar fair',   label: 'Regular' },
    { pct: '80%', cls: 'strength-bar good',   label: 'Buena' },
    { pct: '100%',cls: 'strength-bar strong', label: 'Muy fuerte' }
  ];

  const level = levels[Math.min(score - 1, 4)] || levels[0];
  barEl.style.width = level.pct;
  barEl.className = level.cls;
  textEl.textContent = level.label;
}

// ========================================
// FUNCIONES DE UI
// ========================================

function mostrarCargandoCP(mostrar) {
  const btn = document.getElementById('change-password-button');
  const btnText = document.getElementById('cp-button-text');
  const spinner = document.getElementById('cp-button-spinner');

  if (btn) btn.disabled = mostrar;
  if (btnText) btnText.textContent = mostrar ? 'Actualizando...' : 'Actualizar Contraseña';
  if (spinner) spinner.style.display = mostrar ? 'inline-block' : 'none';
}

function mostrarErrorCP(campo, mensaje) {
  const errorEl = document.getElementById(campo + '-error');
  const inputEl = document.getElementById(campo);
  if (errorEl) errorEl.textContent = mensaje;
  if (inputEl) inputEl.classList.add('error');
}

function limpiarErrorCP(campo) {
  const errorEl = document.getElementById(campo + '-error');
  const inputEl = document.getElementById(campo);
  if (errorEl) errorEl.textContent = '';
  if (inputEl) inputEl.classList.remove('error');
}

function limpiarTodosLosErroresCP() {
  ['current-password', 'cp-new-password', 'cp-confirm-password'].forEach(limpiarErrorCP);
  const alerta = document.getElementById('cp-alert');
  if (alerta) alerta.style.display = 'none';
}

function mostrarAlertaCP(mensaje, tipo) {
  const alerta = document.getElementById('cp-alert');
  const alertaMsg = document.getElementById('cp-alert-message');
  if (!alerta || !alertaMsg) return;

  alerta.className = `alert alert-${tipo === 'success' ? 'success' : 'error'}`;
  alertaMsg.innerHTML = mensaje;
  alerta.style.display = 'flex';
}

function togglePasswordVisibilidadCP(inputId, buttonId) {
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

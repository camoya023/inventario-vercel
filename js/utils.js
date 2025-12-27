/* =========================================================================
   UTILIDADES JAVASCRIPT GLOBALES
   ========================================================================= */

/**
 * Utilidades para trabajar con variables CSS
 */
window.CSSUtils = {
  /**
   * Obtiene el valor de una variable CSS
   * @param {string} property - Nombre de la propiedad CSS (con o sin --)
   * @param {Element} element - Elemento del cual obtener la propiedad (por defecto document.documentElement)
   * @returns {string} - Valor de la propiedad
   */
  getCSSVariable: function(property, element = document.documentElement) {
    const prop = property.startsWith('--') ? property : `--${property}`;
    return getComputedStyle(element).getPropertyValue(prop).trim();
  },

  /**
   * Establece el valor de una variable CSS
   * @param {string} property - Nombre de la propiedad CSS (con o sin --)
   * @param {string} value - Nuevo valor
   * @param {Element} element - Elemento en el cual establecer la propiedad
   */
  setCSSVariable: function(property, value, element = document.documentElement) {
    const prop = property.startsWith('--') ? property : `--${property}`;
    element.style.setProperty(prop, value);
  },

  /**
   * Cambia el tema de colores dinámicamente
   * @param {Object} colorMap - Objeto con mappeo de variables y valores
   */
  setTheme: function(colorMap) {
    Object.entries(colorMap).forEach(([property, value]) => {
      this.setCSSVariable(property, value);
    });
  },

  /**
   * Obtiene todos los colores del tema actual
   * @returns {Object} - Objeto con todas las variables de color
   */
  getCurrentTheme: function() {
    const colors = {};
    const properties = [
      'color-primary', 'color-primary-dark', 'color-primary-light',
      'color-secondary', 'color-success', 'color-danger', 'color-warning', 'color-info',
      'bg-body', 'bg-light', 'bg-dark', 'text-primary', 'text-secondary'
    ];

    properties.forEach(prop => {
      colors[prop] = this.getCSSVariable(prop);
    });

    return colors;
  }
};

/**
 * Utilidades para manejo de temas predefinidos
 */
window.ThemeManager = {
  themes: {
    default: {
      'color-primary': '#1572E8',
      'color-primary-dark': '#0d5aa7',
      'color-primary-light': '#4d8ced',
      'color-success': '#198754',
      'color-danger': '#dc3545',
      'color-warning': '#ffc107',
      'color-info': '#0dcaf0'
    },
    dark: {
      'color-primary': '#4d8ced',
      'color-primary-dark': '#1572E8',
      'color-primary-light': '#7dabf0',
      'bg-body': '#212529',
      'bg-light': '#343a40',
      'bg-dark': '#495057',
      'text-primary': '#ffffff',
      'text-secondary': '#adb5bd',
      'border-color': '#495057'
    },
    green: {
      'color-primary': '#198754',
      'color-primary-dark': '#146c43',
      'color-primary-light': '#25a85a',
      'color-success': '#20c997',
      'color-info': '#13795b'
    },
    purple: {
      'color-primary': '#6f42c1',
      'color-primary-dark': '#59359a',
      'color-primary-light': '#8563c1',
      'color-success': '#20c997',
      'color-info': '#6610f2'
    }
  },

  /**
   * Aplica un tema predefinido
   * @param {string} themeName - Nombre del tema
   */
  applyTheme: function(themeName) {
    if (this.themes[themeName]) {
      window.CSSUtils.setTheme(this.themes[themeName]);
      localStorage.setItem('selectedTheme', themeName);
      console.log(`🎨 Tema '${themeName}' aplicado`);
    } else {
      console.warn(`⚠️ Tema '${themeName}' no encontrado`);
    }
  },

  /**
   * Obtiene el tema actual guardado
   * @returns {string} - Nombre del tema actual
   */
  getCurrentTheme: function() {
    return localStorage.getItem('selectedTheme') || 'default';
  },

  /**
   * Restaura el tema guardado al cargar la página
   */
  restoreTheme: function() {
    const savedTheme = this.getCurrentTheme();
    if (savedTheme !== 'default') {
      this.applyTheme(savedTheme);
    }
  },

  /**
   * Registra un nuevo tema personalizado
   * @param {string} name - Nombre del tema
   * @param {Object} colors - Objeto con variables de color
   */
  registerTheme: function(name, colors) {
    this.themes[name] = colors;
    console.log(`🎨 Tema personalizado '${name}' registrado`);
  }
};

/**
 * Utilidades para responsive design
 */
window.ResponsiveUtils = {
  breakpoints: {
    xs: 0,
    sm: 576,
    md: 768,
    lg: 992,
    xl: 1200,
    xxl: 1400
  },

  /**
   * Obtiene el breakpoint actual
   * @returns {string} - Nombre del breakpoint actual
   */
  getCurrentBreakpoint: function() {
    const width = window.innerWidth;
    const breakpoints = Object.entries(this.breakpoints)
      .sort(([,a], [,b]) => b - a);

    for (const [name, size] of breakpoints) {
      if (width >= size) {
        return name;
      }
    }
    return 'xs';
  },

  /**
   * Verifica si está en un breakpoint específico o superior
   * @param {string} breakpoint - Nombre del breakpoint
   * @returns {boolean}
   */
  isBreakpointUp: function(breakpoint) {
    return window.innerWidth >= this.breakpoints[breakpoint];
  },

  /**
   * Verifica si está en un breakpoint específico o inferior
   * @param {string} breakpoint - Nombre del breakpoint
   * @returns {boolean}
   */
  isBreakpointDown: function(breakpoint) {
    return window.innerWidth < this.breakpoints[breakpoint];
  }
};

/**
 * Sistema de notificaciones Toast
 */
window.NotificationSystem = {
  container: null,

  /**
   * Inicializa el contenedor de notificaciones
   */
  init: function() {
    if (!this.container) {
      this.container = document.getElementById('notification-container');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        document.body.appendChild(this.container);
      }
    }
  },

  /**
   * Muestra una notificación toast
   * @param {string} message - Mensaje a mostrar
   * @param {string} type - Tipo de notificación (success, error, warning, info)
   * @param {number} duration - Duración en milisegundos (0 = no auto-cerrar)
   */
  show: function(message, type = 'info', duration = 4000) {
    this.init();

    const toast = document.createElement('div');
    toast.className = `custom-toast toast-${type}`;

    const iconMap = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };

    toast.innerHTML = `
      <i class="fas ${iconMap[type]} toast-icon"></i>
      <div class="toast-message">
        <p>${message}</p>
      </div>
      <button class="toast-close-button" aria-label="Cerrar">
        <i class="fas fa-times"></i>
      </button>
    `;

    this.container.appendChild(toast);

    // Trigger reflow para la animación
    toast.offsetHeight;

    // Mostrar con animación
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Cerrar al hacer clic en el botón
    const closeBtn = toast.querySelector('.toast-close-button');
    closeBtn.addEventListener('click', () => {
      this.close(toast);
    });

    // Auto-cerrar después de la duración especificada
    if (duration > 0) {
      setTimeout(() => {
        this.close(toast);
      }, duration);
    }

    return toast;
  },

  /**
   * Cierra una notificación
   * @param {HTMLElement} toast - Elemento toast a cerrar
   */
  close: function(toast) {
    toast.classList.remove('show');
    toast.classList.add('fade-out');

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 400);
  },

  /**
   * Cierra todas las notificaciones
   */
  closeAll: function() {
    if (this.container) {
      const toasts = this.container.querySelectorAll('.custom-toast');
      toasts.forEach(toast => this.close(toast));
    }
  }
};

/**
 * Función global para mostrar notificaciones (compatibilidad)
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo de notificación
 * @param {number} duration - Duración en milisegundos
 */
function showNotification(message, type = 'info', duration = 4000) {
  return window.NotificationSystem.show(message, type, duration);
}

/**
 * Toggle de submenús en el sidebar
 * @param {HTMLElement} element - Elemento clickeado
 */
function toggleSubMenu(element) {
  const submenu = element.nextElementSibling;
  if (submenu && submenu.classList.contains('sidebar__submenu')) {
    submenu.classList.toggle('active');
    submenu.classList.toggle('show');
  }
}

/**
 * Inicialización automática al cargar el DOM
 */
document.addEventListener('DOMContentLoaded', function() {
  // Restaurar tema guardado
  window.ThemeManager.restoreTheme();

  // Inicializar sistema de notificaciones
  window.NotificationSystem.init();

  console.log('🚀 Sistema de utilidades inicializado');
});

/**
 * Función auxiliar para debugging
 */
window.debugApp = function() {
  console.group('🎨 Debug Aplicación');
  console.log('Tema actual:', window.ThemeManager.getCurrentTheme());
  console.log('Variables de color actuales:', window.CSSUtils.getCurrentTheme());
  console.log('Breakpoint actual:', window.ResponsiveUtils.getCurrentBreakpoint());
  console.log('Cliente Supabase:', supabaseClient ? 'Inicializado' : 'No inicializado');
  console.groupEnd();
};

/* =========================================================================
   MODAL DE CONFIRMACIÓN GENÉRICO
   ========================================================================= */

/**
 * Muestra un modal de confirmación moderno y elegante
 * @param {string} mensaje - Mensaje a mostrar en el modal
 * @param {function} callbackConfirmar - Función a ejecutar si el usuario confirma
 * @param {string} titulo - Título del modal (opcional, por defecto "Confirmar Acción")
 */
function mostrarModalConfirmacion(mensaje, callbackConfirmar, titulo = "Confirmar Acción") {
  console.log('[mostrarModalConfirmacion] Iniciando con:', { mensaje, titulo });

  // Obtener elementos del modal genérico
  const modal = document.getElementById('modal-confirmacion-generica');
  const tituloElement = document.getElementById('modal-confirmacion-generica-titulo');
  const mensajeElement = document.getElementById('modal-confirmacion-generica-mensaje');
  const btnAceptar = document.getElementById('btn-aceptar-modal-confirmacion-generica');
  const btnCancelar = document.getElementById('btn-cancelar-modal-confirmacion-generica');
  const btnCerrar = document.getElementById('btn-cerrar-modal-confirmacion-generica-x');

  console.log('[mostrarModalConfirmacion] Modal encontrado:', !!modal);

  if (!modal) {
    console.warn('[mostrarModalConfirmacion] Modal no encontrado, usando confirm() nativo');
    // Fallback si no existe el modal
    if (confirm(mensaje)) {
      callbackConfirmar();
    }
    return;
  }

  // Configurar modal
  if (tituloElement) tituloElement.textContent = titulo;
  if (mensajeElement) mensajeElement.textContent = mensaje;

  // Mostrar modal con todos los estilos necesarios
  console.log('[mostrarModalConfirmacion] Mostrando modal...');
  modal.style.display = 'flex';
  modal.style.visibility = 'visible';
  modal.style.opacity = '1';
  modal.style.zIndex = '9999';
  modal.classList.add('is-visible');

  // Función para cerrar el modal
  const cerrarModal = function() {
    modal.style.display = 'none';
    modal.style.visibility = 'hidden';
    modal.style.opacity = '0';
    modal.classList.remove('is-visible');

    // Limpiar event listeners
    if (btnAceptar) btnAceptar.removeEventListener('click', handlerConfirmar);
    if (btnCancelar) btnCancelar.removeEventListener('click', handlerCancelar);
    if (btnCerrar) btnCerrar.removeEventListener('click', handlerCancelar);
  };

  // Handler para confirmar
  const handlerConfirmar = function() {
    cerrarModal();
    callbackConfirmar();
  };

  // Handler para cancelar
  const handlerCancelar = function() {
    cerrarModal();
  };

  // Asignar event listeners
  if (btnAceptar) btnAceptar.addEventListener('click', handlerConfirmar);
  if (btnCancelar) btnCancelar.addEventListener('click', handlerCancelar);
  if (btnCerrar) btnCerrar.addEventListener('click', handlerCancelar);
}

/* =========================================================================
   BADGE DE ENTORNO (DESARROLLO/PRODUCCIÓN)
   ========================================================================= */

/**
 * Muestra un badge visual indicando el entorno actual
 * Solo se muestra en desarrollo local
 */
function mostrarBadgeEntorno() {
  // Solo mostrar en desarrollo local
  const esLocal = window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1' ||
                  window.location.port === '5500';

  if (!esLocal) {
    return; // No mostrar badge en producción
  }

  // Obtener el entorno desde el query parameter
  const params = new URLSearchParams(window.location.search);
  const env = params.get('env');
  const entorno = env === 'prod' ? 'prod' : 'dev'; // Por defecto 'dev'

  // Crear el badge si no existe
  let badge = document.getElementById('badge-entorno');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'badge-entorno';
    document.body.appendChild(badge);
  }

  // Configurar estilos y contenido según entorno
  if (entorno === 'dev') {
    badge.innerHTML = '🟢 DESARROLLO';
    badge.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: linear-gradient(135deg, #28a745, #20c997);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
      z-index: 999999;
      box-shadow: 0 2px 8px rgba(40, 167, 69, 0.4);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      letter-spacing: 0.5px;
      cursor: help;
      transition: transform 0.2s;
    `;
    badge.title = 'Conectado a BD de DESARROLLO\nURL: ' + window.location.href;
  } else {
    badge.innerHTML = '🔴 PRODUCCIÓN';
    badge.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: linear-gradient(135deg, #dc3545, #c82333);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
      z-index: 999999;
      box-shadow: 0 2px 8px rgba(220, 53, 69, 0.4);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      letter-spacing: 0.5px;
      cursor: help;
      transition: transform 0.2s;
      animation: pulse 2s infinite;
    `;
    badge.title = '⚠️ CONECTADO A BD DE PRODUCCIÓN\nURL: ' + window.location.href;

    // Agregar animación de pulso para producción
    if (!document.getElementById('badge-entorno-style')) {
      const style = document.createElement('style');
      style.id = 'badge-entorno-style';
      style.textContent = `
        @keyframes pulse {
          0%, 100% { box-shadow: 0 2px 8px rgba(220, 53, 69, 0.4); }
          50% { box-shadow: 0 2px 16px rgba(220, 53, 69, 0.8); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // Efecto hover
  badge.addEventListener('mouseenter', () => {
    badge.style.transform = 'scale(1.05)';
  });
  badge.addEventListener('mouseleave', () => {
    badge.style.transform = 'scale(1)';
  });

  console.log('[BADGE] Mostrando badge de entorno:', entorno.toUpperCase());
}

// Ejecutar automáticamente cuando se carga el script
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mostrarBadgeEntorno);
} else {
  mostrarBadgeEntorno();
}

/* =========================================================================
   FUNCIONES DE FORMATEO (PARA REPORTES Y KARDEX)
   ========================================================================= */

/**
 * Formatea un número como moneda colombiana (COP)
 * @param {number} amount - Cantidad a formatear
 * @param {boolean} esCompacto - (Opcional) Si es true, usa notación K/M (ej: $90K). Si es false o no se proporciona, muestra el valor completo
 * @returns {string} - Cantidad formateada como moneda
 */
window.formatMoney = function(amount, esCompacto = false) {
  if (amount === null || amount === undefined) return '$ 0';

  // Formato compacto manual (más confiable que notation: 'compact')
  if (esCompacto) {
    if (amount >= 1000000000) {
      return '$ ' + (amount / 1000000000).toFixed(1).replace('.0', '') + ' mil M';
    } else if (amount >= 1000000) {
      return '$ ' + (amount / 1000000).toFixed(1).replace('.0', '') + ' M';
    } else if (amount >= 1000) {
      return '$ ' + (amount / 1000).toFixed(1).replace('.0', '') + ' K';
    }
  }

  // Formato completo estándar
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(amount);
};

/**
 * Formatea una fecha a formato legible colombiano con hora
 * @param {string} dateString - Fecha en formato ISO o timestamp
 * @returns {string} - Fecha formateada (dd/mm/yyyy hh:mm)
 */
window.formatDate = function(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Formatea una fecha solo fecha (sin hora)
 * @param {string} dateString - Fecha en formato ISO o timestamp
 * @returns {string} - Fecha formateada (dd/mm/yyyy)
 */
window.formatDateOnly = function(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Obtiene la fecha de hace N días en formato ISO (YYYY-MM-DD)
 * @param {number} days - Número de días hacia atrás
 * @returns {string} - Fecha en formato ISO
 */
window.getDateDaysAgo = function(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
};

/**
 * Obtiene la fecha de hoy en formato ISO (YYYY-MM-DD)
 * @returns {string} - Fecha en formato ISO
 */
window.getTodayISO = function() {
  return new Date().toISOString().split('T')[0];
};

# 🔄 Guía de Configuración de Entornos (Desarrollo/Producción)

Documentación completa del sistema de gestión de entornos para el proyecto Inventrack.

---

## 📋 Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [¿Qué se implementó?](#qué-se-implementó)
3. [Configuración Inicial](#configuración-inicial)
4. [Cómo Usar](#cómo-usar)
5. [Archivos Modificados](#archivos-modificados)
6. [Troubleshooting](#troubleshooting)
7. [Tips y Mejores Prácticas](#tips-y-mejores-prácticas)

---

## 📝 Descripción General

Este sistema permite cambiar fácilmente entre la base de datos de **desarrollo** y **producción** cuando trabajas localmente con Live Server en VSCode.

### Problema que resuelve:
- Antes: Solo podías conectarte a la BD configurada en Vercel
- Ahora: Puedes elegir entre desarrollo o producción usando un parámetro en la URL

### Características:
✅ Cambio de entorno mediante query parameters
✅ Badge visual indicando el entorno actual
✅ Credenciales de desarrollo en archivo local (no se sube a git)
✅ Logs detallados en consola para debugging
✅ Protección contra commits accidentales de credenciales

---

## 🎯 ¿Qué se implementó?

### 1. **Sistema de Query Parameters**
- Detecta el parámetro `?env=dev` o `?env=prod` en la URL
- Por defecto usa desarrollo cuando no hay parámetro

### 2. **Configuración Local**
- Archivo `config.local.js` con credenciales de desarrollo
- No se sube a git (protegido por `.gitignore`)

### 3. **Badge Visual**
- Indicador flotante en esquina superior derecha
- Verde para desarrollo, rojo pulsante para producción
- Solo visible en localhost

### 4. **Logging Detallado**
- Mensajes en consola indicando el entorno activo
- Información de conexión para debugging

---

## ⚙️ Configuración Inicial

### Paso 1: Obtener credenciales de Supabase

1. Ve a tu proyecto de **DESARROLLO** en [Supabase](https://supabase.com)
2. Navega a: **Settings → API**
3. Copia los siguientes valores:
   - **Project URL** (ejemplo: `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon/public key** (cadena JWT larga)

### Paso 2: Configurar `config.local.js`

Abre el archivo `/js/config.local.js` y reemplaza los placeholders:

```javascript
const SUPABASE_DEV_CONFIG = {
  // Reemplaza con tu URL de desarrollo
  url: 'https://tu-proyecto-dev.supabase.co',

  // Reemplaza con tu anon key de desarrollo
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};
```

### Paso 3: Configurar .gitignore en GitKraken

**Opción A - Commit del .gitignore primero:**

1. Abre **GitKraken**
2. Localiza el archivo `.gitignore` en Unstaged Files
3. Haz clic derecho → **Stage File**
4. Commit con mensaje: `"Agregar .gitignore con config.local.js"`
5. Ahora `config.local.js` NO debe aparecer en cambios pendientes

**Opción B - Si config.local.js ya aparece:**

1. En GitKraken, busca `config.local.js` en Unstaged Files
2. Clic derecho → **Ignore** → **Ignore file**
3. GitKraken lo agregará automáticamente al `.gitignore`

**✅ Verificación:**
- Después del commit del `.gitignore`, `config.local.js` NO debe estar listado
- Si aparece, el `.gitignore` no está funcionando correctamente

### Paso 4: Verificar configuración en Vercel

Asegúrate de que en Vercel estén configuradas las variables de entorno de **PRODUCCIÓN**:

1. Ve a tu proyecto en [Vercel](https://vercel.com)
2. Settings → Environment Variables
3. Verifica que existan:
   - `SUPABASE_URL` → URL de BD producción
   - `SUPABASE_ANON_KEY` → Anon key de BD producción

---

## 🚀 Cómo Usar

### Desarrollo (BD de desarrollo)

```
http://127.0.0.1:5500?env=dev
```
o simplemente:
```
http://127.0.0.1:5500
```

**Resultado:**
- 🟢 Badge: **DESARROLLO** (verde)
- Consola: `[CONFIG] 🟢 Usando configuración LOCAL de DESARROLLO`
- Conecta a tu BD de desarrollo

### Producción (BD de producción)

```
http://127.0.0.1:5500?env=prod
```

**Resultado:**
- 🔴 Badge: **PRODUCCIÓN** (rojo pulsante)
- Consola: `[CONFIG] 🔴 Obteniendo configuración de VERCEL (Producción)`
- Conecta a tu BD de producción (vía Vercel)

### Trabajo con múltiples pestañas

Puedes tener ambas abiertas simultáneamente:

- **Pestaña 1:** `?env=dev` → Trabajas y pruebas en desarrollo
- **Pestaña 2:** `?env=prod` → Verificas que todo funcione en producción

---

## 📁 Archivos Modificados

### Nuevos archivos:

#### `/js/config.local.js`
- Contiene credenciales de BD de desarrollo
- **NO se sube a git**
- Se carga antes de `config.js`

```javascript
const SUPABASE_DEV_CONFIG = {
  url: 'TU_URL_DE_DESARROLLO',
  anonKey: 'TU_ANON_KEY_DE_DESARROLLO'
};
window.SUPABASE_DEV_CONFIG = SUPABASE_DEV_CONFIG;
```

#### `/.gitignore`
- Protege archivos sensibles
- Incluye `js/config.local.js`
- Incluye otros archivos comunes

---

### Archivos modificados:

#### `/js/config.js`
**Cambios principales:**

1. Nueva función `obtenerEntornoDeURL()`:
   ```javascript
   // Lee el query parameter ?env=dev o ?env=prod
   function obtenerEntornoDeURL() {
     const params = new URLSearchParams(window.location.search);
     const env = params.get('env');
     return env === 'dev' ? 'dev' : 'prod';
   }
   ```

2. Modificada `inicializarSupabaseClient()`:
   - Detecta entorno solicitado
   - Si es `dev` en local → usa `config.local.js`
   - Si es `prod` → consulta Vercel
   - Logs detallados

#### `/js/utils.js`
**Función agregada:**

```javascript
function mostrarBadgeEntorno()
```

**Características:**
- Crea badge visual flotante
- Solo se muestra en localhost
- Verde para dev, rojo para prod
- Animación de pulso en producción
- Tooltip con información del entorno

#### `/index.html`
**Cambio en orden de carga de scripts:**

```html
<!-- Config local debe cargarse ANTES de config.js -->
<script src="/js/config.local.js"></script>
<script src="/js/config.js"></script>
<script src="/js/utils.js"></script>
```

⚠️ **Importante:** `config.local.js` debe cargarse ANTES de `config.js`

---

## 🔍 Troubleshooting

### ❌ Error: "No se encontró config.local.js"

**Causa:** El archivo no existe o no está cargado correctamente

**Solución:**
1. Verifica que existe: `/js/config.local.js`
2. Verifica que está incluido en `index.html` ANTES de `config.js`
3. Recarga la página con Ctrl+Shift+R (recarga forzada)

---

### ❌ No aparece el badge de entorno

**Causa:** No estás en localhost o hay un error de carga

**Solución:**
1. Verifica que la URL sea: `127.0.0.1:5500` o `localhost:5500`
2. Abre consola (F12) y busca: `[BADGE] Mostrando badge de entorno`
3. Verifica que `utils.js` esté cargado correctamente

---

### ❌ Sigue conectando a producción en ?env=dev

**Causa:** Credenciales no configuradas en `config.local.js`

**Solución:**
1. Abre `/js/config.local.js`
2. Verifica que los placeholders estén reemplazados
3. Las cadenas NO deben contener "TU_URL_" o "TU_ANON_KEY_"
4. Abre consola y busca: `[CONFIG] Credenciales locales`

---

### ❌ GitKraken sigue mostrando config.local.js

**Causa:** El `.gitignore` no se aplicó correctamente

**Solución:**
1. Verifica que `.gitignore` exista en la raíz del proyecto
2. Verifica que contenga la línea: `js/config.local.js`
3. Si ya fue commiteado antes, debes eliminarlo del historial:
   ```bash
   git rm --cached js/config.local.js
   git commit -m "Eliminar config.local.js del repositorio"
   ```

---

### ❌ Error 404 al cargar config.local.js

**Causa:** Live Server no encuentra el archivo

**Solución:**
1. Verifica que el archivo esté en: `/js/config.local.js`
2. Reinicia Live Server en VSCode
3. Verifica que no haya errores de sintaxis en el archivo

---

## 💡 Tips y Mejores Prácticas

### 🎯 Uso diario

1. **Por defecto trabaja en desarrollo:**
   - Abre simplemente: `http://127.0.0.1:5500`
   - No necesitas agregar `?env=dev`

2. **Verifica siempre el badge:**
   - Antes de hacer cambios, mira el badge
   - Pasa el mouse sobre él para ver más info

3. **Usa marcadores del navegador:**
   - Guarda ambas URLs como marcadores
   - Acceso rápido a cada entorno

### 🔒 Seguridad

1. **Nunca commits config.local.js:**
   - Siempre verifica en GitKraken antes de commit
   - Si aparece, ignóralo explícitamente

2. **Credenciales seguras:**
   - Las `anon key` son públicas por diseño
   - La seguridad real está en las políticas RLS de Supabase

3. **Entorno de producción:**
   - Cuando uses `?env=prod` en local, ten cuidado
   - El badge rojo pulsante te recordará que estás en producción

### 📊 Debugging

1. **Siempre con consola abierta:**
   - Presiona F12 para abrir DevTools
   - Busca logs que empiecen con `[CONFIG]` y `[BADGE]`

2. **Verifica la conexión:**
   - En consola verás la URL de Supabase conectada
   - Ejemplo: `[CONFIG] Conectado a: https://xxxxx.supabase.co...`

3. **Prueba de conexión rápida:**
   ```javascript
   // En consola del navegador:
   const client = getSupabaseClient();
   console.log('Cliente:', client);
   ```

### 🚀 Workflow recomendado

**Desarrollo de nueva feature:**
1. Abre: `?env=dev`
2. Desarrolla y prueba
3. Cuando esté lista, abre: `?env=prod`
4. Verifica que funcione en producción
5. Deploy a Vercel

**Fixing bugs:**
1. Reproduce el bug en: `?env=prod`
2. Verifica si también ocurre en: `?env=dev`
3. Desarrolla el fix en dev
4. Prueba en prod antes de deploy

### 🎨 Personalización del badge

Si quieres cambiar los estilos del badge, edita `/js/utils.js:424-520`

**Ejemplos de cambios:**
- Posición: Cambia `top` y `right` en los estilos CSS
- Colores: Modifica los valores de `background`
- Tamaño: Ajusta `font-size` y `padding`

---

## 📚 Recursos Adicionales

- [Documentación de Supabase](https://supabase.com/docs)
- [Documentación de Vercel](https://vercel.com/docs)
- [GitKraken Docs](https://support.gitkraken.com/)

---

## 🆘 Soporte

Si encuentras algún problema no cubierto en esta guía:

1. Revisa la consola del navegador (F12)
2. Busca errores en los logs que empiecen con `[CONFIG]` o `[BADGE]`
3. Verifica que todos los archivos estén en su lugar
4. Compara con esta documentación

---

## ✅ Checklist de Verificación

Antes de empezar a trabajar, verifica:

- [ ] `config.local.js` existe y tiene credenciales válidas
- [ ] `.gitignore` incluye `js/config.local.js`
- [ ] `config.local.js` NO aparece en GitKraken
- [ ] Badge se muestra correctamente en localhost
- [ ] `?env=dev` conecta a BD de desarrollo
- [ ] `?env=prod` conecta a BD de producción
- [ ] Consola muestra logs de `[CONFIG]` correctamente

---

**Última actualización:** Diciembre 2, 2025
**Versión:** 1.0.0

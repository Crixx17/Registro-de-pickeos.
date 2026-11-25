# PickFlow · Registro de órdenes y pickeos

Aplicación web ligera (HTML + CSS + JavaScript puro) para cargar, organizar y dar seguimiento a órdenes de pickeo. La información se guarda en **Supabase** (Base de datos + Auth) y se sincroniza en tiempo real entre pestañas y usuarios.

---

## ✨ Funcionalidades

### Gestión de registros
- Alta, edición y eliminación de órdenes.
- **Selección múltiple** con casillas de verificación: marcar varios como recibidos o eliminarlos en bloque.
- Cambio de estado **Recibido / Pendiente** con actualización optimista (respuesta inmediata y reversión si falla).
- Búsqueda instantánea (debounce) por cualquier campo.
- Filtro por fecha y vista "Todos / Hoy".
- Chips de estado: **Todos / Recibidos / Pendientes**.
- Ordenación por fecha u orden, tanto desde el selector como haciendo clic en las cabeceras de la tabla.
- Paginación configurable (8 / 15 / 30 registros por página).
- **Exportar a CSV** respetando los filtros activos (con BOM para Excel y acentos correctos).
- Copiar el número de orden al portapapeles haciendo clic en la celda.
- Borrador automático del formulario en `localStorage` para no perder datos al recargar.

### Interfaz y experiencia
- Diseño *glassmorphism* con gradientes, fondo animado y **tema claro / oscuro** persistente.
- Animaciones de entrada escalonadas, contadores animados, *ripple* en botones, toasts con barra de progreso, *skeleton loading*, transiciones de estado y modales.
- Diseño responsive con vista móvil y sugerencia de desplazamiento horizontal en la tabla.
- Soporte de `prefers-reduced-motion` para accesibilidad.
- Atajos de teclado: `Ctrl/Cmd + K` enfoca la búsqueda, `Esc` cancela la edición o cierra el modal.
- Modal de confirmación accesible (en lugar de `confirm()` nativo) con tractor de foco.

### Datos y seguridad
- Autenticación con Supabase Auth (sesión persistente).
- Estado de carga, errores con mensajes claros y pantalla de fallback si Supabase no está disponible.
- La clave integrada es una **publishable key** (pública por diseño). La protección real de los datos depende de las políticas **RLS** configuradas en Supabase.

---

## ⚙️ Configuración en Supabase

### 1. Crear la tabla

```sql
create table public.registros_pickeos (
  id bigint generated always as identity primary key,
  fecha date not null default (now() at time zone 'America/Mexico_City')::date,
  cambio text,
  orden text not null,
  linea text not null,
  pickeos text not null,
  column5 text,
  column6 text,
  column7 text,
  column8 text,
  recibido boolean not null default false,
  created_at timestamptz not null default now()
);

create index registros_pickeos_fecha_idx on public.registros_pickeos (fecha desc);
```

### 2. Habilitar RLS y políticas

```sql
alter table public.registros_pickeos enable row level security;

create policy "Lectura para usuarios autenticados"
  on public.registros_pickeos for select
  to authenticated using (true);

create policy "Alta para usuarios autenticados"
  on public.registros_pickeos for insert
  to authenticated with check (true);

create policy "Edición para usuarios autenticados"
  on public.registros_pickeos for update
  to authenticated using (true) with check (true);

create policy "Borrado para usuarios autenticados"
  on public.registros_pickeos for delete
  to authenticated using (true);
```

> Si quieres restringir por usuario, agrega una columna `user_id uuid references auth.users(id)` y cambia `using (true)` por `using (auth.uid() = user_id)`.

### 3. Habilitar Realtime

```sql
alter publication supabase_realtime add table public.registros_pickeos;
```

### 4. Crear usuarios

En **Authentication → Users**, invita a los usuarios que podrán acceder al panel.

### 5. Ejecutar la app

No requiere build ni dependencias. Sirve la carpeta con cualquier servidor estático, por ejemplo:

```bash
npx serve .
```

> Abrir el `index.html` con `file://` funciona visualmente, pero algunos navegadores bloquean el portapapeles y las peticiones externas. Se recomienda servirlo por HTTP.

---

## 📁 Estructura

| Archivo | Contenido |
|---|---|
| `index.html` | Estructura semántica, sprite SVG de iconos y loaded de fuentes. |
| `styles.css` | Sistema de diseño, temas, layout, componentes y animaciones. |
| `script.js` | Cliente de Supabase, estado, renderizado, filtros e interacciones. |
| `README.md` | Esta documentación. |

## 🛠️ Personalización rápida

- **Color principal:** variables `--primary` y `--primary-2` en `styles.css`.
- **Registros por página:** constante `DEFAULT_PAGE_SIZE` en `script.js` (el usuario puede cambiarlo en la interfaz: 8 / 15 / 30).
- **Campos del formulario:** arreglos `fields` y `columnNames` en `script.js` (deben coincidir con las columnas de la tabla).
- **Credenciales:** constantes `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` en `script.js`.

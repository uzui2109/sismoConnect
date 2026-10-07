# Interfaz, componentes y temas

El sistema de diseño de SismoConnect: componentes reutilizables, tokens de estilo, cambio claro/oscuro/sistema y las utilidades de formato y háptica.

## [Volver al README](../README.md)

---

## 1. Tokens de diseño (`src/constants/theme.ts`)

| Export | Qué define |
|---|---|
| `Colors.light` / `Colors.dark` | Paletas completas (`primary`, `background`, `surface`, `surfaceContainer`, `text`, `textSecondary`, `outline`, `outlineVariant`, `error`, `success`, `warning`, `info`…) |
| `QuakeScale` | Escala de magnitud: pares `{label, color}` por nivel (`green/blue/yellow/orange/red`) |
| `quakeLevel(mag)` / `quakeColor(mag, isDark)` | Nivel y color de un sismo según su magnitud (con variante para fondo oscuro) |
| `Spacing` | Escala de espaciado (`one…five`) — nada de píxeles sueltos |
| `Radius` | `sm/md/lg/xl/pill` para bordes |
| `Fonts` | Familias tipográficas (`display`, `mono`) por plataforma |
| `MaxContentWidth = 800` | Ancho máximo de contenido (web/tablet) |
| `HitSlop`, `BottomTabInset` | Táctiles mínimos y altura del tab bar nativo |
| `USGS_MIN_REFRESH_MS = 60_000` | Intervalo mínimo de refresco USGS |

Regla del proyecto: **colores y medidas siempre desde estos tokens** o desde `useTheme()`, nunca valores literales (con la excepción de los rojos de error puntuales en pantallas auth).

---

## 2. Componentes (`src/components/ui/`)

| Componente | Props clave | Cuándo usarlo |
|---|---|---|
| `Card` | `variant: 'flat' | 'raised'`, `onPress`, `style` | Contenedor de bloque; `flat` para filas, `raised` para tarjetas destacadas; con `onPress` se vuelve `Pressable` con háptica y estado pressed |
| `Button` | `label`, `variant: 'filled' | 'tonal' | 'outlined' | 'text'`, `loading`, `disabled`, `fullWidth`, `icon` | Cualquier acción; `loading` muestra spinner y bloquea |
| `Chip` | `label`, `selected`, `accent`, `onPress` | Filtros y selectores (magnitud, ventana, tema); `accessibilityState={{ selected }}` |
| `Badge` | `label`, `color`, `onDarkBackground` | Pastilla con punto de color: magnitud, estado de alerta, nivel PAGER |
| `TextField` | `label` (obligatorio), `error`, `hint`, + props de `TextInput` | Todo input; dibuja label, borde rojo con `error`, y `hint` cuando no hay error |
| `Skeleton` / `SkeletonRow` | `width`, `height`, `radius` | Placeholders de carga con `FadeIn` de reanimated |
| `EmptyState` | `icon?`, `title`, `description?`, `children?` | Lista vacía con llamada a la acción |
| `ErrorState` | `message`, `title?`, `onRetry?` | Envuelve `EmptyState` con badge "!" y botón "Reintentar" |

Y el texto:

### `ThemedText` (`components/themed-text.tsx`)

```ts
type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code'
themeColor?: ThemeColor          // nombre de color del tema activo ('textSecondary', 'error'…)
onDarkBackground?: boolean       // fuerza texto blanco sobre losas de color
```

- `title` (48/52) y `subtitle` (32/44) para encabezados de pantalla; `small`/`smallBold` (14) para metadatos; `linkPrimary` azul `#3c87f7` para links navegables (siempre envueltos en `Link asChild` de Expo Router).
- El color sale del tema activo vía `theme[themeColor ?? 'text']` (línea 25).

---

## 3. Sistema de temas

### Preferencia: `hooks/use-theme-preference.tsx`

```ts
type ThemePreference = 'system' | 'light' | 'dark';
const { preference, resolved, setPreference } = useThemePreference();
```

- **Fuente única de verdad**: un solo `Context` (`ThemePreferenceProvider`) montado en el layout raíz → una lectura de AsyncStorage (`sismoconnect:theme`) y un listener del sistema para toda la app.
- `preference` = lo que eligió el usuario; `resolved` = lo que hay que pintar (`system` resuelto con el esquema del SO).
- **Persistencia**: `setPreference` guarda en AsyncStorage en el mismo paso (`líneas 64-67`).
- **Aplicación al sistema** (líneas 48-62):
  - **Nativo**: `Appearance.setColorScheme('light' | 'dark' | 'unspecified')` — así las barras de status, diálogos y el tema de Android siguen la elección (`'unspecified'` devuelve el control al SO).
  - **Web**: react-native-web no expone `Appearance`; se asigna `document.documentElement.style.colorScheme`, y los colores reales los aplica el contexto.

### Consumo: `hooks/use-theme.ts`

```ts
const theme = useTheme();     // paleta Colors[resolved] completa
const isDark = useIsDark();   // booleano para quakeColor y similares
```

En el layout raíz, el mismo `resolved` alimenta `navigationTheme()` (`lib/navigation-theme.ts`) para que las pantallas de react-navigation compartan la paleta.

### Selector en el Perfil

`profile.tsx` renderiza tres `Chip` (Sistema / Claro / Oscuro) que llaman `setPreference` — es la única UI de tema.

---

## 4. Plataforma web

| Pieza | Papel |
|---|---|
| `src/global.css` | Variables CSS de fuentes (`--font-display`, `--font-mono`…) importado por el layout raíz |
| `src/app/+html.tsx` | Plantilla HTML del shell estático web |
| `src/app/(app)/_layout.web.tsx` | Variante web del layout de pestañas |
| `use-color-scheme.web.ts` | Implementación web de la detección de esquema (`matchMedia`, con fallback a `useColorScheme` de react-native en native) |
| `*.web.tsx` (quake-map, google-sign-in-button) | Componentes con renderer web propio |

Metro selecciona automáticamente `.web.tsx` en web y el archivo base en native — mismo nombre de export, mismo contrato de props.

---

## 5. Háptica (`src/lib/haptics.ts`)

Wrapper delgado sobre `expo-haptics` para que ninguna pantalla haga `Platform.OS`:

| Método | Feedback |
|---|---|
| `haptics.tap()` | Impacto ligero — toda pulsación de botón o fila |
| `haptics.select()` | Selección — cambiar chip/filtro |
| `haptics.success()` | Notificación de éxito — login, crear alerta |
| `haptics.warning()` | Aviso |
| `haptics.error()` | Error — fallo de auth o de escritura |

Todas son *fire-and-forget*: en web no hay vibración y la promesa se resuelve sin ruido (`safe()` catchea todo).

---

## 6. Utilidades de formato (`src/utils/format.ts`)

| Función | Salida |
|---|---|
| `timeAgo(epochMs)` | "ahora mismo", "hace 3 min", "hace 5 h", "hace 2 d" y después fecha |
| `formatDate` / `formatTime` / `formatDateTime` | `Intl.DateTimeFormat('es', …)` |
| `formatMagnitude(mag)` | `"M 4.5"` (o `"M —"` si es null) |
| `formatDepth(km)` | `"12.0 km"` |
| `formatCoordinates(lat, lng)` | `"19.43° N, 99.13° W"` |
| `formatFelt(n)` | `"3 personas"` / `null` si no hay reportes |
| `pluralize(n, sing, plural)` | `"1 evento"` / `"12 eventos"` |
| `shortenPlace(place)` | Quita el prefijo `"50km NNE of "` → `"Tsukuba, Japan"` |

### Validación (`src/utils/validation.ts`)

- `validateEmail` / `validatePassword` → mensaje en español o `null` (se usan en los tres formularios de auth).
- `friendlyAuthError` → traduce códigos de Firebase a mensajes accionables (ver [autenticacion.md](autenticacion.md)).

---

## 7. Patrones de composición de pantalla

Todas las pantallas del grupo `(app)` siguen el mismo molde:

```tsx
<ScrollView/SectionList/View style={[styles.screen, { backgroundColor: theme.background }]}>
  <Header/>                                  // título (type="title") + subtítulo
  <View style={styles.section}>              // gap: Spacing.three, marginTop: Spacing.two
    <ThemedText type="subtitle">…</ThemedText>
    …
  </View>
</ScrollView>
```

- `contentContainerStyle` siempre incluye `paddingTop: insets.top + Spacing.two`, `paddingBottom: insets.bottom + 96` (holgura del tab bar) y `maxWidth: MaxContentWidth` centrado.
- Estados de carga/error/vacío siempre con `Skeleton` / `ErrorState` / `EmptyState`.
- Accesibilidad: `accessibilityRole` + `accessibilityLabel` en todo lo pulsable; targets ≥ 40-52 px de alto (`Button` 52, `clearButton` 40).

## 8. Documentación relacionada

- [arquitectura.md](arquitectura.md) — convenciones de código y estructura de pantallas.
- [datos-sismos.md](datos-sismos.md) — cómo se pintan los sismos con estos tokens.

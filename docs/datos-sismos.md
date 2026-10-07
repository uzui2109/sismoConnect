# Datos sísmicos (USGS)

De dónde salen los sismos, cómo se descargan, se normalizan y se pintan en las pantallas Monitor, Mapa y Alertas.

## [Volver al README](../README.md)

---

## 1. Fuente de datos

SismoConnect consume los **summary feeds GeoJSON** del USGS Earthquake Hazards Program:

```
https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson
https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson
```

- Datos de dominio público: **sin API key** y con atribución obligatoria (`USGS_ATTRIBUTION` en `usgs.ts:6`, mostrado al pie del Monitor y del Mapa).
- Cada feed trae ~100 eventos ordenados por tiempo, con ~30 propiedades por evento.
- El feed de USGS se sirve desde una **caché de 60 s**: por eso la app refresca como mínimo cada `USGS_MIN_REFRESH_MS = 60_000` ms (`constants/theme.ts:156`) — pedir antes devuelve idénticos datos y arriesga un **HTTP 429**.

---

## 2. Cliente: `src/services/usgs.ts`

### `feedUrl(window, minMagnitude?)` (líneas 16-23)

USGS nombra los feeds `{magnitud}_{ventana}.geojson` (`2.5_day.geojson`) o `all_{ventana}.geojson`. `FeedWindow` (`'all_day' | 'all_week'`) trae el prefijo `all_`, que hay que **quitar** antes de componer un feed por magnitud:

```ts
const slug = window.replace(/^all_/, '');           // 'all_day' → 'day'
return `${FEED_BASE}/${minMagnitude.toFixed(1)}_${slug}.geojson`;   // 2.5_day.geojson
return `${FEED_BASE}/all_${slug}.geojson`;                           // all_day.geojson
```

### `fetchQuakes(window, { minMagnitude?, signal? })` (líneas 93-124)

Pipeline de defensa:

1. `fetch` con `AbortSignal` (el caller puede cancelar).
2. `!response.ok` → mensaje específico: **429** → "USGS está limitando las peticiones. Espera un momento."
3. Validación de contenido: USGS responde **HTTP 200 con cuerpo de texto `404 File Not Found`** para rutas inexistentes, así que se comprueba `content-type` y que el cuerpo parsea como JSON con `features` array.
4. `normalize` cada feature → `Quake`, descartando las inválidas, y orden descendente por `time`.

### `normalize(feature)` (líneas 58-87)

Del GeoJSON crudo al tipo de la app:

- Descarta lo que **no se puede ubicar**: sin `geometry.coordinates` de ≥3 entradas, o con `properties.type !== 'earthquake'`.
- `coordinates` del GeoJSON es `[longitud, latitud, profundidad]` — se desestructura en ese orden (línea 65).
- Defiensa ante nulos: `magnitude` puede ser `null`, `place` vacío → `"Ubicación desconocida"`, `alert` solo se acepta si es `green|yellow|orange|red`.
- Salida: el tipo `Quake` de `src/types/earthquake.ts`.

### Filtros y agregados (líneas 126-179)

| Función | Qué hace |
|---|---|
| `matchesMagnitude(quake, filter)` | Umbrales: `light ≥ 2.5`, `moderate ≥ 4`, `strong ≥ 5`, `major ≥ 6`. El filtrado es **en cliente** (el feed ya viene limitado): cambiar de chip es instantáneo y no gasta una petición. |
| `aggregateByRegion(quakes)` | Agrupa por el **sufijo** de `place` (texto tras la última coma: "… of Tsukuba, **Japan**"), cuenta eventos, suma magnitudes (`energy`) y guarda la máxima; ordena por cantidad. Alimenta las "Zonas más activas" del Mapa. |

---

## 3. Hook: `src/hooks/use-earthquakes.ts`

```ts
const { data, loading, refreshing, error, lastUpdated, refetch } = useEarthquakes('all_day');
```

| Estado | Significado |
|---|---|
| `data` | Lista de `Quake` ya normalizada y ordenada |
| `loading` | Primera carga (lista vacía) → esqueletos `SkeletonRow` |
| `refreshing` | Pull-to-refresh (ya hay datos) → `RefreshControl` |
| `error` | Mensaje en español → `ErrorState` con "Reintentar" |
| `lastUpdated` | `Date.now()` del último éxito → "Actualizado hace 3 min" |
| `refetch` | Recarga manual |

Mecánicas clave:

- **`AbortController` por petición** (líneas 31-36): al llegar una respuesta nueva se aborta la anterior; un respuesta lenta **nunca** pisa datos más frescos. El abort no se reporta como error (línea 57).
- **Polling** (líneas 76-80): `setInterval(load, 60_000)` mientras `autoRefresh = true`; se limpia al desmontar.
- **`autoRefresh = false`**: usado por el Perfil (`profile.tsx:33`), que solo necesita el historial una vez.
- **Ventana como dependencia**: cambiar de `'all_day'` a `'all_week'` re-crea `load` y el effect principal re-descarga (líneas 69-74).

---

## 4. Tipos: `src/types/earthquake.ts`

| Tipo | Uso |
|---|---|
| `Quake` | Modelo de la app: `id, magnitude, place, time, updated, depthKm, longitude, latitude, url, tsunami, felt, alert, status, magnitudeType` (cada campo documentado en el archivo) |
| `MagnitudeFilter` | `'all' \| 'light' \| 'moderate' \| 'strong' \| 'major'` — chips del Monitor |
| `FeedWindow` | `'all_day' \| 'all_week'` — ventanas del Monitor/Alertas y del Mapa |
| `RegionAggregate` | Salida de `aggregateByRegion` |

---

## 5. Pantallas que consumen los datos

### Monitor — `(app)/index.tsx`

- `SectionList` con un solo grupo; **búsqueda por lugar** y chips de magnitud combinados con `matchesMagnitude` (memoizado con `useMemo`).
- Cabecera con "Sismo más fuerte" destacado si es ≥ M5.
- Cada fila es `QuakeRow`: losa de magnitud coloreada (`quakeColor`), lugar, `timeAgo`, profundidad y etiquetas (maremoto / nº de reportes); los ya vistos salen atenuados (`dimmed`, 55 % de opacidad).
- Tocar una fila → `QuakeDetailModal` + `remember(id)` del historial (`useViewedHistory`).
- Pie: leyenda de colores `QuakeScale` + atribución USGS.
- Pull-to-refresh con `RefreshControl`.

### Mapa — `(app)/map.tsx`

- Selector de ventana **24 horas / 7 días** → cambia la `FeedWindow` del hook.
- `QuakeMap` con **dos implementaciones**:
  - `components/map/quake-map.tsx` (nativo): `react-native-maps` con `PROVIDER_GOOGLE`, `Marker` por sismo, color de `quakeColor`, marcador más grande si está seleccionado, `memo` + `tracksViewChanges={false}` para rendimiento. La región inicial se centra en el sismo más fuerte (o fallback Pacífico, líneas 26-39).
  - `components/map/quake-map.web.tsx`: variante web (react-native-maps no tiene renderer web) con el mismo contrato de props.
- Debajo: leyenda de la escala, tarjeta "Sismo más fuerte del periodo" y "Zonas más activas" con `aggregateByRegion(...).slice(0, 8)` (línea 34).

### Alertas — `(app)/alertas` (USGS, no Firestore)

- Filtra `magnitude ≥ 5` de las últimas 24 h (`ALERT_THRESHOLD`, línea 58) y lista "Avisos recientes".
- También incluye números de emergencia por país (datos estáticos en el archivo) con `Linking.openURL('tel:…')`.

### Modal de detalle — `components/quake/quake-detail-modal.tsx`

- Sheet inferior con scrim: losa grande de magnitud, lugar, badges (alerta PAGER, maremoto, revisión automática), filas de fecha/profundidad/coordenadas/reportes/id, escala de magnitud y botones "Ver en USGS" (`Linking.openURL(quake.url)` + `onOpenUsgs` para marcar historial) y "Cerrar".

---

## 6. Historial local — `useViewedHistory` (`hooks/use-storage.ts`)

- Guarda los `id` de los sismos abiertos en AsyncStorage (`sismoconnect:viewed`), **máximo 60**, más reciente primero.
- Solo funciona en este dispositivo (no es Firestore): es la razón por la que el Perfil lo borra al cerrar sesión.
- El Monitor lo usa para atenuar filas leídas; el Perfil lo lista con `useEarthquakes('all_week', false)` para resolver `id → Quake`.

---

## 7. Documentación relacionada

- [interfaz-y-temas.md](interfaz-y-temas.md) — colores de magnitud y componentes usados.
- [firestore.md](firestore.md) — alertas personales (independientes de USGS).
- [arquitectura.md](arquitectura.md) — por qué las pantallas no hacen `fetch` directo.

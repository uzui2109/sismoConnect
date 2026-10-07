# SismoConnect

App móvil de monitoreo sísmico construida con **Expo / React Native** y **Firebase**. Muestra en tiempo real la actividad sísmica reportada por el USGS (United States Geological Survey) y permite a cada usuario crear sus propias alertas personalizadas sincronizadas en la nube.

- **Plataformas**: Android y Web (`app.json` → `platforms`).
- **Rutas**: Expo Router con rutas por archivo en `src/app/`.
- **Backend**: Firebase Authentication (correo, Google, invitado) + Firestore (alertas personales).
- **Datos sísmicos**: feeds GeoJSON públicos del USGS, sin API key.

---

## Características

| Pantalla | Qué hace | Documentación |
|---|---|---|
| **Monitor** (`(app)/index.tsx`) | Lista de sismos de las últimas 24 h con buscador, filtros de magnitud (M2.5+/M4+/M5+/M6+), pull-to-refresh y modal de detalle. | [datos-sismos.md](docs/datos-sismos.md) |
| **Mapa** (`(app)/map.tsx`) | Epicentros sobre mapa (nativo y web), selector 24 h / 7 días, "zonas más activas" agrupadas por región. | [datos-sismos.md](docs/datos-sismos.md) |
| **Alertas** (`(app)/alerts.tsx`) | Avisos de USGS (≥ M5), números de emergencia por país y **"Mis alertas": umbrales personales guardados en Firestore con sincronización en tiempo real**. | [firestore.md](docs/firestore.md) |
| **Perfil** (`(app)/profile.tsx`) | Datos de la cuenta, verificación de correo, tema (claro/oscuro/sistema), historial de sismos vistos y cierre de sesión. | [interfaz-y-temas.md](docs/interfaz-y-temas.md) |
| **Auth** (`(auth)/`) | Inicio de sesión, registro, recuperación de contraseña, acceso con Google y modo invitado. | [autenticacion.md](docs/autenticacion.md) |

---

## Puesta en marcha

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Firebase (`.env`)

Crea un archivo `.env` en la raíz del proyecto con las claves de tu proyecto de Firebase
(Firebase Console → Configuración del proyecto → Tus apps):

```env
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...

# Opcional: activa el botón "Continuar con Google"
EXPO_PUBLIC_GOOGLE_CLIENT_ID=
```

> **Importante**
> - Todas las variables **deben** empezar con `EXPO_PUBLIC_` para que Expo las incluya en el bundle.
> - Sin `.env` la app arranca igual: entra en **modo invitado local** y solo desactiva las funciones que necesitan Firebase.
> - Si el `.env` está codificado con BOM (carácter invisible al inicio del archivo), Node (`node --env-file=.env`) no leerá la primera línea; Expo sí lo tolera.

### 3. Arrancar el dev server

```bash
npx expo start
```

Desde ahí puedes abrir la app en:

- **Android** (`a`) — emulador o dispositivo con Expo Go.
- **Web** (`w`) — navegador.
- **Development build** (`npx expo run:android`) — necesario solo para **Inicio de sesión con Google** (ver [configuracion.md](docs/configuracion.md)).

### 4. Reglas de Firestore

Para que la base de datos solo acepte usuarios autenticados, publica el contenido de
[`firestore.rules`](firestore.rules) en **Firebase Console → Firestore Database → Reglas**.
Más detalle en [firestore.md](docs/firestore.md#reglas-de-seguridad).

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm start` / `npx expo start` | Dev server de Expo |
| `npm run android` | Abre en Android |
| `npm run web` | Abre en el navegador |
| `npm run typecheck` | `tsc --noEmit` (TypeScript estricto, sin emitir) |
| `npm run lint` | ESLint con la config de Expo |
| `npm run doctor` | Diagnóstico de dependencias y configuración de Expo |

---

## Estructura del proyecto

```
sismoConnect/
├── app.json                 # Config de Expo: nombre, plataformas, plugins, splash
├── expo-env.d.ts            # Tipos generados por Expo
├── tsconfig.json            # TypeScript estricto + alias @/* -> src/*
├── eslint.config.js         # ESLint flat config (eslint-config-expo)
├── firestore.rules          # Reglas de seguridad de Firestore (request.auth != null)
├── firebaseConfig.js        # [Fuera de flujo] config hardcodeada; nadie la importa
├── app.js                   # [Fuera de flujo] plantilla base; no es el entry
├── .env                     # Claves de Firebase (no commitear)
├── assets/                  # Iconos, splash, imágenes
└── src/
    ├── app/                 # RUTAS (Expo Router: cada archivo es una pantalla)
    │   ├── _layout.tsx      #   Layout raíz: providers + splash + guards de sesión
    │   ├── (auth)/          #   Grupo protegido cuando NO hay sesión
    │   │   ├── sign-in.tsx      # Inicio de sesión (correo + Google + invitado)
    │   │   ├── sign-up.tsx      # Registro
    │   │   └── forgot-password.tsx
    │   └── (app)/           #   Grupo protegido cuando HAY sesión (tabs nativos)
    │       ├── _layout.tsx      # NativeTabs: Monitor, Mapa, Alertas, Perfil
    │       ├── index.tsx        # Monitor (lista de sismos)
    │       ├── map.tsx          # Mapa de riesgo
    │       ├── alerts.tsx       # Alertas USGS + "Mis alertas" (Firestore)
    │       ├── profile.tsx      # Perfil, tema, historial, sesión
    │       └── firestore-test.tsx  # Pantalla mínima de prueba de Firestore
    ├── components/
    │   ├── auth/            # AuthScreen (chrome compartido) y botón de Google
    │   ├── map/             # quake-map.tsx (nativo) / .web.tsx (web)
    │   ├── quake/           # Fila de sismos + modal de detalle
    │   ├── ui/              # Sistema de diseño: Card, Button, Chip, Badge,
    │   │                    # TextField, Skeleton, EmptyState, ErrorState...
    │   └── themed-text.tsx  # Texto con variantes tipográficas y colores de tema
    ├── providers/
    │   └── auth-provider.tsx  # Contexto de autenticación (único onAuthStateChanged)
    ├── hooks/
    │   ├── use-earthquakes.ts # polling de USGS con AbortController
    │   ├── use-alerts.ts      # alertas personales en Firestore (onSnapshot)
    │   ├── use-storage.ts     # AsyncStorage genérico + historial de vistos
    │   ├── use-theme-preference.tsx  # contexto claro/oscuro/sistema
    │   ├── use-theme.ts       # useTheme() / useIsDark()
    │   └── use-color-scheme(.web).ts # detección de esquema del sistema
    ├── services/
    │   ├── usgs.ts          # Cliente HTTP del USGS (fetchQuakes, filtros, regiones)
    │   └── firestore.ts     # CRUD de Firestore + listener onSnapshot
    ├── lib/
    │   ├── firebase.native.ts / firebase.web.ts  # Init perezosa de Firebase
    │   ├── firebase.d.ts    # Declaraciones compartidas
    │   ├── haptics.ts       # Retroalimentación háptica
    │   └── navigation-theme.ts  # Tema de react-navigation
    ├── constants/
    │   ├── config.ts        # firebaseConfig desde process.env + flags
    │   └── theme.ts         # Colores, Spacing, Radius, QuakeScale, tokens
    ├── types/
    │   ├── earthquake.ts    # Quake, MagnitudeFilter, FeedWindow, RegionAggregate
    │   └── firebase-rn.d.ts # Augmentos de tipos para Firebase en RN
    ├── utils/
    │   ├── format.ts        # timeAgo, formatMagnitude, shortenPlace...
    │   └── validation.ts    # validateEmail/Password + friendlyAuthError
    └── global.css           # Variables CSS (fuentes) para la versión web
```

---

## Stack tecnológico

| Tecnología | Versión | Por qué |
|---|---|---|
| Expo | ~57.0.9 | SDK con router, splash, fuentes y build en la nube (EAS). |
| React Native | 0.86.3 | Runtime móvil compartido con la web (react-native-web). |
| Expo Router | ~57.0.24 | Enrutamiento por archivos + guards declarativos (`Stack.Protected`). |
| Firebase (JS SDK) | ^12.19.0 | Un solo SDK para web y native; init perezosa en `src/lib/firebase.*`. |
| AsyncStorage | 2.2.0 | Persistencia de sesión de Firebase, tema e historial. |
| react-native-maps | 1.27.2 | Mapa nativo en Android (versión web propia con react-native-web). |
| expo-auth-session | ~57.0.13 | Flujo OAuth de Google (id_token → credencial de Firebase). |
| TypeScript | ~6.0.3 | `strict: true` y rutas tipadas (`experiments.typedRoutes`). |

---

## Documentación

| Documento | Contenido |
|---|---|
| [docs/arquitectura.md](docs/arquitectura.md) | Carpetas, capas, flujo de arranque, guards, convenciones de código. |
| [docs/configuracion.md](docs/configuracion.md) | `.env`, inicialización de Firebase, `app.json`, Expo Go vs dev build, archivos fuera de flujo. |
| [docs/autenticacion.md](docs/autenticacion.md) | AuthProvider, los tres modos de sesión, Google, validación y errores. |
| [docs/firestore.md](docs/firestore.md) | Servicio CRUD, listener `onSnapshot`, hook de alertas, esquema y reglas. |
| [docs/datos-sismos.md](docs/datos-sismos.md) | Cliente USGS, tipos, polling, filtros, mapa y modal de detalle. |
| [docs/interfaz-y-temas.md](docs/interfaz-y-temas.md) | Sistema de componentes, tokens de diseño, temas y utilidades. |
| [docs/guia-de-clase.md](docs/guia-de-clase.md) | Requisitos de la guía "Integración con Firebase" cumplidos → archivo:línea. |

---

## Notas conocidas

- `firebaseConfig.js` (raíz) y `app.js` (raíz) están **fuera del flujo principal**: el entry real es `expo-router/entry` y la config de Firebase vive en `.env → src/constants/config.ts`. Se conservan sin usar por decisión del proyecto; no crear una segunda arquitectura de Firebase con ellos.
- `getDocuments()` en `src/services/firestore.ts` existe y funciona, pero hoy ninguna pantalla la llama: la lista en vivo usa `subscribeToCollection()` (onSnapshot).
- La app funciona sin `.env` en modo invitado local; Firestore y el login por correo quedan deshabilitados en ese estado.
- `LICENSE` es la licencia MIT de la plantilla de Expo.

## Licencia

MIT — ver [LICENSE](LICENSE).

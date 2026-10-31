# SismoConnect

App móvil de monitoreo sísmico construida con **Expo / React Native** y **Firebase**. Muestra en tiempo real la actividad sísmica reportada por el USGS (United States Geological Survey), permite crear alertas personalizadas y añade una capa social con perfiles, amistades, grupos y chat.

- **Plataformas**: Android y Web (`app.json` → `platforms`).
- **Rutas**: Expo Router con rutas por archivo en `src/app/`.
- **Backend**: Firebase Authentication (correo, Google, invitado) + Firestore + Cloud Functions + Storage.
- **Datos sísmicos**: feeds GeoJSON públicos del USGS, sin API key.
- **Monetización**: anuncios recompensados de AdMob con validación SSV en el servidor.

---

## Características

| Pantalla | Qué hace | Documentación |
|---|---|---|
| **Monitor** (`(app)/index.tsx`) | Lista de sismos de las últimas 24 h con buscador, filtros de magnitud (M2.5+/M4+/M5+/M6+), pull-to-refresh y modal de detalle. | [datos-sismos.md](docs/datos-sismos.md) |
| **Mapa** (`(app)/map.tsx`) | Epicentros sobre mapa (nativo y web), selector 24 h / 7 días, "zonas más activas" agrupadas por región. | [datos-sismos.md](docs/datos-sismos.md) |
| **Alertas** (`(app)/alerts.tsx`) | Avisos de USGS (≥ M5), números de emergencia por país y **"Mis alertas": umbrales personales guardados en Firestore con sincronización en tiempo real**. | [firestore.md](docs/firestore.md) |
| **Perfil** (`(app)/profile.tsx`) | Datos de la cuenta, perfil social (avatar, portada, bio, país, usuario), verificación de correo, tema, historial de sismos vistos y cierre de sesión. | [interfaz-y-temas.md](docs/interfaz-y-temas.md) |
| **Editar perfil** (`profile/edit.tsx`) | Nombre visible, usuario único, descripción, país, visibilidad pública y subida de avatar/portada comprimidos en el dispositivo. | [firestore.md](docs/firestore.md) |
| **Comunidad** (`(app)/community.tsx`) | Chats directos y grupales, amistades, solicitudes, búsqueda de personas, bloqueo, reportes y grupos por código de invitación. | [firestore.md](docs/firestore.md) |
| **Chat** (`chat/[chatId].tsx`) | Mensajes en tiempo real, cooldown de 30 s, alertas de emergencia y desbloqueo con anuncio recompensado validado por SSV. | [firestore.md](docs/firestore.md) |
| **Perfil público** (`user/[uid].tsx`) | Perfil de otra persona, privacidad, acciones de amistad/bloqueo/reporte y apertura de chat directo. | [firestore.md](docs/firestore.md) |
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
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.firebasestorage.app
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
- **Development build** (`npx expo run:android` o EAS) — necesario para **AdMob, mapas nativos y algunos flujos de Google** (ver [despliegue.md](docs/despliegue.md)).

### 4. Desplegar reglas, Functions y Storage

El proyecto ya incluye `.firebaserc` con el proyecto por defecto. Para desplegar necesitas
activar **Blaze** y tener configuradas las variables de Functions (AdMob):

```bash
npm run deploy
```

`npm run deploy` compila Functions y despliega Functions, reglas e índices. Si solo
cambiaste reglas, usa `npm run deploy:rules`. El runbook completo está en
[despliegue.md](docs/despliegue.md).

> Las funciones sociales (`bootstrapProfile`, amistades, chats, recompensas) no funcionan
> hasta que las Functions estén desplegadas. Sin ellas la app sigue mostrando sismos,
> alertas y el modo invitado.

### 5. AdMob y development build

Los IDs de `app.json` son los de **prueba** de Google. Para probar anuncios reales:

1. Crea la app y una unidad recompensada en AdMob.
2. Reemplaza `androidAppId`/`iosAppId` en `app.json`.
3. Define `EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID` en `.env`.
4. Define `ADMOB_REWARDED_UNIT_ID` en `functions/.env` y configura la URL SSV.
5. Genera un development build: `npx eas-cli build --profile development --platform android`.

Expo Go no incluye los módulos nativos de AdMob, mapas ni notificaciones; esas pruebas
requieren un development build. Detalle en [despliegue.md](docs/despliegue.md#5-admob-y-ssv-solo-propietario).

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm start` / `npx expo start` | Dev server de Expo |
| `npm run android` | Abre en Android |
| `npm run web` | Abre en el navegador |
| `npm run typecheck` | `tsc --noEmit` (TypeScript estricto, sin emitir) |
| `npm run lint` | ESLint con la config de Expo |
| `npm test` | Tests unitarios con Jest |
| `npm run test:watch` | Tests en modo watch |
| `npm run test:rules` | Tests de reglas Firestore; arranca y detiene el emulador aislado |
| `npm run doctor` | Diagnóstico de dependencias y configuración de Expo |
| `npm run emulators` | Emuladores locales de Firebase |
| `npm run deploy` | Compila Functions y despliega Functions, reglas e índices |
| `npm run deploy:rules` | Solo reglas de Firestore/Storage e índices |
| `cd functions && npm run set-admin -- <uid-o-correo>` | Asigna el custom claim `admin` para moderación |

---

## Estructura del proyecto

```
sismoConnect/
├── app.json                 # Expo: nombre, plataformas, plugins, AdMob, splash
├── eas.json                 # Perfiles development / preview / production
├── firebase.json            # Functions, Firestore, Storage y emuladores
├── firestore.rules          # Reglas de Firestore (owner-only + Functions-only)
├── storage.rules            # Reglas de Storage (avatares/portadas del dueño)
├── firebase.test.json       # Emulador aislado para tests de reglas
├── jest.config.js           # Tests unitarios
├── .firebaserc              # Proyecto Firebase por defecto
├── .env                     # Claves de Firebase/AdMob (no commitear)
├── functions/               # Cloud Functions v2 en TypeScript
│   └── src/
│       ├── index.ts         # Exporta callables y SSV
│       ├── config.ts        # Límites, defaults y helpers
│       ├── profiles.ts      # bootstrap, username, updateProfile, reportes
│       ├── social.ts        # amistades, bloqueos, chats directos
│       ├── chats.ts         # grupos, miembros, mensajes, cooldown/emergencia
│       └── rewards.ts       # SSV de AdMob y estado de recompensas
├── tests/                   # Tests de reglas Firestore
├── scripts/                 # Generador del dataset de países
├── assets/                  # Iconos, splash, imágenes y dataset Natural Earth
└── src/
    ├── app/                 # RUTAS (Expo Router: cada archivo es una pantalla)
    │   ├── _layout.tsx      #   Layout raíz: providers + splash + guards
    │   ├── (auth)/          #   Login, registro y recuperación
    │   ├── (app)/           #   Tabs: Monitor, Mapa, Alertas, Comunidad, Perfil
    │   ├── profile/edit.tsx #   Edición del perfil social
    │   ├── user/[uid].tsx   #   Perfil público de otra persona
    │   └── chat/[chatId].tsx#   Chat directo o grupal
    ├── components/          # Auth, mapa, sismos, filtros y sistema de diseño
    ├── hooks/               # USGS, alertas, tema, storage y capa social
    ├── services/            # USGS, Firestore, social, países e imágenes
    ├── lib/                 # Firebase, AdMob, háptica y tema de navegación
    ├── constants/           # Config y tokens de diseño
    ├── types/               # Sismos, países, social y augmentos de Firebase
    └── utils/               # Formato y validación
```

---

## Stack tecnológico

| Tecnología | Versión | Por qué |
|---|---|---|
| Expo | ~57.0.31 | SDK con router, splash, fuentes y build en la nube (EAS). |
| React Native | 0.86.3 | Runtime móvil compartido con la web (react-native-web). |
| Expo Router | ~57.0.29 | Enrutamiento por archivos + guards declarativos (`Stack.Protected`). |
| Firebase (JS SDK) | ^12.19.0 | Auth, Firestore, Storage y Functions desde un solo SDK. |
| Cloud Functions | v2 / Node 20 | Validación server-side de perfiles, chats, cooldown y recompensas. |
| AsyncStorage | 2.2.0 | Persistencia de sesión de Firebase, tema e historial. |
| react-native-maps | 1.27.2 | Mapa nativo en Android (versión web propia con react-native-web). |
| react-native-google-mobile-ads | ^17.4.0 | Anuncio recompensado + SSV (solo development/production build). |
| expo-auth-session | ~57.0.16 | Flujo OAuth de Google (id_token → credencial de Firebase). |
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
| [docs/despliegue.md](docs/despliegue.md) | Runbook de Firebase, Functions, Storage, AdMob/SSV, EAS y validación en dispositivo. |
| [docs/costos-firebase.md](docs/costos-firebase.md) | Cuotas gratuitas, riesgos de costo, alertas de presupuesto y checklist. |
| [docs/informes-push-moderacion.md](docs/informes-push-moderacion.md) | Informes GDACS/ReliefWeb, push FCM, inbox, moderación admin y ajustes de grupo. |

---

## Notas conocidas

- `firebaseConfig.js` (raíz) y `app.js` (raíz) están **fuera del flujo principal**: el entry real es `expo-router/entry` y la config de Firebase vive en `.env → src/constants/config.ts`. Se conservan sin usar por decisión del proyecto; no crear una segunda arquitectura de Firebase con ellos.
- `getDocuments()` en `src/services/firestore.ts` existe y funciona, pero hoy ninguna pantalla la llama: la lista en vivo usa `subscribeToCollection()` (onSnapshot).
- La app funciona sin `.env` en modo invitado local; Firestore, perfiles, amistades, chats y el login por correo quedan deshabilitados en ese estado.
- **Las funciones sociales requieren Functions desplegadas.** La app muestra errores controlados si el backend no está disponible.
- Los IDs de AdMob en `app.json` son los oficiales de prueba. AdMob solo funciona en Android nativo con development/production build; en web y Expo Go se usa el modo sin recompensa.
- `firestore-test.tsx` sigue siendo una pantalla de diagnóstico de Firestore, no forma parte del flujo social.
- `LICENSE` es la licencia MIT de la plantilla de Expo.

## Calidad

```bash
npm test          # 21 tests unitarios
npm run test:rules # 14 tests de reglas Firestore (requiere Java + emulador)
npm run typecheck
npm run lint
npm run doctor
```

Los tests de reglas usan el proyecto demo `demo-sismoconnect` y el puerto `8082`
(`firebase.test.json`), por lo que no tocan Firebase real. `scripts/test-rules.mjs`
arranca y detiene el emulador automáticamente; si el puerto está ocupado, falla sin
reutilizar ni detener procesos ajenos.

## Licencia

MIT — ver [LICENSE](LICENSE).

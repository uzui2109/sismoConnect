# Configuración y entorno

Todo lo que hay que configurar para que SismoConnect corra, y qué hace cada archivo de configuración.

## [Volver al README](../README.md)

---

## 1. Variables de entorno (`.env`)

Se leen exclusivamente desde `src/constants/config.ts`:

```ts
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
} as const;
```

| Variable | Origen en Firebase Console | Uso |
|---|---|---|
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Configuración del proyecto → Tus apps → SDK | Identifica el proyecto (no es un secreto: viaja en el bundle) |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | idem | Dominio para flujos web de auth |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | idem | ID del proyecto (`<proyecto>.firebaseio.com`) |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | idem | Bucket (no se usa Storage hoy) |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | idem | Sender de FCM (hoy solo se propaga) |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | idem | ID de la app registrada |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Google Cloud Console → credenciales OAuth | Opcional: habilita "Continuar con Google" |

Reglas:

1. **Todo prefijo `EXPO_PUBLIC_`** — Expo solo inyecta en el bundle las variables con ese prefijo; cualquier otra se queda en el servidor.
2. **Nunca commitear `.env`** (está en `.gitignore`).
3. **La app sin `.env` funciona**: `isFirebaseConfigured` (`config.ts:16`) se vuelve `false` y la app entra en modo invitado local.

### BOM en `.env` (advertencia)

El `.env` de este proyecto está guardado con **BOM** (bytes `EF BB BF` al inicio). Expo lo tolera, pero Node no: `node --env-file=.env` no leerá la primera línea (`EXPO_PUBLIC_FIREBASE_API_KEY` quedará indefinida). Si automatizas scripts de Node contra este `.env`, carga el archivo manualmente y limpia el BOM (`content.replace(/^\uFEFF/, '')`).

### Cliente de Google (opcional)

Para que aparezca activo el botón **"Continuar con Google"**:

1. Crear credencial **OAuth 2.0 Client ID** (tipo Android) en Google Cloud Console con la huella de SHA-1 de tu keystore.
2. Poner el valor en `EXPO_PUBLIC_GOOGLE_CLIENT_ID`.
3. Usar un **development build** (`npx expo run:android`): el flujo OAuth abre el navegador del sistema y no puede completarse dentro de Expo Go (`google-sign-in-button.tsx:31-32`).

Si la variable está vacía, el componente no rompe: muestra un aviso (`google-sign-in-button.tsx:67-75`).

---

## 2. Inicialización de Firebase (una sola vez, perezosa)

Existe **una** inicialización por plataforma, en `src/lib/`:

| Archivo | Cuándo lo usa Metro |
|---|---|
| `firebase.native.ts` | Android/iOS (suffix `.native`) |
| `firebase.web.ts` | Web |
| `firebase.d.ts` | Declaraciones compartidas para TypeScript (`getFirebaseAuth`, `getFirebaseFirestore`, `firebaseAuth`) |

Ambos exponen lo mismo:

```ts
let instance: ReturnType<typeof initializeAuth> | null = null;

export function getFirebaseAuth() {
  if (!isFirebaseConfigured) throw new Error('Firebase no está configurado. Revisa tu archivo .env.');
  instance ??= initializeAuth(initializeApp(firebaseConfig), { persistence: ... });
  return instance;
}

export const firebaseAuth = new Proxy({} as ReturnType<typeof getAuth>, {
  get: (_t, property, receiver) => Reflect.get(instance ?? getFirebaseAuth(), property, receiver),
});
```

Por qué está así:

- **`??=` perezoso**: si nadie llama a auth (checkout sin `.env`), no hay `initializeApp` y la app no crashea al arrancar.
- **Una sola instancia**: `initializeAuth` lanza `auth/already-initialized` si se llama dos veces; el caché `instance` lo evita y todas las pantallas comparten la misma sesión.
- **`firebaseAuth` como `Proxy`**: da compatibilidad con código que espera un objeto auth "eager", resolviéndolo bajo demanda.
- **Firestore reutiliza la app**: `getFirebaseFirestore()` (`firebase.native.ts:37-43`) hace `getFirestore(instance ? getApp() : initializeApp(firebaseConfig))`, así auth y Firestore apuntan al mismo `app` sin duplicar inicializaciones.

El punto único de acceso para servicios es `getFirebaseFirestore()`; `services/firestore.ts` es el único archivo que lo consume.

---

## 3. `app.json` (configuración de Expo)

| Clave | Valor actual | Significado |
|---|---|---|
| `name` / `slug` | `sismoConnect` | Nombre visible y slug de EAS |
| `scheme` | `sismoconnect` | Deep links (`sismoconnect://`) |
| `platforms` | `["android", "web"]` | No se compila para iOS |
| `userInterfaceStyle` | `automatic` | Respeta el modo claro/oscuro del sistema |
| `android.package` | `com.sismoconnect.app` | Package id de Android |
| `web.bundler` / `output` | `metro` / `static` | SSG estático para web |
| `experiments.typedRoutes` | `true` | Los `href` de Expo Router se validan en TS |
| `plugins` | expo-router, expo-image, expo-web-browser, expo-splash-screen, expo-font | Módulos nativos que necesitan config (splash con logo y fondo `#0B1120`) |

> No existen carpetas `ios/` ni `android/` (Continuous Native Generation): la config nativa vive en `app.json` y los plugins.

---

## 4. TypeScript, ESLint y scripts

- **`tsconfig.json`**: `strict: true`, hereda `expo/tsconfig.base`, alias `@/* → ./src/*` y `@/assets/* → ./assets/*`, incluye `.expo/types` (rutas tipadas) y `expo-env.d.ts`.
- **`eslint.config.js`**: flat config con `eslint-config-expo/flat` e ignora `dist/`.
- **Scripts** (`package.json`): `start`, `android`, `web`, `typecheck` (`tsc --noEmit`), `lint` (`expo lint`), `doctor` (`expo-doctor`).

Validación habitual antes de dar por terminada una tarea:

```bash
npm run typecheck && npm run lint
```

---

## 5. Expo Go vs development build

| Función | Expo Go | Dev build (`npx expo run:android`) / EAS build |
|---|---|---|
| Login/registro por correo | ✅ | ✅ |
| Invitado, persistencia de sesión | ✅ | ✅ |
| Firestore (SDK JS puro) | ✅ | ✅ |
| Mapa (`react-native-maps`) | ✅ (incluido en Expo Go) | ✅ |
| **Google Sign-In** (OAuth por navegador) | ❌ | ✅ |
| `global.css` / fuentes | ✅ | ✅ |

Firestore no requiere módulos nativos propios: usa el SDK JS (`firebase/firestore`) sobre WebSocket, así que funciona en Expo Go sin development build.

---

## 6. Archivos de la raíz fuera de flujo

Se conservan **sin usar** por decisión del proyecto (no eliminar, no expandir):

| Archivo | Qué es | Por qué está fuera |
|---|---|---|
| `firebaseConfig.js` | Módulo con `initializeApp` + `initializeAuth` + `getFirestore` y las credenciales **hardcodeadas** | Nadie lo importa (`grep` no encuentra referencias). El flujo real es `.env → src/constants/config.ts → src/lib/firebase.*`. Usarlo crearía una **segunda inicialización** de Firebase. |
| `app.js` | Componente `App()` de plantilla ("Proyecto base funcionando!") | El entry real es `"main": "expo-router/entry"` en `package.json`. |
| `firestore-test.tsx` (en `(app)/`) | Pantalla mínima que solo llama `addDocument` | Existe y es navegable, pero no tiene pestaña en el tab bar; la integración real de Firestore está en `alerts.tsx`. |

> `firebaseConfig.js` contiene una API key de Firebase escrita a mano. Las API keys web no son secretos (viajan en todo bundle), pero el archivo está desactualizado respecto a `.env`; si el proyecto se publica, conviene revocar esa key en la consola y quedarse solo con `.env`.

---

## 7. Documentación relacionada

- [autenticacion.md](autenticacion.md) — qué consume esta configuración.
- [firestore.md](firestore.md) — reglas de seguridad de Firestore.
- [arquitectura.md](arquitectura.md) — cómo encajan estas piezas en el arranque.

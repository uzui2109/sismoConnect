# Guía de clase: "Integración con Firebase"

Checklist de cada requisito de la guía y dónde está cumplido en el código (`archivo:línea`), más el procedimiento de verificación manual.

## [Volver al README](../README.md)

---

## 1. Autenticación (ya funcionando)

| # | Requisito | Dónde está | Estado |
|---|---|---|---|
| 1 | Configuración vía `.env` | `src/constants/config.ts:3-16` · `src/lib/firebase.native.ts` / `firebase.web.ts` (init perezosa, una sola instancia) | ✅ |
| 2 | Registro con correo y contraseña | `src/providers/auth-provider.tsx:123-128` (`createUserWithEmailAndPassword` + `sendEmailVerification`) · UI en `src/app/(auth)/sign-up.tsx` | ✅ |
| 3 | Inicio de sesión | `auth-provider.tsx:117-121` (`signInWithEmailAndPassword`) · UI en `sign-in.tsx` | ✅ |
| 4 | Cierre de sesión | `auth-provider.tsx:150-157` · UI en `profile.tsx` | ✅ |
| 5 | `onAuthStateChanged` (único listener) | `auth-provider.tsx:88-102` | ✅ |
| 6 | Persistencia de sesión | Native: `getReactNativePersistence(AsyncStorage)` en `firebase.native.ts:21-25`; Web: `browserLocalPersistence` en `firebase.web.ts:21-23` | ✅ |
| 7 | Contexto de acceso (`AuthContext` / `useAuth`) | `auth-provider.tsx:56, 187-191` | ✅ |
| 8 | Protección de rutas | `src/app/_layout.tsx:67-72` (`Stack.Protected` por `user`) | ✅ |

---

## 2. Firestore (integración completa)

| # | Requisito | Dónde está | Estado |
|---|---|---|---|
| 1 | **Firestore** conectado al proyecto | `getFirebaseFirestore()` en `firebase.native.ts:37-43` / `firebase.web.ts:38-44`; declarado en `firebase.d.ts:5` | ✅ |
| 2 | **Crear documentos con `addDoc`** | `src/services/firestore.ts:17-28` → `addDocument()`; llamado por `use-alerts.ts:88` (`addAlert`) desde el formulario de `alerts.tsx:90-111` | ✅ |
| 3 | **Escuchar en tiempo real con `onSnapshot`** | `firestore.ts:81-87` dentro de `subscribeToCollection()`; suscripción en `use-alerts.ts:60-77` con `where('userId','==',uid)` | ✅ |
| 4 | **Devolver `unsubscribe` para limpiar el listener** | `firestore.ts:89` (`return unsubscribe`) → retornado como cleanup del `useEffect` en `use-alerts.ts:79` | ✅ |
| 5 | **Actualizar documentos con `updateDoc`** | `firestore.ts:42-52` → `updateDocument()`; llamado por `use-alerts.ts:105` (`toggleAlert`: pausar/activar) | ✅ |
| 6 | **Eliminar documentos con `deleteDoc`** | `firestore.ts:54-63` → `deleteDocument()`; llamado por `use-alerts.ts:114` (`removeAlert`) | ✅ |
| 7 | **Interfaz de la app que usa Firestore de verdad** | Sección **"Mis alertas"** en `src/app/(app)/alerts.tsx:186-270`: formulario de creación, lista en vivo, botones Pausar/Activar y Eliminar | ✅ |
| 8 | **Reglas: solo usuarios autenticados** | `firestore.rules` (raíz): `allow read, write: if request.auth != null;` para `alertas` y `test` | ✅ *(ver nota)* |

> **Nota**: las reglas del archivo ya están escritas, pero hay que **publicarlas** en Firebase Console → Firestore → Reglas. Mientras no se hagan públicas, la consola puede seguir con las reglas anteriores (durante la verificación, una lectura sin sesión fue aceptada).

### Qué NO se tocó (según los límites del encargo)

- Navegación, tabs, estilos generales, autenticación existente, `AuthProvider`, login/registro/persistencia.
- Integración con USGS y la lógica de terremotos.
- `.env`, `firebaseConfig.js` (raíz) y `firestore-test.tsx`: intactos y fuera del flujo.
- No hay una segunda inicialización de Firebase: todo pasa por `getFirebaseFirestore()`.

---

## 3. Verificación manual (10 pasos)

Con la app corriendo (`npx expo start`) y con las reglas publicadas:

1. **Login**: iniciar sesión con correo y contraseña → entra directo al Monitor (sin pantalla de login intermedia).
2. **Persistencia**: cerrar y reabrir la app → la sesión sigue activa.
3. **Crear (addDoc)**: pestaña **Alertas** → sección "Mis alertas" → magnitud `5.5`, lugar "Prueba" → **Crear alerta** → la fila aparece **sin recargar**.
4. **Tiempo real (onSnapshot)**: con la misma cuenta abierta en otra ventana/dispositivo → la alerta aparece sola en ambos.
5. **Actualizar (updateDoc)**: pulsar **Pausar** → el badge cambia a "Pausada" **en todas las ventanas**.
6. **Eliminar (deleteDoc)**: pulsar **Eliminar** → la fila desaparece en todas las ventanas.
7. **Limpieza del listener**: salir de la pestaña Alertas, volver, y cerrar sesión → no quedan errores de `permission denied` en consola (el `unsubscribe` corrió al desmontar).
8. **Sin sesión**: cerrar sesión → "Mis alertas" muestra "Inicia sesión para sincronizar" y no hace llamadas.
9. **Invitado local**: con la app sin `.env`, entrar como invitado → misma tarjeta, cero llamadas a Firestore.
10. **Reglas**: con las reglas publicadas, leer la colección `alertas` sin sesión (consola o script) → `permission-denied`.

Resultado del smoke test automatizado (2026-10-06, ejecutado contra el proyecto real):

```
ADD_OK                ← addDoc creó el documento
ONSNAPSHOT_OK         ← el listener lo vio en tiempo real
UPDATE_OK             ← onSnapshot reflejó el updateDoc
DELETE_OK             ← onSnapshot reflejó el deleteDoc
DOCS smoke-test restantes: 0
```

---

## 4. Comandos de validación

```bash
npm run typecheck   # tsc --noEmit — TypeScript estricto
npm run lint        # expo lint — ESLint
```

Ambos deben pasar sin errores antes de entregar.

---

## 5. Mapa rápido de la integración Firestore

```
.env
 └─ src/constants/config.ts          firebaseConfig + isFirebaseConfigured
     └─ src/lib/firebase.*.ts        getFirebaseFirestore()  [una sola init]
         └─ src/services/firestore.ts   addDoc · getDocs · updateDoc · deleteDoc · onSnapshot
             └─ src/hooks/use-alerts.ts   estado React + cleanup del listener
                 └─ src/app/(app)/alerts.tsx   "Mis alertas" (interfaz real)
firestore.rules  →  Firebase Console (reglas: request.auth != null)
```

## 6. Documentación relacionada

- [firestore.md](firestore.md) — detalle completo de la integración.
- [autenticacion.md](autenticacion.md) — los requisitos de la sección 1.
- [configuracion.md](configuracion.md) — `.env` y inicialización.

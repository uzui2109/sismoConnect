# Firestore en SismoConnect

Todo sobre la integración con Firestore: el servicio CRUD, el listener en tiempo real, la interfaz que lo usa y las reglas de seguridad.

## [Volver al README](../README.md)

---

## 1. Arquitectura de la integración

```
.env → src/constants/config.ts → getFirebaseFirestore()  (src/lib/firebase.*.ts)
                                        ↓
                          src/services/firestore.ts       ← único archivo que toca firebase/firestore
                                        ↓
                          src/hooks/use-alerts.ts         ← estado React + ciclo de vida
                                        ↓
                          src/app/(app)/alerts.tsx        ← interfaz "Mis alertas"
```

Reglas que cumple el diseño:

- **Una sola inicialización**: todo pasa por `getFirebaseFirestore()`; no hay `initializeApp` extra en ningún archivo nuevo.
- **Las pantallas no importan el SDK**: solo `services/firestore.ts` (y el operador `where` en `use-alerts.ts`).
- **La sesión es la existente**: el hook consume `useAuth()` del `AuthProvider` actual; no hay un segundo contexto.

---

## 2. El servicio: `src/services/firestore.ts`

Cinco funciones genéricas (el nombre de colección siempre lo pasa el caller):

| Función | Líneas | SDK | Retorna | Uso |
|---|---|---|---|---|
| `addDocument(collection, data)` | 17-28 | `addDoc` | `id` del documento creado | **CREATE** |
| `getDocuments(collection)` | 30-40 | `getDocs` | array `{id, ...data}` | Lectura única (disponible, sin uso actual) |
| `updateDocument(collection, id, data)` | 42-52 | `updateDoc` | `void` | **UPDATE** (merge parcial) |
| `deleteDocument(collection, id)` | 54-63 | `deleteDoc` | `void` | **DELETE** |
| `subscribeToCollection(collection, onData, onError?, constraints?)` | 70-90 | `onSnapshot` | **`unsubscribe`** | **READ REAL-TIME** |

### El patrón de tiempo real (requisito de la guía)

```ts
export function subscribeToCollection(
  collectionName: string,
  onData: (documents: FirestoreDocument[]) => void,
  onError?: (error: Error) => void,
  constraints: QueryConstraint[] = []
) {
  const db = getFirebaseFirestore();

  const collectionRef = collection(db, collectionName);
  const queryRef = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;

  const unsubscribe = onSnapshot(
    queryRef,
    (snapshot) => {
      onData(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
    },
    (error) => onError?.(error)
  );

  return unsubscribe;
}
```

- `onSnapshot` registra un listener persistente: **cada** alta, baja o edición (en este cliente o en cualquier otro) dispara el callback con la lista completa.
- La función **retorna `unsubscribe`**, que el llamante debe invocar para dejar de escuchar (si no, el listener vive para siempre y filtra memoria).
- `constraints` permite componer queries (`where`, `orderBy`…) sin duplicar código.
- `FirestoreDocument` (línea 15) es `Record<string, unknown> & { id: string }`: el `id` lo aporta el snapshot, no el documento.

---

## 3. El hook: `src/hooks/use-alerts.ts`

`useFirestoreAlerts()` es el puente React ↔ Firestore.

### Suscripción y limpieza

```ts
useEffect(() => {
  if (uid === null) return;

  const unsubscribe = subscribeToCollection(
    'alertas',
    (documents) => { setFeed({ uid, alerts: … }); setFailure(null); },
    (listenerError) => { … setFailure({ uid, message: … }); },
    [where('userId', '==', uid)]
  );

  return unsubscribe;          // ← la limpieza del listener ES el retorno del effect
}, [uid]);
```

- **`return unsubscribe`** en el `useEffect` es exactamente el patrón que exige la guía: React lo llama al desmontar o cuando cambia `uid`, y Firebase deja de escuchar.
- El listener solo se activa con sesión Firebase real: `enabled = isConfigured && user !== null && !isLocalGuest` (línea 54) y `uid = enabled ? user.uid : null` (línea 55).

### Sin `orderBy`: evitar el índice compuesto

La query usa **un solo** `where` (`userId == uid`). El orden descendente por `createdAt` se aplica en el cliente (línea 68). Razón: combinar un `where` de igualdad con un `orderBy` sobre **otro** campo obliga a crear un **índice compuesto** en Firebase Console; con un solo campo filtrado no hace falta ningún índice y la app funciona en cualquier proyecto nuevo.

Defensa adicional: aunque las reglas permitieran leer toda la colección, el hook **filtra por `userId` en cliente** (línea 67) y descarta documentos ajenos.

### Estado derivado sin `setState` en el effect

```ts
const alerts  = feed !== null && feed.uid === uid ? feed.alerts : EMPTY_ALERTS;
const loading = uid !== null && (feed === null || feed.uid !== uid) && failure?.uid !== uid;
const error   = failure !== null && failure.uid === uid ? failure.message : null;
```

- `feed` y `failure` recuerdan **a qué uid** pertenecen: al cerrar sesión o cambiar de cuenta, `uid` ya no coincide → la UI ve lista vacía/inmediata en lugar de las alertas del usuario anterior (y se evita el lint `react-hooks/set-state-in-effect`, que prohíbe `setState` síncrono dentro del cuerpo de un effect).
- Los `setFeed`/`setFailure` solo ocurren dentro de los callbacks de `onSnapshot`.

### Operaciones CRUD expuestas

| Método | Línea | Servicio | Detalle |
|---|---|---|---|
| `addAlert({minMagnitude, place})` | 82-100 | `addDocument` | Escribe `userId`, `active: true`, `createdAt: Date.now()` |
| `toggleAlert(alert)` | 102-109 | `updateDocument` | `updateDocument(…, { active: !alert.active })` — update parcial |
| `removeAlert(alert)` | 111-118 | `deleteDocument` | Borra por `id` |

Las tres envuelven la operación en `setBusy(true/false)` con `try/finally` para que los botones se deshabilten mientras hay una escritura en curso.

### Esquema del documento `alertas`

| Campo | Tipo | Ejemplo | Quién lo escribe |
|---|---|---|---|
| `userId` | `string` | `"abc123…"` (uid de Firebase) | `addAlert` |
| `minMagnitude` | `number` | `5.5` | `addAlert` (0-10, validado en la UI) |
| `place` | `string` | `"Ciudad de México"` o `""` | `addAlert` |
| `active` | `boolean` | `true` / `false` | `addAlert` / `toggleAlert` |
| `createdAt` | `number` (epoch ms) | `1759776000000` | `addAlert` |

`toAlert()` (líneas 26-35) convierte el `Record<string, unknown>` del snapshot al tipo `AlertRecord` con coerción defensiva (`Number(...)`, `String(...)`, `active !== false`), para que un documento editado a mano en la consola no rompa la UI.

---

## 4. La interfaz: sección "Mis alertas" en `alerts.tsx`

Ubicación: `src/app/(app)/alerts.tsx`, sección que empieza en la línea 186, dentro de la pestaña **Alertas**.

```
┌ Alertas ────────────────────────────────┐
│ Sismos recientes…                       │  ← USGS (useEarthquakes)
│                                         │
│ Mis alertas                             │
│ ┌─────────────────────────────────────┐ │
│ │ Magnitud mínima  [ 5.5 ]            │ │  ← TextField (valida 0-10)
│ │ Lugar (opcional)  [________]        │ │
│ │ [ Crear alerta ]                    │ │  ← addDoc
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ M 5.5              ● Activa         │ │  ← llega por onSnapshot
│ │ Ciudad de México                   │ │
│ │ [ Pausar ]  [ Eliminar ]            │ │  ← updateDoc / deleteDoc
│ └─────────────────────────────────────┘ │
│ Números de emergencia…                  │
└─────────────────────────────────────────┘
```

Comportamiento:

- **Sin sesión Firebase** (invitado local o sin `.env`): tarjeta "Inicia sesión para sincronizar" — cero llamadas a Firestore (línea 191).
- **Carga**: "Sincronizando alertas con Firestore…" (línea 233).
- **Error del listener**: `ErrorState` con el mensaje del hook (línea 231).
- **Lista vacía**: `EmptyState` "Sin alertas guardadas" (línea 238).
- **Formulario**: `createAlert()` (línea 90) valida magnitud 0-10 (acepta coma decimal), llama `addAlert` y limpia los campos; en error muestra "No se pudo guardar la alerta en Firestore."
- **Cada fila**: badge `Activa`/`Pausada` (verde/neutral), botón Pausar/Activar (`updateDoc`) y Eliminar (`deleteDoc`), todos deshabilitados con `busy`.
- **Tiempo real**: no hay botón "refrescar" — al crear/pausar/borrar (en cualquier dispositivo con la misma sesión) la lista se actualiza sola vía `onSnapshot`.

El resto de la pantalla (avisos USGS ≥ M5, números de emergencia por país) es independiente de Firestore y no se modificó.

---

## 5. Reglas de seguridad

Archivo: [`firestore.rules`](../firestore.rules) en la raíz.

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Alertas personalizadas del usuario (la app usa esta colección).
    match /alertas/{alertId} {
      allow read, write: if request.auth != null;
    }

    // Colección que usa la pantalla de prueba de Firestore.
    match /test/{documentId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

- `request.auth != null` = **solo usuarios autenticados** (correo, Google o anónimo). Un invitado local o un usuario sin sesión recibe `permission-denied`.
- Si el `match` no cubre una colección, el denegado es el **default**: colecciones no listadas quedan cerradas.
- No se permite `if true` en ninguna parte.

### Cómo publicarlas

1. Firebase Console → **Firestore Database** → pestaña **Reglas**.
2. Reemplazar el contenido por el de `firestore.rules`.
3. **Publicar**.

> **Estado actual (2026-10-06)**: las reglas desplegadas en la consola siguen abiertas — una lectura sin sesión fue aceptada durante la verificación. Publica este archivo para exigir autenticación.

---

## 6. Verificación realizada

Smoke test ejecutado en vivo contra el proyecto real (script temporal, ya eliminado):

```
LECTURA sin auth: permitida (reglas aún abiertas)
ADD_OK 4sipoR9hQnt3Ehomqwnv        ← addDoc
ONSNAPSHOT_OK documento visible en tiempo real
UPDATE_OK onSnapshot reflejó updateDoc
DELETE_OK onSnapshot reflejó deleteDoc
DOCS smoke-test restantes: 0
SMOKE_TEST_EXITO
```

Verificación manual en la app (ver también [guia-de-clase.md](guia-de-clase.md)):

1. Iniciar sesión con correo → Alertas → crear una alerta → aparece al instante.
2. Abrir la app en otro dispositivo/navegador con la misma cuenta → la alerta aparece sola (onSnapshot).
3. Pausar/activar y eliminar desde cualquiera de los dos → el otro se actualiza solo.
4. Cerrar sesión → la sección cambia a "Inicia sesión para sincronizar".
5. Entrar como invitado local (sin `.env`) → misma pantalla, sin llamadas a Firestore.
6. Probar sin sesión en la consola → `permission-denied` una vez publicadas las reglas.

---

## 7. Documentación relacionada

- [autenticacion.md](autenticacion.md) — qué sesiones cumplen `request.auth != null`.
- [configuracion.md](configuracion.md) — de dónde sale `getFirebaseFirestore()`.
- [guia-de-clase.md](guia-de-clase.md) — requisitos cumplidos con `archivo:línea`.

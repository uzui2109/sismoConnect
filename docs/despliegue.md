# Despliegue y validación

Runbook para pasar de un checkout local a una build instalable con Firebase, Functions,
Storage y AdMob reales. Los pasos marcados **solo propietario** requieren credenciales,
facturación o accesos que no están en el repositorio.

## [Volver al README](../README.md)

## 1. Requisitos

- Node 20 para `functions/` (el proyecto raíz puede usar una versión más nueva).
- Java 11+ para el emulador de Firestore.
- Firebase CLI (`firebase-tools`, ya está en devDependencies).
- Cuenta de Expo/EAS para development/production builds.
- Proyecto Firebase con **Blaze** activo: Functions y Storage no funcionan en Spark.

```bash
node --version
java -version
npx firebase --version
npx eas-cli --version
```

Si usas varias versiones de Node, cambia a 20 antes de compilar Functions:

```bash
nvm use 20
```

## 2. Firebase (solo propietario)

1. Entra en [Firebase Console](https://console.firebase.google.com/) y crea o abre el proyecto.
2. Activa **Blaze** en *Configuración del proyecto → Uso y facturación*.
3. En **Authentication → Sign-in method** activa:
   - Correo electrónico/contraseña.
   - Google.
4. Crea la base de datos de **Firestore** en modo producción.
5. Activa **Storage** y confirma el bucket.
6. Registra una app web y copia su configuración a `.env`.

`.firebaserc` ya apunta a `sismoconnectfirebase`. Si usas otro proyecto, cámbialo o
ejecuta `firebase use --add`.

```env
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

No subas `.env` al repositorio.

## 3. Google Sign-In

1. En Google Cloud Console crea un **OAuth 2.0 Client ID** de tipo Web.
2. Crea también un cliente Android con el package `com.sismoconnect.app` y el SHA-1
   del keystore usado para firmar (debug o EAS).
3. Añade el client ID web a `.env`:

```env
EXPO_PUBLIC_GOOGLE_CLIENT_ID=...apps.googleusercontent.com
```

4. En Firebase Authentication → Google, confirma que el proveedor está habilitado.
5. Prueba en un development build; Expo Go no basta para el flujo nativo.

Si el login falla con `DEVELOPER_ERROR`, el SHA-1 o el package no coinciden.

## 4. Reglas, índices y Functions

```bash
npm run deploy
```

- `deploy` compila `functions/` con `predeploy` y publica Functions, reglas e índices.
- `deploy:rules` publica solo `firestore.rules`, `firestore.indexes.json` y `storage.rules`.
- `firebase.json` fija `nodejs20` y `maxInstances` está limitado en el código.

Verifica:

```bash
npx firebase functions:list
npx firebase firestore:indexes
```

Si Firestore pide un índice compuesto al usar una consulta nueva, créalo desde el enlace
del error y vuelve a ejecutar `npm run deploy:rules`.

### Variables de Functions

Crea `functions/.env` (ignorado por Git) para los IDs de AdMob:

```env
ADMOB_REWARDED_UNIT_ID=ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy
ADMOB_REWARDED_UNIT_ID_ANDROID=ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy
```

Vuelve a desplegar Functions después de cambiar estas variables:

```bash
npm run deploy:functions
```

`config/chat` es opcional. Si no existe, Functions usa:

- `cooldownSeconds = 30`
- `emergencyCooldownSeconds = 600`

Puedes crearlo en Firestore Console si quieres cambiar los valores sin desplegar.

## 5. AdMob y SSV (solo propietario)

1. Crea la app Android en [AdMob](https://apps.admob.com/) con el package
   `com.sismoconnect.app`.
2. Crea una unidad de anuncio **recompensado**.
3. Copia el App ID a `app.json`:

```json
[
  "react-native-google-mobile-ads",
  {
    "androidAppId": "ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy",
    "iosAppId": "ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy"
  }
]
```

4. Define la unidad en `.env`:

```env
EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID=ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy
```

5. Define la misma unidad en `functions/.env`.
6. En AdMob → tu app → **SSV**, configura la URL:

```text
https://us-central1-sismoconnectfirebase.cloudfunctions.net/admobSsv
```

7. Despliega Functions y genera un development build.

El servidor valida firma ECDSA, `timestamp` (15 min), unidad y `transaction_id`
idempotente. Si SSV falla, revisa los logs:

```bash
npx firebase functions:log --only admobSsv
```

Sin SSV válido no se concede la recompensa. El usuario siempre puede esperar el cooldown.

### IDs de prueba

Mientras no haya IDs reales, `app.json` y `src/constants/config.ts` usan los IDs oficiales
de prueba de Google. No funcionan en producción y no generan ingresos.

## 6. Development build

Expo Go no incluye AdMob, mapas nativos ni notificaciones. Para probar todo:

```bash
npx eas-cli login
npx eas-cli init
npx eas-cli build --profile development --platform android
```

`eas init` puede añadir `extra.eas.projectId` a `app.json`; es normal.

Instala el APK en el dispositivo y arranca Metro:

```bash
npx expo start --dev-client
```

Para una build instalable de producción:

```bash
npx eas-cli build --profile production --platform android
npx eas-cli submit --platform android
```

`eas.json` define los perfiles `development`, `preview` y `production`.

## 7. Validación en dispositivo

Marca cada punto en un Android real:

- [ ] Arranque sin `.env` en modo invitado local.
- [ ] Login por correo, registro y recuperación de contraseña.
- [ ] Login con Google.
- [ ] `bootstrapProfile` crea `users/{uid}` y `publicProfiles/{uid}`.
- [ ] Editar nombre, bio, país y visibilidad.
- [ ] Reservar y cambiar nombre de usuario.
- [ ] Subir avatar y portada; se recortan, comprimen y persisten.
- [ ] Buscar personas y enviar/aceptar/rechazar solicitudes.
- [ ] Bloquear, desbloquear y reportar.
- [ ] Crear chat directo y grupo; unirse con código.
- [ ] Enviar mensajes y verlos en tiempo real en otro dispositivo.
- [ ] Cooldown de 30 s y mensaje de espera.
- [ ] Alerta de emergencia con confirmación y límite de 10 min.
- [ ] Anuncio recompensado + SSV concede exactamente 1 desbloqueo.
- [ ] El desbloqueo se consume al enviar y no se acumula.
- [ ] Rechazo de escritura directa a `users`, `chats` o `messages` desde el cliente.
- [ ] Reglas de Storage impiden subir archivos de otro usuario o de más de 2 MB.
- [ ] Web sigue funcionando sin AdMob y sin mapas nativos.

## 8. Tests locales

```bash
npm test
npm run test:rules
npm run typecheck
npm run lint
npm run doctor
npx expo export --platform web --output-dir .expo-export-check
```

`npm run test:rules` usa `scripts/test-rules.mjs`: arranca el emulador en el puerto
`8082` con el proyecto demo `demo-sismoconnect`, espera a que esté listo, ejecuta Jest y
detiene los procesos al final. No toca Firebase real ni reutiliza un puerto ocupado; si
`8082` ya está en uso, falla e indica el PID sin detenerlo.

Fallback manual si el runner no puede usarse:

```powershell
npx firebase emulators:start --config firebase.test.json --only firestore --project demo-sismoconnect
```

En otra terminal:

```powershell
$env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8082"
node_modules\.bin\jest.cmd --config jest.rules.config.js --runInBand
```

Al terminar, detén el emulador con `Ctrl+C`.

## 9. Costos y límites

Antes de desplegar revisa [costos-firebase.md](costos-firebase.md). Como mínimo:

- Configura alertas de presupuesto en 1, 5 y 10 USD.
- Mantén `maxInstances: 5` en Functions.
- No subas imágenes mayores de 2 MB.
- Vigila las lecturas de Firestore si el número de usuarios crece.
- Revisa los logs de SSV después de cada cambio de AdMob.

## 10. Checklist de salida

- [ ] `.env` y `functions/.env` configurados fuera de Git.
- [ ] Blaze activo y presupuesto con alertas.
- [ ] Auth por correo y Google probados.
- [ ] Firestore y Storage con reglas desplegadas.
- [ ] Functions desplegadas y `functions:list` las muestra.
- [ ] AdMob real con SSV validado.
- [ ] Build de producción instalada y probada.
- [ ] Tests, typecheck, lint, doctor y export web en verde.

## 11. Respaldos y restauración de Firestore

Firestore no crea respaldos automáticos salvo que el propietario los programe. A continuación los comandos reales de exportación e importación, con los permisos necesarios. Ningún paso asume que exista un respaldo automático vigente.

### Requisitos previos

- Proyecto en plan **Blaze** (pago por uso). Las exportaciones e importaciones no están disponibles en Spark.
- Cuenta de servicio o usuario con el rol `roles/datastore.importExportAdmin` (o `roles/owner`/`roles/editor` como mínimo).
- Bucket de Cloud Storage destino con permiso `storage.objects.create` y `storage.objects.get` para la cuenta de servicio que ejecuta la exportación/importación.
- `gcloud` autenticado (`gcloud auth login` o `GOOGLE_APPLICATION_CREDENTIALS`).

### Exportar (snapshot de toda la base de datos)

```bash
gcloud auth login
gcloud config set project sismoconnectfirebase
gcloud firestore export gs://BUCKET_NAME/sismoconnect-backup-$(date +%Y%m%d)
```

Opciones útiles:
- `--async`: devuelve el control inmediatamente y la operación continúa en segundo plano.
- `--namespace=NAMESPACE`: exporta solo un espacio de nombres (por defecto, `(default)`).

La operación genera un archivo `overall_export_metadata.json` y los fragmentos de datos en el bucket indicado.

### Importar (restaurar desde un respaldo)

```bash
gcloud firestore import gs://BUCKET_NAME/sismoconnect-backup-20260101/overall_export_metadata.json
```

- La importación sobrescribe documentos existentes con los del respaldo; no elimina documentos que no estén en el respaldo.
- Para importar en un proyecto distinto, cámbialo con `gcloud config set project` antes de ejecutar.

### Programar respaldos (no automáticos por defecto)

Firestore no programa exportaciones por sí solo. Opciones reales:

1. **Cloud Scheduler + Cloud Functions**: una función periódica invoca `gcloud firestore export` (o la API `projects.databases.exportDocuments`) y guarda en un bucket con ciclo de vida (por ejemplo, borrar objetos antiguos de 30 días).
2. **Cron externo** (CI/CD, máquina propia): ejecuta el comando de exportación en una rutina programada y sube el metadata a un bucket con retención definida.

### Retención

- Conservar al menos los últimos 7 respaldos diarios y 1 semanal, ajustado a la tolerancia a pérdida de datos del negocio.
- Configurar reglas de ciclo de vida del bucket de Storage para expirar objetos antiguos y evitar costos ilimitados.
- Probar al menos una restauración en un proyecto de staging antes de confiar en el procedimiento en producción.

### Verificar un respaldo

```bash
gcloud firestore operations describe OPERATION_ID
```

`OPERATION_ID` se obtiene al iniciar la exportación o importación. El estado debe ser `SUCCESSFUL` antes de considerar el respaldo válido.


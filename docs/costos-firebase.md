# Costos y límites de Firebase

SismoConnect usa Firebase Authentication, Firestore, Cloud Storage y Cloud Functions. Las
funciones requieren el plan **Blaze**, pero el plan incluye cuotas gratuitas mensuales. Una cuota
gratuita **no es un tope de gasto**: si el uso la supera, se factura el excedente.

Verifica siempre las cifras en la consola y en la documentación oficial, porque Firebase puede
cambiar precios y cuotas:

- https://firebase.google.com/pricing
- https://firebase.google.com/docs/firestore/quotas
- https://firebase.google.com/docs/storage/quotas
- https://firebase.google.com/docs/functions/quotas

## Resumen de cuotas gratuitas

### Cloud Functions

- 2 millones de invocaciones al mes.
- 400,000 GB-segundo de tiempo de ejecución al mes.
- 200,000 CPU-segundo al mes.
- 5 GB de transferencia de salida al mes.

Las funciones de este proyecto usan `maxInstances: 5`, `minInstances: 0` y la región
`us-central1`. No hay una instancia permanente, así que el costo en reposo es cero. El costo
aparece con llamadas frecuentes, ejecuciones lentas o tráfico de salida alto.

### Firestore

- 1 GiB de almacenamiento.
- 10 GiB de transferencia de salida al mes.
- 20,000 escrituras por día.
- 50,000 lecturas por día.
- 20,000 borrados por día.

Cada envío de mensaje escribe varios documentos: el mensaje, el chat, el miembro del chat, el
índice del remitente y el índice de cada destinatario. En un grupo grande, un solo mensaje puede
consumir muchas escrituras. El cooldown de 30 segundos y la alerta de emergencia limitada a una
cada 10 minutos reducen ese consumo. Los listeners en tiempo real también generan lecturas al
cargar chats, perfiles y alertas.

### Cloud Storage

- 5 GB-mes de almacenamiento en `us-central1`, `us-west1` o `us-east1`.
- 100 GB de descarga al mes.
- 5,000 subidas al mes.
- 50,000 descargas al mes.

Las fotos de perfil y portada se recortan y comprimen en el dispositivo antes de subirse. El
límite propio es 2 MB por imagen, que es menor que el máximo de las reglas de Storage. Cada
cambio de foto sobrescribe el mismo objeto `users/{uid}/profile/avatar.jpg` o `cover.jpg`; no se
acumulan versiones.

### Authentication

El inicio de sesión con correo, Google e invitado no se factura por usuario en los planes
habituales. Los límites de proveedores y de verificación de correo dependen de la configuración
de Firebase Authentication.

### AdMob

El SDK de AdMob y la validación SSV no tienen costo directo de Firebase. Los ingresos y las
políticas dependen de la cuenta de AdMob. En desarrollo se usan IDs de prueba; nunca se deben
cobrar impresiones de prueba.

## Costos que pueden crecer

1. **Mensajes de chat**: son la principal fuente de escrituras de Firestore. Evita grupos masivos
   y no aumentes el cooldown sin una razón de producto.
2. **Listeners en tiempo real**: cada chat abierto y cada lista de amigos mantiene lecturas.
   Cierra pantallas al salir y no dupliques hooks.
3. **Imágenes**: una portada de 1280 px pesa más que un avatar. Mantén la compresión y el límite
   de 2 MB.
4. **Salida de Functions**: la verificación SSV y las respuestas de chat generan tráfico de
   salida, aunque el volumen normal es bajo.
5. **Reintentos**: el cliente no debe reintentar en bucle llamadas fallidas. Un error
   `resource-exhausted` incluye `nextAllowedAt` y debe respetarse.

## Configurar alertas de presupuesto

Las alertas de presupuesto de Google Cloud son avisos por correo, no bloquean el gasto.

1. Abre Google Cloud Console del proyecto y entra en **Facturación > Presupuestos y alertas**.
2. Crea un presupuesto mensual, por ejemplo de 1 USD para empezar.
3. Activa alertas al 50 %, 90 % y 100 % del presupuesto.
4. Añade alertas adicionales en 5 USD y 10 USD si el proyecto va a tener usuarios reales.
5. Revisa **Facturación > Informes** para identificar qué servicio consume el presupuesto.

Para un límite duro real se necesita un mecanismo externo de control de cuotas o deshabilitar
servicios; Firebase no ofrece un tope de gasto integrado.

## Despliegue de Functions

El despliegue está bloqueado hasta que el propietario confirme el plan Blaze y la facturación.
Cuando lo autorice:

```bash
npx firebase-tools login
npx firebase-tools use <project-id>
npm --prefix functions install
npm --prefix functions run build
npx firebase-tools deploy --only functions,firestore:rules,firestore:indexes,storage
```

El proyecto no incluye `android/` ni `ios/`; no edites esos directorios. Las reglas y los índices
se despliegan desde la raíz. `firebase.json` fija Functions en `nodejs20`.

### Variables de Functions

`functions/src/rewards.ts` lee opcionalmente:

- `ADMOB_REWARDED_UNIT_ID`: unidad recompensada de iOS.
- `ADMOB_REWARDED_UNIT_ID_ANDROID`: unidad recompensada de Android.

Si no se configuran, la función acepta la recompensa sin comprobar la unidad. Para producción,
configúralas en `functions/.env.<project-id>` o con el mecanismo de variables de entorno de
Functions y vuelve a desplegar. No son secretos, pero deben coincidir con las unidades usadas por
la app.

La URL SSV que se configura en AdMob es:

```text
https://us-central1-<project-id>.cloudfunctions.net/admobSsv
```

## AdMob de prueba y producción

- En desarrollo, `app.json` usa App IDs de prueba de Google.
- `EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID` debe apuntar a la unidad recompensada real en producción.
- La app usa una unidad de prueba como respaldo si la variable no existe.
- La recompensa solo se concede tras validar la firma SSV; no se debe confiar en el cliente.
- La app debe ser un development build o un build de producción; Expo Go no incluye el módulo
  nativo de AdMob.

## Seguridad y costos

- Las reglas de Firestore y Storage bloquean escrituras directas del cliente en perfiles, chats,
  mensajes y recompensas. Las mutaciones pasan por Functions.
- `admobRewards` es de solo lectura para el propietario y se escribe con Admin SDK.
- `admobSsv` es idempotente por `transactionId` y limita la recompensa a un desbloqueo.
- No se guardan claves privadas ni secretos en el repositorio.
- El archivo `.env` real está ignorado por Git; usa `.env.example` como plantilla.

## Comprobaciones antes de production

- [ ] Presupuesto y alertas creados en Google Cloud.
- [ ] Plan Blaze confirmado por el propietario.
- [ ] Funciones desplegadas y probadas.
- [ ] Reglas e índices desplegados.
- [ ] Storage habilitado y reglas aplicadas.
- [ ] App IDs y unidades de AdMob reales configurados.
- [ ] URL SSV configurada en AdMob.
- [ ] Development build probado en Android.
- [ ] Límites de uso revisados después de una semana de tráfico real.

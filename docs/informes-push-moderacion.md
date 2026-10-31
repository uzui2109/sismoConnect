# Informes, notificaciones push y moderación

Este documento cubre las funciones añadidas sobre la base de sismos, alertas y comunidad.

## Informes oficiales

- Ruta: `src/app/reports.tsx`.
- Callable: `getSituationReports` (`functions/src/sources.ts`).
- Fuentes: GDACS (eventos sísmicos naranja/rojo) y ReliefWeb (RSS de desastres).
- Caché: `system/situationCache`, con TTL de 10 minutos. Si una fuente falla se devuelve la última copia disponible y se marca como `stale`. Nunca se inventan eventos.
- Filtros de la pantalla: todos, solo sismos y mi país.
- Enlaces externos abren la ficha oficial de cada fuente.

La callable es pública porque solo devuelve información oficial ya publicada. Firestore sigue cerrado: `system/**` es server-only.

## Notificaciones push

### Arquitectura

- Cliente: `src/services/push.ts`, `src/services/notifications.ts`, `src/hooks/use-notification-observer.ts`.
- Backend: `functions/src/notifications.ts`.
- Transporte: **FCM directo** con Firebase Admin (`sendEachForMulticast`). No se usa Expo Push Service.
- Inbox: cada aviso se guarda en `notifications/{id}` y se puede leer en `src/app/notifications.tsx`.
- Dispositivos: `pushDevices/{hash(uid:deviceId)}`, server-only.
- Canales Android: `default`, `earthquakes` (alta importancia) y `social`.
- El token se refresca con `addPushTokenListener` y se vuelve a registrar si el usuario tenía los avisos activos.

### Eventos

- Sismos: cada 5 minutos se consultan los sismos M4.5+ de la última hora y se comparan con las alertas guardadas. Los M5.5+ globales también generan aviso. El marcador `system/earthquakePush/{quakeId}` evita duplicados.
- Chat: mensaje nuevo (`onChatMessageCreated`).
- Amistades: solicitud nueva y respuesta (`onFriendRequestCreated`, `onFriendRequestUpdated`).
- Grupos: alguien se une al grupo (`notifyGroupJoined`).

Las preferencias están en `users.notificationPrefs` (`earthquakes`, `social`, `messages`, `friends`, `groups`) y el interruptor maestro en `users.notificationsEnabled`. La inbox se crea aunque el push esté desactivado; el envío FCM solo se hace para usuarios con avisos activos.

### Requisitos para activar push nativo

1. Crear la app Android en Firebase con el paquete `com.sismoconnect.app`.
2. Descargar `google-services.json` y colocarlo en la raíz del proyecto.
3. Añadir `"googleServicesFile": "./google-services.json"` dentro de `expo.android` en `app.json`.
4. Generar una development build (`npx eas-cli build --profile development --platform android` o `npx expo run:android`).
5. Desplegar Functions. El plan Blaze es necesario para Cloud Scheduler.
6. Probar en un dispositivo físico. Expo Go y web no reciben push FCM.

Sin `google-services.json` la app muestra un mensaje controlado al intentar activar avisos; no se rompe el resto de la aplicación.

## Moderación

### Usuario

- Los mensajes de chat se pueden reportar manteniendo pulsado el mensaje.
- Los perfiles se pueden reportar desde la pantalla de perfil público.
- Los reportes quedan en `reports` y solo los lee el backend.

### Administrador

- Custom claim: `admin`.
- Interfaz: `src/app/admin/reports.tsx`, visible desde Perfil solo si `user.isAdmin`.
- Callables: `adminListReports`, `adminModerateReport`.
- Acciones: revisar, descartar, resolver, advertir, suspender, reactivar y eliminar mensaje.
- Cada acción se audita en `moderationActions`.
- `reportContent` acepta mensajes y grupos; los perfiles usan `reportUser`.

Asignar el rol después de crear el usuario:

```bash
cd functions
node scripts/set-admin.mjs <uid-o-correo> --project sismoconnectfirebase
```

Requiere credenciales de Application Default Credentials (`gcloud auth application-default login`) o `GOOGLE_APPLICATION_CREDENTIALS`. Para retirar el rol:

```bash
node scripts/set-admin.mjs <uid-o-correo> --remove --project sismoconnectfirebase
```

El usuario debe cerrar sesión y volver a entrar para refrescar el token con el nuevo claim.

## Grupos

- Ajustes: `src/app/group/[chatId].tsx`.
- El creador puede editar nombre y descripción, regenerar el código, compartir la invitación y expulsar miembros.
- Cualquier miembro puede salir del grupo. Si sale el creador, el rol pasa al siguiente miembro; si no quedan miembros, el grupo se elimina.
- Al eliminar un grupo se borran el documento del chat, miembros e índices. La subcolección `messages` no se borra en cascada y queda inaccesible por reglas.

## Validación

```bash
npx tsc --noEmit
npm run lint
npm test
npm run test:rules
cd functions && npm run typecheck
npx expo export --platform web
```

Los tests de reglas cubren la lectura de la inbox por su dueño y el bloqueo de escritura para `notifications`, `pushDevices` y `system`. Las callables de moderación y el envío FCM real deben probarse en un proyecto de staging antes de producción.

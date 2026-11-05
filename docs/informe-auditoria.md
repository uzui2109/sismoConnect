# Informe de auditoría y corrección — SismoConnect

**Rama:** `audit/security-fixes` (desde `main`, HEAD `53a31dd`)  
**Estado:** cambios aplicados y verificados, **sin commit, push ni deploy**  
**Backend principal:** `server/` (Express, puerto 8085).  
**Cloud Functions:** conserva push, moderación, notificaciones y SSV de AdMob; no se duplica la lógica de chats.

---

## A. Resumen ejecutivo

Se realizó una auditoría técnica del repositorio (Expo/React Native/TypeScript/Firebase + backend Express + Cloud Functions) y se aplicaron correcciones de seguridad, reglas Firestore, configuración, backend, pruebas y documentación.

Se resolvieron los 5 archivos con marcadores de conflicto Git (`firestore.rules`, `firestore.indexes.json`, `app.js`, `firebaseConfig.js`, `docs/firestore.md`) conservando la variante HEAD para el chat global y los índices de `friendRequests`.

Se endureció `firestore.rules` (update de `alertas` exige `request.resource.data.userId == uid()`; `delete` solo dueño), se corrigió el backend Express (cooldown 30s, mensaje 1000, descripción grupo 280, nombre 60, bio 280, `sendMessage` valida `clientId`, membresía, suspensión, amistad/bloqueo en directos y consume `unlocks`; `joinGlobalChat` actualiza `memberIds`; `blockUser`/`reportUser` verifican existencia del objetivo; errores sin fugas internas), se desrastreó `.env` del repositorio (archivo local conservado) y se documentó App Check deshabilitado.

Se añadieron tests unitarios de servidor (`server/tests/chat-policy.test.js`, 15 casos) y se amplió `tests/firestore.rules.test.js` (reasignación de alerta).

**Todas las verificaciones pasan:** `typecheck`, `lint`, `test` (22), `test:rules` (18), `server build`, `server test` (15), `functions typecheck`.

---

## B. Hallazgos críticos y resueltos

| # | Hallazgo | Estado | Evidencia |
|---|----------|--------|-----------|
| 1 | `firestore.rules`, `firestore.indexes.json`, `app.js`, `firebaseConfig.js`, `docs/firestore.md` con marcadores de conflicto Git | Resuelto | `grep` no encuentra `<<<<<<<\|=======\|>>>>>>>`; `JSON.parse` válido en `firestore.indexes.json` |
| 2 | `server/src/routes/chats.ts:sendMessage` no verificaba `memberIds`, amistad, bloqueo ni suspensión; no consumía `unlocks`; no validaba `clientId` | Resuelto | `chats.ts` exige `memberSnap.exists`, `chatMembers.includes(uid)`, `suspended`, bloques/amistad en `direct_`, `clientId` regex, `usedUnlock` |
| 3 | `server/src/lib/chat-config.ts` cooldown 60s (debe ser 30s) | Resuelto | `COOLDOWN_SECONDS = 30` |
| 4 | `server/src/routes/chats.ts` límite mensaje 500 (debe ser 1000) | Resuelto | `MAX_MESSAGE_LENGTH = 1000` |
| 5 | `server/src/routes/profiles.ts` nombre 40 / bio 160 (deben ser 60 / 280); grupo descripción 200 (debe ser 280) | Resuelto | `MAX_DISPLAY_NAME = 60`, `MAX_BIO = 280`, `MAX_GROUP_DESCRIPTION = 280` |
| 6 | `firestore.rules`: `alertas.update` permitía cambiar `userId` a otro usuario | Resuelto | `update` exige `resource.data.userId == uid() && request.resource.data.userId == uid()` |
| 7 | `.env` trackeado por Git | Resuelto | `git rm --cached .env`; archivo local conservado; `.gitignore` ya lo excluía |
| 8 | `functions/src/config.ts` `enforceAppCheck: false` y cliente sin App Check | Documentado | Se mantiene deshabilitado; procedimiento de activación documentado, sin dependencias nativas |
| 9 | `searchPublicProfiles` no filtraba por `isPublic` | Resuelto | `where('isPublic', '==', true)` + `profile?.isPublic`; índices compuestos añadidos |
| 10 | `blockUser` creaba `friendRequests` huérfanos sin `fromUid`/`toUid` | Resuelto | Solo actualiza la solicitud si existe; verifica que el usuario objetivo exista |
| 11 | `reportUser` no verificaba que el reportado exista | Resuelto | Consulta `users/{reportedUid}` antes de escribir el reporte |
| 12 | Errores del servidor devolvían `e.message` (fuga de detalles internos) | Resuelto | `server/src/lib/public-error.ts` + `publicErrorMessage` en rutas y handler global |
| 13 | Respaldos de Firestore sin instrucciones reales | Resuelto | Sección 11 en `docs/despliegue.md` (exportar/importar, permisos, retención, sin afirmar copias automáticas) |

---

## C. Cambios por archivo

| Archivo | Cambio principal | Motivo |
|---------|------------------|--------|
| `firestore.rules` | Resuelto conflicto; `alertas.update` exige `request.resource.data.userId == uid()` | Seguridad de datos propios |
| `firestore.indexes.json` | Resuelto conflicto; añadidos índices compuestos `publicProfiles` (`isPublic`+`username`, `isPublic`+`displayName`) | Soporte a búsqueda filtrada |
| `app.js` | Eliminados marcadores de conflicto (variantes idénticas) | Limpieza |
| `firebaseConfig.js` | Eliminados marcadores de conflicto (variantes idénticas) | Limpieza; configuración legacy mantiene funcionalidad |
| `docs/firestore.md` | Conservada nota de Sala Global; eliminados marcadores | Documentación coherente |
| `docs/despliegue.md` | Añadida sección 11 "Respaldos y restauración de Firestore" | Fase 6 |
| `docs/informe-auditoria.md` | Nuevo: informe final A–G | Entregable |
| `server/src/lib/chat-config.ts` | `COOLDOWN_SECONDS = 30`; `MAX_STORED_UNLOCKS = 1` | Alinear límites con Functions |
| `server/src/lib/chat-policy.ts` | Nuevo: lógica pura de cooldown, emergencia y unlocks | Testabilidad (Fase 5) |
| `server/src/lib/public-error.ts` | Nuevo: oculta mensajes internos, devuelve fallback | No filtrar errores internos |
| `server/src/index.ts` | Usa `publicErrorMessage` en handler global 500 | No filtrar `err.message` |
| `server/src/routes/chats.ts` | `sendMessage`: membresía, suspensión, amistad/bloqueo, unlocks, `clientId`, cooldown 30s, mensaje 1000; `joinGlobalChat` actualiza `memberIds` | IDOR y cooldown |
| `server/src/routes/social.ts` | `blockUser` sin huérfanos + verifica objetivo; `reportUser` verifica objetivo | Integridad social |
| `server/src/routes/profiles.ts` | `MAX_DISPLAY_NAME = 60`, `MAX_BIO = 280` | Alinear límites |
| `server/src/routes/rewards.ts` | Nuevo: expone `/state` (SSV real queda en Functions) | Backend Express |
| `server/package.json` | Añadido script `test` con `pretest` (build) | Ejecutar tests de servidor |
| `server/tests/chat-policy.test.js` | Nuevo: 15 pruebas unitarias con `node:assert` | Validar lógica pura |
| `src/services/social.ts` | `searchPublicProfiles` filtra `isPublic == true` | No exponer perfiles privados en búsqueda |
| `tests/firestore.rules.test.js` | Añadida prueba "rejects reassigning an owned alert to another user" | Evitar cambio de `userId` |
| `tsconfig.json` | Excluye `sismoconnect` (copia anidada no trackeada) | Evitar falsos positivos de typecheck |
| `eslint.config.js` | Ignora `sismoconnect/**` y archivos legacy de raíz `src/*.ts` | Coherencia con `tsconfig` |

---

## D. Pruebas ejecutadas y resultados reales

| Comando | Resultado | Detalle |
|---------|-----------|---------|
| `npm run typecheck` | ✅ PASS | `tsc --noEmit` sin errores |
| `npm run lint` | ✅ PASS | `expo lint` sin errores (solo carga `.env`) |
| `npm test -- --runInBand` | ✅ PASS | 3 suites, **22 tests**, 0 fallos |
| `node scripts/test-rules.mjs` | ✅ PASS | 1 suite, **18 tests** de reglas; emulador iniciado en `127.0.0.1:8082` y detenido limpiamente |
| `npm --prefix server run build` | ✅ PASS | `tsc` del servidor sin errores |
| `npm --prefix server test` | ✅ PASS | `pretest` build + **15 tests** de `chat-policy`, 0 fallos |
| `npm --prefix functions run typecheck` | ✅ PASS | `tsc --noEmit` de Functions sin errores |

Pruebas de reglas incluidas: acceso sin sesión, perfiles privados, alertas (crear/leer/actualizar/rechazar ajeno/rechazar reasignación), amistades, bloques, reportes cerrados, chats/miembros/mensajes, Sala Global (lectura autenticada, escritura denegada), notificaciones, push, config, recompensas SSV.

---

## E. Riesgos residuales

| Riesgo | Descripción | Mitigación sugerida |
|--------|-------------|---------------------|
| App Check deshabilitado | `enforceAppCheck: false`; cliente sin App Check | Activar solo cuando exista proveedor compatible y development build; documento el procedimiento |
| `firebaseConfig.js` legacy | Contiene configuración Firebase hardcodeada (identificadores públicos, no secretos privados) | Mover a variables de entorno o recomendar rotación de la API key de Firebase si se expuso |
| Lectura directa de `publicProfiles` | Cualquier autenticado puede leer un perfil público directo (búsqueda ya filtra `isPublic`) | Documentado como riesgo aceptado; dividir datos privados en otra colección requeriría cambio de esquema mayor |
| `server/lib/*.js` trackeado | Está en `.gitignore` pero sigue versionado | Usuario decidió no desrastrear hasta confirmar que el build genera todo y el despliegue funciona |
| Sin pruebas de integración API | Solo pruebas unitarias de política de chat (runner nativo de Node) | Añadir integración con emulador si se considera necesario; requiere dependencias/mocks de `firebase-admin` |

---

## F. Recomendaciones

1. **App Check:** dejar `enforceAppCheck: false` por ahora. Cuando se integre un proveedor nativo y un development build, pasar a `true` y actualizar el cliente.
2. **Segredo Firebase:** rotar la API key de `firebaseConfig.js` si se considera expuesta, y migrar la configuración a variables de entorno (`.env` ya no se rastrea).
3. **Respaldos:** programar exportaciones periódicas de Firestore (Cloud Scheduler + Functions o cron externo) y probar restauraciones en staging; no asumir copias automáticas.
4. **Pruebas:** añadir pruebas de integración del API Express con el emulador de Firestore cuando se justifique el esfuerzo de mockear `firebase-admin`.
5. **Despliegue:** antes de producir, confirmar que `npm run build` genera todo `server/lib/` y que `npm --prefix server start` arranca sin depender de los archivos JS rastreados.

---

## G. Anexos — comandos ejecutados y resultados

```bash
# Rama y respaldo
git checkout -b audit/security-fixes
# respaldo en %TEMP%\opencode\sismoconnect-audit-20261105-133433 (working-tree.patch verificado con git apply --check --reverse)

# Verificaciones raíz
npm run typecheck              # PASS
npm run lint                   # PASS
npm test -- --runInBand        # PASS: 3 suites, 22 tests
node scripts/test-rules.mjs    # PASS: 18 tests, emulador 8082 iniciado y detenido

# Servidor Express
npm --prefix server run build  # PASS
npm --prefix server test       # PASS: 15 tests chat-policy

# Cloud Functions
npm --prefix functions run typecheck   # PASS

# Git (sin commit)
git rm --cached .env           # .env deja de rastrearse; archivo local conserva
git status                     # cambios listados, sin commitear
```

**Archivo de respaldo:** `C:\Users\CHRIST~1\AppData\Local\Temp\opencode\sismoconnect-audit-20261105-133433\working-tree.patch` (SHA256 `D300161339BCDB161E8CEFA40913D7BBC6822390B939F59B9F79B7A783D91ADB`, verificado con `git apply --check --reverse`).

---

*Fin del informe. No se ha realizado commit, push ni deploy.*

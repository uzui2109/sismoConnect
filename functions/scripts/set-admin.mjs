import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const [identifier, ...flags] = process.argv.slice(2);
const remove = flags.includes('--remove');
const projectFlag = flags.indexOf('--project');
const projectId =
  projectFlag >= 0
    ? flags[projectFlag + 1]
    : process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;

if (!identifier) {
  console.error('Uso: node scripts/set-admin.mjs <uid|correo> [--remove] [--project <id>]');
  process.exit(1);
}

initializeApp({
  credential: applicationDefault(),
  ...(projectId ? { projectId } : {}),
});

const auth = getAuth();

try {
  let user;
  try {
    user = await auth.getUser(identifier);
  } catch {
    user = await auth.getUserByEmail(identifier);
  }

  const claims = { ...(user.customClaims ?? {}) };
  if (remove) {
    delete claims.admin;
  } else {
    claims.admin = true;
  }

  await auth.setCustomUserClaims(user.uid, claims);
  console.log(
    `${remove ? 'Rol admin retirado' : 'Rol admin asignado'} a ${user.email ?? user.uid} (${user.uid}).`
  );
  console.log('El usuario debe cerrar sesión y volver a entrar para refrescar el token.');
} catch (error) {
  console.error('No se pudo actualizar el custom claim:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

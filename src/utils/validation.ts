export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return 'Ingresa tu correo electrónico.';
  // Deliberately loose: Firebase owns real verification.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Ese correo no parece válido.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Ingresa tu contraseña.';
  if (password.length < 6) return 'Debe tener al menos 6 caracteres.';
  return null;
}

/**
 * Turns a Firebase error into something a person can act on, without leaking
 * whether an account exists.
 */
export function friendlyAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: string }).code)
      : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correo o contraseña incorrectos.';
    case 'auth/email-already-in-use':
      return 'Ese correo ya tiene una cuenta. Inicia sesión.';
    case 'auth/weak-password':
      return 'Elige una contraseña más segura (mínimo 6 caracteres).';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera unos minutos.';
    case 'auth/network-request-failed':
      return 'Sin conexión con el servidor. Revisa tu red.';
    default:
      return error instanceof Error
        ? error.message
        : 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  }
}
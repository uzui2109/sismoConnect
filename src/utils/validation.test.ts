import {
  friendlyAuthError,
  validateEmail,
  validatePassword,
} from '@/utils/validation';

describe('validateEmail', () => {
  it('rejects empty and malformed values', () => {
    expect(validateEmail('')).toBe('Ingresa tu correo electrónico.');
    expect(validateEmail('   ')).toBe('Ingresa tu correo electrónico.');
    expect(validateEmail('correo')).not.toBeNull();
    expect(validateEmail('correo@')).not.toBeNull();
    expect(validateEmail('correo@dominio')).not.toBeNull();
  });

  it('accepts plausible addresses and trims spaces', () => {
    expect(validateEmail('persona@ejemplo.com')).toBeNull();
    expect(validateEmail('  persona@ejemplo.com  ')).toBeNull();
  });
});

describe('validatePassword', () => {
  it('requires at least six characters', () => {
    expect(validatePassword('')).toBe('Ingresa tu contraseña.');
    expect(validatePassword('12345')).toBe('Debe tener al menos 6 caracteres.');
    expect(validatePassword('123456')).toBeNull();
  });
});

describe('friendlyAuthError', () => {
  it('does not reveal whether an account exists', () => {
    for (const code of ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found']) {
      expect(friendlyAuthError({ code })).toBe('Correo o contraseña incorrectos.');
    }
  });

  it('maps actionable Firebase errors', () => {
    expect(friendlyAuthError({ code: 'auth/email-already-in-use' })).toContain('ya tiene una cuenta');
    expect(friendlyAuthError({ code: 'auth/weak-password' })).toContain('mínimo 6');
    expect(friendlyAuthError({ code: 'auth/too-many-requests' })).toContain('Demasiados intentos');
    expect(friendlyAuthError({ code: 'auth/network-request-failed' })).toContain('Sin conexión');
  });

  it('falls back to the original message or a generic one', () => {
    expect(friendlyAuthError(new Error('Fallo de prueba'))).toBe('Fallo de prueba');
    expect(friendlyAuthError(null)).toBe('Ocurrió un error inesperado. Inténtalo de nuevo.');
  });
});

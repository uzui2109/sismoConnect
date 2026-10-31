import { useState } from 'react';
import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { haptics } from '@/lib/haptics';
import { friendlyAuthError, validateEmail, validatePassword } from '@/utils/validation';
import { AuthScreen } from '@/components/auth/auth-screen';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { ThemedText } from '@/components/themed-text';

export default function SignUpScreen() {
  const { signUpWithEmail } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{
    email: string | null;
    password: string | null;
    confirm: string | null;
  }>({ email: null, password: null, confirm: null });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onSubmit() {
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    const confirmError = confirm === password ? null : 'Las contraseñas no coinciden.';

    setErrors({ email: emailError, password: passwordError, confirm: confirmError });
    if (emailError || passwordError || confirmError) return;

    void (async () => {
      setBusy(true);
      setFormError(null);
      try {
        await signUpWithEmail(email, password);
        haptics.success();
        // No navigation: the root `Stack.Protected` guard swaps the navigator.
      } catch (error) {
        haptics.error();
        setFormError(friendlyAuthError(error));
      } finally {
        setBusy(false);
      }
    })();
  }

  return (
    <AuthScreen
      title="Crea tu cuenta"
      subtitle="Guarda tu historial de sismos y recibe alertas relevantes."
      footer={
        <>
          <ThemedText type="small" themeColor="textSecondary">
            ¿Ya tienes cuenta?
          </ThemedText>
          <Link href="/sign-in" asChild>
            <ThemedText type="linkPrimary">Iniciar sesión</ThemedText>
          </Link>
        </>
      }>
      <TextField
        label="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        placeholder="tucorreo@ejemplo.com"
      />

      <TextField
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoComplete="new-password"
        hint="Mínimo 6 caracteres."
      />

      <TextField
        label="Repite la contraseña"
        value={confirm}
        onChangeText={setConfirm}
        error={errors.confirm}
        secureTextEntry
        autoComplete="new-password"
        onSubmitEditing={onSubmit}
      />

      {formError ? (
        <ThemedText type="small" style={styles.error}>
          {formError}
        </ThemedText>
      ) : null}

      <Button label="Crear cuenta" onPress={onSubmit} loading={busy} />

      <ThemedText type="small" themeColor="textSecondary" style={styles.legal}>
        Te enviaremos un correo para verificar tu cuenta.
      </ThemedText>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  error: {
    color: '#B3261E',
  },
  legal: {
    textAlign: 'center',
    marginTop: Spacing.two,
  },
});
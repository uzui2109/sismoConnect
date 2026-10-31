import { useState } from 'react';
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { configurationMessage } from '@/constants/config';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { haptics } from '@/lib/haptics';
import { friendlyAuthError, validateEmail, validatePassword } from '@/utils/validation';
import { AuthScreen } from '@/components/auth/auth-screen';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import { ThemedText } from '@/components/themed-text';

export default function SignInScreen() {
  const { signInWithEmail, signInAsGuest, isConfigured } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email: string | null; password: string | null }>({
    email: null,
    password: null,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setFormError(null);
    try {
      // No navigation on success: the root `Stack.Protected` guard swaps screens.
      await task();
    } catch (error) {
      haptics.error();
      setFormError(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit() {
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    setErrors({ email: emailError, password: passwordError });
    if (emailError || passwordError) return;

    void run(() => signInWithEmail(email, password));
  }

  return (
    <AuthScreen
      title="Inicia sesión"
      subtitle="Accede a tu historial y a tus alertas personalizadas."
      footer={
        <>
          <ThemedText type="small" themeColor="textSecondary">
            ¿No tienes cuenta?
          </ThemedText>
          <Link href="/sign-up" asChild>
            <ThemedText type="linkPrimary">Crear una</ThemedText>
          </Link>
        </>
      }>
      {!isConfigured && (
        <Card style={styles.notice}>
          <ThemedText type="small">{configurationMessage}</ThemedText>
        </Card>
      )}

      <TextField
        label="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        placeholder="tucorreo@ejemplo.com"
        returnKeyType="next"
      />

      <TextField
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        placeholder="••••••••"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />

      {formError ? (
        <ThemedText type="small" style={styles.error}>
          {formError}
        </ThemedText>
      ) : null}

      <Button label="Iniciar sesión" onPress={onSubmit} loading={busy} disabled={!isConfigured} />

      {isConfigured ? (
        <>
          <View style={styles.separator}>
            <View style={styles.rule} />
            <ThemedText type="small" themeColor="textSecondary">
              o
            </ThemedText>
            <View style={styles.rule} />
          </View>

          <GoogleSignInButton onError={setFormError} />
        </>
      ) : null}

      <Button
        label="Continuar como invitado"
        variant="tonal"
        onPress={() => void run(() => signInAsGuest())}
      />

      <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
        {isConfigured
          ? 'Como invitado podrás explorar la app; el historial se guarda en este dispositivo.'
          : 'El modo invitado funciona sin Firebase y guarda el historial solo en este dispositivo.'}
      </ThemedText>

      <Link href="/forgot-password" asChild>
        <ThemedText type="linkPrimary" style={styles.center}>
          ¿Olvidaste tu contraseña?
        </ThemedText>
      </Link>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  notice: {
    marginBottom: Spacing.two,
  },
  error: {
    color: '#B3261E',
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#8A8A8A66',
  },
  center: {
    textAlign: 'center',
  },
});
import { useState } from 'react';
import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useAuth } from '@/providers/auth-provider';
import { haptics } from '@/lib/haptics';
import { friendlyAuthError, validateEmail } from '@/utils/validation';
import { AuthScreen } from '@/components/auth/auth-screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import { ThemedText } from '@/components/themed-text';

export default function ForgotPasswordScreen() {
  const { sendResetEmail } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  function onSubmit() {
    const emailError = validateEmail(email);
    setError(emailError);
    if (emailError) return;

    void (async () => {
      setBusy(true);
      setFormError(null);
      try {
        await sendResetEmail(email);
        haptics.success();
        setSent(true);
      } catch (err) {
        haptics.error();
        setFormError(friendlyAuthError(err));
      } finally {
        setBusy(false);
      }
    })();
  }

  return (
    <AuthScreen
      title="Recupera tu acceso"
      subtitle="Te enviaremos un enlace para crear una contraseña nueva."
      footer={
        <Link href="/sign-in" asChild>
          <ThemedText type="linkPrimary">Volver a iniciar sesión</ThemedText>
        </Link>
      }>
      {sent ? (
        <>
          <Card>
            <ThemedText style={styles.success} type="smallBold">
              ¡Listo!
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Si existe una cuenta con ese correo, recibirás un mensaje en unos minutos.
              Revisa también la carpeta de spam.
            </ThemedText>
          </Card>
          <Button label="Enviar de nuevo" variant="tonal" onPress={onSubmit} loading={busy} />
        </>
      ) : (
        <>
          <TextField
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            error={error}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
            onSubmitEditing={onSubmit}
          />

          {formError ? (
            <ThemedText type="small" style={styles.error}>
              {formError}
            </ThemedText>
          ) : null}

          <Button label="Enviar enlace" onPress={onSubmit} loading={busy} />
        </>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  error: {
    color: '#B3261E',
  },
  success: {
    color: '#2E6B3E',
  },
});
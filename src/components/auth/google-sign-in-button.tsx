import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import { ResponseType } from 'expo-auth-session';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';

import { googleClientId } from '@/constants/config';
import { getFirebaseAuth } from '@/lib/firebase';
import { haptics } from '@/lib/haptics';
import { Radius, Spacing } from '@/constants/theme';
import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';

type Props = {
  onError?: (message: string) => void;
};

const CONFIG = {
  clientId: googleClientId ?? '',
  androidClientId: googleClientId ?? '',
  iosClientId: googleClientId ?? '',
  // Implicit id_token flow: no client secret is ever needed in the bundle.
  responseType: ResponseType.IdToken,
};

/**
 * Google sign-in on Android via the system browser tab. Firebase's web SDK has
 * no usable popup on a device, so the id_token from the OAuth flow is exchanged
 * for a Firebase credential.
 *
 * Requires a development build (`npx expo run:android`); an OAuth redirect
 * cannot complete inside Expo Go.
 */
export function GoogleSignInButton({ onError }: Props) {
  const [request, response, promptAsync] = Google.useAuthRequest(CONFIG);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (response?.type !== 'success') {
      if (response?.type === 'error') {
        onError?.(response.error?.message ?? 'No se pudo iniciar sesión con Google.');
      }
      return;
    }

    const idToken = response.params?.id_token ?? response.authentication?.idToken;
    if (!idToken) {
      onError?.('Google no devolvió un token de sesión.');
      return;
    }

    void (async () => {
      setBusy(true);
      try {
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(getFirebaseAuth(), credential);
        haptics.success();
      } catch (error) {
        haptics.error();
        onError?.(error instanceof Error ? error.message : 'Error al iniciar sesión.');
      } finally {
        setBusy(false);
      }
    })();
  }, [response, onError]);

  if (!googleClientId) {
    return (
      <View style={styles.notice}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Añade EXPO_PUBLIC_GOOGLE_CLIENT_ID a tu .env para activar el acceso con Google.
        </ThemedText>
      </View>
    );
  }

  return (
    <Button
      testID="google-sign-in"
      label="Continuar con Google"
      variant="outlined"
      loading={busy}
      disabled={!request || busy}
      onPress={() => {
        haptics.tap();
        void promptAsync();
      }}
    />
  );
}

const styles = StyleSheet.create({
  notice: {
    padding: Spacing.two,
    borderRadius: Radius.md,
  },
  center: {
    textAlign: 'center',
  },
});
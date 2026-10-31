import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

import { googleClientId } from '@/constants/config';
import { getFirebaseAuth } from '@/lib/firebase';
import { haptics } from '@/lib/haptics';
import { Radius } from '@/constants/theme';
import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';

type Props = {
  onError?: (message: string) => void;
};

/**
 * Web preview: the browser can show a real popup, so Firebase's
 * `signInWithPopup` is used directly instead of the OAuth redirect flow.
 */
export function GoogleSignInButton({ onError }: Props) {
  const [busy, setBusy] = useState(false);

  if (!googleClientId) {
    return (
      <ThemedText type="small" themeColor="textSecondary" style={{ borderRadius: Radius.md }}>
        Añade EXPO_PUBLIC_GOOGLE_CLIENT_ID a tu .env para activar el acceso con Google.
      </ThemedText>
    );
  }

  return (
    <Button
      testID="google-sign-in"
      label="Continuar con Google"
      variant="outlined"
      loading={busy}
      onPress={() => {
        haptics.tap();
        setBusy(true);
        void signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider())
          .then(() => haptics.success())
          .catch((error: unknown) => {
            haptics.error();
            // A user closing the popup is not a failure worth reporting.
            if (error instanceof Error && !/popup-closed|cancelled/i.test(error.message)) {
              onError?.(error.message);
            }
          })
          .finally(() => setBusy(false));
      }}
    />
  );
}
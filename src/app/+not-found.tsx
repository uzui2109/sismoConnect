import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';

export default function NotFoundScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen options={{ title: 'No encontrado' }} />
      <View
        style={[
          styles.container,
          { backgroundColor: theme.background, paddingTop: insets.top + Spacing.five },
        ]}>
        <ThemedText type="title" style={styles.title}>
          404
        </ThemedText>
        <ThemedText type="subtitle" style={styles.center}>
          Esta página no existe
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          El enlace que seguiste no lleva a ninguna parte de la app.
        </ThemedText>
        <Link href="/" asChild>
          <Button label="Volver al monitor" variant="tonal" fullWidth={false} />
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  title: {
    fontSize: 72,
    lineHeight: 80,
  },
  center: {
    textAlign: 'center',
  },
});
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';

type Props = {
  uri?: string | null;
  name: string;
  size?: number;
};

export function Avatar({ uri, name, size = 44 }: Props) {
  const theme = useTheme();
  const initial = (name.trim().charAt(0) || '?').toUpperCase();

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        transition={150}
        accessibilityLabel={`Foto de ${name}`}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.primaryContainer,
        },
      ]}>
      <ThemedText
        style={[
          styles.initial,
          { color: theme.onPrimaryContainer, fontSize: Math.max(14, size * 0.4) },
        ]}>
        {initial}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontWeight: '800',
  },
});

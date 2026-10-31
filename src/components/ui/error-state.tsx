import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';

type Props = {
  title?: string;
  message: string;
  onRetry?: () => void;
};

export function ErrorState({ title = 'Algo salió mal', message, onRetry }: Props) {
  const theme = useTheme();

  return (
    <EmptyState
      icon={
        <View style={[styles.badge, { backgroundColor: theme.primaryContainer }]}>
          <ThemedText style={[styles.mark, { color: theme.onPrimaryContainer }]}>!</ThemedText>
        </View>
      }
      title={title}
      description={message}>
      {onRetry ? (
        <Button label="Reintentar" onPress={onRetry} variant="tonal" fullWidth={false} />
      ) : null}
    </EmptyState>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    fontSize: 34,
    fontWeight: '700',
  },
});
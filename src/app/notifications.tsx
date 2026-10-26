import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useNotifications } from '@/hooks/use-notifications';
import { useTheme } from '@/hooks/use-theme';
import { timeAgo } from '@/utils/format';
import type { InboxNotification } from '@/services/notifications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ThemedText } from '@/components/themed-text';

export default function NotificationsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { enabled, notifications, unread, loading, error, busy, markAllRead, markRead } =
    useNotifications();

  function open(item: InboxNotification) {
    void markRead(item.id);
    if (item.data.chatId) {
      router.push({ pathname: '/chat/[chatId]', params: { chatId: item.data.chatId } });
      return;
    }
    if (item.data.uid) {
      router.push({ pathname: '/user/[uid]', params: { uid: item.data.uid } });
      return;
    }
    if (item.type === 'earthquake') router.push('/reports' as Href);
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Spacing.two,
          paddingBottom: insets.bottom + Spacing.five,
          maxWidth: MaxContentWidth,
        },
      ]}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => router.back()}
          style={[styles.back, { borderColor: theme.outlineVariant }]}>
          <ThemedText type="smallBold">← Volver</ThemedText>
        </Pressable>
        {unread > 0 ? (
          <Button
            label="Marcar todo leído"
            variant="text"
            fullWidth={false}
            loading={busy}
            onPress={() => void markAllRead()}
          />
        ) : null}
      </View>

      <View style={styles.heading}>
        <ThemedText type="title" style={styles.title}>
          Notificaciones
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Avisos sísmicos, mensajes y actividad de tu comunidad.
        </ThemedText>
      </View>

      {!enabled ? (
        <EmptyState
          title="Inicia sesión"
          description="Las notificaciones se sincronizan con tu cuenta."
        />
      ) : loading ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            Cargando notificaciones…
          </ThemedText>
        </Card>
      ) : error ? (
        <ErrorState message={error} />
      ) : notifications.length === 0 ? (
        <EmptyState
          title="Todo al día"
          description="Cuando ocurra algo relevante para ti aparecerá aquí."
        />
      ) : (
        <View style={styles.list}>
          {notifications.map((item) => (
            <Card
              key={item.id}
              onPress={() => open(item)}
              style={
                item.read
                  ? undefined
                  : { borderColor: theme.primary, backgroundColor: theme.primaryContainer }
              }>
              <View style={styles.cardHeader}>
                <View style={[styles.dot, { backgroundColor: item.read ? theme.outline : theme.primary }]} />
                <ThemedText type="smallBold" style={styles.cardTitle}>
                  {item.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {timeAgo(item.createdAt)}
                </ThemedText>
              </View>
              {item.body ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {item.body}
                </ThemedText>
              ) : null}
              <Badge
                label={
                  item.type === 'earthquake'
                    ? 'Sismo'
                    : item.type === 'chat'
                      ? 'Chat'
                      : item.type === 'group'
                        ? 'Grupo'
                        : 'Comunidad'
                }
                color={item.type === 'earthquake' ? theme.error : theme.info}
              />
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    alignSelf: 'center',
    width: '100%',
    gap: Spacing.three,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heading: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
  },
  list: {
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  cardTitle: {
    flex: 1,
  },
});

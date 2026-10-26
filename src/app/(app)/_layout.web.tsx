import { StyleSheet } from 'react-native';
import { usePathname } from 'expo-router';
import { Tabs, TabList, TabSlot, TabTrigger } from 'expo-router/ui';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';

const TABS = [
  { name: 'monitor', href: '/', label: 'Monitor' },
  { name: 'map', href: '/map', label: 'Mapa' },
  { name: 'community', href: '/community', label: 'Comunidad' },
  { name: 'alerts', href: '/alerts', label: 'Alertas' },
  { name: 'profile', href: '/profile', label: 'Perfil' },
] as const;

/**
 * Web preview only. `react-native-maps` has no web implementation, and headless
 * tabs keep the preview in sync with the native tab routes.
 */
export default function AppTabsLayout() {
  const theme = useTheme();
  const pathname = usePathname();

  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList
        style={[
          styles.list,
          { backgroundColor: theme.surfaceContainer, borderTopColor: theme.outlineVariant },
        ]}>
        {TABS.map((tab) => {
          const isFocused = pathname === tab.href;

          return (
            <TabTrigger
              key={tab.name}
              name={tab.name}
              href={tab.href}
              style={[styles.trigger, isFocused && { backgroundColor: theme.backgroundSelected }]}>
              {/* `TabTrigger` renders as a Pressable, so the label has to be a
                  Text element: a bare string throws "Unexpected text node". */}
              <ThemedText
                type="smallBold"
                style={{ color: isFocused ? theme.primary : theme.textSecondary }}>
                {tab.label}
              </ThemedText>
            </TabTrigger>
          );
        })}
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: '100%',
  },
  list: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  trigger: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
});
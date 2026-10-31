import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCountries } from '@/services/countries';
import { Chip } from '@/components/ui/chip';
import { ThemedText } from '@/components/themed-text';

type Props = {
  selected: string[];
  onChange: (codes: string[]) => void;
};

export function CountryFilter({ selected, onChange }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const countries = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return getCountries();
    return getCountries().filter(
      (country) =>
        country.name.toLowerCase().includes(term) ||
        country.code.toLowerCase().includes(term)
    );
  }, [query]);

  const label =
    selected.length === 0
      ? 'Todos los países'
      : selected.length === 1
        ? getCountries().find((country) => country.code === selected[0])?.name ?? '1 país'
        : `${selected.length} países`;

  function toggle(code: string) {
    onChange(
      selected.includes(code)
        ? selected.filter((item) => item !== code)
        : [...selected, code]
    );
  }

  return (
    <>
      <View style={styles.triggerRow}>
        <Chip label={`País: ${label}`} selected={selected.length > 0} onPress={() => setOpen(true)} />
        {selected.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quitar filtro de países"
            onPress={() => onChange([])}
            style={styles.clear}>
            <ThemedText type="small" themeColor="textSecondary">
              Limpiar
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={[styles.scrim, { backgroundColor: theme.scrim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.background,
                borderColor: theme.outlineVariant,
                paddingBottom: Math.max(insets.bottom, Spacing.three),
              },
            ]}>
            <View style={[styles.grabber, { backgroundColor: theme.outlineVariant }]} />
            <View style={styles.heading}>
              <ThemedText type="subtitle" style={styles.title}>
                Filtrar por país
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Elige uno o varios países. El filtro se guarda en este dispositivo.
              </ThemedText>
            </View>

            <TextInput
              accessibilityLabel="Buscar país"
              placeholder="Buscar país…"
              placeholderTextColor={theme.textSecondary}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              style={[
                styles.search,
                {
                  color: theme.text,
                  backgroundColor: theme.surface,
                  borderColor: theme.outlineVariant,
                },
              ]}
            />

            <FlatList
              data={countries}
              keyExtractor={(country) => country.code}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                  No hay países que coincidan con la búsqueda.
                </ThemedText>
              }
              renderItem={({ item }) => {
                const checked = selected.includes(item.code);
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    accessibilityLabel={item.name}
                    onPress={() => toggle(item.code)}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        backgroundColor: pressed
                          ? theme.backgroundSelected
                          : checked
                            ? theme.primaryContainer
                            : 'transparent',
                        borderColor: theme.outlineVariant,
                      },
                    ]}>
                    <View style={styles.rowText}>
                      <ThemedText>{item.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.continent ?? item.code}
                      </ThemedText>
                    </View>
                    <View
                      style={[
                        styles.check,
                        {
                          borderColor: checked ? theme.primary : theme.outline,
                          backgroundColor: checked ? theme.primary : 'transparent',
                        },
                      ]}>
                      {checked ? (
                        <ThemedText type="smallBold" onDarkBackground>
                          ✓
                        </ThemedText>
                      ) : null}
                    </View>
                  </Pressable>
                );
              }}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar filtro"
              onPress={() => setOpen(false)}
              style={({ pressed }) => [
                styles.done,
                { backgroundColor: theme.primary, opacity: pressed ? 0.82 : 1 },
              ]}>
              <ThemedText style={{ color: theme.onPrimary, fontWeight: '700' }}>
                Listo
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  triggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  clear: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  grabber: {
    width: 32,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
  },
  heading: {
    gap: 2,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
  },
  search: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: Spacing.three,
    minHeight: 48,
    fontSize: 16,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: Spacing.one,
    paddingBottom: Spacing.two,
  },
  row: {
    minHeight: 56,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowText: {
    flex: 1,
    gap: 0,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: {
    minHeight: 52,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    textAlign: 'center',
    padding: Spacing.four,
  },
});

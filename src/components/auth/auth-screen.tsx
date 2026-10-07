import { type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Shared chrome for the auth screens: scrollable, centred, keyboard-safe. */
export function AuthScreen({ title, subtitle, children, footer }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.five, paddingBottom: insets.bottom + Spacing.five },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={[styles.inner, { maxWidth: MaxContentWidth }]}>
          <View style={[styles.logo, { backgroundColor: theme.primaryContainer }]}>
            <ThemedText style={[styles.logoMark, { color: theme.onPrimaryContainer }]}>S</ThemedText>
          </View>

          <ThemedText type="title" style={styles.title}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText themeColor="textSecondary" style={styles.subtitle}>
              {subtitle}
            </ThemedText>
          ) : null}

          <View style={styles.form}>{children}</View>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  inner: {
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.two,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  logoMark: {
    fontSize: 34,
    fontWeight: '800',
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
  },
  subtitle: {
    marginBottom: Spacing.three,
  },
  form: {
    gap: Spacing.three,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    marginTop: Spacing.four,
    flexWrap: 'wrap',
  },
});
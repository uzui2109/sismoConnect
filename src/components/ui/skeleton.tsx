import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
};

/** Single placeholder block. Compose several to sketch a loading screen. */
export function Skeleton({ width = '100%', height = 16, radius = Radius.sm, style }: Props) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: theme.backgroundElement,
        },
        style,
      ]}
    />
  );
}

/** Placeholder row shaped like a feed item, animated in once on mount. */
export function SkeletonRow() {
  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.row}>
      <Skeleton width={56} height={56} radius={Radius.md} />
      <View style={styles.rowBody}>
        <Skeleton width="45%" height={18} />
        <Skeleton width="80%" height={14} />
        <Skeleton width="30%" height={12} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  rowBody: {
    flex: 1,
    gap: Spacing.two,
    justifyContent: 'center',
  },
});
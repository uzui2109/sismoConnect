import React, { memo, useMemo } from 'react';
<<<<<<< HEAD
import { Platform, StyleSheet, Text, View } from 'react-native';
=======
import { StyleSheet, Text, View } from 'react-native';
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { quakeColor, Radius } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import type { Quake } from '@/types/earthquake';

type Props = {
  quakes: Quake[];
  selectedId?: string | null;
  onSelect?: (quake: Quake) => void;
};

const VIEW_W = 720;
const VIEW_H = 360;
const GRID_STEP = 60;

/** Equirectangular projection into the fixed SVG viewBox. */
function projectX(longitude: number) {
  return ((longitude + 180) / 360) * VIEW_W;
}

function projectY(latitude: number) {
  return ((90 - latitude) / 180) * VIEW_H;
}

/**
 * Web preview implementation. `react-native-maps` ships a web stub that renders
 * an empty placeholder, so the preview plots the same points onto an SVG
 * equirectangular grid. No tiles, no network, no extra dependency.
 */
function QuakeMapImpl({ quakes, selectedId, onSelect }: Props) {
  const theme = useTheme();
  const isDark = useIsDark();
  const ocean = isDark ? '#0E1826' : '#DCE7F2';

  const gridLines = useMemo(() => {
    const values: number[] = [];
    for (let value = -180 + GRID_STEP; value < 180; value += GRID_STEP) values.push(value);
    return values;
  }, []);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Mapa con ${quakes.length} sismos plotting`}
      style={[styles.container, { borderColor: theme.outlineVariant }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        <Rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill={ocean} />

        {gridLines.map((value) => (
          <React.Fragment key={`lat-${value}`}>
            <Line
              x1={0}
              y1={projectY(value)}
              x2={VIEW_W}
              y2={projectY(value)}
              stroke={theme.outlineVariant}
              strokeWidth={0.5}
              opacity={0.45}
            />
            <Line
              x1={projectX(value)}
              y1={0}
              x2={projectX(value)}
              y2={VIEW_H}
              stroke={theme.outlineVariant}
              strokeWidth={0.5}
              opacity={0.45}
            />
          </React.Fragment>
        ))}

        {quakes.map((quake) => {
          const selected = quake.id === selectedId;
<<<<<<< HEAD
          const handleSelect = () => {
            haptics.tap();
            onSelect?.(quake);
          };
=======
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
          return (
            <Circle
              key={quake.id}
              cx={projectX(quake.longitude)}
              cy={projectY(quake.latitude)}
              r={selected ? 11 : 6}
              fill={quakeColor(quake.magnitude, isDark)}
              stroke={selected ? theme.text : 'none'}
              strokeWidth={selected ? 2 : 0}
              opacity={0.9}
<<<<<<< HEAD
              {...(Platform.OS === 'web' ? { onClick: handleSelect } : { onPress: handleSelect })}
=======
              onPress={() => {
                haptics.tap();
                onSelect?.(quake);
              }}
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
            />
          );
        })}
      </Svg>

      <View style={[styles.attribution, { borderColor: theme.outlineVariant }]}>
        <View style={[styles.dot, { backgroundColor: theme.textSecondary }]} />
        <Text style={[styles.attributionText, { color: theme.textSecondary }]}>
          Vista esquemática · previsualización web
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 260,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  attribution: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    opacity: 0.9,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  attributionText: {
    fontSize: 11,
  },
});

export const QuakeMap = memo(QuakeMapImpl);
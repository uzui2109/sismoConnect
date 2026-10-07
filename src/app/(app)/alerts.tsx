import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, quakeColor, Radius, Spacing } from '@/constants/theme';
import { useEarthquakes } from '@/hooks/use-earthquakes';
import { useFirestoreAlerts, type AlertRecord } from '@/hooks/use-alerts';
import { useIsDark, useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { timeAgo } from '@/utils/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { TextField } from '@/components/ui/text-field';
import { ThemedText } from '@/components/themed-text';

const EMERGENCY: { country: string; numbers: { label: string; number: string }[] }[] = [
  {
    country: 'México',
    numbers: [
      { label: 'Emergencias', number: '911' },
      { label: 'Protección Civil', number: '911' },
      { label: 'Cruz Roja', number: '0655' },
    ],
  },
  {
    country: 'Colombia',
    numbers: [
      { label: 'Emergencias', number: '123' },
      { label: 'Cruz Roja', number: '132' },
    ],
  },
  {
    country: 'Chile',
    numbers: [
      { label: 'Emergencias', number: '133' },
      { label: 'Bomberos', number: '132' },
    ],
  },
  {
    country: 'Perú',
    numbers: [
      { label: 'Emergencias', number: '105' },
      { label: 'Defensa Civil', number: '116' },
    ],
  },
  {
    country: 'Ecuador',
    numbers: [
      { label: 'Emergencias', number: '911' },
      { label: 'SRI', number: '911' },
    ],
  },
];

const ALERT_THRESHOLD = 5;

export default function AlertsScreen() {
  const theme = useTheme();
  const isDark = useIsDark();
  const insets = useSafeAreaInsets();
  const { data, loading, error, refetch, lastUpdated } = useEarthquakes('all_day');
  const {
    enabled: alertsEnabled,
    alerts: myAlerts,
    loading: alertsLoading,
    error: alertsError,
    busy: alertsBusy,
    addAlert,
    toggleAlert,
    removeAlert,
  } = useFirestoreAlerts();

  const [magnitude, setMagnitude] = useState('');
  const [place, setPlace] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const significant = data.filter((quake) => (quake.magnitude ?? 0) >= ALERT_THRESHOLD);

  function dial(number: string) {
    haptics.tap();
    Linking.openURL(`tel:${number}`).catch(() => {
      // Desktop browsers have no tel: handler; nothing to recover from.
    });
  }

  async function createAlert() {
    const value = Number.parseFloat(magnitude.replace(',', '.'));

    if (Number.isNaN(value) || value < 0 || value > 10) {
      setFormError('Ingresa una magnitud entre 0 y 10.');
      return;
    }

    setFormError(null);
    setCreating(true);
    try {
      await addAlert({ minMagnitude: value, place });
      haptics.success();
      setMagnitude('');
      setPlace('');
    } catch {
      haptics.error();
      setFormError('No se pudo guardar la alerta en Firestore.');
    } finally {
      setCreating(false);
    }
  }

  async function onToggleAlert(alert: AlertRecord) {
    try {
      await toggleAlert(alert);
      haptics.select();
    } catch {
      haptics.error();
    }
  }

  async function onRemoveAlert(alert: AlertRecord) {
    try {
      await removeAlert(alert);
      haptics.success();
    } catch {
      haptics.error();
    }
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + Spacing.two,
          paddingBottom: insets.bottom + 96,
          maxWidth: MaxContentWidth,
        },
      ]}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          Alertas
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Sismos de {ALERT_THRESHOLD}.0 o más en las últimas 24 horas.
        </ThemedText>
      </View>

      <View style={styles.section}>
        <ThemedText type="subtitle">Avisos recientes</ThemedText>

        {loading ? (
          <Card>
            <ThemedText type="small" themeColor="textSecondary">
              Revisando la actividad sísmica…
            </ThemedText>
          </Card>
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : significant.length === 0 ? (
          <EmptyState
            title="Sin alertas activas"
            description={`No se han registrado sismos de ${ALERT_THRESHOLD} o más puntos en las últimas 24 horas.`}
          />
        ) : (
          significant.map((quake) => (
            <Card
              key={quake.id}
              style={[styles.alertCard, { borderColor: quakeColor(quake.magnitude, isDark) }]}>
              <View style={styles.alertHeader}>
                <ThemedText type="smallBold">{`M ${quake.magnitude?.toFixed(1)}`}</ThemedText>
                <Badge label={timeAgo(quake.time)} color={quakeColor(quake.magnitude, isDark)} />
              </View>
              <ThemedText>{quake.place}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {quake.depthKm.toFixed(1)} km de profundidad · {lastUpdated ? timeAgo(lastUpdated) : ''}
              </ThemedText>
            </Card>
          ))
        )}
      </View>

      <View style={styles.section}>
        <ThemedText type="subtitle">Mis alertas</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Umbrales guardados en Firestore y sincronizados en tiempo real.
        </ThemedText>

        {!alertsEnabled ? (
          <Card>
            <ThemedText type="smallBold">Inicia sesión para sincronizar</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Con tu cuenta de SismoConnect tus alertas se guardan en la nube y se actualizan en
              todos tus dispositivos.
            </ThemedText>
          </Card>
        ) : (
          <>
            <Card style={styles.formCard}>
              <TextField
                label="Magnitud mínima"
                placeholder="5.5"
                keyboardType="decimal-pad"
                value={magnitude}
                onChangeText={(text) => {
                  setMagnitude(text);
                  setFormError(null);
                }}
                error={formError}
                hint="Valor entre 0 y 10."
              />
              <TextField
                label="Lugar (opcional)"
                placeholder="Ciudad de México"
                value={place}
                onChangeText={setPlace}
              />
              <Button
                label="Crear alerta"
                onPress={() => void createAlert()}
                loading={creating}
                disabled={alertsBusy}
              />
            </Card>

            {alertsError ? (
              <ErrorState message={alertsError} />
            ) : alertsLoading ? (
              <Card>
                <ThemedText type="small" themeColor="textSecondary">
                  Sincronizando alertas con Firestore…
                </ThemedText>
              </Card>
            ) : myAlerts.length === 0 ? (
              <EmptyState
                title="Sin alertas guardadas"
                description="Crea una alerta con la magnitud mínima que te interesa y aparecerá aquí al instante."
              />
            ) : (
              myAlerts.map((alert) => (
                <Card key={alert.id} style={styles.mineCard}>
                  <View style={styles.alertHeader}>
                    <ThemedText type="smallBold">{`M ${alert.minMagnitude.toFixed(1)}`}</ThemedText>
                    <Badge
                      label={alert.active ? 'Activa' : 'Pausada'}
                      color={alert.active ? theme.success : theme.textSecondary}
                    />
                  </View>
                  <ThemedText>{alert.place || 'Cualquier lugar'}</ThemedText>
                  <View style={styles.mineActions}>
                    <Button
                      label={alert.active ? 'Pausar' : 'Activar'}
                      variant="tonal"
                      fullWidth={false}
                      disabled={alertsBusy}
                      onPress={() => void onToggleAlert(alert)}
                    />
                    <Button
                      label="Eliminar"
                      variant="text"
                      fullWidth={false}
                      disabled={alertsBusy}
                      onPress={() => void onRemoveAlert(alert)}
                    />
                  </View>
                </Card>
              ))
            )}
          </>
        )}
      </View>

      <View style={styles.section}>
        <ThemedText type="subtitle">Números de emergencia</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Marcarlos mantiene la llamada lista para enviar.
        </ThemedText>

        {EMERGENCY.map((country) => (
          <Card key={country.country} style={styles.countryCard}>
            <ThemedText type="smallBold">{country.country}</ThemedText>
            <View style={styles.numbers}>
              {country.numbers.map((entry) => (
                <Card
                  key={`${country.country}-${entry.label}`}
                  style={styles.numberCard}
                  onPress={() => dial(entry.number)}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {entry.label}
                  </ThemedText>
                  <ThemedText style={styles.number}>{entry.number}</ThemedText>
                </Card>
              ))}
            </View>
          </Card>
        ))}
      </View>

      <Card variant="raised" style={styles.notice}>
        <ThemedText type="smallBold">Antes de un sismo</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Identifica las salidas de emergencia de tu zona, asegura muebles pesados y mantén a la
          mano este número. Durante el evento, protege tu cabeza y refrainte de usar ascensores.
        </ThemedText>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.three,
  },
  header: {
    gap: 2,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
  },
  section: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  alertCard: {
    gap: Spacing.one,
    borderWidth: 2,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formCard: {
    gap: Spacing.three,
  },
  mineCard: {
    gap: Spacing.two,
  },
  mineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  countryCard: {
    gap: Spacing.three,
  },
  numbers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  numberCard: {
    flexGrow: 1,
    minWidth: 110,
    gap: 2,
  },
  number: {
    fontSize: 26,
    fontWeight: '800',
    color: '#B3261E',
    paddingVertical: Spacing.one,
  },
  notice: {
    marginTop: Spacing.two,
    gap: Spacing.two,
    borderRadius: Radius.lg,
  },
});
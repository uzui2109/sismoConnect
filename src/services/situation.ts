import { invoke } from './social';
import type { SituationFeed } from '@/types/situation';

export const SITUATION_ATTRIBUTION =
  'Informes oficiales: GDACS (Comisión Europea) y ReliefWeb (OCHA).';

export async function fetchSituationReports(): Promise<SituationFeed> {
  return invoke<Record<string, never>, SituationFeed>('getSituationReports', {});
}

export function situationErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message.replace(/^Firebase:\s*/i, '').replace(/\s*\(.*\)\.?$/, '');
    }
  }
  return 'No se pudieron cargar los informes oficiales.';
}

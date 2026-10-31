import {
  AdEventType,
  MobileAds,
  RewardedAd,
  RewardedAdEventType,
} from 'react-native-google-mobile-ads';

import { admobRewardedUnitId } from '@/constants/config';

let initialized: Promise<unknown> | null = null;

export async function showRewardedAd(userId: string): Promise<{ earned: boolean }> {
  initialized ??= MobileAds().initialize();
  await initialized;

  return new Promise((resolve, reject) => {
    const ad = RewardedAd.createForAdRequest(admobRewardedUnitId, {
      requestNonPersonalizedAdsOnly: true,
      serverSideVerificationOptions: {
        userId,
        customData: 'sismoconnect-unlock',
      },
    });

    let earned = false;
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cleanups: (() => void)[] = [];

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      for (const cleanup of cleanups) cleanup();
      if (error) reject(error);
      else resolve({ earned });
    };

    cleanups.push(
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        ad.show().catch((showError: unknown) => {
          finish(showError instanceof Error ? showError : new Error('No se pudo mostrar el anuncio.'));
        });
      })
    );
    cleanups.push(
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      })
    );
    cleanups.push(
      ad.addAdEventListener(AdEventType.CLOSED, () => {
        finish();
      })
    );
    cleanups.push(
      ad.addAdEventListener(AdEventType.ERROR, (adError: unknown) => {
        const message =
          adError && typeof adError === 'object' && 'message' in adError
            ? String((adError as { message: unknown }).message)
            : 'No se pudo cargar el anuncio.';
        finish(new Error(message));
      })
    );

    timer = setTimeout(() => finish(new Error('El anuncio tardó demasiado en cargar.')), 45_000);
    ad.load();
  });
}

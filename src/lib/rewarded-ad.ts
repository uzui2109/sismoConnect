import Constants from 'expo-constants';

import { admobRewardedUnitId } from '@/constants/config';

const isExpoGo = Constants.appOwnership === 'expo';

interface RewardedAdMock {
  load: () => void;
  show: () => Promise<void>;
  addAdEventListener: (
    eventType: string,
    handler: (event: unknown) => void
  ) => () => void;
}

interface MockAdEvent {
  type: string;
}

function createRewardedAdMock(unitId: string, requestOptions: unknown): RewardedAdMock {
  let loadedHandler: ((event: MockAdEvent) => void) | null = null;

  return {
    load() {
      console.log('[AdMob Mock] Cargando anuncio recompensado simulado (Expo Go).');
      setTimeout(() => {
        if (loadedHandler) {
          loadedHandler({ type: 'LOADED' });
        }
      }, 500);
    },
    async show() {
      console.log('[AdMob Mock] Mostrando anuncio recompensado simulado (Expo Go).');
    },
    addAdEventListener(eventType, handler) {
      if (eventType === 'LOADED') {
        loadedHandler = handler as (event: MockAdEvent) => void;
      }
      return () => {
        loadedHandler = null;
      };
    },
  };
}

let initialized: Promise<unknown> | null = null;

export async function showRewardedAd(userId: string): Promise<{ earned: boolean }> {
  if (isExpoGo) {
    console.info('[AdMob Warning] Anuncios desactivados en Expo Go');
    const ad = createRewardedAdMock(admobRewardedUnitId, {
      requestNonPersonalizedAdsOnly: true,
      serverSideVerificationOptions: {
        userId,
        customData: 'sismoconnect-unlock',
      },
    });

    return new Promise((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        if (error) reject(error);
        else resolve({ earned: false });
      };

      ad.addAdEventListener('LOADED', () => {
        void ad.show().catch((showError: unknown) => {
          finish(
            showError instanceof Error ? showError : new Error('No se pudo mostrar el anuncio.')
          );
        });
      });

      timer = setTimeout(
        () => finish(new Error('El anuncio tardó demasiado en cargar.')),
        45_000
      );

      ad.load();
    });
  }

  const {
    AdEventType,
    MobileAds,
    RewardedAd,
    RewardedAdEventType,
  } = await import('react-native-google-mobile-ads');

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

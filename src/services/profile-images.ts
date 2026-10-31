import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';

import { getFirebaseStorage } from '@/lib/firebase';

export type ProfileImageKind = 'avatar' | 'cover';

const MAX_BYTES = 2 * 1024 * 1024;

const SIZES: Record<ProfileImageKind, { width: number; height: number | null }> = {
  avatar: { width: 512, height: 512 },
  cover: { width: 1280, height: 480 },
};

export async function pickAndUploadProfileImage(
  uid: string,
  kind: ProfileImageKind
): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Permite el acceso a tus fotos para cambiar la imagen.');
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: kind === 'avatar' ? [1, 1] : [16, 9],
    quality: 1,
  });

  if (picked.canceled || picked.assets.length === 0) return null;

  const context = ImageManipulator.manipulate(picked.assets[0].uri);
  context.resize(SIZES[kind]);
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    compress: 0.82,
    format: SaveFormat.JPEG,
    base64: true,
  });

  if (!saved.base64) throw new Error('No se pudo procesar la imagen.');

  const estimatedBytes = Math.floor((saved.base64.length * 3) / 4);
  if (estimatedBytes > MAX_BYTES) {
    throw new Error('La imagen es demasiado grande. Elige otra foto.');
  }

  const storage = getFirebaseStorage();
  const objectRef = ref(storage, `users/${uid}/profile/${kind}.jpg`);
  await uploadString(objectRef, saved.base64, 'base64', {
    contentType: 'image/jpeg',
    cacheControl: 'public,max-age=31536000,immutable',
  });

  return getDownloadURL(objectRef);
}

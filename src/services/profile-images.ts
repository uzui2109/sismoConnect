import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { getFirebaseStorage } from '@/lib/firebase';

export type ProfileImageKind = 'avatar' | 'cover';

const MAX_BYTES = 2 * 1024 * 1024;

const SIZES: Record<ProfileImageKind, { width: number; height: number | null }> = {
  avatar: { width: 512, height: 512 },
  cover: { width: 1280, height: 480 },
};

function uriToNativeBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

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
  const saved = await rendered.saveAsync({ compress: 0.82, format: SaveFormat.JPEG, base64: false });
  if (!saved.uri) throw new Error('No se pudo procesar la imagen.');

  const storage = getFirebaseStorage();
  const objectRef = ref(storage, `users/${uid}/profile/${kind}.jpg`);
  const blob = await uriToNativeBlob(saved.uri);
  try {
    if (blob.size > MAX_BYTES) {
      throw new Error('La imagen es demasiado grande. Elige otra foto.');
    }

    await uploadBytes(objectRef, blob, {
      contentType: 'image/jpeg',
      cacheControl: 'public,max-age=31536000,immutable',
    });
  } finally {
    (blob as any)?.close?.();
  }

  return getDownloadURL(objectRef);
}

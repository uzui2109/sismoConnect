<<<<<<< HEAD
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  type QueryConstraint,
} from 'firebase/firestore';

import { getFirebaseFirestore } from '@/lib/firebase';

export type FirestoreDocument = Record<string, unknown> & { id: string };

export async function addDocument(
  collectionName: string,
  data: Record<string, unknown>
) {
  const db = getFirebaseFirestore();

  const collectionRef = collection(db, collectionName);

  const document = await addDoc(collectionRef, data);

  return document.id;
}

export async function getDocuments(collectionName: string) {
  const db = getFirebaseFirestore();

  const collectionRef = collection(db, collectionName);
  const snapshot = await getDocs(collectionRef);

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
}

export async function updateDocument(
  collectionName: string,
  documentId: string,
  data: Record<string, unknown>
) {
  const db = getFirebaseFirestore();

  const documentRef = doc(db, collectionName, documentId);

  await updateDoc(documentRef, data);
}

export async function deleteDocument(
  collectionName: string,
  documentId: string
) {
  const db = getFirebaseFirestore();

  const documentRef = doc(db, collectionName, documentId);

  await deleteDoc(documentRef);
}

/**
 * Real-time listener: every change in the collection pushes a fresh list to
 * `onData`. The returned function MUST be called (e.g. from a `useEffect`
 * cleanup) so Firebase removes the listener.
 */
export function subscribeToCollection(
  collectionName: string,
  onData: (documents: FirestoreDocument[]) => void,
  onError?: (error: Error) => void,
  constraints: QueryConstraint[] = []
) {
  const db = getFirebaseFirestore();

  const collectionRef = collection(db, collectionName);
  const queryRef = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;

  const unsubscribe = onSnapshot(
    queryRef,
    (snapshot) => {
      onData(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
    },
    (error) => onError?.(error)
  );

  return unsubscribe;
=======
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  type QueryConstraint,
} from 'firebase/firestore';

import { getFirebaseFirestore } from '@/lib/firebase';

export type FirestoreDocument = Record<string, unknown> & { id: string };

export async function addDocument(
  collectionName: string,
  data: Record<string, unknown>
) {
  const db = getFirebaseFirestore();

  const collectionRef = collection(db, collectionName);

  const document = await addDoc(collectionRef, data);

  return document.id;
}

export async function getDocuments(collectionName: string) {
  const db = getFirebaseFirestore();

  const collectionRef = collection(db, collectionName);
  const snapshot = await getDocs(collectionRef);

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
}

export async function updateDocument(
  collectionName: string,
  documentId: string,
  data: Record<string, unknown>
) {
  const db = getFirebaseFirestore();

  const documentRef = doc(db, collectionName, documentId);

  await updateDoc(documentRef, data);
}

export async function deleteDocument(
  collectionName: string,
  documentId: string
) {
  const db = getFirebaseFirestore();

  const documentRef = doc(db, collectionName, documentId);

  await deleteDoc(documentRef);
}

/**
 * Real-time listener: every change in the collection pushes a fresh list to
 * `onData`. The returned function MUST be called (e.g. from a `useEffect`
 * cleanup) so Firebase removes the listener.
 */
export function subscribeToCollection(
  collectionName: string,
  onData: (documents: FirestoreDocument[]) => void,
  onError?: (error: Error) => void,
  constraints: QueryConstraint[] = []
) {
  const db = getFirebaseFirestore();

  const collectionRef = collection(db, collectionName);
  const queryRef = constraints.length > 0 ? query(collectionRef, ...constraints) : collectionRef;

  const unsubscribe = onSnapshot(
    queryRef,
    (snapshot) => {
      onData(snapshot.docs.map((document) => ({ id: document.id, ...document.data() })));
    },
    (error) => onError?.(error)
  );

  return unsubscribe;
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
}
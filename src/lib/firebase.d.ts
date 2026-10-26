import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { Functions } from 'firebase/functions';
import type { FirebaseStorage } from 'firebase/storage';

export declare function getFirebaseAuth(): Auth;
export declare function getFirebaseFirestore(): Firestore;
export declare function getFirebaseStorage(): FirebaseStorage;
export declare function getFirebaseFunctions(): Functions;

export declare const firebaseAuth: Auth;
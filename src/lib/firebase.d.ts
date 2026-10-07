import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

export declare function getFirebaseAuth(): Auth;
export declare function getFirebaseFirestore(): Firestore;

export declare const firebaseAuth: Auth;
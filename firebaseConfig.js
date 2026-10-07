import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCLB9lvTvGjMRP3fTkrUYXOxnxED4swAtA",
  authDomain: "sismoconnectfirebase.firebaseapp.com",
  projectId: "sismoconnectfirebase",
  storageBucket: "sismoconnectfirebase.firebasestorage.app",
  messagingSenderId: "811581801016",
  appId: "1:811581801016:web:567fbe5549866197ec9ccd"
};

export const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export const db = getFirestore(app);
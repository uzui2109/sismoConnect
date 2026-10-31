// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCLB9lvTvGjMRP3fTkrUYXOxnxED4swAtA",
  authDomain: "sismoconnectfirebase.firebaseapp.com",
  projectId: "sismoconnectfirebase",
  storageBucket: "sismoconnectfirebase.firebasestorage.app",
  messagingSenderId: "811581801016",
  appId: "1:811581801016:web:567fbe5549866197ec9ccd",
  measurementId: "G-V3Z2YZ8JX6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

/**
 * FIREBASE SECURITY RULES (Copy & Paste to Firebase Console -> Firestore -> Rules):
 * 
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /{document=**} {
 *       // SECURE: Allow read/write only to users who are authenticated (including Anonymous users)
 *       allow read, write: if request.auth != null;
 *     }
 *   }
 * }
 * 
 * NOTE: You must enable "Anonymous" provider in Firebase Console -> Authentication -> Settings.
 */

const firebaseConfig = {
  apiKey: "AIzaSyAW85HLoKFugnzSDjk4v_Sb6NZI2BzbjP4",
  authDomain: "smart-cycle-count.firebaseapp.com",
  projectId: "smart-cycle-count",
  storageBucket: "smart-cycle-count.firebasestorage.app",
  messagingSenderId: "921554575755",
  appId: "1:921554575755:web:7a2af4cda21b80a36acf8e"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

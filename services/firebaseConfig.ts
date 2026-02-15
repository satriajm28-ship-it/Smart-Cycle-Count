
import { Firestore } from "firebase/firestore";

// Workaround for potential type definition mismatches where named exports are not recognized
// We import the namespaces and cast them to any to access the v9 modular functions at runtime
import * as firebaseApp from "firebase/app";
import * as firebaseFirestore from "firebase/firestore";
import * as firebaseAuth from "firebase/auth";

const initializeApp = (firebaseApp as any).initializeApp;
const initializeFirestore = (firebaseFirestore as any).initializeFirestore;
const getAuth = (firebaseAuth as any).getAuth;
const persistentLocalCache = (firebaseFirestore as any).persistentLocalCache;
const persistentMultipleTabManager = (firebaseFirestore as any).persistentMultipleTabManager;

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

// Initialize Firestore with settings to handle connection issues better
// experimentalAutoDetectLongPolling helps when WebSockets are blocked or unstable (fixing the 10s timeout error)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache ? persistentLocalCache({
    tabManager: persistentMultipleTabManager ? persistentMultipleTabManager() : undefined
  }) : undefined,
  experimentalAutoDetectLongPolling: true
}) as Firestore;

export const auth = getAuth(app);

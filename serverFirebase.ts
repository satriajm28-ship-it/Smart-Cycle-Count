import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

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

// Authenticate server to bypass security rules that require auth
export const authenticateServer = async () => {
    try {
        await signInAnonymously(auth);
        console.log("Server authenticated with Firebase");
    } catch (e) {
        console.error("Server Firebase auth failed:", e);
    }
};

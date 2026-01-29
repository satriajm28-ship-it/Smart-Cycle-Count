
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Define config directly to ensure it works in all environments
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

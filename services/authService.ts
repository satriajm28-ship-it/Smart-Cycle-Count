
import { AppUser } from "../types";
import { db } from "./firebaseConfig";
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from "firebase/firestore";

const STORAGE_KEY = 'app_session_user';

// Authenticate user against Firestore
export const authenticateUser = async (username: string, password: string): Promise<AppUser | null> => {
    try {
        const userDoc = await getDoc(doc(db, 'users', username));
        if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.password === password) {
                return {
                    username: data.username,
                    role: data.role,
                    name: data.name
                };
            }
        }
        return null;
    } catch (e) {
        console.error("Auth failed:", e);
        return null;
    }
};

// Get all users from Firestore
export const getAllUsers = async (): Promise<AppUser[]> => {
    try {
        const usersSnap = await getDocs(collection(db, 'users'));
        return usersSnap.docs.map(doc => {
            const data = doc.data();
            return {
                username: data.username,
                role: data.role,
                name: data.name,
                password: data.password // We include password for management purposes
            } as any;
        });
    } catch (e) {
        console.error("Failed to fetch users:", e);
        return [];
    }
};

// Save or update a user in Firestore
export const saveUser = async (user: any) => {
    try {
        await setDoc(doc(db, 'users', user.username), user, { merge: true });
        return true;
    } catch (e) {
        console.error("Failed to save user:", e);
        return false;
    }
};

// Delete a user from Firestore
export const deleteUser = async (username: string) => {
    try {
        await deleteDoc(doc(db, 'users', username));
        return true;
    } catch (e) {
        console.error("Failed to delete user:", e);
        return false;
    }
};

// Bootstrap users if the collection is empty
export const bootstrapUsers = async () => {
    try {
        const usersSnap = await getDocs(collection(db, 'users'));
        if (usersSnap.empty) {
            console.log("Bootstrapping users to Firestore...");
            const users = [
                { username: 'admin', password: 'admin123', role: 'admin', name: 'Administrator' },
                ...Array.from({ length: 20 }, (_, i) => ({
                    username: `User${i + 1}`,
                    password: `User${i + 1}`,
                    role: 'user',
                    name: `Staff ${i + 1}`
                }))
            ];
            for (const user of users) {
                await setDoc(doc(db, 'users', user.username), user);
            }
            console.log("Bootstrapping complete.");
        }
    } catch (e) {
        console.error("Bootstrap failed:", e);
    }
};

export const getSessionUser = (): AppUser | null => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        return null;
    }
};

export const setSessionUser = (user: AppUser) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    // Also update team member name for audit logs convenience
    localStorage.setItem('team_member_name', user.name); 
};

export const clearSessionUser = () => {
    localStorage.removeItem(STORAGE_KEY);
};

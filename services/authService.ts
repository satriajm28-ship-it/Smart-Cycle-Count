import { AppUser } from "../types";
import { db, handleFirestoreError, OperationType } from "./firebaseClient";
import { doc, getDoc, getDocs, collection, setDoc, deleteDoc } from 'firebase/firestore';

const STORAGE_KEY = 'app_session_user';

// Authenticate user against Firestore
export const authenticateUser = async (username: string, password: string): Promise<{ user: AppUser | null, error: string | null }> => {
    try {
        const userDocRef = doc(db, 'users', username);
        let userSnap;
        try {
            userSnap = await getDoc(userDocRef);
        } catch (error) {
            handleFirestoreError(error, OperationType.GET, `users/${username}`);
        }

        if (!userSnap.exists()) {
            // First check if database is empty by querying all users.
            // If empty, we can bootstrap that admin user.
            let usersSnap;
            try {
                usersSnap = await getDocs(collection(db, 'users'));
            } catch (error) {
                console.warn("Could not list users, falling back. Error:", error);
                if (username === 'admin' && password === 'admin123') {
                    return { user: { username: 'admin', role: 'admin', name: 'Administrator' }, error: null };
                }
                handleFirestoreError(error, OperationType.LIST, 'users');
            }

            if (usersSnap && usersSnap.empty) {
                await bootstrapUsers();
                return { user: null, error: "Database kosong. Sistem mencoba melakukan inisialisasi akun default. Silakan coba masuk kembali dalam 3 detik." };
            }
            return { user: null, error: "Username tidak ditemukan." };
        }

        const data = userSnap.data();
        if (data && data.password === password) {
            return {
                user: {
                    username: data.username,
                    role: data.role,
                    name: data.name
                },
                error: null
            };
        }
        return { user: null, error: "Password salah." };
    } catch (e: any) {
        console.error("Auth failed:", e);
        if (username === 'admin' && password === 'admin123') {
            return { user: { username: 'admin', role: 'admin', name: 'Administrator' }, error: null };
        }
        
        let displayError = e.message || "Terjadi kesalahan sistem.";
        try {
            const parsed = JSON.parse(e.message);
            if (parsed.error && parsed.error.includes("Missing or insufficient permissions")) {
                displayError = "Gagal mengakses database Firebase. Pastikan Anda telah membuat 'Firestore Database' di Firebase Console, dan mengatur rules ke allow read, write: if true;";
            }
        } catch (_) {}
        
        return { user: null, error: displayError };
    }
};

// Get all users from Firestore
export const getAllUsers = async (): Promise<AppUser[]> => {
    try {
        let querySnapshot;
        try {
            querySnapshot = await getDocs(collection(db, 'users'));
        } catch (error) {
            handleFirestoreError(error, OperationType.LIST, 'users');
        }

        const users: AppUser[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            users.push({
                username: data.username,
                role: data.role,
                name: data.name,
                password: data.password // Included for management purposes
            } as any);
        });
        return users;
    } catch (e) {
        console.error("Failed to fetch users:", e);
        return [];
    }
};

// Save or update a user in Firestore
export const saveUser = async (user: any) => {
    try {
        const userDocRef = doc(db, 'users', user.username);
        try {
            await setDoc(userDocRef, user);
        } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `users/${user.username}`);
        }
        return { success: true };
    } catch (e: any) {
        console.error("Failed to save user:", e);
        return { success: false, error: e.message || JSON.stringify(e) };
    }
};

// Delete a user from Firestore
export const deleteUser = async (username: string) => {
    try {
        const userDocRef = doc(db, 'users', username);
        try {
            await deleteDoc(userDocRef);
        } catch (error) {
            handleFirestoreError(error, OperationType.DELETE, `users/${username}`);
        }
        return true;
    } catch (e) {
        console.error("Failed to delete user:", e);
        return false;
    }
};

// Bootstrap users if the collection is empty
export const bootstrapUsers = async () => {
    try {
        // Always ensure admin exists to prevent lockout
        const adminUser = { username: 'admin', password: 'admin123', role: 'admin', name: 'Administrator' };
        const adminDocRef = doc(db, 'users', adminUser.username);
        
        try {
            await setDoc(adminDocRef, adminUser);
        } catch (adminError) {
            console.error("Failed to bootstrap admin user:", adminError);
        }

        let querySnapshot;
        try {
            querySnapshot = await getDocs(collection(db, 'users'));
        } catch (error) {
            console.error("Failed to query users during bootstrap:", error);
            return;
        }
        
        if (querySnapshot.size <= 1) { // Only admin or empty
            console.log("Bootstrapping users to Firestore...");
            const users = Array.from({ length: 20 }, (_, i) => ({
                username: `User${i + 1}`,
                password: `User${i + 1}`,
                role: 'user',
                name: `Staff ${i + 1}`
            }));
            
            for (const u of users) {
                try {
                    await setDoc(doc(db, 'users', u.username), u);
                } catch (insertError) {
                    console.error(`Failed to bootstrap staff user ${u.username}:`, insertError);
                }
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

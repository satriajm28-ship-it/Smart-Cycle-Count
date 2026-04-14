
import { AppUser } from "../types";
import { supabase } from "./supabaseClient";

const STORAGE_KEY = 'app_session_user';

// Authenticate user against Supabase
export const authenticateUser = async (username: string, password: string): Promise<AppUser | null> => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error) {
            console.error("Auth query error:", error);
            return null;
        }

        if (data && data.password === password) {
            return {
                username: data.username,
                role: data.role,
                name: data.name
            };
        }
        return null;
    } catch (e) {
        console.error("Auth failed:", e);
        return null;
    }
};

// Get all users from Supabase
export const getAllUsers = async (): Promise<AppUser[]> => {
    try {
        const { data, error } = await supabase.from('users').select('*');
        if (error) throw error;
        
        return (data || []).map(user => ({
            username: user.username,
            role: user.role,
            name: user.name,
            password: user.password // Included for management purposes
        } as any));
    } catch (e) {
        console.error("Failed to fetch users:", e);
        return [];
    }
};

// Save or update a user in Supabase
export const saveUser = async (user: any) => {
    try {
        const { error } = await supabase.from('users').upsert(user, { onConflict: 'username' });
        if (error) throw error;
        return true;
    } catch (e) {
        console.error("Failed to save user:", e);
        return false;
    }
};

// Delete a user from Supabase
export const deleteUser = async (username: string) => {
    try {
        const { error } = await supabase.from('users').delete().eq('username', username);
        if (error) throw error;
        return true;
    } catch (e) {
        console.error("Failed to delete user:", e);
        return false;
    }
};

// Bootstrap users if the table is empty
export const bootstrapUsers = async () => {
    try {
        // Always ensure admin exists to prevent lockout
        const adminUser = { username: 'admin', password: 'admin123', role: 'admin', name: 'Administrator' };
        await supabase.from('users').upsert(adminUser, { onConflict: 'username' });

        const { data, error, count } = await supabase.from('users').select('*', { count: 'exact', head: true });
        
        if (count !== null && count <= 1) { // Only admin or empty
            console.log("Bootstrapping users to Supabase...");
            const users = Array.from({ length: 20 }, (_, i) => ({
                username: `User${i + 1}`,
                password: `User${i + 1}`,
                role: 'user',
                name: `Staff ${i + 1}`
            }));
            
            const { error: insertError } = await supabase.from('users').upsert(users, { onConflict: 'username' });
            if (insertError) throw insertError;
            
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

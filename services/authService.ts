
import { AppUser } from "../types";

const STORAGE_KEY = 'app_session_user';

// Authenticate user against the requested hardcoded list
export const authenticateUser = (username: string, password: string): AppUser | null => {
    
    // 1. Check Admin
    if (username === 'admin' && password === 'admin123') {
        return {
            username: 'admin',
            role: 'admin',
            name: 'Administrator'
        };
    }

    // 2. Check Users 1-20
    // Pattern: UserX / UserX
    if (username.startsWith('User') && password === username) {
        const numberPart = parseInt(username.replace('User', ''));
        if (!isNaN(numberPart) && numberPart >= 1 && numberPart <= 20) {
            return {
                username: username,
                role: 'user',
                name: `Staff ${numberPart}`
            };
        }
    }

    return null;
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

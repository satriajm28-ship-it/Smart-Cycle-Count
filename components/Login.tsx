
import React, { useState } from 'react';
import { Logo } from './Logo';
import { authenticateUser, setSessionUser } from '../services/authService';
import { AppUser } from '../types';

interface LoginProps {
    onLoginSuccess: (user: AppUser) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Simulate network delay for UX
        setTimeout(() => {
            const user = authenticateUser(username, password);
            if (user) {
                setSessionUser(user);
                onLoginSuccess(user);
            } else {
                setError('Username atau Password salah.');
                setLoading(false);
            }
        }, 800);
    };

    return (
        <div className="min-h-screen bg-[#050A18] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-800">
                <div className="p-8 pb-0 flex flex-col items-center">
                    <div className="p-3 bg-primary/10 rounded-2xl mb-4">
                        <Logo size={60} />
                    </div>
                    <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Welcome Back</h1>
                    <p className="text-xs font-bold text-primary uppercase tracking-widest mt-2">MEDIKA BINA INVESTAMA</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-5">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3">
                            <span className="material-symbols-outlined text-red-500">error</span>
                            <span className="text-xs font-bold text-red-500">{error}</span>
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username</label>
                        <div className="relative">
                            <span className="absolute left-4 top-3.5 text-slate-400 material-symbols-outlined text-[20px]">person</span>
                            <input 
                                type="text" 
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary outline-none transition-all dark:text-white"
                                placeholder="Enter your username"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password</label>
                        <div className="relative">
                            <span className="absolute left-4 top-3.5 text-slate-400 material-symbols-outlined text-[20px]">lock</span>
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary outline-none transition-all dark:text-white"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading || !username || !password}
                        className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/25 flex items-center justify-center gap-2 mt-4 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <span className="material-symbols-outlined animate-spin">sync</span>
                        ) : (
                            <>
                                <span>Login System</span>
                                <span className="material-symbols-outlined">arrow_forward</span>
                            </>
                        )}
                    </button>
                </form>
                
                <div className="bg-slate-50 dark:bg-slate-950 p-4 text-center border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Smart Cycle Count v1.0</p>
                </div>
            </div>
        </div>
    );
};

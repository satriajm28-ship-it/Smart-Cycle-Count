
import React, { useState } from 'react';
import { Logo } from './Logo';
import { authenticateUser, setSessionUser } from '../services/authService';
import { saveActivityLog } from '../services/storageService';
import { AppUser } from '../types';

interface LoginProps {
    onLoginSuccess: (user: AppUser) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const user = await authenticateUser(username, password);
            if (user) {
                setSessionUser(user);
                
                // Log login activity
                saveActivityLog({
                    type: 'adjustment',
                    title: 'User Logged In',
                    description: `${user.name} (${user.role}) has entered the system.`,
                    user: user.name,
                    details: `IP: ${window.location.hostname}`
                }).catch(console.error);

                onLoginSuccess(user);
            } else {
                setError('Username atau Password salah.');
                setLoading(false);
            }
        } catch (e) {
            setError('Terjadi kesalahan sistem.');
            setLoading(false);
        }
    };

    return (
        <div className="font-body bg-[#f7f9fb] text-[#191c1e] antialiased min-h-screen flex flex-col">
            {/* Top Navigation Anchor */}
            <header className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl flex items-center justify-between px-6 h-16 border-b border-[#c3c6d1]/15 shadow-[0_20px_40px_rgba(0,30,64,0.06)]">
                <div className="flex items-center gap-3">
                    <Logo size={32} />
                    <span className="text-lg font-bold text-[#001e40] uppercase tracking-widest font-headline">PT Medika Bina Investama</span>
                </div>
                <div className="hidden md:flex gap-6 items-center">
                    <span className="font-headline font-bold tracking-tight text-[#006875]">Akses Sistem</span>
                </div>
            </header>

            {/* Main Content: Login Shell */}
            <main className="flex-grow flex items-center justify-center relative overflow-hidden px-4 pt-16" style={{
                backgroundColor: '#001e40',
                backgroundImage: `
                    radial-gradient(at 0% 0%, hsla(188, 100%, 47%, 0.15) 0px, transparent 50%),
                    radial-gradient(at 100% 0%, hsla(214, 100%, 25%, 0.2) 0px, transparent 50%),
                    radial-gradient(at 100% 100%, hsla(188, 100%, 47%, 0.1) 0px, transparent 50%),
                    radial-gradient(at 0% 100%, hsla(214, 100%, 15%, 0.2) 0px, transparent 50%)
                `
            }}>
                {/* Subtle Medical Illustration Background */}
                <div className="absolute inset-0 z-0">
                    <img alt="Medical Illustration Background" className="w-full h-full object-cover opacity-15 mix-blend-overlay" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCW-IJxhdL4tkJ_qazHNVy2ZXvskDzcXNhV570epIXBm36Prt6sFlHJMK6djp16fKOUP30bwMXOHXQg_yuzxuI-5qOcJrIO8nMw7gJrGHhe2wYrWCmNvof-gjfdyrIT9ZFDyBk7FHkkPXi6pxw9WllWzPEOx7SpG53g0cpMWZDlwa5MmL06wzd1E1QXYbKVCod_ucietsvx3ArUd61v_1pVpacp_bPaJVXjtXjzzxX2ZWDnN2YRIBrib7hBHL3jrOqLhSnUd2w4DHsE" />
                    <div className="absolute inset-0 bg-[#001e40]/40 backdrop-blur-[2px]"></div>
                </div>

                {/* Abstract Tech Background Elements */}
                <div className="absolute inset-0 pointer-events-none opacity-20 z-0">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#9cf0ff] rounded-full blur-[128px]"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-[#003366] rounded-full blur-[96px]"></div>
                </div>

                <div className="w-full max-w-md relative z-10">
                    {/* Glassmorphism Login Card */}
                    <div className="p-8 rounded-xl shadow-[0_40px_80px_rgba(0,30,64,0.25)] flex flex-col gap-8 overflow-hidden relative" style={{
                        background: 'rgba(255, 255, 255, 0.7)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        borderTop: '1px solid rgba(167, 200, 255, 0.2)'
                    }}>
                        {/* Visual Accent */}
                        <div className="absolute top-0 left-0 w-1 h-full bg-[#006875]"></div>
                        
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00e3fd] text-[#00616d] uppercase tracking-wider">Internal System</span>
                            </div>
                            <h1 className="text-3xl font-headline font-extrabold text-[#001e40] tracking-tight leading-none">Stock Opname</h1>
                            <p className="text-[#43474f] text-sm font-medium">Silakan masuk menggunakan kredensial pegawai Anda.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3">
                                    <span className="material-symbols-outlined text-red-500">error</span>
                                    <span className="text-xs font-bold text-red-500">{error}</span>
                                </div>
                            )}

                            <div className="flex flex-col gap-5">
                                {/* ID Pegawai Field */}
                                <div className="flex flex-col gap-2">
                                    <label className="font-label text-xs font-semibold uppercase tracking-widest text-[#43474f] flex items-center gap-2" htmlFor="id_pegawai">USER NAME</label>
                                    <div className="relative group">
                                        <input 
                                            className="w-full bg-[#e6e8ea] border-none rounded-lg px-4 py-3.5 text-[#001e40] font-medium focus:ring-2 focus:ring-[#006875]/20 focus:bg-[#ffffff] transition-all duration-300 placeholder:text-[#737780]/50 outline-none" 
                                            id="id_pegawai" 
                                            name="id_pegawai" 
                                            placeholder="MBI-XXXX" 
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                {/* Sandi Field */}
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-end">
                                        <label className="font-label text-xs font-semibold uppercase tracking-widest text-[#43474f] flex items-center gap-2" htmlFor="sandi">
                                            <span className="material-symbols-outlined text-sm">lock</span>
                                            Sandi
                                        </label>
                                        <a className="text-[10px] font-bold text-[#006875] uppercase tracking-wider hover:underline" href="#">Lupa Sandi?</a>
                                    </div>
                                    <div className="relative group">
                                        <input 
                                            className="w-full bg-[#e6e8ea] border-none rounded-lg px-4 py-3.5 text-[#001e40] font-medium focus:ring-2 focus:ring-[#006875]/20 focus:bg-[#ffffff] transition-all duration-300 placeholder:text-[#737780]/50 outline-none" 
                                            id="sandi" 
                                            name="sandi" 
                                            placeholder="••••••••" 
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Remember Me Toggle */}
                            <div className="flex items-center gap-3">
                                <input className="w-4 h-4 rounded border-[#c3c6d1] text-[#006875] focus:ring-[#006875]" id="remember" type="checkbox" />
                                <label className="text-xs text-[#43474f] font-medium" htmlFor="remember">Ingat saya di perangkat ini</label>
                            </div>

                            {/* Submit Button */}
                            <button 
                                className="group relative flex items-center justify-center w-full bg-[#001e40] text-[#ffffff] font-headline font-bold text-sm py-4 rounded-lg transition-all duration-300 hover:bg-[#003366] shadow-lg active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed" 
                                type="submit"
                                disabled={loading || !username || !password}
                            >
                                <span className="absolute left-0 top-0 h-full w-[3px] bg-[#00daf3] rounded-l-lg opacity-0 group-hover:opacity-100 transition-opacity"></span>
                                <span className="flex items-center gap-2">
                                    {loading ? (
                                        <><span className="material-symbols-outlined animate-spin">sync</span> Memproses...</>
                                    ) : (
                                        <>Masuk Ke Dashboard <span className="material-symbols-outlined text-base">arrow_forward</span></>
                                    )}
                                </span>
                            </button>
                        </form>

                        {/* System Status / Security Note */}
                        <div className="pt-4 border-t border-[#c3c6d1]/15 flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-[#00daf3] animate-pulse"></div>
                            <span className="text-[10px] text-[#8c9cb5] font-medium uppercase tracking-tighter">Sistem Terenkripsi AES-256 Aktif</span>
                        </div>
                    </div>

                    {/* Secondary Information Grid */}
                    <div className="mt-8 grid grid-cols-2 gap-4">
                        <div className="bg-white/5 backdrop-blur-md p-4 rounded-lg border border-white/5">
                            <span className="material-symbols-outlined text-[#00daf3] mb-2">security</span>
                            <h3 className="text-white text-xs font-bold uppercase tracking-widest">Akses Aman</h3>
                            <p className="text-white/60 text-[10px] mt-1">Multi-factor authentication didukung untuk verifikasi lanjutan.</p>
                        </div>
                        <div className="bg-white/5 backdrop-blur-md p-4 rounded-lg border border-white/5">
                            <span className="material-symbols-outlined text-[#00daf3] mb-2">inventory_2</span>
                            <h3 className="text-white text-xs font-bold uppercase tracking-widest">Real-time Data</h3>
                            <p className="text-white/60 text-[10px] mt-1">Sinkronisasi stok obat dan peralatan medis secara instan.</p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer Anchor */}
            <footer className="w-full py-8 bg-[#f7f9fb] flex flex-col md:flex-row justify-between items-center px-10 gap-4 border-t border-[#c3c6d1]/10">
                <div className="text-[#006875] font-['Inter'] text-xs font-medium uppercase tracking-wider">
                    © 2026 PT Medika Bina Investama. All Rights Reserved.
                </div>
                <div className="flex gap-8">
                    <a className="text-[#43474f] font-['Inter'] text-xs font-medium uppercase tracking-wider hover:text-[#006875] transition-all opacity-80 hover:opacity-100" href="#">Privacy Policy</a>
                    <a className="text-[#43474f] font-['Inter'] text-xs font-medium uppercase tracking-wider hover:text-[#006875] transition-all opacity-80 hover:opacity-100" href="#">Terms of Service</a>
                    <a className="text-[#43474f] font-['Inter'] text-xs font-medium uppercase tracking-wider hover:text-[#006875] transition-all opacity-80 hover:opacity-100" href="#">Support</a>
                </div>
            </footer>

            {/* Background Pattern Decoration */}
            <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
                <svg className="absolute top-0 right-0 h-full w-auto text-[#001e40]/5" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <defs>
                        <pattern height="10" id="grid" patternUnits="userSpaceOnUse" width="10">
                            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.1"></path>
                        </pattern>
                    </defs>
                    <rect fill="url(#grid)" height="100" width="100"></rect>
                </svg>
            </div>
        </div>
    );
};

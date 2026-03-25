
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
    
    // State for sliding panel animation
    const [isRightPanelActive, setIsRightPanelActive] = useState(false);
    
    // State for request access form
    const [requestName, setRequestName] = useState('');
    const [requestDept, setRequestDept] = useState('');

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

    const handleRequestAccess = (e: React.FormEvent) => {
        e.preventDefault();
        const message = `Halo Administrator IT,\n\nSaya ingin meminta akses untuk sistem Stock Opname.\n\nNama Lengkap: ${requestName}\nDepartemen: ${requestDept}\n\nTerima kasih.`;
        const encodedMessage = encodeURIComponent(message);
        const waUrl = `https://api.whatsapp.com/send/?phone=6285283510952&text=${encodedMessage}&type=phone_number&app_absent=0&wame_ctl=1`;
        
        window.open(waUrl, '_blank');
        
        setRequestName('');
        setRequestDept('');
        setIsRightPanelActive(false);
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

                {/* Sliding Panel Container */}
                <div className="relative w-full max-w-[900px] h-[600px] bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_40px_80px_rgba(0,30,64,0.35)] overflow-hidden z-10 border-t border-white/40">
                    
                    {/* Sign In Form (Left Panel) */}
                    <div className={`absolute top-0 left-0 h-full w-1/2 transition-all duration-700 ease-in-out flex flex-col justify-center px-12 ${isRightPanelActive ? 'translate-x-[100%] opacity-0 z-10' : 'translate-x-0 opacity-100 z-20'}`}>
                        <div className="flex flex-col gap-2 mb-8">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00e3fd] text-[#00616d] uppercase tracking-wider">Internal System</span>
                            </div>
                            <h1 className="text-3xl font-headline font-extrabold text-[#001e40] tracking-tight leading-none">Stock Opname</h1>
                            <p className="text-[#43474f] text-sm font-medium">Masuk dengan kredensial Anda.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-3">
                                    <span className="material-symbols-outlined text-red-500">error</span>
                                    <span className="text-xs font-bold text-red-500">{error}</span>
                                </div>
                            )}

                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="font-label text-xs font-semibold uppercase tracking-widest text-[#43474f] flex items-center gap-2" htmlFor="id_pegawai">USER NAME</label>
                                    <input 
                                        className="w-full bg-[#e6e8ea] border-none rounded-lg px-4 py-3.5 text-[#001e40] font-medium focus:ring-2 focus:ring-[#006875]/20 focus:bg-[#ffffff] transition-all duration-300 placeholder:text-[#737780]/50 outline-none" 
                                        id="id_pegawai" 
                                        name="id_pegawai" 
                                        placeholder="MBI-XXXX" 
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-end">
                                        <label className="font-label text-xs font-semibold uppercase tracking-widest text-[#43474f] flex items-center gap-2" htmlFor="sandi">
                                            <span className="material-symbols-outlined text-sm">lock</span>
                                            Sandi
                                        </label>
                                        <a className="text-[10px] font-bold text-[#006875] uppercase tracking-wider hover:underline" href="#">Lupa Sandi?</a>
                                    </div>
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

                            <button 
                                className="group relative flex items-center justify-center w-full bg-[#001e40] text-[#ffffff] font-headline font-bold text-sm py-4 rounded-lg transition-all duration-300 hover:bg-[#003366] shadow-lg active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-2" 
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
                    </div>

                    {/* Sign Up / Request Access Form (Right Panel) */}
                    <div className={`absolute top-0 left-0 h-full w-1/2 transition-all duration-700 ease-in-out flex flex-col justify-center px-12 ${isRightPanelActive ? 'translate-x-[100%] opacity-100 z-20' : 'translate-x-[100%] opacity-0 z-10'}`}>
                        <div className="flex flex-col gap-2 mb-8">
                            <h1 className="text-3xl font-headline font-extrabold text-[#001e40] tracking-tight leading-none">Minta Akses</h1>
                            <p className="text-[#43474f] text-sm font-medium">Daftarkan diri Anda ke Administrator IT.</p>
                        </div>

                        <form onSubmit={handleRequestAccess} className="flex flex-col gap-5">
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="font-label text-xs font-semibold uppercase tracking-widest text-[#43474f] flex items-center gap-2">NAMA LENGKAP</label>
                                    <input 
                                        className="w-full bg-[#e6e8ea] border-none rounded-lg px-4 py-3.5 text-[#001e40] font-medium focus:ring-2 focus:ring-[#006875]/20 focus:bg-[#ffffff] transition-all duration-300 placeholder:text-[#737780]/50 outline-none" 
                                        placeholder="Nama Anda" 
                                        type="text"
                                        value={requestName}
                                        onChange={(e) => setRequestName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="font-label text-xs font-semibold uppercase tracking-widest text-[#43474f] flex items-center gap-2">DEPARTEMEN</label>
                                    <input 
                                        className="w-full bg-[#e6e8ea] border-none rounded-lg px-4 py-3.5 text-[#001e40] font-medium focus:ring-2 focus:ring-[#006875]/20 focus:bg-[#ffffff] transition-all duration-300 placeholder:text-[#737780]/50 outline-none" 
                                        placeholder="Gudang / Farmasi" 
                                        type="text"
                                        value={requestDept}
                                        onChange={(e) => setRequestDept(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            <button 
                                className="group relative flex items-center justify-center w-full bg-[#006875] text-[#ffffff] font-headline font-bold text-sm py-4 rounded-lg transition-all duration-300 hover:bg-[#004d57] shadow-lg active:scale-[0.98] mt-2" 
                                type="submit"
                            >
                                <span className="flex items-center gap-2">
                                    Kirim Permintaan <span className="material-symbols-outlined text-base">send</span>
                                </span>
                            </button>
                        </form>
                    </div>

                    {/* Overlay Container */}
                    <div className={`absolute top-0 left-1/2 w-1/2 h-full overflow-hidden transition-transform duration-700 ease-in-out z-[100] ${isRightPanelActive ? '-translate-x-full' : 'translate-x-0'}`}>
                        <div className={`bg-[#001e40] relative -left-full h-full w-[200%] transform transition-transform duration-700 ease-in-out ${isRightPanelActive ? 'translate-x-1/2' : 'translate-x-0'}`}
                            style={{
                                background: 'linear-gradient(135deg, #006875 0%, #001e40 100%)',
                                backgroundRepeat: 'no-repeat',
                                backgroundSize: 'cover',
                                backgroundPosition: '0 0'
                            }}>
                            
                            {/* Overlay Left (Visible when right panel active) */}
                            <div className={`absolute flex flex-col items-center justify-center px-12 text-center top-0 h-full w-1/2 transform transition-transform duration-700 ease-in-out ${isRightPanelActive ? 'translate-x-0' : '-translate-x-[20%]'}`}>
                                <Logo size={64} className="mb-6 opacity-80" />
                                <h1 className="text-4xl font-headline font-extrabold text-white mb-4 tracking-tight">Sudah Punya Akun?</h1>
                                <p className="text-white/80 mb-8 font-medium text-sm leading-relaxed">
                                    Silakan masuk menggunakan ID Pegawai dan Sandi Anda untuk mengakses sistem Stock Opname.
                                </p>
                                <button 
                                    onClick={() => setIsRightPanelActive(false)} 
                                    className="border-2 border-white/50 text-white px-10 py-3 rounded-lg font-bold uppercase tracking-widest hover:bg-white hover:text-[#001e40] transition-all duration-300"
                                >
                                    Masuk
                                </button>
                            </div>

                            {/* Overlay Right (Visible when left panel active) */}
                            <div className={`absolute right-0 flex flex-col items-center justify-center px-12 text-center top-0 h-full w-1/2 transform transition-transform duration-700 ease-in-out ${isRightPanelActive ? 'translate-x-[20%]' : 'translate-x-0'}`}>
                                <Logo size={64} className="mb-6 opacity-80" />
                                <h1 className="text-4xl font-headline font-extrabold text-white mb-4 tracking-tight">Belum Punya Akses?</h1>
                                <p className="text-white/80 mb-8 font-medium text-sm leading-relaxed">
                                    Hubungi Administrator IT atau kirim permintaan akses untuk menggunakan sistem Stock Opname.
                                </p>
                                <button 
                                    onClick={() => setIsRightPanelActive(true)} 
                                    className="border-2 border-white/50 text-white px-10 py-3 rounded-lg font-bold uppercase tracking-widest hover:bg-white hover:text-[#001e40] transition-all duration-300"
                                >
                                    Minta Akses
                                </button>
                            </div>
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



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
    
    // State for lamp animation
    const [isLampOn, setIsLampOn] = useState(false);
    
    // State to toggle between Login and Request Access
    const [showRequestAccess, setShowRequestAccess] = useState(false);
    
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
        setShowRequestAccess(false);
    };

    return (
        <div className="font-body bg-[#121418] text-white antialiased min-h-screen flex flex-col relative overflow-hidden transition-colors duration-700">
            {/* Top Navigation Anchor */}
            <header className="fixed top-0 w-full z-50 flex items-center justify-between px-6 h-16">
                <div className={`flex items-center gap-3 transition-opacity duration-700 ${isLampOn ? 'opacity-100' : 'opacity-30'}`}>
                    <Logo size={32} />
                    <span className="text-lg font-bold uppercase tracking-widest font-headline text-white">PT Medika Bina Investama</span>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-grow flex items-center justify-center relative w-full h-full">
                <style>{`
                    .light-beam {
                        background: linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.02) 50%, transparent 100%);
                        clip-path: polygon(35% 0, 65% 0, 100% 100%, 0 100%);
                    }
                    @media (min-width: 640px) {
                        .light-beam {
                            background: linear-gradient(90deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.02) 50%, transparent 100%);
                            clip-path: polygon(0 43%, 100% 0, 100% 100%, 0 57%);
                        }
                    }
                `}</style>
                
                {/* Lamp Container */}
                <div className="absolute top-16 left-1/2 -translate-x-1/2 sm:left-[10%] md:left-[20%] sm:top-1/2 sm:-translate-y-1/2 sm:translate-x-0 flex flex-col items-center z-20 scale-[0.6] sm:scale-100 origin-top sm:origin-left transition-all duration-700">
                    {/* Lamp Shade */}
                    <div className={`w-32 h-24 transition-colors duration-300 relative z-10 ${isLampOn ? 'bg-[#fef08a]' : 'bg-[#2a303c]'}`} 
                         style={{ clipPath: 'polygon(25% 0, 75% 0, 100% 100%, 0 100%)' }}>
                        {/* Inner glow when on */}
                        {isLampOn && <div className="absolute bottom-0 left-0 w-full h-4 bg-white/50 blur-sm"></div>}
                    </div>
                    
                    {/* Lamp Stand */}
                    <div className="w-2 h-48 bg-[#1a1d24]"></div>
                    
                    {/* Lamp Base */}
                    <div className="w-24 h-4 bg-[#1a1d24] rounded-t-lg"></div>
                    
                    {/* Pull String */}
                    <div 
                        className="absolute top-24 left-1/2 -translate-x-1/2 cursor-pointer group p-2 z-30"
                        onClick={() => setIsLampOn(!isLampOn)}
                    >
                        <div className={`w-0.5 bg-[#4a5568] mx-auto transition-all duration-300 ${isLampOn ? 'h-16' : 'h-12 group-hover:h-14'}`}></div>
                        <div className="w-3 h-3 bg-[#4a5568] rounded-full mx-auto -mt-1 shadow-sm"></div>
                    </div>
                    
                    {/* Light Beam */}
                    <div className={`absolute pointer-events-none transition-opacity duration-700 light-beam ${isLampOn ? 'opacity-100' : 'opacity-0'}
                        top-[96px] left-1/2 -translate-x-1/2 w-[1000px] h-[150vh] origin-top
                        sm:top-[96px] sm:left-1/2 sm:translate-x-0 sm:w-[150vw] sm:h-[1000px] sm:-translate-y-1/2 sm:origin-left
                    `}></div>
                </div>

                {/* Form Container */}
                <div className={`relative w-[90%] sm:w-full max-w-[360px] sm:max-w-md transition-all duration-1000 z-30 sm:ml-[20%] md:ml-[10%] mt-56 sm:mt-0 ${isLampOn ? 'opacity-100 translate-y-0 sm:translate-x-0' : 'opacity-0 translate-y-12 sm:translate-y-0 sm:translate-x-12 pointer-events-none'}`}>
                    
                    <div className="bg-[#1e232d]/80 backdrop-blur-xl p-6 sm:p-8 rounded-2xl shadow-2xl border border-white/10 relative overflow-hidden">
                        {/* Glow effect behind form */}
                        <div className="absolute -inset-4 bg-white/5 blur-2xl -z-10 rounded-full"></div>

                        {showRequestAccess ? (
                            // Request Access Form
                            <div className="animate-fade-in">
                                <div className="flex flex-col gap-2 mb-8">
                                    <h1 className="text-3xl font-headline font-extrabold text-white tracking-tight leading-none">Minta Akses</h1>
                                    <p className="text-slate-400 text-sm font-medium">Daftarkan diri Anda ke Administrator IT.</p>
                                </div>

                                <form onSubmit={handleRequestAccess} className="flex flex-col gap-5">
                                    <div className="flex flex-col gap-4">
                                        <div className="flex flex-col gap-2">
                                            <label className="font-label text-xs font-semibold uppercase tracking-widest text-slate-400">NAMA LENGKAP</label>
                                            <input 
                                                className="w-full bg-[#121418] border border-white/10 rounded-lg px-4 py-3.5 text-white font-medium focus:ring-2 focus:ring-[#00daf3]/50 focus:border-transparent transition-all duration-300 placeholder:text-slate-600 outline-none" 
                                                placeholder="Nama Anda" 
                                                type="text"
                                                value={requestName}
                                                onChange={(e) => setRequestName(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <label className="font-label text-xs font-semibold uppercase tracking-widest text-slate-400">DEPARTEMEN</label>
                                            <input 
                                                className="w-full bg-[#121418] border border-white/10 rounded-lg px-4 py-3.5 text-white font-medium focus:ring-2 focus:ring-[#00daf3]/50 focus:border-transparent transition-all duration-300 placeholder:text-slate-600 outline-none" 
                                                placeholder="Gudang / Farmasi" 
                                                type="text"
                                                value={requestDept}
                                                onChange={(e) => setRequestDept(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <button 
                                        className="group relative flex items-center justify-center w-full bg-[#00daf3] text-[#001e40] font-headline font-bold text-sm py-4 rounded-lg transition-all duration-300 hover:bg-white shadow-[0_0_20px_rgba(0,218,243,0.3)] active:scale-[0.98] mt-2" 
                                        type="submit"
                                    >
                                        <span className="flex items-center gap-2">
                                            Kirim Permintaan <span className="material-symbols-outlined text-base">send</span>
                                        </span>
                                    </button>
                                </form>

                                <div className="mt-6 text-center">
                                    <button 
                                        onClick={() => setShowRequestAccess(false)}
                                        className="text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider transition-colors"
                                    >
                                        Kembali ke Login
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // Login Form
                            <div className="animate-fade-in">
                                <div className="flex flex-col gap-2 mb-8">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00daf3]/20 text-[#00daf3] uppercase tracking-wider border border-[#00daf3]/30">Internal System</span>
                                    </div>
                                    <h1 className="text-3xl font-headline font-extrabold text-white tracking-tight leading-none">Stock Opname</h1>
                                    <p className="text-slate-400 text-sm font-medium">Masuk dengan kredensial Anda.</p>
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
                                            <label className="font-label text-xs font-semibold uppercase tracking-widest text-slate-400">USER NAME</label>
                                            <input 
                                                className="w-full bg-[#121418] border border-white/10 rounded-lg px-4 py-3.5 text-white font-medium focus:ring-2 focus:ring-[#00daf3]/50 focus:border-transparent transition-all duration-300 placeholder:text-slate-600 outline-none" 
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
                                                <label className="font-label text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-sm">lock</span>
                                                    Sandi
                                                </label>
                                            </div>
                                            <input 
                                                className="w-full bg-[#121418] border border-white/10 rounded-lg px-4 py-3.5 text-white font-medium focus:ring-2 focus:ring-[#00daf3]/50 focus:border-transparent transition-all duration-300 placeholder:text-slate-600 outline-none" 
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
                                        className="group relative flex items-center justify-center w-full bg-[#00daf3] text-[#001e40] font-headline font-bold text-sm py-4 rounded-lg transition-all duration-300 hover:bg-white shadow-[0_0_20px_rgba(0,218,243,0.3)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2" 
                                        type="submit"
                                        disabled={loading || !username || !password}
                                    >
                                        <span className="flex items-center gap-2">
                                            {loading ? (
                                                <><span className="material-symbols-outlined animate-spin">sync</span> Memproses...</>
                                            ) : (
                                                <>Masuk Ke Dashboard <span className="material-symbols-outlined text-base">arrow_forward</span></>
                                            )}
                                        </span>
                                    </button>
                                </form>

                                <div className="mt-6 text-center">
                                    <button 
                                        onClick={() => setShowRequestAccess(true)}
                                        className="text-xs font-bold text-slate-400 hover:text-white uppercase tracking-wider transition-colors"
                                    >
                                        Belum punya akses? Minta Akses
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
            
            {/* Click anywhere to turn on lamp if it's off (optional UX improvement) */}
            {!isLampOn && (
                <div 
                    className="absolute inset-0 z-10 cursor-pointer" 
                    onClick={() => setIsLampOn(true)}
                    title="Klik dimana saja untuk menyalakan lampu"
                ></div>
            )}
        </div>
    );
};


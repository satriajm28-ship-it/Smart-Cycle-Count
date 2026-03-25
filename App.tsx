
import React, { useState, useEffect } from 'react';
import { AppView, AppUser } from './types';
import { AuditForm } from './components/AuditForm';
import { Dashboard } from './components/Dashboard';
import { MasterData } from './components/MasterData';
import { ActivityLogs } from './components/ActivityLogs';
import { DamagedReport } from './components/DamagedReport';
import { WMSIntegration } from './components/WMSIntegration';
import { UserManagement } from './components/UserManagement';
import { Logo } from './components/Logo';
import { Login } from './components/Login'; // Import Login
import { auth } from './services/firebaseConfig';
import * as firebaseAuth from 'firebase/auth';
import { setPermissionErrorHandler } from './services/storageService';
import { Home, ClipboardList, Database, Activity } from 'lucide-react';
import { getSessionUser, clearSessionUser, bootstrapUsers } from './services/authService';

const { onAuthStateChanged, signInAnonymously } = firebaseAuth as any;

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [navParams, setNavParams] = useState<any>(null);
  
  // Authentication State
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    let mounted = true;

    // 1. Check for existing session on load
    const savedUser = getSessionUser();
    if (savedUser) {
        setCurrentUser(savedUser);
    }

    // 2. Network Listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 3. Permission Handler
    setPermissionErrorHandler((err) => {
        if (mounted && err.code === 'permission-denied') {
            console.warn("Permission denied error detected:", err);
        }
    });

    // 4. Firebase Anonymous Auth (Background)
    const unsubscribe = onAuthStateChanged(auth, (user: any) => {
      if (user) {
        if (mounted) {
            setIsFirebaseConnected(true);
            // Bootstrap users once connected
            bootstrapUsers();
        }
      } else {
        signInAnonymously(auth)
            .catch((error: any) => {
                console.warn("Firebase Auth background connection skipped:", error.code);
                if (mounted) {
                    setIsFirebaseConnected(true); 
                    // Bootstrap users anyway in public mode
                    bootstrapUsers();
                }
            });
      }
    });

    return () => {
        mounted = false;
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        unsubscribe();
    };
  }, []);

  const navigate = (newView: AppView, params?: any) => {
    setNavParams(params);
    setView(newView);
  };

  const handleLoginSuccess = (user: AppUser) => {
      setCurrentUser(user);
      setView(AppView.DASHBOARD);
  };

  const handleLogout = () => {
      clearSessionUser();
      setCurrentUser(null);
      // Optional: also sign out of Firebase if strict rule enforcement needed, 
      // but usually keeping anon auth active for next login is faster.
  };

  // 1. Show Splash/Loading if Firebase connecting
  if (!isFirebaseConnected) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#050A18] text-white gap-8">
            <div className="relative animate-pulse">
                <Logo size={180} />
            </div>
            <div className="text-center space-y-2">
                <h1 className="text-4xl font-black uppercase tracking-widest">Monitoring</h1>
                <p className="text-lg font-bold text-slate-400 tracking-wider">MEDIKA BINA INVESTAMA</p>
            </div>
            <div className="flex flex-col items-center gap-2 mt-8">
                <span className="material-symbols-outlined animate-spin text-2xl text-primary">sync</span>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-tighter">Establishing Connection...</p>
            </div>
        </div>
    );
  }

  // 2. Show Login Screen if not logged in locally
  if (!currentUser) {
      return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // 3. Main App
  const navItems = [
    { id: AppView.DASHBOARD, icon: Home, label: 'Beranda' },
    { id: AppView.FORM, icon: ClipboardList, label: 'Audit Fisik' },
    { id: AppView.MASTER_DATA, icon: Database, label: 'Database' },
    { id: AppView.ACTIVITIES, icon: Activity, label: 'Aktivitas' },
  ];
  const activeIndex = navItems.findIndex(item => item.id === view);

  return (
    <div className="min-h-screen bg-[#f6f6f8] relative">
        <style>{`
            .magic-indicator {
                position: absolute;
                top: -24px;
                width: 64px;
                height: 64px;
                background-color: #00A3FF;
                border-radius: 50%;
                border: 6px solid #f6f6f8;
                transition: left 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
                z-index: 0;
            }
            .magic-indicator::before {
                content: '';
                position: absolute;
                top: 50%;
                left: -22px;
                width: 20px;
                height: 20px;
                background: transparent;
                border-top-right-radius: 20px;
                box-shadow: 1px -10px 0 0 #f6f6f8;
            }
            .magic-indicator::after {
                content: '';
                position: absolute;
                top: 50%;
                right: -22px;
                width: 20px;
                height: 20px;
                background: transparent;
                border-top-left-radius: 20px;
                box-shadow: -1px -10px 0 0 #f6f6f8;
            }
        `}</style>
        <div className="fixed top-4 right-4 z-[200] pointer-events-none flex flex-col items-end justify-center opacity-90 select-none transition-all">
             {/* Network Status Indicator */}
             <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full backdrop-blur-md shadow-sm border ${isOnline ? 'bg-emerald-50/90 border-emerald-200/50 dark:bg-emerald-900/30 dark:border-emerald-800/50' : 'bg-red-50/90 border-red-200/50 dark:bg-red-900/30 dark:border-red-800/50'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]'}`}></div>
                <span className={`text-[9px] font-bold uppercase tracking-widest ${isOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {isOnline ? 'System Online' : 'Offline Mode'}
                </span>
             </div>
        </div>

        <div className="relative z-10 pb-20">
            {view === AppView.DASHBOARD && (
                <Dashboard 
                    onNavigate={navigate} 
                    currentUser={currentUser}
                    onLogout={handleLogout}
                />
            )}
            
            {view === AppView.DAMAGED_REPORT && (
                <div className="animate-fade-in">
                    <DamagedReport onNavigate={navigate} />
                </div>
            )}
            
            {view === AppView.FORM && (
                <div className="animate-fade-in">
                    <AuditForm 
                        onSuccess={() => navigate(AppView.DASHBOARD)} 
                        initialLocation={navParams?.initialLocation}
                    />
                </div>
            )}

            {view === AppView.USER_MANAGEMENT && (
                <UserManagement onBack={() => setView(AppView.DASHBOARD)} />
            )}

            {view === AppView.MASTER_DATA && (
                <div className="p-4 md:p-8 animate-fade-in relative">
                    <MasterData currentUser={currentUser} />
                </div>
            )}

            {view === AppView.WMS_INTEGRATION && (
                <div className="p-4 md:p-8 animate-fade-in relative">
                    <WMSIntegration />
                </div>
            )}

            {view === AppView.ACTIVITIES && (
                <div className="animate-fade-in">
                    <ActivityLogs />
                </div>
            )}
        </div>

        {/* Bottom Navigation Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.2)] z-[130] pb-[env(safe-area-inset-bottom)]">
            <div className="relative flex w-full h-[72px]">
                {/* Magic Indicator */}
                <div 
                    className="magic-indicator"
                    style={{ 
                        left: `calc(${activeIndex * 25}% + 12.5% - 32px)`,
                    }}
                ></div>

                {navItems.map((item) => {
                    const isActive = view === item.id;
                    const Icon = item.icon;
                    return (
                        <button 
                            key={item.id}
                            onClick={() => navigate(item.id)}
                            className="relative flex-1 flex flex-col items-center justify-center z-10 h-full cursor-pointer"
                        >
                            <div className={`transition-transform duration-500 ease-in-out ${isActive ? '-translate-y-[22px] text-white' : 'translate-y-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                            <span className={`absolute bottom-3 text-[10px] font-bold transition-all duration-500 ease-in-out ${isActive ? 'opacity-100 translate-y-0 text-primary' : 'opacity-0 translate-y-4'}`}>
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    </div>
  );
};

export default App;

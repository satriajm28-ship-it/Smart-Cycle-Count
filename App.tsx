
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
  return (
    <div className="min-h-screen bg-[#f6f6f8] relative">
        <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-[120] pointer-events-none flex flex-col items-center justify-center opacity-80 select-none transition-all">
             {/* Network Status Indicator */}
             <div className={`flex items-center gap-1.5 mb-1 px-2 py-0.5 rounded-full backdrop-blur-sm ${isOnline ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]'}`}></div>
                <span className={`text-[8px] font-bold uppercase tracking-widest ${isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                    {isOnline ? 'System Online' : 'Offline Mode'}
                </span>
             </div>
             
             <div className="opacity-40 flex flex-col items-center">
                 <span className="text-[8px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest drop-shadow-sm leading-tight">Version Beta</span>
                 <span className="text-[7px] font-bold text-slate-400 dark:text-slate-500 italic leading-tight">powered by Satria JM</span>
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
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.2)] z-[130] px-6 py-3 flex justify-around items-center pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <button 
                onClick={() => navigate(AppView.DASHBOARD)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${view === AppView.DASHBOARD ? 'text-primary scale-110' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
                <Home size={24} strokeWidth={view === AppView.DASHBOARD ? 2.5 : 2} />
                <span className="text-[10px] font-bold">Beranda</span>
            </button>
            <button 
                onClick={() => navigate(AppView.FORM)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${view === AppView.FORM ? 'text-primary scale-110' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
                <ClipboardList size={24} strokeWidth={view === AppView.FORM ? 2.5 : 2} />
                <span className="text-[10px] font-bold">Audit Fisik</span>
            </button>
            <button 
                onClick={() => navigate(AppView.MASTER_DATA)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${view === AppView.MASTER_DATA ? 'text-primary scale-110' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
                <Database size={24} strokeWidth={view === AppView.MASTER_DATA ? 2.5 : 2} />
                <span className="text-[10px] font-bold">Database</span>
            </button>
            <button 
                onClick={() => navigate(AppView.ACTIVITIES)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${view === AppView.ACTIVITIES ? 'text-primary scale-110' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
                <Activity size={24} strokeWidth={view === AppView.ACTIVITIES ? 2.5 : 2} />
                <span className="text-[10px] font-bold">Aktivitas</span>
            </button>
        </div>
    </div>
  );
};

export default App;

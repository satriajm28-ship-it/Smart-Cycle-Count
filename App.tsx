
import React, { useState, useEffect } from 'react';
import { AppView } from './types';
import { AuditForm } from './components/AuditForm';
import { Dashboard } from './components/Dashboard';
import { MasterData } from './components/MasterData';
import { LocationChecklist } from './components/LocationChecklist';
import { DamagedReport } from './components/DamagedReport';
import { auth } from './services/firebaseConfig';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { setPermissionErrorHandler } from './services/storageService';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [navParams, setNavParams] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasPermissionError, setHasPermissionError] = useState(false);
  const [showSetupHelper, setShowSetupHelper] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Listen for global permission errors from storageService
    setPermissionErrorHandler((err) => {
        if (mounted && err.code === 'permission-denied') {
            setHasPermissionError(true);
        }
    });

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (mounted) setIsAuthenticated(true);
      } else {
        signInAnonymously(auth)
            .catch((error) => {
                console.warn("Auth check failed:", error.message);
                if (mounted) {
                    setIsAuthenticated(true); 
                    if (error.code === 'auth/configuration-not-found' || error.code === 'auth/operation-not-allowed') {
                        setHasPermissionError(true);
                    }
                }
            });
      }
    });
    return () => {
        mounted = false;
        unsubscribe();
    };
  }, []);

  const navigate = (newView: AppView, params?: any) => {
    setNavParams(params);
    setView(newView);
  };

  if (!isAuthenticated) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#f6f6f8] text-slate-500 gap-3">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">security</span>
            <p className="font-medium animate-pulse">Establishing Connection...</p>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f6f8] relative">
        {/* Connection Warning Banner */}
        {hasPermissionError && (
            <div className="bg-amber-600 text-white px-4 py-2 text-[10px] sm:text-xs font-bold text-center sticky top-0 z-[100] flex items-center justify-center gap-2 shadow-lg">
                <span className="material-symbols-outlined text-sm">database_off</span>
                <span>Database Restricted: Rules Update Required.</span>
                <button 
                    onClick={() => setShowSetupHelper(true)} 
                    className="ml-2 bg-white text-amber-700 px-3 py-1 rounded-full text-[9px] uppercase tracking-tighter hover:bg-amber-50 transition-colors"
                >
                    Fix Permissions
                </button>
            </div>
        )}

        {/* WATERMARK */}
        <div className="fixed bottom-20 left-0 right-0 flex justify-center pointer-events-none z-0">
            <div className="bg-slate-200/50 dark:bg-slate-800/50 px-3 py-1 rounded-full backdrop-blur-[2px]">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600">
                    Version Beta <span className="mx-1 text-slate-300">•</span> powered by Satria JM
                </p>
            </div>
        </div>

        {/* Setup Helper Modal */}
        {showSetupHelper && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
                <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                    <div className="bg-primary p-6 text-white flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined">admin_panel_settings</span>
                                Firestore Setup Required
                            </h2>
                            <p className="text-blue-100 text-xs mt-1">Selesaikan konfigurasi Firebase Anda agar data dapat tersinkronisasi antar perangkat.</p>
                        </div>
                        <button onClick={() => setShowSetupHelper(false)} className="bg-white/20 p-2 rounded-full hover:bg-white/30">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto space-y-6">
                        <div className="space-y-3">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                                <span className="bg-slate-100 dark:bg-slate-800 w-6 h-6 rounded-full flex items-center justify-center text-[10px]">1</span>
                                Aktifkan Anonymous Auth
                            </h3>
                            <p className="text-xs text-slate-600 dark:text-slate-400 ml-8 leading-relaxed">
                                Buka <b>Authentication &gt; Settings &gt; Sign-in method</b>. Klik <b>Add new provider</b>, pilih <b>Anonymous</b>, dan klik <b>Enable</b>.
                            </p>
                        </div>

                        <div className="space-y-3">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                                <span className="bg-slate-100 dark:bg-slate-800 w-6 h-6 rounded-full flex items-center justify-center text-[10px]">2</span>
                                Update Firestore Security Rules
                            </h3>
                            <p className="text-xs text-slate-600 dark:text-slate-400 ml-8 leading-relaxed">
                                Buka <b>Firestore Database &gt; Rules</b>. Ganti kode yang ada dengan kode di bawah ini:
                            </p>
                            <div className="ml-8 bg-slate-950 text-emerald-400 p-4 rounded-xl font-mono text-[10px] sm:text-xs overflow-x-auto relative group">
                                <pre>{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`}</pre>
                                <button 
                                    onClick={() => {
                                        navigator.clipboard.writeText(`rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if request.auth != null;\n    }\n  }\n}`);
                                        alert("Rules copied to clipboard!");
                                    }}
                                    className="absolute top-2 right-2 bg-white/10 p-2 rounded-lg hover:bg-white/20 text-white"
                                >
                                    <span className="material-symbols-outlined text-sm">content_copy</span>
                                </button>
                            </div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 rounded-xl">
                            <p className="text-[10px] text-blue-700 dark:text-blue-300 font-medium leading-relaxed">
                                <b>Mengapa ini terjadi?</b> Google Firebase secara default memblokir semua akses database untuk keamanan. Kode di atas mengizinkan aplikasi (melalui login anonim) untuk menyimpan data Stock Opname Anda.
                            </p>
                        </div>
                    </div>

                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row gap-3">
                        <a 
                            href="https://console.firebase.google.com/project/smart-cycle-count/firestore/rules" 
                            target="_blank" 
                            className="flex-1 bg-primary text-white text-center py-3 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                        >
                            Open Firebase Console <span className="material-symbols-outlined text-sm">open_in_new</span>
                        </a>
                        <button 
                            onClick={() => setShowSetupHelper(false)}
                            className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors text-sm"
                        >
                            Lanjutkan Mode Lokal
                        </button>
                    </div>
                </div>
            </div>
        )}

        <div className="relative z-10">
            {view === AppView.DASHBOARD && <Dashboard onNavigate={navigate} />}
            
            {view === AppView.LOCATION_CHECKLIST && (
                <div className="animate-fade-in">
                    <LocationChecklist onNavigate={navigate} />
                </div>
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

            {view === AppView.MASTER_DATA && (
                <div className="p-4 md:p-8 animate-fade-in relative">
                    <button 
                        onClick={() => navigate(AppView.DASHBOARD)}
                        className="mb-4 flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold text-sm"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                        Back to Dashboard
                    </button>
                    <MasterData />
                </div>
            )}
        </div>
    </div>
  );
};

export default App;

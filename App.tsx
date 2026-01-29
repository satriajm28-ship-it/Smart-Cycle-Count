
import React, { useState, useEffect } from 'react';
import { AppView } from './types';
import { AuditForm } from './components/AuditForm';
import { Dashboard } from './components/Dashboard';
import { MasterData } from './components/MasterData';
import { LocationChecklist } from './components/LocationChecklist';
import { DamagedReport } from './components/DamagedReport';
import { auth } from './services/firebaseConfig';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [navParams, setNavParams] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (mounted) setIsAuthenticated(true);
      } else {
        // Attempt anonymous sign-in
        signInAnonymously(auth)
            .then(() => {
                // Success is handled by the onAuthStateChanged listener
            })
            .catch((error) => {
                console.warn("Authentication failed (App may work if rules are public):", error);
                if (mounted) {
                    // Treat as authenticated to unblock UI
                    // This handles 'auth/configuration-not-found' by letting the app try to fetch data anyway
                    setIsAuthenticated(true); 
                }
            });
      }
    });
    return () => {
        mounted = false;
        unsubscribe();
    };
  }, []);

  // Navigation handler
  const navigate = (newView: AppView, params?: any) => {
    setNavParams(params);
    setView(newView);
  };

  if (!isAuthenticated) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#f6f6f8] text-slate-500 gap-3">
            <span className="material-symbols-outlined animate-spin text-4xl text-primary">security</span>
            <p className="font-medium animate-pulse">Authenticating...</p>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f6f8]">
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
                 <button 
                    onClick={() => navigate(AppView.DASHBOARD)}
                    className="fixed bottom-4 left-4 z-50 bg-white/80 p-2 rounded-full shadow-md text-slate-500 md:hidden"
                 >
                    <span className="text-xs">Cancel</span>
                 </button>
            </div>
        )}

        {view === AppView.MASTER_DATA && (
            <div className="p-4 md:p-8 animate-fade-in relative">
                 <button 
                    onClick={() => navigate(AppView.DASHBOARD)}
                    className="mb-4 flex items-center gap-2 text-slate-600 hover:text-slate-900"
                 >
                    <span className="material-symbols-outlined">arrow_back</span>
                    Back to Dashboard
                 </button>
                <MasterData />
            </div>
        )}
    </div>
  );
};

export default App;
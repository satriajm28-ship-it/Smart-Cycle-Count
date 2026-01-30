
import React, { useState, useEffect, useRef } from 'react';
import { MasterLocation, AppView } from '../types';
import { getMasterLocations, getLocationStates, updateLocationStatus } from '../services/storageService';
import { ScannerModal } from './ScannerModal';

interface LocationChecklistProps {
  onNavigate: (view: AppView, params?: any) => void;
}

export const LocationChecklist: React.FC<LocationChecklistProps> = ({ onNavigate }) => {
  const [locations, setLocations] = useState<MasterLocation[]>([]);
  const [locationStates, setLocationStates] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [loading, setLoading] = useState(true);

  // Scanner State
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Damage Reporting State
  const [isDamageModalOpen, setIsDamageModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [damageDescription, setDamageDescription] = useState('');
  const [damagePhoto, setDamagePhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshData = async () => {
      setLoading(true);
      const [locs, states] = await Promise.all([
          getMasterLocations(),
          getLocationStates()
      ]);
      setLocations(locs);
      setLocationStates(states);
      setLoading(false);
  };

  useEffect(() => {
    refreshData();
  }, []);

  const pendingLocations = locations.filter(loc => {
      const state = locationStates[loc.name];
      if (!state) return true; 
      
      const hasIssues = (state.description && state.description.trim() !== '') || state.photoUrl;
      return hasIssues; 
  });

  const completedLocations = locations.filter(loc => {
      const state = locationStates[loc.name];
      if (!state) return false;
      
      const hasIssues = (state.description && state.description.trim() !== '') || state.photoUrl;
      return !hasIssues; 
  });

  const totalLocations = locations.length;
  const completedCount = completedLocations.length;
  const progressPercentage = totalLocations > 0 ? Math.round((completedCount / totalLocations) * 100) : 0;

  // --- Handlers ---

  const handleScanSuccess = (decodedText: string) => {
      setIsScannerOpen(false);
      onNavigate(AppView.FORM, { initialLocation: decodedText.toUpperCase() });
  };

  const handleMarkEmpty = async (locationName: string) => {
    if (confirm(`Mark ${locationName} as Empty?`)) {
        await updateLocationStatus(locationName, 'empty');
        refreshData();
    }
  };

  const openDamageModal = (locationName: string) => {
      setSelectedLocation(locationName);
      setDamageDescription('');
      setDamagePhoto(null);
      setIsDamageModalOpen(true);
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setDamagePhoto(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };

  const submitDamageReport = async () => {
      if (!selectedLocation) return;
      if (!damageDescription) {
          alert("Please provide a description of the damage.");
          return;
      }
      await updateLocationStatus(selectedLocation, 'damaged', {
          photoUrl: damagePhoto || undefined,
          description: damageDescription,
          teamMember: 'Current Team' 
      });
      setIsDamageModalOpen(false);
      refreshData();
  };

  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen text-slate-500 gap-3">
              <span className="material-symbols-outlined animate-spin text-4xl">sync</span>
              <p>Loading locations...</p>
          </div>
      );
  }

  return (
    <div className="bg-[#f6f6f8] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen pb-24 font-display flex flex-col relative">
      
      <ScannerModal 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        onScanSuccess={handleScanSuccess} 
        title="Scan Lokasi Rak"
      />

      {/* Header */}
      <nav className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
        <button onClick={() => onNavigate(AppView.DASHBOARD)} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-center flex-1 text-slate-900 dark:text-white">Location Checklist</h1>
        <button onClick={() => setIsScannerOpen(true)} className="flex items-center justify-center w-10 h-10 rounded-full text-primary hover:bg-primary/10">
          <span className="material-symbols-outlined">qr_code_scanner</span>
        </button>
      </nav>

      {/* Progress Widget */}
      <div className="px-4 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="flex justify-between items-end mb-2">
              <div>
                  <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Audit Progress</h2>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{completedCount} of {totalLocations} clear</p>
              </div>
              <span className="text-xl font-black text-primary">{progressPercentage}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500 ease-out rounded-full shadow-[0_0_8px_rgba(19,91,236,0.3)]"
                style={{ width: `${progressPercentage}%` }}
              ></div>
          </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-16 z-30">
        <button 
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'pending' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          Pending / Issues ({pendingLocations.length})
        </button>
        <button 
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'completed' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          Clean ({completedLocations.length})
        </button>
      </div>

      {/* List Content */}
      <main className="flex-1 p-4 overflow-y-auto">
          {activeTab === 'pending' && (
              <div className="flex flex-col gap-3">
                  {pendingLocations.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
                          <span className="material-symbols-outlined text-4xl mb-2 text-emerald-500">check_circle</span>
                          <p className="text-sm">Audit Lokasi Selesai & Bersih!</p>
                      </div>
                  ) : (
                      pendingLocations.map(loc => {
                          const state = locationStates[loc.name];
                          const hasIssue = state && ((state.description && state.description.trim() !== '') || state.photoUrl);
                          
                          return (
                            <div key={loc.id} className={`bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border ${hasIssue ? 'border-red-200 dark:border-red-900/50 bg-red-50/20' : 'border-slate-200 dark:border-slate-800'} flex flex-col gap-3 transition-all`}>
                                <div className="flex justify-between items-start border-b border-slate-50 dark:border-slate-800 pb-2">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                            {loc.name}
                                            {hasIssue && <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[8px] font-bold uppercase tracking-tighter">Issue Review</span>}
                                        </h3>
                                        <span className="text-[10px] text-slate-400 font-medium bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded mt-1 inline-block uppercase">{loc.zone}</span>
                                        {state?.description && (
                                            <p className="text-[10px] text-red-600 mt-2 font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded-lg italic">"{state.description}"</p>
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => onNavigate(AppView.FORM, { initialLocation: loc.name })}
                                        className="ml-3 bg-primary text-white hover:bg-primary/90 transition-all p-3 rounded-xl flex items-center shadow-lg shadow-primary/20"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleMarkEmpty(loc.name)}
                                        className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors uppercase"
                                    >
                                        Mark Empty
                                    </button>
                                    <button 
                                        onClick={() => openDamageModal(loc.name)}
                                        className="flex-1 py-2 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors uppercase"
                                    >
                                        Report Issue
                                    </button>
                                </div>
                            </div>
                          );
                      })
                  )}
              </div>
          )}

          {activeTab === 'completed' && (
              <div className="flex flex-col gap-3">
                  {completedLocations.map(loc => {
                      const status = locationStates[loc.name]?.status;
                      let statusClass = "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/50";
                      let icon = "check_circle";

                      if (status === 'empty') {
                          statusClass = "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700";
                          icon = "check_box_outline_blank";
                      }

                      return (
                        <div key={loc.id} className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 flex justify-between items-center transition-all">
                            <div>
                                <h3 className="font-bold text-slate-700 dark:text-slate-200">{loc.name}</h3>
                                <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                                    <span className="uppercase">{loc.zone}</span>
                                    <span>•</span>
                                    <span className="text-[8px]">{new Date(locationStates[loc.name]?.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                </div>
                            </div>
                            <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-widest ${statusClass}`}>
                                <span className="material-symbols-outlined text-[14px]">{icon}</span>
                                {status}
                            </div>
                        </div>
                      );
                  })}
              </div>
          )}
      </main>

      {isDamageModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
                  <div className="bg-red-600 p-4 text-white flex justify-between items-center">
                      <h3 className="font-bold text-lg flex items-center gap-2">
                          <span className="material-symbols-outlined">broken_image</span>
                          Report Issue
                      </h3>
                      <button onClick={() => setIsDamageModalOpen(false)} className="hover:bg-red-700 rounded-full p-1">
                          <span className="material-symbols-outlined">close</span>
                      </button>
                  </div>
                  <div className="p-4 space-y-4">
                      <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Location</label>
                          <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg font-mono font-bold text-slate-700 dark:text-slate-200">
                              {selectedLocation}
                          </div>
                      </div>
                      <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Catatan Issue</label>
                          <textarea 
                            value={damageDescription}
                            onChange={(e) => setDamageDescription(e.target.value)}
                            placeholder="Deskripsikan masalah (misal: rak rusak, label hilang...)"
                            className="w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm p-3 h-24"
                          ></textarea>
                      </div>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                      <button onClick={() => setIsDamageModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                          Cancel
                      </button>
                      <button onClick={submitDamageReport} className="flex-[2] py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 hover:bg-red-700 active:scale-95 transition-all">
                          Submit Issue
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

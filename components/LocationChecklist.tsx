
import React, { useState, useEffect, useRef } from 'react';
import { MasterLocation, AppView } from '../types';
import { getMasterLocations, getLocationStates, updateLocationStatus } from '../services/storageService';

interface LocationChecklistProps {
  onNavigate: (view: AppView, params?: any) => void;
}

export const LocationChecklist: React.FC<LocationChecklistProps> = ({ onNavigate }) => {
  const [locations, setLocations] = useState<MasterLocation[]>([]);
  const [locationStates, setLocationStates] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [loading, setLoading] = useState(true);

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

  // Filter Logic:
  // Pending includes:
  // 1. Not touched yet (no state)
  // 2. Marked 'damaged'
  // 3. Audited but has NOTES or PHOTO (needs review)
  const pendingLocations = locations.filter(loc => {
      const state = locationStates[loc.name];
      if (!state) return true; // Belum diaudit sama sekali
      
      const hasIssues = (state.description && state.description.trim() !== '') || state.photoUrl;
      return hasIssues; // Masuk pending jika ada catatan/foto
  });

  // Completed includes:
  // 1. Audited AND No Notes AND No Photo
  // 2. Empty AND No Notes
  const completedLocations = locations.filter(loc => {
      const state = locationStates[loc.name];
      if (!state) return false;
      
      const hasIssues = (state.description && state.description.trim() !== '') || state.photoUrl;
      return !hasIssues; // Hanya masuk completed jika bersih (tidak ada catatan/foto)
  });

  // Statistics
  const totalLocations = locations.length;
  // Progress is strictly clean audits vs total
  const completedCount = completedLocations.length;
  const progressPercentage = totalLocations > 0 ? Math.round((completedCount / totalLocations) * 100) : 0;

  // --- Handlers ---

  const handleScanLocation = (locationName: string) => {
      onNavigate(AppView.FORM, { initialLocation: locationName });
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
      if (!damagePhoto) {
          if (!confirm("No photo evidence provided. Submit anyway?")) return;
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
    <div className="bg-[#f6f6f8] text-slate-900 min-h-screen pb-24 font-display flex flex-col relative">
      
      {/* Header */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <button onClick={() => onNavigate(AppView.DASHBOARD)} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 transition-colors text-slate-700">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-center flex-1 text-slate-900">Location Checklist</h1>
        <div className="w-10"></div> 
      </nav>

      {/* Progress Widget */}
      <div className="px-4 py-4 bg-white border-b border-slate-200">
          <div className="flex justify-between items-end mb-2">
              <div>
                  <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Audit Progress</h2>
                  <p className="text-xs text-slate-500">{completedCount} of {totalLocations} locations clear</p>
              </div>
              <span className="text-2xl font-black text-primary">{progressPercentage}%</span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
                style={{ width: `${progressPercentage}%` }}
              ></div>
          </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white sticky top-16 z-30">
        <button 
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'pending' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          Pending / Issues ({pendingLocations.length})
        </button>
        <button 
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${activeTab === 'completed' ? 'border-primary text-primary' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          Clean ({completedLocations.length})
        </button>
      </div>

      {/* List Content */}
      <main className="flex-1 p-4 overflow-y-auto">
          {activeTab === 'pending' && (
              <div className="flex flex-col gap-3">
                  {pendingLocations.length === 0 ? (
                      <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-100">
                          <span className="material-symbols-outlined text-4xl mb-2">check_circle</span>
                          <p>All locations audited & clear!</p>
                      </div>
                  ) : (
                      pendingLocations.map(loc => {
                          const state = locationStates[loc.name];
                          // Check if it's pending because of an issue
                          const hasIssue = state && ((state.description && state.description.trim() !== '') || state.photoUrl);
                          
                          return (
                            <div key={loc.id} className={`bg-white rounded-xl p-4 shadow-sm border ${hasIssue ? 'border-red-200 bg-red-50/50' : 'border-slate-200'} flex flex-col gap-3`}>
                                <div className="flex justify-between items-start border-b border-slate-50 pb-2">
                                    <div>
                                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                            {loc.name}
                                            {hasIssue && <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold uppercase">Review Needed</span>}
                                        </h3>
                                        <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded mt-1 inline-block">{loc.zone}</span>
                                        {state?.description && (
                                            <p className="text-xs text-red-600 mt-1 italic">"{state.description}"</p>
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => handleScanLocation(loc.name)}
                                        className="bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors px-3 py-1.5 rounded-lg flex items-center gap-1 text-sm font-bold"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
                                        {hasIssue ? 'Re-Audit' : 'Scan'}
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => handleMarkEmpty(loc.name)}
                                        className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">check_box_outline_blank</span>
                                        Mark Empty
                                    </button>
                                    <button 
                                        onClick={() => openDamageModal(loc.name)}
                                        className="flex-1 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">broken_image</span>
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
                      let statusClass = "bg-green-100 text-green-700 border-green-200";
                      let icon = "check_circle";

                      if (status === 'empty') {
                          statusClass = "bg-slate-100 text-slate-600 border-slate-200";
                          icon = "check_box_outline_blank";
                      }

                      return (
                        <div key={loc.id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex justify-between items-center opacity-75 hover:opacity-100 transition-opacity">
                            <div>
                                <h3 className="font-bold text-slate-700">{loc.name}</h3>
                                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                                    <span>{loc.zone}</span>
                                    <span>•</span>
                                    <span>{new Date(locationStates[loc.name]?.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                </div>
                            </div>
                            <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 text-xs font-bold uppercase ${statusClass}`}>
                                <span className="material-symbols-outlined text-[16px]">{icon}</span>
                                {status}
                            </div>
                        </div>
                      );
                  })}
              </div>
          )}
      </main>

      {/* DAMAGED REPORT MODAL */}
      {isDamageModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
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
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Location</label>
                          <div className="bg-slate-100 p-2 rounded-lg font-mono font-bold text-slate-700">
                              {selectedLocation}
                          </div>
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description (Catatan)</label>
                          <textarea 
                            value={damageDescription}
                            onChange={(e) => setDamageDescription(e.target.value)}
                            placeholder="Describe the issue (e.g. Broken rack, missing tag, crushed box...)"
                            className="w-full rounded-lg border-slate-300 focus:ring-red-500 focus:border-red-500 text-sm p-3 h-24"
                          ></textarea>
                      </div>

                      <div>
                           <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Evidence Photo</label>
                           <input 
                                type="file" 
                                accept="image/*" 
                                capture="environment"
                                ref={fileInputRef}
                                onChange={handlePhotoCapture}
                                className="hidden"
                           />
                           
                           {!damagePhoto ? (
                               <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full h-32 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 hover:border-red-300 hover:text-red-500 transition-colors"
                               >
                                   <span className="material-symbols-outlined text-4xl mb-1">add_a_photo</span>
                                   <span className="text-xs font-bold uppercase">Tap to Take Photo</span>
                               </button>
                           ) : (
                               <div className="relative w-full h-48 rounded-xl overflow-hidden group">
                                   <img src={damagePhoto} alt="Evidence" className="w-full h-full object-cover" />
                                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                       <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md"
                                       >
                                           <span className="material-symbols-outlined">edit</span>
                                       </button>
                                       <button 
                                        onClick={() => setDamagePhoto(null)}
                                        className="bg-red-600/80 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur-md"
                                       >
                                           <span className="material-symbols-outlined">delete</span>
                                       </button>
                                   </div>
                               </div>
                           )}
                      </div>
                  </div>

                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                      <button 
                        onClick={() => setIsDamageModalOpen(false)}
                        className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-xl transition-colors"
                      >
                          Cancel
                      </button>
                      <button 
                        onClick={submitDamageReport}
                        className="flex-[2] py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-500/30 hover:bg-red-700 transition-transform active:scale-95"
                      >
                          Submit Report
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};


import React, { useState, useEffect } from 'react';
import { AppView, LocationState, MasterLocation } from '../types';
import { getMasterLocations, getLocationStates } from '../services/storageService';

interface DamagedReportProps {
  onNavigate: (view: AppView) => void;
}

export const DamagedReport: React.FC<DamagedReportProps> = ({ onNavigate }) => {
  const [damagedItems, setDamagedItems] = useState<(LocationState & { zone: string })[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    const locations = getMasterLocations();
    const states = getLocationStates();
    
    // Combine state with static zone data
    const list = Object.values(states)
        .filter(s => s.status === 'damaged')
        .map(s => {
            const loc = locations.find(l => l.name === s.locationId);
            return { ...s, zone: loc ? loc.zone : 'Unknown Zone' };
        });
    
    setDamagedItems(list);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-[#f6f6f8] text-slate-900 min-h-screen font-display flex flex-col print:bg-white">
      
      {/* Header (Hidden in Print) */}
      <nav className="sticky top-0 z-40 bg-red-600 border-b border-red-700 px-4 py-3 flex items-center justify-between text-white shadow-md print:hidden">
        <button onClick={() => onNavigate(AppView.DASHBOARD)} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/10 transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-lg font-bold text-center flex-1">Damaged Evidence Report</h1>
        <button onClick={handlePrint} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/10 transition-colors">
           <span className="material-symbols-outlined">print</span>
        </button>
      </nav>

      {/* Print Header (Visible only in Print) */}
      <div className="hidden print:block p-8 border-b-2 border-slate-900 mb-6">
          <h1 className="text-3xl font-black uppercase tracking-wider mb-2">Damaged Locations Report</h1>
          <p className="text-slate-600">Generated on: {new Date().toLocaleString()}</p>
      </div>

      <main className="flex-1 p-4 max-w-4xl mx-auto w-full">
          {damagedItems.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm print:shadow-none print:border-none">
                  <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                      <span className="material-symbols-outlined text-4xl">check_circle</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">No Damages Reported</h2>
                  <p className="text-slate-500 mt-2">The warehouse is in good condition.</p>
              </div>
          ) : (
              <div className="space-y-6">
                  {damagedItems.map((item, index) => (
                      <div key={item.locationId} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden break-inside-avoid print:shadow-none print:border-slate-900 print:border-2">
                          <div className="bg-red-50 border-b border-red-100 p-4 flex justify-between items-center print:bg-slate-100 print:border-slate-300">
                              <div>
                                  <h3 className="font-black text-lg text-slate-800">{item.locationId}</h3>
                                  <span className="text-xs font-bold bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600 uppercase tracking-wide">
                                      {item.zone}
                                  </span>
                              </div>
                              <span className="text-xs font-mono text-slate-500 print:text-slate-900">
                                  {new Date(item.timestamp).toLocaleString()}
                              </span>
                          </div>
                          
                          <div className="p-4 grid md:grid-cols-2 gap-6 print:grid-cols-2">
                              <div className="space-y-4">
                                  <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Reported By</label>
                                      <p className="text-sm font-medium text-slate-800">{item.reportedBy || 'Unknown User'}</p>
                                  </div>
                                  <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Problem Description</label>
                                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm text-slate-700 min-h-[80px] print:bg-white print:border-slate-300">
                                          {item.description || 'No description provided.'}
                                      </div>
                                  </div>
                              </div>
                              
                              <div>
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Evidence Photo</label>
                                  {item.photoUrl ? (
                                      <div 
                                        className="rounded-lg overflow-hidden border border-slate-200 aspect-video bg-slate-100 cursor-zoom-in relative group print:cursor-default"
                                        onClick={() => setSelectedImage(item.photoUrl!)}
                                      >
                                          <img src={item.photoUrl} className="w-full h-full object-cover" alt="Damage Evidence" />
                                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center print:hidden">
                                              <span className="material-symbols-outlined text-white opacity-0 group-hover:opacity-100 drop-shadow-md">zoom_in</span>
                                          </div>
                                      </div>
                                  ) : (
                                      <div className="rounded-lg border-2 border-dashed border-slate-200 aspect-video flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                                          <span className="material-symbols-outlined text-3xl mb-1">image_not_supported</span>
                                          <span className="text-xs">No Photo Available</span>
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </main>

      {/* Lightbox for Image Zoom (Not visible in print) */}
      {selectedImage && (
          <div 
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 print:hidden animate-fade-in"
            onClick={() => setSelectedImage(null)}
          >
              <button className="absolute top-4 right-4 text-white hover:text-slate-300">
                  <span className="material-symbols-outlined text-4xl">close</span>
              </button>
              <img 
                src={selectedImage} 
                alt="Full Size Evidence" 
                className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()} 
              />
          </div>
      )}

      {/* Print Footer */}
      <div className="hidden print:block fixed bottom-0 left-0 right-0 p-8 border-t border-slate-300 text-center text-xs text-slate-500">
          Generated by Smart Stock Opname App
      </div>
    </div>
  );
};

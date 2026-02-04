
import React, { useState, useEffect, useRef } from 'react';
import { saveAuditLog, getMasterData } from '../services/storageService';
import { MasterItem } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { ScannerModal } from './ScannerModal';
import { Logo } from './Logo';

interface AuditFormProps {
  onSuccess: () => void;
  initialLocation?: string; 
}

export const AuditForm: React.FC<AuditFormProps> = ({ onSuccess, initialLocation }) => {
  const [allMasterItems, setAllMasterItems] = useState<MasterItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [sku, setSku] = useState('');
  const [location, setLocation] = useState(initialLocation || '');
  const [physicalQty, setPhysicalQty] = useState<number>(0);
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [teamName, setTeamName] = useState(() => localStorage.getItem('team_member_name') || '');
  const [notes, setNotes] = useState('');
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);
  
  const [foundItem, setFoundItem] = useState<MasterItem | null>(null);
  const [scannerType, setScannerType] = useState<'sku' | 'location' | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync Team Name to LocalStorage
  useEffect(() => {
    if (teamName) localStorage.setItem('team_member_name', teamName);
  }, [teamName]);

  // Load Master Data
  useEffect(() => {
    let mounted = true;
    const initData = async () => {
      setLoadingData(true);
      try {
        const items = await getMasterData();
        if (mounted) setAllMasterItems(items);
      } catch (err) {
        console.error("Error loading master data:", err);
      } finally {
        if (mounted) setLoadingData(false);
      }
    };
    initData();
    return () => { mounted = false; };
  }, []);

  // --- AUTOMATIC LOOKUP LOGIC ---
  // When SKU changes (via scanning or typing), lookup details automatically
  useEffect(() => {
    if (loadingData || !sku) {
      setFoundItem(null);
      return;
    }

    // Attempt to find matching item (case-insensitive)
    const normalizedSku = sku.trim().toLowerCase();
    const match = allMasterItems.find(i => i.sku.toLowerCase() === normalizedSku);

    if (match) {
      setFoundItem(match);
      // AUTO-FILL: This is the core logic requested
      setBatchNumber(match.batchNumber || '-');
      setExpiryDate(match.expiryDate || '');
    } else {
      setFoundItem(null);
    }
  }, [sku, loadingData, allMasterItems]);

  const systemStock = foundItem ? foundItem.systemStock : 0;
  const variance = physicalQty - systemStock;
  const activeItemName = foundItem ? foundItem.name : 'Barang Tidak Terdaftar (Item Baru)';
  const percentDiff = (systemStock > 0) ? (Math.abs(variance) / systemStock) * 100 : (physicalQty > 0 ? 100 : 0);
  const isSignificant = percentDiff > 10;

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (evidencePhotos.length >= 5) { alert("Maksimal 5 foto bukti."); return; }
      const reader = new FileReader();
      reader.onloadend = async () => { 
        if (reader.result) {
          const compressed = await compressImage(reader.result as string);
          setEvidencePhotos(prev => [...prev, compressed]);
        } 
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = '';
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!sku) { alert("Mohon scan atau masukkan kode barang."); return; }
    if (!location) { alert("Mohon isi lokasi rak."); return; }
    if (isSignificant && evidencePhotos.length === 0) { 
      alert("Selisih signifikan (>10%)! Wajib melampirkan foto bukti kondisi fisik."); 
      document.getElementById('photo-section')?.scrollIntoView({ behavior: 'smooth' });
      return; 
    }
    
    setIsSubmitting(true);
    try {
      const auditRecord = {
        id: uuidv4(),
        sku: sku.trim(), 
        itemName: activeItemName, 
        location: location.trim().toUpperCase(), 
        batchNumber: batchNumber || '-', 
        expiryDate: expiryDate || '-',
        systemQty: systemStock, 
        physicalQty: physicalQty, 
        variance: variance, 
        timestamp: Date.now(), 
        teamMember: teamName || 'Petugas', 
        notes: notes, 
        evidencePhotos: evidencePhotos
      };
      
      await saveAuditLog(auditRecord); 
      onSuccess();
    } catch (err: any) {
      console.error("Submission error:", err);
      alert(`Gagal menyimpan: ${err.message || "Periksa koneksi internet"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingData) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#050A18] text-white">
      <Logo size={80} className="animate-pulse mb-4" />
      <span className="text-sm font-bold uppercase tracking-widest">Inisialisasi Scan Data...</span>
    </div>
  );

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display min-h-screen flex flex-col antialiased">
        <ScannerModal 
          isOpen={!!scannerType} 
          onClose={() => setScannerType(null)} 
          onScanSuccess={(text) => {
            if (scannerType === 'sku') setSku(text.trim());
            else setLocation(text.trim().toUpperCase());
            setScannerType(null);
          }} 
          title={scannerType === 'sku' ? "Scan Barcode Barang" : "Scan QR Lokasi"} 
        />

        <nav className="sticky top-0 z-20 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
            <button onClick={onSuccess} className="w-10 h-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center">
                <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="flex flex-col items-center">
                <div className="flex items-center gap-2">
                    <Logo size={24} />
                    <h1 className="text-sm font-black uppercase tracking-tight">Audit Fisik</h1>
                </div>
                <span className="text-[9px] font-bold text-primary uppercase tracking-widest leading-none">MEDIKA BINA INVESTAMA</span>
            </div>
            <div className="w-10"></div>
        </nav>

        <main className="flex-1 px-4 pt-4 pb-48 max-w-lg mx-auto w-full">
            {/* TEAM IDENTIFIER */}
            <section className="mb-6">
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">Petugas Pelaksana</h3>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined">person</span>
                    </div>
                    <input 
                      className="text-sm font-bold bg-transparent border-none p-0 focus:ring-0 w-full" 
                      value={teamName} 
                      onChange={(e) => setTeamName(e.target.value)} 
                      placeholder="Masukkan nama petugas..." 
                    />
                </div>
            </section>

            {/* BARCODE SCAN SECTION */}
            <section className="mb-6 space-y-4">
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">Identifikasi Barang</h3>
                <div className="relative flex items-center">
                    <input 
                      className="w-full h-12 pl-4 pr-14 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono text-sm" 
                      placeholder="Scan atau ketik kode barang..." 
                      type="text" 
                      value={sku} 
                      onChange={(e) => setSku(e.target.value)} 
                    />
                    <button onClick={() => setScannerType('sku')} className="absolute right-1 top-1 bottom-1 w-12 bg-primary text-white rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined">barcode_scanner</span>
                    </button>
                </div>
                
                {/* ITEM DETAILS CARD */}
                <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                    <div>
                        <span className="text-[10px] text-slate-400 block mb-1 uppercase font-bold tracking-tight">Nama Barang</span>
                        <p className={`text-sm font-bold leading-tight ${!foundItem && sku ? 'text-amber-600 italic' : ''}`}>
                          {sku ? activeItemName : 'Silakan scan barang...'}
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <span className="text-[10px] text-slate-400 block mb-1 uppercase font-bold tracking-tight">Batch Number</span>
                            <input 
                              className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold" 
                              value={batchNumber} 
                              onChange={(e) => setBatchNumber(e.target.value)} 
                              placeholder="Ketik manual jika berbeda"
                            />
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] text-slate-400 block mb-1 uppercase font-bold tracking-tight">Expiry Date</span>
                            <input 
                              type="text"
                              className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold" 
                              value={expiryDate} 
                              onChange={(e) => setExpiryDate(e.target.value)}
                              placeholder="YYYY-MM-DD"
                            />
                        </div>
                    </div>
                    {foundItem && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase">System Stock</span>
                          <span className="text-xs font-black text-slate-600 dark:text-slate-300">{systemStock} unit</span>
                      </div>
                    )}
                </div>
            </section>

            {/* LOCATION SECTION */}
            <section className="mb-6">
                <h3 className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-2 px-1">Lokasi Rak / Gudang</h3>
                <div className="relative flex items-center">
                    <input 
                      className="w-full h-12 pl-4 pr-14 rounded-xl border border-primary/30 dark:border-slate-600 bg-white dark:bg-slate-800 uppercase font-bold text-sm" 
                      placeholder="Scan atau ketik lokasi..." 
                      type="text" 
                      value={location} 
                      onChange={(e) => setLocation(e.target.value.toUpperCase())} 
                    />
                    <button onClick={() => setScannerType('location')} className="absolute right-1 top-1 bottom-1 w-12 bg-primary text-white rounded-lg flex items-center justify-center">
                        <span className="material-symbols-outlined">qr_code_scanner</span>
                    </button>
                </div>
            </section>

            {/* PHYSICAL COUNT SECTION */}
            <section className="mb-6">
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">Hitung Fisik</h3>
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="p-5 flex gap-4 items-center">
                        <button onClick={() => setPhysicalQty(prev => Math.max(0, prev - 1))} className="w-14 h-14 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors">
                            <span className="material-symbols-outlined text-2xl font-bold">remove</span>
                        </button>
                        <input 
                          className="flex-1 h-14 text-center text-3xl font-black font-mono text-primary bg-slate-50 dark:bg-slate-900 border-none rounded-2xl focus:ring-2 focus:ring-primary/20" 
                          type="number" 
                          value={physicalQty} 
                          onChange={(e) => setPhysicalQty(parseInt(e.target.value) || 0)} 
                        />
                        <button onClick={() => setPhysicalQty(prev => prev + 1)} className="w-14 h-14 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30 active:scale-95 transition-all">
                            <span className="material-symbols-outlined text-2xl font-bold">add</span>
                        </button>
                    </div>
                    
                    <div className={`px-5 py-4 border-t border-slate-100 dark:border-slate-700 ${isSignificant ? 'bg-red-50 dark:bg-red-900/10' : 'bg-slate-50 dark:bg-slate-900/50'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analisis Selisih</span>
                                <span className="text-[9px] text-slate-400">Dibandingkan {systemStock} stok sistem</span>
                            </div>
                            <div className="text-right">
                                <span className={`text-xl font-black ${variance < 0 ? 'text-red-600' : variance > 0 ? 'text-primary' : 'text-emerald-500'}`}>
                                    {variance > 0 ? '+' : ''}{variance}
                                </span>
                                <p className="text-[8px] font-bold uppercase tracking-tighter text-slate-400">{variance === 0 ? 'Sesuai' : (variance > 0 ? 'Surplus' : 'Kurang')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* EVIDENCE SECTION */}
            <section id="photo-section" className="mb-6">
                <div className="flex justify-between items-center mb-2 px-1">
                    <h3 className={`text-[10px] font-bold uppercase tracking-wider ${isSignificant && evidencePhotos.length === 0 ? 'text-red-500 animate-pulse' : 'text-slate-500'}`}>
                        Foto Bukti {isSignificant && <span className="italic ml-1 text-red-500 font-black">(WAJIB)</span>}
                    </h3>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{evidencePhotos.length}/5</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {evidencePhotos.map((photo, idx) => (
                        <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-slate-100">
                            <img src={photo} className="w-full h-full object-cover" alt="Evidence" />
                            <button 
                              onClick={() => setEvidencePhotos(prev => prev.filter((_, i) => i !== idx))} 
                              className="absolute top-1.5 right-1.5 bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center"
                            >
                                <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                        </div>
                    ))}
                    {evidencePhotos.length < 5 && (
                        <button 
                          onClick={() => fileInputRef.current?.click()} 
                          className={`aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${isSignificant && evidencePhotos.length === 0 ? 'border-red-400 bg-red-50 text-red-500' : 'border-slate-300 dark:border-slate-700 text-slate-400'}`}
                        >
                            <span className="material-symbols-outlined text-3xl">add_a_photo</span>
                            <span className="text-[9px] font-bold uppercase mt-2">Ambil Foto</span>
                        </button>
                    )}
                </div>
                <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handlePhotoCapture} />
            </section>

            {/* REMARKS */}
            <section className="mb-6">
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">Catatan Tambahan</h3>
                <textarea 
                  className="w-full rounded-2xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm p-4 h-24 focus:ring-2 focus:ring-primary/20 outline-none" 
                  placeholder="Contoh: Barang rusak, label tidak terbaca, dll..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
            </section>
        </main>

        <footer className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 pb-10 safe-area-pb shadow-[0_-4px_30px_rgba(0,0,0,0.1)]">
            <div className="max-w-lg mx-auto flex gap-3">
                <button 
                  disabled={isSubmitting} 
                  onClick={() => { setSku(''); setPhysicalQty(0); setEvidencePhotos([]); setNotes(''); }} 
                  className="flex-1 h-14 rounded-2xl border border-slate-200 dark:border-slate-700 font-bold text-slate-400 hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Reset
                </button>
                <button 
                  disabled={isSubmitting} 
                  onClick={handleSubmit} 
                  className={`flex-[2] h-14 rounded-2xl font-bold shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-2 ${isSignificant && evidencePhotos.length === 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-primary text-white shadow-primary/40'}`}
                >
                    {isSubmitting ? (
                      <><span className="material-symbols-outlined animate-spin">sync</span><span>Menyimpan...</span></>
                    ) : (
                      <><span className="material-symbols-outlined">save</span><span>Simpan Audit</span></>
                    )}
                </button>
            </div>
        </footer>
    </div>
  );
};

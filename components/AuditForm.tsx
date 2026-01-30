
import React, { useState, useEffect, useRef } from 'react';
import { saveAuditLog, getAuditLogs, getMasterData } from '../services/storageService';
import { MasterItem, AuditRecord } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { ScannerModal } from './ScannerModal';

interface AuditFormProps {
  onSuccess: () => void;
  initialLocation?: string; 
}

export const AuditForm: React.FC<AuditFormProps> = ({ onSuccess, initialLocation }) => {
  // Data State
  const [allMasterItems, setAllMasterItems] = useState<MasterItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form State
  const [sku, setSku] = useState('BRG-882910');
  const [location, setLocation] = useState(initialLocation || 'RACK-C-02-B');
  const [physicalQty, setPhysicalQty] = useState<number>(0);
  
  // Specific Item Details State (Editable but Auto-filled)
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  
  const [teamName, setTeamName] = useState('Tim Gudang A - Shift 2');
  const [notes, setNotes] = useState('');
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);
  
  // Logic State
  const [foundItem, setFoundItem] = useState<MasterItem | null>(null);
  const [itemHistory, setItemHistory] = useState<AuditRecord[]>([]);
  const [existingTotal, setExistingTotal] = useState(0);

  // Modal State
  const [scannerType, setScannerType] = useState<'sku' | 'location' | null>(null);

  const [timestamp, setTimestamp] = useState(new Date());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Master Data
  useEffect(() => {
    const initData = async () => {
        setLoadingData(true);
        const items = await getMasterData();
        setAllMasterItems(items);
        setLoadingData(false);
    };
    initData();
  }, []);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setTimestamp(new Date()), 60000); 
    return () => clearInterval(timer);
  }, []);

  // Lookup Item Logic
  useEffect(() => {
    if (loadingData) return;

    if (sku.length >= 3) {
      const matchingItems = allMasterItems.filter(i => i.sku.toLowerCase() === sku.toLowerCase());
      const item = matchingItems.length > 0 ? matchingItems[0] : null;
      setFoundItem(item || null);

      if (item) {
        setBatchNumber(item.batchNumber);
        setExpiryDate(item.expiryDate);
        
        const fetchHistory = async () => {
            const allLogs = await getAuditLogs();
            const history = allLogs.filter(log => log.sku === item.sku);
            setItemHistory(history);
            const total = history.reduce((sum, log) => sum + log.physicalQty, 0);
            setExistingTotal(total);
        };
        fetchHistory();
      } else {
        setItemHistory([]);
        setExistingTotal(0);
        if (!batchNumber) setBatchNumber('');
        if (!expiryDate) setExpiryDate('');
      }
    } else {
      setFoundItem(null);
      setItemHistory([]);
      setExistingTotal(0);
    }
  }, [sku, loadingData, allMasterItems]);

  // System Stock = TOTAL of all entries for this SKU
  const systemStock = foundItem 
    ? allMasterItems
        .filter(i => i.sku.toLowerCase() === sku.toLowerCase())
        .reduce((sum, i) => sum + i.systemStock, 0)
    : 0;

  const globalTotal = existingTotal + (physicalQty || 0);
  const variance = globalTotal - systemStock;
  const activeItemName = foundItem ? foundItem.name : 'Unknown Item (New)';

  const percentDiff = (systemStock > 0) 
    ? Math.round((Math.abs(variance) / systemStock) * 100) 
    : 0;
  
  const isSignificant = systemStock > 0 && percentDiff > 10;

  const handleSkuInput = (val: string) => {
    if (val.includes(',')) {
        const parts = val.split(',');
        if (parts.length >= 1) setSku(parts[0].trim());
        if (parts.length >= 2) setBatchNumber(parts[1].trim());
        if (parts.length >= 3) {
            let rawDate = parts[2].trim();
            if (rawDate.length === 8 && !rawDate.includes('-')) {
                const year = rawDate.substring(0, 4);
                const month = rawDate.substring(4, 6);
                const day = rawDate.substring(6, 8);
                rawDate = `${year}-${month}-${day}`;
            }
            setExpiryDate(rawDate);
        }
        return;
    }
    setSku(val);
  };

  const handleScanSuccess = (decodedText: string) => {
    if (scannerType === 'sku') {
      handleSkuInput(decodedText);
    } else if (scannerType === 'location') {
      setLocation(decodedText.toUpperCase());
    }
    setScannerType(null);
  };

  const handleQtyChange = (val: number) => {
    setPhysicalQty(val >= 0 ? val : 0);
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (reader.result) {
                setEvidencePhotos(prev => [...prev, reader.result as string]);
            }
        };
        reader.readAsDataURL(file);
    }
  };

  const removePhoto = (index: number) => {
    setEvidencePhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!sku) {
        alert("Mohon scan atau input kode barang yang valid.");
        return;
    }
    
    if (isSignificant && evidencePhotos.length === 0) {
        alert("Foto bukti wajib diisi untuk selisih signifikan!");
        return;
    }

    const record: AuditRecord = {
      id: uuidv4(),
      sku: sku,
      itemName: activeItemName,
      location,
      batchNumber: batchNumber || 'N/A',
      expiryDate: expiryDate || 'N/A',
      systemQty: systemStock, 
      physicalQty: physicalQty,
      variance: variance, 
      timestamp: Date.now(),
      teamMember: teamName,
      notes: notes,
      evidencePhotos: evidencePhotos
    };

    await saveAuditLog(record); 
    onSuccess();
  };

  const dateStr = timestamp.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  if (loadingData) {
      return (
          <div className="flex items-center justify-center min-h-screen text-slate-500 bg-background-light dark:bg-background-dark">
              <span className="material-symbols-outlined animate-spin text-3xl">sync</span>
              <span className="ml-2">Updating Database...</span>
          </div>
      );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display min-h-screen flex flex-col antialiased selection:bg-primary/20 selection:text-primary">
        
        <ScannerModal 
          isOpen={!!scannerType} 
          onClose={() => setScannerType(null)} 
          onScanSuccess={handleScanSuccess}
          title={scannerType === 'sku' ? "Scan Kode Barang" : "Scan Lokasi Rak"}
        />

        {/* NAV */}
        <nav className="sticky top-0 z-20 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
            <button onClick={onSuccess} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300">
                <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="flex flex-col items-center">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Stock Opname</h1>
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full">Mode Audit Real-Time</span>
            </div>
            <div className="w-10"></div>
        </nav>

        <main className="flex-1 flex flex-col px-4 pt-4 pb-36 max-w-lg mx-auto w-full">
            
            {/* Timestamp */}
            <div className="flex items-center justify-end mb-6">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-200 dark:bg-slate-800 rounded-full">
                    <span className="material-symbols-outlined text-[16px] text-slate-500 dark:text-slate-400">schedule</span>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{dateStr}, {timeStr}</p>
                </div>
            </div>

            {/* Team Section */}
            <section className="mb-6">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1 text-[10px]">Team Pelaksana</h3>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between group">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-primary">
                            <span className="material-symbols-outlined">groups</span>
                        </div>
                        <div className="flex flex-col truncate w-full">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">Current Team</span>
                            <input 
                                className="text-sm font-medium text-slate-900 dark:text-white truncate bg-transparent border-none p-0 focus:ring-0 placeholder-slate-400"
                                value={teamName}
                                onChange={(e) => setTeamName(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Item Details */}
            <section className="mb-6 space-y-4">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1 text-[10px]">Item Details</h3>
                <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Kode Barang (SKU)</label>
                    <div className="relative flex items-center">
                        <input 
                            className="w-full h-12 pl-4 pr-14 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary transition-shadow font-mono text-base placeholder:text-slate-400" 
                            placeholder="Scan item barcode..." 
                            type="text" 
                            value={sku}
                            onChange={(e) => handleSkuInput(e.target.value)}
                        />
                        <button 
                            onClick={() => setScannerType('sku')}
                            className="absolute right-1 top-1 bottom-1 w-12 bg-primary text-white rounded-lg flex items-center justify-center transition-colors shadow-sm"
                        >
                            <span className="material-symbols-outlined">barcode_scanner</span>
                        </button>
                    </div>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-4">
                    <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1 uppercase tracking-tighter">Nama Barang</span>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{activeItemName}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1 uppercase tracking-tighter">Batch Number</span>
                            <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-slate-400">tag</span>
                                <input 
                                    className="w-full pl-8 pr-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-1 focus:ring-primary"
                                    value={batchNumber}
                                    onChange={(e) => setBatchNumber(e.target.value)}
                                    placeholder="Input Batch"
                                />
                            </div>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1 uppercase tracking-tighter">Expired Date</span>
                            <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-slate-400">event</span>
                                <input 
                                    type="date"
                                    className="w-full pl-8 pr-2 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-1 focus:ring-primary"
                                    value={expiryDate}
                                    onChange={(e) => setExpiryDate(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

             {/* Entry Lokasi Audit */}
             <section className="mb-6">
                <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2 px-1 text-[10px] flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">add_location_alt</span>
                    Lokasi Rak / Bin
                </h3>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-primary/20 ring-1 ring-primary/5">
                    <div className="relative flex items-center">
                        <input 
                            className="w-full h-12 pl-4 pr-14 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary transition-shadow font-mono text-base uppercase placeholder:text-slate-400" 
                            placeholder="Scan/Input Location..." 
                            type="text" 
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        />
                        <button 
                            onClick={() => setScannerType('location')}
                            className="absolute right-1 top-1 bottom-1 w-12 bg-primary text-white rounded-lg flex items-center justify-center transition-colors"
                        >
                            <span className="material-symbols-outlined">qr_code_scanner</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Riwayat Lokasi */}
            {itemHistory.length > 0 && (
                <section className="mb-6">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <h3 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Terinput di Lokasi Lain:</h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            Sum: {existingTotal} Pcs
                        </span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm max-h-40 overflow-y-auto">
                        {itemHistory.map(log => (
                            <div key={log.id} className="flex justify-between items-center px-4 py-2 border-b border-slate-50 dark:border-slate-700/50 text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-green-500 text-[14px]">check_circle</span>
                                    <span className="font-medium">{log.location}</span>
                                </div>
                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{log.physicalQty}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Input Stok Fisik */}
            <section className="mb-4">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1 text-[10px]">Stok Fisik di Lokasi Ini</h3>
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="p-5">
                        <div className="flex gap-4">
                            <button 
                                onClick={() => handleQtyChange(physicalQty - 1)}
                                className="w-14 h-14 rounded-xl border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all"
                            >
                                <span className="material-symbols-outlined">remove</span>
                            </button>
                            <input 
                                className="flex-1 h-14 text-center text-3xl font-bold font-mono text-primary bg-white dark:bg-slate-800 border-2 border-primary rounded-xl focus:ring-4 focus:ring-primary/20 transition-all outline-none" 
                                inputMode="numeric" 
                                type="number" 
                                value={physicalQty}
                                onChange={(e) => handleQtyChange(parseInt(e.target.value) || 0)}
                                onFocus={(e) => e.target.select()}
                            />
                            <button 
                                onClick={() => handleQtyChange(physicalQty + 1)}
                                className="w-14 h-14 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-95 transition-all"
                            >
                                <span className="material-symbols-outlined">add</span>
                            </button>
                        </div>
                    </div>
                    {foundItem && (
                        <div className={`p-4 ${isSignificant ? 'bg-red-50 dark:bg-red-900/10 border-t border-red-100 dark:border-red-900/30' : 'bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700'}`}>
                            <div className="flex items-center justify-between">
                                <span className={`text-xs font-bold flex items-center gap-1.5 ${isSignificant ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {isSignificant && <span className="material-symbols-outlined text-[18px]">warning</span>}
                                    Diff vs System ({systemStock})
                                </span>
                                <span className={`text-lg font-mono font-black ${isSignificant ? 'text-red-600 dark:text-red-400' : variance === 0 ? 'text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {variance > 0 ? '+' : ''}{variance}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Evidence Photos */}
            <section className="mb-6">
                <div className="flex items-center justify-between mb-2 px-1">
                    <h3 className={`text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 ${isSignificant ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        Bukti Foto
                    </h3>
                    <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold ${isSignificant ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' : 'bg-slate-100 text-slate-500'}`}>
                        {isSignificant ? 'Wajib' : 'Optional'}
                    </span>
                </div>
                <div className={`bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border ${isSignificant ? 'border-red-200 dark:border-red-900/50' : 'border-slate-200 dark:border-slate-700'}`}>
                    <div className="grid grid-cols-3 gap-3">
                         {evidencePhotos.map((photo, i) => (
                             <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group">
                                <img src={photo} alt="Evidence" className="w-full h-full object-cover" />
                                <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors backdrop-blur-sm">
                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                </button>
                            </div>
                         ))}
                        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handlePhotoCapture} />
                        <button onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-primary/50 transition-colors">
                            <span className="material-symbols-outlined text-[24px]">add_a_photo</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Notes Section */}
            <section className="mb-6">
                <h3 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">Catatan</h3>
                <textarea 
                    className="w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary transition-shadow p-3 text-sm placeholder:text-slate-400 min-h-[80px]" 
                    placeholder="Alasan selisih..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                ></textarea>
            </section>
        </main>

        {/* Footer Actions */}
        <footer className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 pb-8 safe-area-pb">
            <div className="max-w-lg mx-auto flex gap-3">
                <button 
                    onClick={() => { setSku(''); setPhysicalQty(0); setNotes(''); setEvidencePhotos([]); }}
                    className="flex-1 h-12 flex items-center justify-center rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 transition-colors"
                >
                    Reset
                </button>
                <button onClick={handleSubmit} className="flex-[2] h-12 flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98]">
                    <span className="material-symbols-outlined text-[20px] filled">check_circle</span>
                    Simpan
                </button>
            </div>
        </footer>

    </div>
  );
};

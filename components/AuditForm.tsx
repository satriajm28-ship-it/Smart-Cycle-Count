
import React, { useState, useEffect, useRef } from 'react';
import { saveAuditLog, getAuditLogs, getMasterData } from '../services/storageService';
import { MasterItem, AuditRecord } from '../types';
import { v4 as uuidv4 } from 'uuid';

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
  const [physicalQty, setPhysicalQty] = useState<number>(15);
  const [teamName, setTeamName] = useState('Tim Gudang A - Shift 2');
  const [notes, setNotes] = useState('');
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]); // We'll mock one if empty for UI demo
  
  // Logic State
  const [foundItem, setFoundItem] = useState<MasterItem | null>(null);
  const [itemHistory, setItemHistory] = useState<AuditRecord[]>([]);
  const [existingTotal, setExistingTotal] = useState(0);
  
  // Scanned specific data 
  const [scannedBatch, setScannedBatch] = useState<string | null>(null);
  const [scannedExpiry, setScannedExpiry] = useState<string | null>(null);

  const [timestamp, setTimestamp] = useState(new Date());
  const [isScanningSku, setIsScanningSku] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Master Data once
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

  // Lookup Item and History
  useEffect(() => {
    if (loadingData) return;

    if (sku.length >= 3) {
      const item = allMasterItems.find(i => i.sku === sku);
      setFoundItem(item || null);

      if (item) {
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
      }
    } else {
      setFoundItem(null);
      setItemHistory([]);
      setExistingTotal(0);
    }
  }, [sku, loadingData, allMasterItems]);

  // Derived Values
  const globalTotal = existingTotal + (physicalQty || 0);
  const systemStock = foundItem ? foundItem.systemStock : 50; // Default 50 for UI demo if not found
  const variance = globalTotal - systemStock;
  
  // Determine which batch/expiry to use
  const activeBatch = scannedBatch || (foundItem ? foundItem.batchNumber : 'BATCH-2023-X');
  const activeExpiry = scannedExpiry || (foundItem ? foundItem.expiryDate : '2024-12-12');
  const activeItemName = foundItem ? foundItem.name : 'Indomie Goreng Special 85g';

  // Percent Diff Calculation
  const percentDiff = (systemStock > 0) 
    ? Math.round((Math.abs(variance) / systemStock) * 100) 
    : 0;
  
  const isSignificant = percentDiff > 10;
  // If significant, require photos
  const isPhotoRequired = isSignificant && variance !== 0;

  // Handle Input with Parsing Logic (Simulate Barcode Scanner)
  const handleSkuInput = (val: string) => {
    // Simulator for GS1 or Comma Separated QR
    if (val.includes(',')) {
        const parts = val.split(',');
        if (parts.length >= 3) {
            setSku(parts[0].trim());
            setScannedBatch(parts[1].trim());
            
            // Handle date format YYYYMMDD or similar
            let rawDate = parts[2].trim();
            let formattedDate = rawDate;
             if (rawDate.length === 8 && !rawDate.includes('-')) {
                // Assuming YYYYMMDD
                const year = rawDate.substring(0, 4);
                const month = rawDate.substring(4, 6);
                const day = rawDate.substring(6, 8);
                formattedDate = `${year}-${month}-${day}`;
            }

            setScannedExpiry(formattedDate);
            return;
        }
    }
    setSku(val);
    setScannedBatch(null);
    setScannedExpiry(null);
  };

  const handleScanSku = () => {
    setIsScanningSku(true);
    setTimeout(() => {
      setIsScanningSku(false);
      // Simulate a scan result
      handleSkuInput('BRG-882910'); 
    }, 500);
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
    if (!foundItem && sku.length < 3) {
        alert("Mohon scan atau input kode barang yang valid.");
        return;
    }
    
    // For demo purposes, we allow submission even if item not in master, 
    // creating a record with input SKU
    
    if (isPhotoRequired && evidencePhotos.length === 0) {
        alert("Foto bukti wajib diisi untuk selisih signifikan!");
        return;
    }

    const record: AuditRecord = {
      id: uuidv4(),
      sku: sku,
      itemName: activeItemName,
      location,
      batchNumber: activeBatch,
      expiryDate: activeExpiry,
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
              <span className="ml-2">Initializing Database...</span>
          </div>
      );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display min-h-screen flex flex-col antialiased selection:bg-primary/20 selection:text-primary">
        
        {/* NAV */}
        <nav className="sticky top-0 z-20 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
            <button onClick={onSuccess} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-300">
                <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="flex flex-col items-center">
                <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">Stock Opname</h1>
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full">Multi-Location Mode</span>
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
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">Team Pelaksana</h3>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-between group">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-primary">
                            <span className="material-symbols-outlined">groups</span>
                        </div>
                        <div className="flex flex-col truncate w-full">
                            <span className="text-sm text-slate-500 dark:text-slate-400">Current Team</span>
                            <input 
                                className="text-base font-medium text-slate-900 dark:text-white truncate bg-transparent border-none p-0 focus:ring-0 placeholder-slate-400"
                                value={teamName}
                                onChange={(e) => setTeamName(e.target.value)}
                            />
                        </div>
                    </div>
                    <button className="p-2 text-slate-400 hover:text-primary transition-colors">
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                </div>
            </section>

            {/* Item Details */}
            <section className="mb-6 space-y-4">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">Item Details</h3>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Kode Barang</label>
                    <div className="relative flex items-center">
                        <input 
                            className="w-full h-12 pl-4 pr-14 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary transition-shadow font-mono text-base placeholder:text-slate-400" 
                            placeholder="Scan item barcode..." 
                            type="text" 
                            value={sku}
                            onChange={(e) => handleSkuInput(e.target.value)}
                        />
                        <button 
                            onClick={handleScanSku}
                            className="absolute right-1 top-1 bottom-1 w-12 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg flex items-center justify-center transition-colors"
                        >
                            <span className="material-symbols-outlined">barcode_scanner</span>
                        </button>
                    </div>
                    {foundItem ? (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            Item found
                        </p>
                    ) : sku.length > 3 ? (
                        <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[14px]">info</span>
                            Item not in master (New Entry)
                        </p>
                    ) : null}
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-4">
                    <div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Nama Barang</span>
                        <p className="text-base font-medium text-slate-800 dark:text-slate-200">{activeItemName}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Batch Number</span>
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-slate-400">tag</span>
                                <p className={`text-sm font-medium ${scannedBatch ? 'text-primary' : 'text-slate-700 dark:text-slate-300'}`}>{activeBatch}</p>
                            </div>
                        </div>
                        <div>
                            <span className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Expired Date</span>
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-slate-400">event_busy</span>
                                <p className={`text-sm font-medium ${scannedExpiry ? 'text-primary' : 'text-slate-700 dark:text-slate-300'}`}>{activeExpiry}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Riwayat Lokasi */}
            <section className="mb-6">
                <div className="flex items-center justify-between mb-2 px-1">
                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Riwayat Lokasi (Breakdown)</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        {itemHistory.length} Lokasi Lain Ditemukan
                    </span>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <div className="col-span-8">Location</div>
                        <div className="col-span-4 text-right">Qty</div>
                    </div>
                    
                    {itemHistory.length === 0 ? (
                        // Mock Data for UI if empty
                        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 items-center hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                            <div className="col-span-8">
                                <div className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                    -- No History --
                                </div>
                            </div>
                            <div className="col-span-4 text-right">
                                <span className="text-sm font-mono font-medium text-slate-600 dark:text-slate-300">0</span>
                            </div>
                        </div>
                    ) : (
                        itemHistory.map(log => (
                            <div key={log.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 items-center hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                <div className="col-span-8">
                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                        {log.location}
                                        <span className="material-symbols-outlined text-green-500 text-[14px]">verified</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400">Rec: {log.teamMember.split(' ')[0]} • {new Date(log.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                </div>
                                <div className="col-span-4 text-right">
                                    <span className="text-sm font-mono font-medium text-slate-600 dark:text-slate-300">{log.physicalQty}</span>
                                </div>
                            </div>
                        ))
                    )}
                    
                    <div className="flex justify-between items-center px-4 py-3 bg-slate-50/80 dark:bg-slate-800">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Total Lokasi Lain (Existing)</span>
                        <span className="text-base font-mono font-bold text-slate-700 dark:text-slate-200">{existingTotal}</span>
                    </div>
                </div>
            </section>

            {/* Entry Lokasi Baru */}
            <section className="mb-6">
                <div className="flex items-center justify-between mb-2 px-1">
                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-base">add_location_alt</span>
                        Entry Lokasi Baru (Current)
                    </h3>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-primary/20 ring-1 ring-primary/5">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase">Lokasi Saat Ini (Scan QR)</label>
                    <div className="relative flex items-center">
                        <input 
                            className="w-full h-12 pl-4 pr-14 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary transition-shadow font-mono text-base uppercase placeholder:text-slate-400" 
                            placeholder="Scan location..." 
                            type="text" 
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        />
                        <button className="absolute right-1 top-1 bottom-1 w-12 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg flex items-center justify-center transition-colors">
                            <span className="material-symbols-outlined">qr_code_scanner</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Global Calculation */}
            <section className="mb-4">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1">Global Calculation</h3>
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="grid grid-cols-[1fr,auto,1fr,auto,1fr] gap-1 p-4 items-center bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                        <div className="text-center">
                            <span className="block text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-1">Existing</span>
                            <span className="block text-lg font-mono font-medium text-slate-600 dark:text-slate-400">{existingTotal}</span>
                        </div>
                        <div className="text-slate-300 dark:text-slate-600 font-bold text-lg">+</div>
                        <div className="text-center">
                            <span className="block text-[10px] uppercase text-primary font-bold tracking-wider mb-1">Current</span>
                            <span className="block text-lg font-mono font-bold text-primary underline decoration-2 decoration-primary/30 underline-offset-4">{physicalQty}</span>
                        </div>
                        <div className="text-slate-300 dark:text-slate-600 font-bold text-lg">=</div>
                        <div className="text-center relative">
                            <span className="block text-[10px] uppercase text-slate-900 dark:text-white font-bold tracking-wider mb-1">Total Global</span>
                            <span className="block text-xl font-mono font-black text-slate-900 dark:text-white">{globalTotal}</span>
                            <div className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
                        </div>
                    </div>
                    <div className="p-5">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Jumlah Fisik (Lokasi Ini)</label>
                            <span className="text-xs text-slate-400">Masukkan hitungan di sini</span>
                        </div>
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
                            />
                            <button 
                                onClick={() => handleQtyChange(physicalQty + 1)}
                                className="w-14 h-14 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-95 transition-all"
                            >
                                <span className="material-symbols-outlined">add</span>
                            </button>
                        </div>
                    </div>
                    <div className={`p-4 ${isSignificant ? 'bg-red-50 dark:bg-red-900/10 border-t border-red-100 dark:border-red-900/30' : 'bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700'}`}>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Target (Stok Sistem)</span>
                            <span className="text-base font-mono font-bold text-slate-700 dark:text-slate-300">{systemStock}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className={`text-sm font-bold flex items-center gap-1.5 ${isSignificant ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                {isSignificant && <span className="material-symbols-outlined text-[18px]">warning</span>}
                                Selisih (Global vs Sistem)
                            </span>
                            <div className="flex items-center gap-2">
                                {isSignificant && (
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center hover:bg-red-200 transition-colors animate-pulse"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                                    </button>
                                )}
                                <span className={`text-xl font-mono font-black ${isSignificant ? 'text-red-600 dark:text-red-400' : variance === 0 ? 'text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                    {variance > 0 ? '+' : ''}{variance}
                                </span>
                                {isSignificant && (
                                    <span className="text-xs font-bold bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-200 px-2 py-1 rounded-md">{percentDiff}%</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Warning Box */}
            {isSignificant && (
                <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-r-lg" role="alert">
                    <div className="flex items-start">
                        <div className="flex-shrink-0">
                            <span className="material-symbols-outlined text-red-500 text-[24px]">add_a_photo</span>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-bold text-red-800 dark:text-red-200">Foto Bukti Diperlukan</h3>
                            <div className="mt-1 text-sm text-red-700 dark:text-red-300">
                                <p>Terdapat selisih stok yang signifikan. Anda wajib mengambil foto bukti fisik barang atau rak untuk melanjutkan.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Evidence Photos */}
            <section className="mb-6">
                <div className="flex items-center justify-between mb-2 px-1">
                    <h3 className={`text-sm font-semibold uppercase tracking-wider flex items-center gap-1 ${isSignificant ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        Bukti Foto
                        <span className="material-symbols-outlined text-[14px]">lock</span>
                    </h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isSignificant ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' : 'bg-slate-100 text-slate-500'}`}>
                        {isSignificant ? 'Wajib Diisi (1/3)' : 'Optional'}
                    </span>
                </div>
                <div className={`bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border ${isSignificant ? 'border-red-200 dark:border-red-900/50' : 'border-slate-200 dark:border-slate-700'}`}>
                    <div className="grid grid-cols-3 gap-3">
                        {/* 1. Existing/Mock Photo (if any or simulating) */}
                         {evidencePhotos.length > 0 ? evidencePhotos.map((photo, i) => (
                             <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group">
                                <img src={photo} alt="Evidence" className="w-full h-full object-cover" />
                                <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-red-500 transition-colors backdrop-blur-sm">
                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                </button>
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                                    <p className="text-[8px] text-white text-center font-mono">IMG_{i+1}.jpg</p>
                                </div>
                            </div>
                         )) : (
                             // Mock for UI match if user wants exact look
                             <div className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 group">
                                <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBTLoLX99KsW8Vc1FiTjonbtU85k3aXpXgAAhXPJTXLkl_aEmwX3MQQMtdgBUavOLNFwsnaucqo72r4GnY2MHnwNAv2C0dMMPPVGVytf9ct6YWFbWvRqVVhnmVbBuvnNSijo1JlAcm5gAXdEdKUKyN2f3z9EvQ3f6sHCrk__TGQgz9CKdslSVpuotMftHsKlSybOvlPjdFsWLm7L5zAVoPML5r8X9BKfVco1GEy3woYbZoGoloJOs-iLjvSf-Rl-MwBLamjlUSREBQ" alt="Evidence Mock" className="w-full h-full object-cover" />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                                    <p className="text-[8px] text-white text-center font-mono">IMG_MOCK.jpg</p>
                                </div>
                             </div>
                         )}

                        {/* 2. Add Button */}
                        <input 
                            type="file" 
                            accept="image/*" 
                            capture="environment" 
                            ref={fileInputRef} 
                            className="hidden" 
                            onChange={handlePhotoCapture}
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="aspect-square rounded-lg border-2 border-dashed border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/10 flex flex-col items-center justify-center gap-1 text-red-400 dark:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[24px]">add_a_photo</span>
                            <span className="text-[10px] font-medium">Tambah</span>
                        </button>

                        {/* 3. Placeholder */}
                        <div className="aspect-square rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center">
                            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-[24px]">image</span>
                        </div>
                    </div>
                    {isSignificant && <p className="text-[11px] text-slate-400 mt-3 text-center">Minimal 1 foto diperlukan untuk mengaktifkan tombol simpan.</p>}
                </div>
            </section>

            {/* Notes Section */}
            <section className="mb-6">
                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 px-1 flex items-center gap-1">
                    Catatan / Alasan
                    <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 text-[10px] px-1.5 py-0.5 rounded font-bold">Opsional</span>
                </h3>
                <div>
                    <textarea 
                        className="w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary transition-shadow p-3 text-sm placeholder:text-slate-400 min-h-[80px]" 
                        placeholder="Jelaskan alasan selisih stok (cth: Barang rusak, hilang, salah input)..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    ></textarea>
                </div>
            </section>
        </main>

        {/* Footer Actions */}
        <footer className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 pb-8 safe-area-pb">
            <div className="max-w-lg mx-auto flex gap-3">
                <button 
                    onClick={() => {
                        setSku('');
                        setPhysicalQty(0);
                        setFoundItem(null);
                        setNotes('');
                        setEvidencePhotos([]);
                    }}
                    className="flex-1 h-12 flex items-center justify-center rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                    Reset
                </button>
                <button 
                    onClick={handleSubmit}
                    className="flex-[2] h-12 flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-500/30 transition-all active:scale-[0.98]"
                >
                    <span className="material-symbols-outlined text-[20px] filled">check_circle</span>
                    Simpan Opname
                </button>
            </div>
        </footer>

    </div>
  );
};

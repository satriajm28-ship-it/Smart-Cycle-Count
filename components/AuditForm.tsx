
import React, { useState, useEffect, useRef } from 'react';
import { saveAuditLog, getAuditLogs, getMasterData } from '../services/storageService';
import { MasterItem, AuditRecord } from '../types';
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

  const [sku, setSku] = useState('');
  const [location, setLocation] = useState(initialLocation || '');
  const [physicalQty, setPhysicalQty] = useState<number>(0);
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [teamName, setTeamName] = useState(() => localStorage.getItem('team_member_name') || '');
  const [notes, setNotes] = useState('');
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);
  
  const [foundItem, setFoundItem] = useState<MasterItem | null>(null);
  const [itemHistory, setItemHistory] = useState<AuditRecord[]>([]);
  const [existingTotal, setExistingTotal] = useState(0);

  const [scannerType, setScannerType] = useState<'sku' | 'location' | null>(null);
  const [timestamp, setTimestamp] = useState(new Date());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannedOverrides = useRef<{ batch?: string; expiry?: string }>({});

  useEffect(() => {
      if (teamName) localStorage.setItem('team_member_name', teamName);
  }, [teamName]);

  useEffect(() => {
    let mounted = true;
    const initData = async () => {
        setLoadingData(true);
        try {
            const items = await getMasterData();
            if (mounted) setAllMasterItems(items);
        } catch (err) {
            console.error(err);
        } finally {
            if (mounted) setLoadingData(false);
        }
    };
    initData();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setTimestamp(new Date()), 60000); 
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (loadingData) return;

    if (sku.length >= 3) {
      const matchingItems = allMasterItems.filter(i => i.sku.toLowerCase() === sku.toLowerCase());
      const item = matchingItems.length > 0 ? matchingItems[0] : null;
      setFoundItem(item || null);

      if (item) {
        if (scannedOverrides.current.batch) setBatchNumber(scannedOverrides.current.batch);
        else setBatchNumber(item.batchNumber);

        if (scannedOverrides.current.expiry) setExpiryDate(scannedOverrides.current.expiry);
        else setExpiryDate(item.expiryDate);
        
        const fetchHistory = async () => {
            const allLogs = await getAuditLogs();
            const history = allLogs.filter(log => log.sku === item.sku);
            setItemHistory(history);
            setExistingTotal(history.reduce((sum, log) => sum + log.physicalQty, 0));
        };
        fetchHistory();
        scannedOverrides.current = {};
      } else {
        setItemHistory([]);
        setExistingTotal(0);
        if (scannedOverrides.current.batch) setBatchNumber(scannedOverrides.current.batch);
        if (scannedOverrides.current.expiry) setExpiryDate(scannedOverrides.current.expiry);
        scannedOverrides.current = {};
      }
    } else {
      setFoundItem(null);
      setItemHistory([]);
      setExistingTotal(0);
    }
  }, [sku, loadingData, allMasterItems]);

  const systemStock = foundItem 
    ? allMasterItems
        .filter(i => i.sku.toLowerCase() === sku.toLowerCase())
        .reduce((sum, i) => sum + i.systemStock, 0)
    : 0;

  const globalTotal = existingTotal + (physicalQty || 0);
  const variance = globalTotal - systemStock;
  const activeItemName = foundItem ? foundItem.name : 'Unknown Item (New)';
  const percentDiff = (systemStock > 0) ? Math.round((Math.abs(variance) / systemStock) * 100) : 0;
  const isSignificant = systemStock > 0 && percentDiff > 10;

  const handleSkuInput = (val: string) => {
    if (val.includes(',')) {
        const parts = val.split(',');
        if (parts.length >= 1) setSku(parts[0].trim());
        if (parts.length >= 2) {
            const b = parts[1].trim();
            setBatchNumber(b);
            scannedOverrides.current.batch = b;
        }
        if (parts.length >= 3) {
            let rawDate = parts[2].trim();
            if (rawDate.length === 8 && !rawDate.includes('-')) {
                rawDate = `${rawDate.substring(4, 8)}-${rawDate.substring(2, 4)}-${rawDate.substring(0, 2)}`;
            }
            setExpiryDate(rawDate);
            scannedOverrides.current.expiry = rawDate;
        }
        return;
    }
    setSku(val);
  };

  const handleScanSuccess = (decodedText: string) => {
    if (scannerType === 'sku') handleSkuInput(decodedText);
    else if (scannerType === 'location') setLocation(decodedText.toUpperCase());
    setScannerType(null);
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => { if (reader.result) setEvidencePhotos(prev => [...prev, reader.result as string]); };
        reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!sku) { alert("Mohon scan barang."); return; }
    if (isSignificant && evidencePhotos.length === 0) { alert("Foto bukti wajib diisi untuk selisih signifikan!"); return; }
    await saveAuditLog({
      id: uuidv4(),
      sku, itemName: activeItemName, location, batchNumber: batchNumber || 'N/A', expiryDate: expiryDate || 'N/A',
      systemQty: systemStock, physicalQty, variance, timestamp: Date.now(), teamMember: teamName, notes, evidencePhotos
    }); 
    onSuccess();
  };

  if (loadingData) return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#050A18] text-white">
          <Logo size={80} className="animate-pulse mb-4" />
          <span className="text-sm font-bold uppercase">Syncing...</span>
      </div>
  );

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display min-h-screen flex flex-col antialiased">
        <ScannerModal isOpen={!!scannerType} onClose={() => setScannerType(null)} onScanSuccess={handleScanSuccess} title={scannerType === 'sku' ? "Scan Barang" : "Scan Lokasi"} />

        <nav className="sticky top-0 z-20 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
            <button onClick={onSuccess} className="w-10 h-10 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 flex items-center justify-center">
                <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="flex flex-col items-center">
                <div className="flex items-center gap-2">
                    <Logo size={24} />
                    <h1 className="text-sm font-black uppercase tracking-tight">Input Audit</h1>
                </div>
                <span className="text-[9px] font-bold text-primary uppercase tracking-widest leading-none">MEDIKA BINA INVESTAMA</span>
            </div>
            <div className="w-10"></div>
        </nav>

        <main className="flex-1 px-4 pt-4 pb-36 max-w-lg mx-auto w-full">
            <div className="flex items-center justify-end mb-6">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-200 dark:bg-slate-800 rounded-full">
                    <span className="material-symbols-outlined text-[16px] text-slate-500">schedule</span>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{timestamp.toLocaleDateString()} {timestamp.toLocaleTimeString()}</p>
                </div>
            </div>

            <section className="mb-6">
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">Petugas</h3>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined">groups</span>
                    </div>
                    <input className="text-sm font-bold bg-transparent border-none p-0 focus:ring-0 w-full" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Nama Petugas..." />
                </div>
            </section>

            <section className="mb-6 space-y-4">
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">Item Details</h3>
                <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">Kode Barang</label>
                    <div className="relative flex items-center">
                        <input className="w-full h-12 pl-4 pr-14 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 font-mono" placeholder="Scan item..." type="text" value={sku} onChange={(e) => handleSkuInput(e.target.value)} />
                        <button onClick={() => setScannerType('sku')} className="absolute right-1 top-1 bottom-1 w-12 bg-primary text-white rounded-lg flex items-center justify-center">
                            <span className="material-symbols-outlined">barcode_scanner</span>
                        </button>
                    </div>
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 space-y-4">
                    <div>
                        <span className="text-[10px] text-slate-500 block mb-1 uppercase">Nama Barang</span>
                        <p className="text-sm font-bold">{activeItemName}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <span className="text-[10px] text-slate-500 block mb-1 uppercase">Batch</span>
                            <input className="w-full p-2 rounded-lg border border-slate-200 text-sm font-medium" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-500 block mb-1 uppercase">Expired</span>
                            <input type="date" className="w-full p-2 rounded-lg border border-slate-200 text-sm font-medium" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                        </div>
                    </div>
                </div>
            </section>

            <section className="mb-6">
                <h3 className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-2 px-1">Lokasi Rak</h3>
                <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-primary/20">
                    <div className="relative flex items-center">
                        <input className="w-full h-12 pl-4 pr-14 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 uppercase" placeholder="Scan Lokasi..." type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
                        <button onClick={() => setScannerType('location')} className="absolute right-1 top-1 bottom-1 w-12 bg-primary text-white rounded-lg flex items-center justify-center">
                            <span className="material-symbols-outlined">qr_code_scanner</span>
                        </button>
                    </div>
                </div>
            </section>

            <section className="mb-6">
                <h3 className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">Stok Fisik</h3>
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 flex gap-3 items-center">
                        <button onClick={() => setPhysicalQty(prev => Math.max(0, prev - 1))} className="w-10 h-10 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500">
                            <span className="material-symbols-outlined">remove</span>
                        </button>
                        <input className="flex-1 h-10 text-center text-xl font-bold font-mono text-primary bg-slate-50 border-none rounded-lg" type="number" value={physicalQty} onChange={(e) => setPhysicalQty(parseInt(e.target.value) || 0)} />
                        <button onClick={() => setPhysicalQty(prev => prev + 1)} className="w-10 h-10 rounded-lg bg-primary text-white flex items-center justify-center">
                            <span className="material-symbols-outlined">add</span>
                        </button>
                    </div>
                    {foundItem && (
                        <div className={`px-4 py-3 border-t ${isSignificant ? 'bg-red-50' : 'bg-slate-50'}`}>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-700">Variance vs System ({systemStock})</span>
                                <span className={`text-base font-black ${isSignificant ? 'text-red-600' : 'text-primary'}`}>{variance > 0 ? '+' : ''}{variance}</span>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </main>

        <footer className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 p-4 pb-8 safe-area-pb">
            <div className="max-w-lg mx-auto flex gap-3">
                <button onClick={() => { setSku(''); setPhysicalQty(0); }} className="flex-1 h-12 rounded-xl border border-slate-300 font-medium">Reset</button>
                <button onClick={handleSubmit} className="flex-[2] h-12 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/30">Simpan Audit</button>
            </div>
        </footer>
    </div>
  );
};

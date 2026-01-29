
import React, { useState, useEffect } from 'react';
import { findItemBySku, saveAuditLog, getAuditLogs } from '../services/storageService';
import { MasterItem, AuditRecord } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface AuditFormProps {
  onSuccess: () => void;
  initialLocation?: string; // Allow pre-filling location from checklist
}

export const AuditForm: React.FC<AuditFormProps> = ({ onSuccess, initialLocation }) => {
  // Form State
  const [sku, setSku] = useState('BRG-882910');
  const [location, setLocation] = useState(initialLocation || 'RACK-C-02-B');
  const [physicalQty, setPhysicalQty] = useState<number>(15);
  const [teamName, setTeamName] = useState('Tim Gudang A - Shift 2');
  const [notes, setNotes] = useState('');
  
  // Logic State
  const [foundItem, setFoundItem] = useState<MasterItem | null>(null);
  const [itemHistory, setItemHistory] = useState<AuditRecord[]>([]);
  const [existingTotal, setExistingTotal] = useState(0);
  
  // Scanned specific data (overrides master data if present)
  const [scannedBatch, setScannedBatch] = useState<string | null>(null);
  const [scannedExpiry, setScannedExpiry] = useState<string | null>(null);

  const [timestamp, setTimestamp] = useState(new Date());
  const [isScanningSku, setIsScanningSku] = useState(false);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setTimestamp(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Lookup Item and History
  useEffect(() => {
    if (sku.length >= 3) {
      const item = findItemBySku(sku);
      setFoundItem(item || null);

      if (item) {
        const allLogs = getAuditLogs();
        const history = allLogs.filter(log => log.sku === item.sku);
        setItemHistory(history);
        const total = history.reduce((sum, log) => sum + log.physicalQty, 0);
        setExistingTotal(total);
      } else {
        setItemHistory([]);
        setExistingTotal(0);
      }
    } else {
      setFoundItem(null);
      setItemHistory([]);
      setExistingTotal(0);
    }
  }, [sku]);

  // Derived Values
  const globalTotal = existingTotal + (physicalQty || 0);
  const systemStock = foundItem ? foundItem.systemStock : 0;
  const variance = foundItem ? globalTotal - systemStock : 0;
  const hasDiscrepancy = foundItem && variance !== 0;
  
  // Determine which batch/expiry to use (Scanned takes priority over Master)
  const activeBatch = scannedBatch || (foundItem ? foundItem.batchNumber : '-');
  const activeExpiry = scannedExpiry || (foundItem ? foundItem.expiryDate : '-');

  // Percent Diff Calculation
  const percentDiff = (foundItem && systemStock > 0) 
    ? Math.round((Math.abs(variance) / systemStock) * 100) 
    : 0;
  
  const isSignificant = percentDiff > 10;

  // Handle Input with Parsing Logic
  const handleSkuInput = (val: string) => {
    // Check format: CODE,BATCH,EXPIRY (e.g., 123BX,12345GG,30093039)
    if (val.includes(',')) {
        const parts = val.split(',');
        if (parts.length >= 3) {
            const cleanSku = parts[0].trim();
            const batch = parts[1].trim();
            const rawDate = parts[2].trim(); // Expecting DDMMYYYY

            // Parse Date DDMMYYYY -> YYYY-MM-DD
            let formattedDate = rawDate;
            if (rawDate.length === 8) {
                const day = rawDate.substring(0, 2);
                const month = rawDate.substring(2, 4);
                const year = rawDate.substring(4);
                formattedDate = `${year}-${month}-${day}`;
            }

            setSku(cleanSku);
            setScannedBatch(batch);
            setScannedExpiry(formattedDate);
            return;
        }
    }

    // Default behavior
    setSku(val);
    setScannedBatch(null);
    setScannedExpiry(null);
  };

  const handleScanSku = () => {
    setIsScanningSku(true);
    setTimeout(() => {
      setIsScanningSku(false);
      // Simulate the specific requested format
      handleSkuInput('123BX,12345GG,30093039'); 
    }, 500);
  };

  const handleQtyChange = (val: number) => {
    setPhysicalQty(val >= 0 ? val : 0);
  };

  const handleSubmit = () => {
    if (!foundItem || !location) {
        alert("Mohon lengkapi data barang dan lokasi.");
        return;
    }

    if (isSignificant && !notes.trim()) {
        alert("Wajib mengisi Catatan/Alasan jika terdapat selisih signifikan (>10%)!");
        return;
    }

    const record: AuditRecord = {
      id: uuidv4(),
      sku: foundItem.sku,
      itemName: foundItem.name,
      location,
      batchNumber: activeBatch, // Save the actual batch used
      expiryDate: activeExpiry, // Save the actual expiry used
      systemQty: foundItem.systemStock,
      physicalQty: physicalQty,
      variance: variance, 
      timestamp: Date.now(),
      teamMember: teamName,
      notes: notes
    };

    saveAuditLog(record); 
    onSuccess();
  };

  // Helper values for display
  const dateStr = timestamp.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col min-h-screen bg-[#f6f6f8] text-slate-900 pb-32 font-display">
      
      {/* Navbar */}
      <nav className="sticky top-0 z-20 bg-[#f6f6f8]/95 backdrop-blur-sm border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <button onClick={onSuccess} className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-200 transition-colors text-slate-700">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex flex-col items-center">
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Stock Opname</h1>
            <span className="text-[10px] font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">Multi-Location Mode</span>
        </div>
        <div className="w-10"></div>
      </nav>

      <main className="flex-1 flex flex-col px-4 pt-4 max-w-lg mx-auto w-full">
        
        {/* Time Info */}
        <div className="flex items-center justify-end mb-6">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-200 rounded-full">
            <span className="material-symbols-outlined text-[16px] text-slate-500">schedule</span>
            <p className="text-xs font-medium text-slate-600">{dateStr}, {timeStr}</p>
          </div>
        </div>

        {/* Team Section */}
        <section className="mb-6">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">Team Pelaksana</h3>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 flex items-center justify-between group">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 text-primary">
                <span className="material-symbols-outlined">groups</span>
              </div>
              <div className="flex flex-col truncate">
                <span className="text-sm text-slate-500">Current Team</span>
                <input 
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="text-base font-medium text-slate-900 truncate border-none p-0 focus:ring-0 w-full"
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
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">Item Details</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Kode Barang</label>
            <div className="relative flex items-center">
              <input 
                className="w-full h-12 pl-4 pr-14 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary transition-shadow font-mono text-base placeholder:text-slate-400" 
                placeholder="Scan format: Code,Batch,Date" 
                type="text" 
                value={sku}
                onChange={(e) => handleSkuInput(e.target.value)}
              />
              <button 
                onClick={handleScanSku}
                className="absolute right-1 top-1 bottom-1 w-12 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg flex items-center justify-center transition-colors"
              >
                 {isScanningSku ? <span className="animate-spin">...</span> : <span className="material-symbols-outlined">barcode_scanner</span>}
              </button>
            </div>
            {foundItem && (
                 <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    Item found {scannedBatch && <span className="text-slate-500 ml-1">(Scan Parsed)</span>}
                </p>
            )}
             {!foundItem && sku.length > 3 && (
                 <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    Item not found
                </p>
            )}
          </div>

          {foundItem && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-4 animate-fade-in">
                <div>
                <span className="text-xs text-slate-500 block mb-1">Nama Barang</span>
                <p className="text-base font-medium text-slate-800">{foundItem.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                <div>
                    <span className="text-xs text-slate-500 block mb-1">Batch Number</span>
                    <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">tag</span>
                    <p className={`text-sm font-medium ${scannedBatch ? 'text-primary font-bold' : 'text-slate-700'}`}>
                        {activeBatch}
                    </p>
                    </div>
                </div>
                <div>
                    <span className="text-xs text-slate-500 block mb-1">Expired Date</span>
                    <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-slate-400">event_busy</span>
                    <p className={`text-sm font-medium ${scannedExpiry ? 'text-primary font-bold' : new Date(activeExpiry) < new Date() ? 'text-red-600' : 'text-slate-700'}`}>
                        {activeExpiry}
                    </p>
                    </div>
                </div>
                </div>
            </div>
          )}
        </section>

        {foundItem && (
            <>
                {/* History Breakdown */}
                <section className="mb-6 animate-fade-in">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Riwayat Lokasi (Breakdown)</h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">{itemHistory.length} Lokasi Lain Ditemukan</span>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500">
                            <div className="col-span-8">Location</div>
                            <div className="col-span-4 text-right">Qty</div>
                        </div>
                        
                        {itemHistory.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400 italic">Belum ada data scan sebelumnya untuk item ini.</div>
                        ) : (
                            itemHistory.map((log) => (
                                <div key={log.id} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-100 items-center hover:bg-slate-50 transition-colors">
                                    <div className="col-span-8">
                                        <div className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                            {log.location}
                                            <span className="material-symbols-outlined text-green-500 text-[14px]">verified</span>
                                        </div>
                                        <div className="text-[10px] text-slate-400">Rec: {log.teamMember.split(' ')[0]} • {new Date(log.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
                                    </div>
                                    <div className="col-span-4 text-right">
                                        <span className="text-sm font-mono font-medium text-slate-600">{log.physicalQty}</span>
                                    </div>
                                </div>
                            ))
                        )}

                        <div className="flex justify-between items-center px-4 py-3 bg-slate-50/80">
                            <span className="text-xs font-semibold text-slate-500 uppercase">Total Lokasi Lain (Existing)</span>
                            <span className="text-base font-mono font-bold text-slate-700">{existingTotal}</span>
                        </div>
                    </div>
                </section>

                {/* New Location Entry */}
                <section className="mb-6 animate-fade-in">
                    <div className="flex items-center justify-between mb-2 px-1">
                        <h3 className="text-sm font-semibold text-primary uppercase tracking-wider flex items-center gap-1">
                            <span className="material-symbols-outlined text-base">add_location_alt</span>
                            Entry Lokasi Baru (Current)
                        </h3>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-primary/20 ring-1 ring-primary/5">
                        <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase">Lokasi Saat Ini (Scan QR)</label>
                        <div className="relative flex items-center">
                            <input 
                                className="w-full h-12 pl-4 pr-14 rounded-xl border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary transition-shadow font-mono text-base uppercase placeholder:text-slate-400" 
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

                {/* Global Calculation Card */}
                <section className="mb-4 animate-fade-in">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">Global Calculation</h3>
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        
                        {/* Math Formula Bar */}
                        <div className="grid grid-cols-[1fr,auto,1fr,auto,1fr] gap-1 p-4 items-center bg-slate-50 border-b border-slate-100">
                            <div className="text-center">
                                <span className="block text-[10px] uppercase text-slate-400 font-bold tracking-wider mb-1">Existing</span>
                                <span className="block text-lg font-mono font-medium text-slate-600">{existingTotal}</span>
                            </div>
                            <div className="text-slate-300 font-bold text-lg">+</div>
                            <div className="text-center">
                                <span className="block text-[10px] uppercase text-primary font-bold tracking-wider mb-1">Current</span>
                                <span className="block text-lg font-mono font-bold text-primary underline decoration-2 decoration-primary/30 underline-offset-4">{physicalQty}</span>
                            </div>
                            <div className="text-slate-300 font-bold text-lg">=</div>
                            <div className="text-center relative">
                                <span className="block text-[10px] uppercase text-slate-900 font-bold tracking-wider mb-1">Total Global</span>
                                <span className="block text-xl font-mono font-black text-slate-900">{globalTotal}</span>
                                <div className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="p-5">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-bold text-slate-700">Jumlah Fisik (Lokasi Ini)</label>
                                <span className="text-xs text-slate-400">Masukkan hitungan di sini</span>
                            </div>
                            <div className="flex gap-4">
                                <button 
                                    onClick={() => handleQtyChange(physicalQty - 1)}
                                    className="w-14 h-14 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 active:scale-95 transition-all"
                                >
                                    <span className="material-symbols-outlined">remove</span>
                                </button>
                                <input 
                                    className="flex-1 h-14 text-center text-3xl font-bold font-mono text-primary bg-white border-2 border-primary rounded-xl focus:ring-4 focus:ring-primary/20 transition-all outline-none" 
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

                        {/* System Comparison */}
                        <div className={`border-t p-4 ${isSignificant ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold uppercase text-slate-500">Target (Stok Sistem)</span>
                                <span className="text-base font-mono font-bold text-slate-700">{systemStock}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className={`text-sm font-bold flex items-center gap-1.5 ${isSignificant ? 'text-red-600' : 'text-slate-600'}`}>
                                    {isSignificant && <span className="material-symbols-outlined text-[18px]">warning</span>}
                                    Selisih (Global vs Sistem)
                                </span>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xl font-mono font-black ${isSignificant ? 'text-red-600' : variance === 0 ? 'text-green-600' : 'text-slate-700'}`}>
                                        {variance > 0 ? '+' : ''}{variance}
                                    </span>
                                    {isSignificant && (
                                        <span className="text-xs font-bold bg-red-200 text-red-800 px-2 py-1 rounded-md">{percentDiff}%</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Significant Warning */}
                {isSignificant && (
                    <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg animate-pulse" role="alert">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <span className="material-symbols-outlined text-red-500 text-[24px]">warning</span>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-bold text-red-800">Peringatan: Selisih Signifikan!</h3>
                                <div className="mt-1 text-sm text-red-700">
                                    <p>Total Global ({globalTotal}) berbeda lebih dari 10% dari Stok Sistem ({systemStock}). Mohon verifikasi semua lokasi atau berikan alasan.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Mandatory Notes */}
                {isSignificant && (
                    <section className="mb-6 animate-fade-in">
                        <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wider mb-2 px-1 flex items-center gap-1">
                            Catatan / Alasan
                            <span className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded font-bold">Wajib Diisi</span>
                        </h3>
                        <div>
                            <textarea 
                                className="w-full rounded-xl border-red-300 bg-white text-slate-900 focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-shadow p-3 text-sm placeholder:text-slate-400 min-h-[80px]" 
                                placeholder="Jelaskan alasan selisih stok (cth: Barang rusak, hilang, salah input)..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                            <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">info</span>
                                Penjelasan diperlukan untuk selisih {percentDiff}%
                            </p>
                        </div>
                    </section>
                )}
            </>
        )}

      </main>

      {/* Footer Actions */}
      <footer className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 p-4 pb-8 safe-area-pb">
        <div className="max-w-lg mx-auto flex gap-3">
          <button 
            onClick={() => {
                setSku('');
                setPhysicalQty(0);
                setFoundItem(null);
                setNotes('');
                setItemHistory([]);
                setScannedBatch(null);
                setScannedExpiry(null);
            }}
            className="flex-1 h-12 flex items-center justify-center rounded-xl border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
          >
            Reset
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!foundItem}
            className={`flex-[2] h-12 flex items-center justify-center gap-2 rounded-xl font-bold shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:shadow-none ${isSignificant ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-500/30' : 'bg-primary hover:bg-blue-700 text-white shadow-blue-500/30'}`}
          >
            {isSignificant ? (
                <>
                    <span className="material-symbols-outlined text-[20px] filled">warning</span>
                    Konfirmasi & Simpan
                </>
            ) : (
                <>
                    <span className="material-symbols-outlined text-[20px]">save</span>
                    Simpan Data
                </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
};

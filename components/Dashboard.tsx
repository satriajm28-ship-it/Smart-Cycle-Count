
import React, { useState, useEffect, useCallback } from 'react';
import { 
  subscribeToAuditLogs, 
  subscribeToMasterData, 
  getMasterLocations, 
  subscribeToLocationStates,
  deleteAuditLog,
  updateAuditLog
} from '../services/storageService';
import { AuditRecord, AppView, MasterItem, LocationState, MasterLocation } from '../types';
import * as XLSX from 'xlsx';
import { Pencil, Trash2, X, Save, AlertTriangle } from 'lucide-react';

interface DashboardProps {
  onNavigate: (view: AppView) => void;
}

interface GroupedItem {
  sku: string;
  name: string;
  unit: string;
  logs: AuditRecord[];
  totalSystem: number;
  totalPhysical: number;
  variance: number;
  status: 'matched' | 'shortage' | 'surplus';
  locationsCount: number;
  master?: MasterItem;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [groupedData, setGroupedData] = useState<GroupedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  
  // Team State
  const [teamName, setTeamName] = useState(() => localStorage.getItem('team_member_name') || '');

  // Edit State
  const [editingLog, setEditingLog] = useState<AuditRecord | null>(null);
  const [editForm, setEditForm] = useState({
      physicalQty: 0,
      location: '',
      batchNumber: '',
      expiryDate: '',
      notes: ''
  });

  // Image Preview State
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const [stats, setStats] = useState({
    totalAudited: 0,
    totalLocations: 0,
    locAudited: 0,
    locEmpty: 0,
    locDamaged: 0,
    netVariance: 0,
    accuracy: "100",
    criticalItems: 0
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'shortage' | 'surplus'>('all');

  // Using refs to keep data fresh within the process function without triggering excessive re-renders
  const dataRefs = React.useRef<{
    logs: AuditRecord[];
    master: MasterItem[];
    locations: MasterLocation[];
    states: Record<string, LocationState>;
  }>({
    logs: [],
    master: [],
    locations: [],
    states: {}
  });

  const processDashboardData = useCallback(() => {
    const { logs, master, locations, states } = dataRefs.current;
    
    // We can process even if some data is empty, as long as we have master data
    const masterMap = new Map<string, MasterItem[]>();
    master.forEach(m => {
        if (!masterMap.has(m.sku)) masterMap.set(m.sku, []);
        masterMap.get(m.sku)?.push(m);
    });

    const getSystemStock = (sku: string) => {
        const items = masterMap.get(sku) || [];
        return items.reduce((sum, item) => sum + item.systemStock, 0);
    };

    const getMasterInfo = (sku: string) => {
        const items = masterMap.get(sku);
        return items && items.length > 0 ? items[0] : undefined;
    };

    const groups: Record<string, GroupedItem> = {};
    logs.forEach(log => {
        if (!groups[log.sku]) {
            const m = getMasterInfo(log.sku);
            groups[log.sku] = {
                sku: log.sku,
                name: log.itemName,
                unit: m?.unit || 'Pcs',
                logs: [],
                totalSystem: getSystemStock(log.sku),
                totalPhysical: 0, 
                variance: 0,
                status: 'matched',
                locationsCount: 0,
                master: m
            };
        }
        groups[log.sku].logs.push(log);
        groups[log.sku].totalPhysical += log.physicalQty; 
    });

    let globalVariance = 0, criticalCount = 0, totalAuditQty = 0;
    const finalGroups = Object.values(groups).map(g => {
        g.variance = g.totalPhysical - g.totalSystem;
        globalVariance += g.variance;
        totalAuditQty += g.totalPhysical;
        if (g.variance < 0) { g.status = 'shortage'; criticalCount++; }
        else if (g.variance > 0) { g.status = 'surplus'; }
        g.locationsCount = new Set(g.logs.map(l => l.location)).size;
        return g;
    });

    setGroupedData(finalGroups);

    let la = 0, le = 0, ld = 0;
    // Fix: Explicitly typed 's' as LocationState to resolve 'property status does not exist on type unknown' error
    Object.values(states).forEach((s: LocationState) => {
        if (s.status === 'audited') la++;
        if (s.status === 'empty') le++;
        if (s.status === 'damaged') ld++;
    });

    const accurateItems = finalGroups.filter(g => g.variance === 0).length;
    const accuracyStr = finalGroups.length > 0 ? ((accurateItems / finalGroups.length) * 100).toFixed(1) : "100";

    setStats({
        totalAudited: totalAuditQty,
        totalLocations: locations.length || 1,
        locAudited: la,
        locEmpty: le,
        locDamaged: ld,
        netVariance: globalVariance,
        accuracy: accuracyStr,
        criticalItems: criticalCount
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    // Initial fetch for locations (usually static-ish)
    getMasterLocations().then(locs => {
        dataRefs.current.locations = locs;
        processDashboardData();
    });

    const handleListenerError = (err: any) => {
        if (err.code === 'permission-denied') {
            setErrorStatus("Akses Database Dibatasi. Cek aturan keamanan Firebase.");
        }
    };

    const unsubLogs = subscribeToAuditLogs(data => { 
        dataRefs.current.logs = data; 
        processDashboardData(); 
    }, handleListenerError);

    const unsubMaster = subscribeToMasterData(data => { 
        dataRefs.current.master = data; 
        processDashboardData(); 
    }, handleListenerError);

    const unsubStates = subscribeToLocationStates(data => { 
        dataRefs.current.states = data; 
        processDashboardData(); 
    }, handleListenerError);

    return () => {
        unsubLogs();
        unsubMaster();
        unsubStates();
    };
  }, [processDashboardData]);

  // --- CRUD HANDLERS ---
  
  const handleDelete = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm("Apakah Anda yakin ingin menghapus data scan ini? Tindakan ini tidak dapat dibatalkan.")) {
          try {
              await deleteAuditLog(id);
              // State updates automatically via subscription
          } catch (error) {
              alert("Gagal menghapus data.");
          }
      }
  };

  const handleEditClick = (log: AuditRecord, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingLog(log);
      setEditForm({
          physicalQty: log.physicalQty,
          location: log.location,
          batchNumber: log.batchNumber,
          expiryDate: log.expiryDate,
          notes: log.notes || ''
      });
  };

  const handleUpdateSubmit = async () => {
      if (!editingLog) return;
      try {
          await updateAuditLog(editingLog.id, {
              physicalQty: editForm.physicalQty,
              location: editForm.location,
              batchNumber: editForm.batchNumber,
              expiryDate: editForm.expiryDate,
              notes: editForm.notes
          });
          setEditingLog(null);
      } catch (error) {
          alert("Gagal mengupdate data.");
      }
  };

  const handleExportReport = () => {
    const exportRows = groupedData.flatMap(group => 
        group.logs.map(log => ({
            "Kode Barang": group.sku,
            "Nama Barang": group.name,
            "Nama Satuan": group.unit,
            "QTY Fisik": log.physicalQty,
            "Team Warehouse": log.teamMember,
            "batch & ED": `${log.batchNumber} / ${log.expiryDate}`,
            "Lokasi": log.location,
            "Catatan": log.notes || '-'
        }))
    );
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "StockOpname");
    XLSX.writeFile(wb, `Audit_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleTeamNameChange = (val: string) => {
      setTeamName(val);
      localStorage.setItem('team_member_name', val);
  };

  const filteredGroups = groupedData.filter(g => {
      const matchSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase()) || g.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFilter = activeFilter === 'all' ? true : g.status === activeFilter;
      return matchSearch && matchFilter;
  });

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background-light dark:bg-background-dark text-slate-400 font-display">
        <span className="material-symbols-outlined animate-spin text-4xl mb-2">sync</span>
        <p className="text-sm">Menghubungkan ke Database...</p>
    </div>
  );

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen pb-24 font-display">
      
      {errorStatus && (
          <div className="bg-amber-100 text-amber-800 text-[10px] px-4 py-1.5 flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[14px]">warning</span>
              {errorStatus} - Menggunakan Cache Offline
          </div>
      )}

      {/* --- IMAGE LIGHTBOX --- */}
      {previewImage && (
        <div 
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setPreviewImage(null)}
        >
            <button className="absolute top-4 right-4 text-white hover:text-slate-300">
                <X size={32} />
            </button>
            <img 
                src={previewImage} 
                className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
                alt="Evidence Fullscreen"
                onClick={(e) => e.stopPropagation()}
            />
        </div>
      )}

      {/* --- EDIT MODAL --- */}
      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Pencil size={18} className="text-primary" /> Edit Data Scan
                    </h3>
                    <button onClick={() => setEditingLog(null)} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg text-xs mb-2">
                         <span className="block font-bold text-slate-700 dark:text-slate-200">{editingLog.itemName}</span>
                         <span className="font-mono text-slate-500">{editingLog.sku}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Qty Fisik</label>
                            <input 
                                type="number" 
                                value={editForm.physicalQty}
                                onChange={e => setEditForm({...editForm, physicalQty: Number(e.target.value)})}
                                className="w-full rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-950 p-2 text-sm font-bold text-center"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Lokasi</label>
                            <input 
                                type="text" 
                                value={editForm.location}
                                onChange={e => setEditForm({...editForm, location: e.target.value})}
                                className="w-full rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-950 p-2 text-sm uppercase"
                            />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Batch</label>
                            <input 
                                type="text" 
                                value={editForm.batchNumber}
                                onChange={e => setEditForm({...editForm, batchNumber: e.target.value})}
                                className="w-full rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-950 p-2 text-xs"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Expired</label>
                            <input 
                                type="date" 
                                value={editForm.expiryDate}
                                onChange={e => setEditForm({...editForm, expiryDate: e.target.value})}
                                className="w-full rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-950 p-2 text-xs"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Catatan</label>
                        <textarea 
                            value={editForm.notes}
                            onChange={e => setEditForm({...editForm, notes: e.target.value})}
                            className="w-full rounded-lg border-slate-300 dark:border-slate-600 dark:bg-slate-950 p-2 text-xs h-16"
                        />
                    </div>
                </div>
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                    <button onClick={() => setEditingLog(null)} className="flex-1 py-2 text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm">Batal</button>
                    <button onClick={handleUpdateSubmit} className="flex-1 py-2 bg-primary text-white font-bold rounded-lg text-sm hover:bg-primary/90 flex items-center justify-center gap-2">
                        <Save size={16} /> Simpan
                    </button>
                </div>
            </div>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-white/90 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">Dashboard Audit (Live)</h1>
        <button onClick={handleExportReport} className="p-2 rounded-full text-green-600 hover:bg-green-50"><span className="material-symbols-outlined">ios_share</span></button>
      </header>

      {/* TEAM INPUT SECTION */}
      <section className="px-4 pt-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-3 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">badge</span>
              </div>
              <div className="flex-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Team Pelaksana</label>
                  <input 
                      type="text" 
                      value={teamName}
                      onChange={(e) => handleTeamNameChange(e.target.value)}
                      className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-900 dark:text-white focus:ring-0 placeholder-slate-400"
                      placeholder="Nama Tim / Petugas"
                  />
              </div>
              <span className="material-symbols-outlined text-slate-300">edit</span>
          </div>
      </section>

      <section className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-4 space-y-4 shadow-sm z-30 relative mt-4">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
                <span className="material-symbols-outlined text-slate-500 text-[20px]">search</span>
                <input 
                    type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none p-0 focus:ring-0 text-sm w-full" 
                    placeholder="Cari SKU atau Nama Barang..." 
                />
            </div>
            <button onClick={() => setActiveFilter(activeFilter === 'all' ? 'shortage' : 'all')} className={`ml-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${activeFilter !== 'all' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {activeFilter === 'all' ? 'Filter: Semua' : 'Filter: Selisih'}
            </button>
        </div>
      </section>

      <section className="px-4 py-4 overflow-x-auto no-scrollbar flex gap-3">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 min-w-[140px]">
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Total Diaudit (Pcs)</p>
                <p className="text-xl font-bold">{stats.totalAudited}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 min-w-[140px]">
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Akurasi</p>
                <p className="text-xl font-bold">{stats.accuracy}%</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 min-w-[140px]">
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Item Selisih</p>
                <p className="text-xl font-bold text-red-600">{stats.criticalItems}</p>
            </div>
      </section>

      <main className="px-4 pb-4 space-y-3">
        {filteredGroups.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
                <span className="material-symbols-outlined text-4xl mb-2">inventory</span>
                <p>Data tidak ditemukan.</p>
            </div>
        ) : filteredGroups.map(group => (
            <details key={group.sku} className="group rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden transition-all">
                <summary className="cursor-pointer p-4 list-none flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex gap-3 items-center min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
                            <span className="material-symbols-outlined">inventory_2</span>
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm font-bold truncate">{group.name}</h3>
                            <p className="text-[10px] text-slate-500 font-mono">{group.sku}</p>
                        </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                        <span className={`text-xs font-bold ${group.variance < 0 ? 'text-red-600' : group.variance > 0 ? 'text-blue-600' : 'text-emerald-500'}`}>
                            {group.totalPhysical} / {group.totalSystem}
                        </span>
                        <span className="material-symbols-outlined text-slate-400 text-sm ml-2 group-open:rotate-180 transition-transform">expand_more</span>
                    </div>
                </summary>
                <div className="bg-slate-50 dark:bg-slate-950 p-4 space-y-2 border-t border-slate-100 dark:border-slate-800">
                    {group.logs.map(log => (
                        <div key={log.id} className="flex flex-col text-xs border-b border-slate-100 dark:border-slate-800 last:border-0 pb-3 last:pb-0 gap-2">
                            
                            {/* Top Row: Info & Actions */}
                            <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px] text-slate-400">location_on</span>
                                        {log.location}
                                    </p>
                                    <p className="text-[10px] text-slate-400 ml-5">Batch: {log.batchNumber} • Exp: {log.expiryDate}</p>
                                    <p className="text-[10px] text-slate-400 ml-5 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[10px]">badge</span>
                                        {log.teamMember}
                                    </p>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                    <span className="font-mono font-bold text-sm">{log.physicalQty} <span className="text-[10px] text-slate-400">{group.unit}</span></span>
                                    <div className="flex gap-1 ml-2">
                                        <button 
                                            onClick={(e) => handleEditClick(log, e)}
                                            className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button 
                                            onClick={(e) => handleDelete(log.id, e)}
                                            className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Middle Row: Notes */}
                            {log.notes && (
                                <div className="flex items-start gap-1.5 ml-5 bg-amber-50 dark:bg-amber-900/10 p-2 rounded-lg text-amber-800 dark:text-amber-500 border border-amber-100 dark:border-amber-900/20">
                                    <span className="material-symbols-outlined text-[14px] mt-0.5">sticky_note_2</span>
                                    <p className="text-[11px] italic leading-tight">{log.notes}</p>
                                </div>
                            )}

                            {/* Bottom Row: Evidence Photos */}
                            {log.evidencePhotos && log.evidencePhotos.length > 0 && (
                                <div className="ml-5 mt-1 flex gap-2 overflow-x-auto pb-1">
                                    {log.evidencePhotos.map((photo, idx) => (
                                        <div 
                                            key={idx} 
                                            className="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 cursor-zoom-in group"
                                            onClick={(e) => { e.stopPropagation(); setPreviewImage(photo); }}
                                        >
                                            <img src={photo} className="w-full h-full object-cover" alt="Evidence" />
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                                        </div>
                                    ))}
                                </div>
                            )}

                        </div>
                    ))}
                </div>
            </details>
        ))}
      </main>

      <nav className="fixed bottom-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe pt-2 px-2 z-30">
        <div className="flex justify-around items-center h-16">
            <button className="flex flex-col items-center gap-1 flex-1 text-primary">
                <span className="material-symbols-outlined filled">dashboard</span>
                <span className="text-[10px] font-medium">Dashboard</span>
            </button>
            <button onClick={() => onNavigate(AppView.FORM)} className="flex flex-col items-center gap-1 flex-1 text-slate-400">
                <span className="material-symbols-outlined">barcode_scanner</span>
                <span className="text-[10px] font-medium">Scan</span>
            </button>
            <button onClick={() => onNavigate(AppView.MASTER_DATA)} className="flex flex-col items-center gap-1 flex-1 text-slate-400">
                <span className="material-symbols-outlined">database</span>
                <span className="text-[10px] font-medium">Data</span>
            </button>
        </div>
      </nav>
    </div>
  );
};

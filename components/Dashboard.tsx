
import React, { useState, useEffect, useCallback } from 'react';
import { 
  subscribeToAuditLogs, 
  subscribeToMasterData, 
  getMasterLocations, 
  subscribeToLocationStates,
  deleteAuditLog,
  updateAuditLog,
  resetAllAuditData,
  restoreAuditData
} from '../services/storageService';
import { AuditRecord, AppView, MasterItem, LocationState, MasterLocation } from '../types';
import { Logo } from './Logo';
import * as XLSX from 'xlsx';
import { 
  Pencil, Trash2, X, Save, AlertTriangle, 
  Image as ImageIcon, ZoomIn, Search, 
  CheckCircle2, Package, MapPin, Clock, 
  BarChart3, Info, ChevronRight, LayoutDashboard,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw,
  RotateCcw
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (view: AppView) => void;
}

interface GroupedItem {
  sku: string;
  name: string;
  unit: string;
  category: string;
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
  
  const [teamName, setTeamName] = useState(() => localStorage.getItem('team_member_name') || '');

  const [editingLog, setEditingLog] = useState<AuditRecord | null>(null);
  const [editForm, setEditForm] = useState({
      physicalQty: 0,
      location: '',
      batchNumber: '',
      expiryDate: '',
      notes: ''
  });

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // State for Reset/Restore Process
  const [isResetting, setIsResetting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  
  const [stats, setStats] = useState({
    totalAudited: 0,
    totalLocations: 0,
    locAudited: 0,
    shortageCount: 0,
    surplusCount: 0,
    netVariance: 0,
    accuracy: "100"
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'shortage' | 'surplus' | 'matched'>('all');

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
    
    // Process online logs directly
    const combinedLogs = logs;

    const masterMap = new Map<string, MasterItem[]>();
    master.forEach(m => {
        if (!masterMap.has(m.sku)) masterMap.set(m.sku, []);
        masterMap.get(m.sku)?.push(m);
    });

    const groups: Record<string, GroupedItem> = {};
    combinedLogs.forEach(log => {
        if (!groups[log.sku]) {
            const items = masterMap.get(log.sku);
            const m = items && items.length > 0 ? items[0] : undefined;
            groups[log.sku] = {
                sku: log.sku,
                name: log.itemName,
                unit: m?.unit || 'Pcs',
                category: m?.category || 'General',
                logs: [],
                totalSystem: items?.reduce((sum, i) => sum + i.systemStock, 0) || 0,
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

    let globalVariance = 0, shortageItems = 0, surplusItems = 0, totalAuditQty = 0;
    const finalGroups = Object.values(groups).map(g => {
        g.variance = g.totalPhysical - g.totalSystem;
        globalVariance += g.variance;
        totalAuditQty += g.totalPhysical;
        if (g.variance < 0) { g.status = 'shortage'; shortageItems++; }
        else if (g.variance > 0) { g.status = 'surplus'; surplusItems++; }
        else { g.status = 'matched'; }
        g.locationsCount = new Set(g.logs.map(l => l.location)).size;
        return g;
    });

    setGroupedData(finalGroups);

    let la = 0;
    Object.values(states).forEach((s: LocationState) => {
        if (s.status === 'audited') la++;
    });

    const accurateItems = finalGroups.filter(g => g.variance === 0).length;
    const accuracyStr = finalGroups.length > 0 ? ((accurateItems / finalGroups.length) * 100).toFixed(1) : "100";

    setStats({
        totalAudited: totalAuditQty,
        totalLocations: locations.length || 1,
        locAudited: la,
        shortageCount: shortageItems,
        surplusCount: surplusItems,
        netVariance: globalVariance,
        accuracy: accuracyStr
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    getMasterLocations().then(locs => {
        dataRefs.current.locations = locs;
        processDashboardData();
    });

    const handleListenerError = (err: any) => {
        if (err.code === 'permission-denied') {
            setErrorStatus("Akses Dibatasi - Hubungi Admin");
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

    window.addEventListener('auditDataChanged', processDashboardData);

    return () => {
        unsubLogs();
        unsubMaster();
        unsubStates();
        window.removeEventListener('auditDataChanged', processDashboardData);
    };
  }, [processDashboardData]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
      e.preventDefault(); 
      e.stopPropagation(); 
      
      if (window.confirm("Hapus data scan ini?")) {
          try {
              // Delete from firestore/local
              await deleteAuditLog(id);
              // We rely on the subscribeToAuditLogs listener to update the UI
              // This prevents race conditions between manual filtering and snapshot updates
          } catch (error) {
              console.error("Delete failed:", error);
              alert("Gagal menghapus data.");
          }
      }
  };

  const handleEditClick = (log: AuditRecord, e: React.MouseEvent) => {
      e.preventDefault();
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
          // Listener will update UI
      } catch (error) {
          alert("Gagal update.");
      }
  };

  const handleResetAllData = async () => {
      if (window.confirm("PERINGATAN: Tindakan ini akan MEMINDAHKAN SEMUA DATA SCAN saat ini ke Backup dan mengosongkan Dashboard.\n\nDatabase Barang (Master Data) AMAN.\n\nLanjutkan reset?")) {
          setIsResetting(true);
          try {
              await resetAllAuditData();
              alert("Data berhasil di-reset. Siap untuk sesi audit baru.");
          } catch (e: any) {
              alert(e.message || "Gagal melakukan reset.");
          } finally {
              setIsResetting(false);
          }
      }
  };

  const handleRestoreData = async () => {
      if (window.confirm("KEMBALIKAN DATA?\n\nTindakan ini akan mengambil data dari BACKUP TERAKHIR dan menggabungkannya kembali ke Dashboard.\n\nApakah Anda yakin?")) {
          setIsRestoring(true);
          try {
              await restoreAuditData();
              alert("Data berhasil dikembalikan dari backup!");
          } catch (e: any) {
              alert(e.message || "Gagal mengembalikan data.");
          } finally {
              setIsRestoring(false);
          }
      }
  };

  const handleExportReport = () => {
    const exportRows = groupedData.flatMap(group => 
        group.logs.map(log => ({
            "Kode Barang": group.sku,
            "Nama Barang": group.name,
            "QTY Fisik": log.physicalQty,
            "Satuan": group.unit,
            "Lokasi": log.location,
            "Batch": log.batchNumber,
            "Expired": log.expiryDate,
            "Team": log.teamMember,
            "Catatan": log.notes || '-',
            "Jumlah Foto": log.evidencePhotos?.length || 0
        }))
    );
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AuditReport");
    XLSX.writeFile(wb, `Audit_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const filteredGroups = groupedData.filter(g => {
      const matchSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase()) || g.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFilter = activeFilter === 'all' ? true : g.status === activeFilter;
      return matchSearch && matchFilter;
  });

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background-dark text-white">
        <Logo size={80} className="animate-pulse mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest text-primary">Inisialisasi Dashboard...</p>
    </div>
  );

  return (
    <div className="bg-[#f8fafc] dark:bg-[#050A18] text-slate-900 dark:text-slate-100 min-h-screen pb-32 font-display">
      
      {/* PHOTO LIGHTBOX */}
      {previewImage && (
          <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewImage(null)}>
              <button className="absolute top-6 right-6 text-white bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
                  <X size={24} />
              </button>
              <img src={previewImage} alt="Bukti Audit" className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
          </div>
      )}

      {/* EDIT MODAL */}
      {editingLog && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-sm shadow-2xl overflow-hidden border border-white/5">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-primary text-white">
                    <h3 className="font-bold flex items-center gap-2 text-sm"><Pencil size={18} /> Edit Data Audit</h3>
                    <button onClick={() => setEditingLog(null)} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X size={20} /></button>
                </div>
                <div className="p-6 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Jumlah Fisik</label>
                            <input type="number" value={editForm.physicalQty} onChange={e => setEditForm({...editForm, physicalQty: Number(e.target.value)})} className="w-full rounded-2xl border-slate-200 dark:bg-slate-800 dark:border-slate-700 p-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none transition-all" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lokasi Rak</label>
                            <input type="text" value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value.toUpperCase()})} className="w-full rounded-2xl border-slate-200 dark:bg-slate-800 dark:border-slate-700 p-3 text-sm uppercase font-bold focus:ring-2 focus:ring-primary outline-none transition-all" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Catatan/Remark</label>
                        <textarea value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} className="w-full rounded-2xl border-slate-200 dark:bg-slate-800 dark:border-slate-700 p-4 text-xs h-24 resize-none focus:ring-2 focus:ring-primary outline-none" placeholder="Masukkan alasan selisih atau kondisi barang..."/>
                    </div>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex gap-4">
                    <button onClick={() => setEditingLog(null)} className="flex-1 py-3.5 text-slate-500 font-bold text-sm hover:bg-slate-100 dark:hover:bg-white/5 rounded-2xl transition-colors">Batal</button>
                    <button onClick={handleUpdateSubmit} className="flex-[2] py-3.5 bg-primary text-white font-bold rounded-2xl text-sm shadow-xl shadow-primary/25 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"><Save size={18} /> Update Data</button>
                </div>
            </div>
        </div>
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#050A18]/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
            <div className="p-1 bg-primary/10 rounded-xl">
                <Logo size={40} />
            </div>
            <div>
                <h1 className="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white leading-none">Smart Dashboard</h1>
                <p className="text-[9px] font-bold text-primary uppercase tracking-[0.2em] mt-1.5">MEDIKA BINA INVESTAMA</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={handleRestoreData}
                disabled={isRestoring || isResetting}
                title="Kembalikan Data (Undo Reset)"
                className="w-11 h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 rounded-2xl flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 active:scale-90 transition-all shadow-sm disabled:opacity-50"
            >
                {isRestoring ? <RefreshCw className="animate-spin" size={20} /> : <RotateCcw size={20} />}
            </button>
            <button 
                onClick={handleResetAllData}
                disabled={isResetting || isRestoring}
                title="Reset & Backup Data"
                className="w-11 h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-red-500 rounded-2xl flex items-center justify-center hover:bg-red-50 hover:border-red-200 active:scale-90 transition-all shadow-sm disabled:opacity-50"
            >
                {isResetting ? <RefreshCw className="animate-spin" size={20} /> : <Trash2 size={20} />}
            </button>
            <button onClick={handleExportReport} className="w-11 h-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-emerald-600 rounded-2xl flex items-center justify-center hover:shadow-lg active:scale-90 transition-all shadow-sm">
                <span className="material-symbols-outlined text-[24px]">sim_card_download</span>
            </button>
        </div>
      </header>

      {/* SUMMARY DASHBOARD CARDS */}
      <section className="px-5 pt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="group bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 hover:border-primary/50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Total Fisik</p>
                    <div className="bg-primary/10 text-primary p-2 rounded-xl group-hover:scale-110 transition-transform">
                        <Package size={18} />
                    </div>
                </div>
                <p className="text-3xl font-black text-slate-900 dark:text-white leading-none">{stats.totalAudited.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-tight">Units Audited</p>
            </div>

            <div className="group bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Akurasi (%)</p>
                    <div className="bg-emerald-500/10 text-emerald-500 p-2 rounded-xl group-hover:scale-110 transition-transform">
                        <CheckCircle2 size={18} />
                    </div>
                </div>
                <p className="text-3xl font-black text-emerald-500 leading-none">{stats.accuracy}%</p>
                <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-tight">Data Validity</p>
            </div>

            <div className="group bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 hover:border-red-500/50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Selisih Item</p>
                    <div className="bg-red-500/10 text-red-500 p-2 rounded-xl group-hover:scale-110 transition-transform">
                        <AlertTriangle size={18} />
                    </div>
                </div>
                <p className="text-3xl font-black text-red-500 leading-none">{stats.shortageCount + stats.surplusCount}</p>
                <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-tight">Requires Check</p>
            </div>

            <div className="group bg-white dark:bg-slate-900 p-5 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 hover:border-slate-400 transition-colors">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Net Var</p>
                    <div className={`p-2 rounded-xl group-hover:scale-110 transition-transform ${stats.netVariance < 0 ? 'bg-red-500/10 text-red-500' : stats.netVariance > 0 ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>
                        <BarChart3 size={18} />
                    </div>
                </div>
                <div className="flex items-baseline gap-1">
                    <p className={`text-3xl font-black leading-none ${stats.netVariance < 0 ? 'text-red-500' : stats.netVariance > 0 ? 'text-primary' : 'text-slate-900 dark:text-white'}`}>
                        {stats.netVariance > 0 ? '+' : ''}{stats.netVariance}
                    </p>
                    {stats.netVariance !== 0 && (
                        <span className="text-xs">
                            {stats.netVariance > 0 ? <ArrowUpRight size={14} className="text-primary"/> : <ArrowDownRight size={14} className="text-red-500"/>}
                        </span>
                    )}
                </div>
                <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-tight">Total Variance</p>
            </div>
      </section>

      {/* SEARCH & FILTERS - STICKY COMPACT */}
      <section className="px-5 mt-8 sticky top-[80px] z-30 bg-[#f8fafc]/80 dark:bg-[#050A18]/80 backdrop-blur-md pb-4">
        <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center px-4 h-12 ring-1 ring-black/5">
                <Search size={18} className="text-slate-400" />
                <input 
                    type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent border-none text-sm p-3 focus:ring-0 outline-none font-medium placeholder:text-slate-400" 
                    placeholder="Search SKU, Name or Location..." 
                />
                {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="p-1 text-slate-400 hover:text-slate-600"><X size={16}/></button>
                )}
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1">
                {[
                    { id: 'all', label: 'All Items', color: 'primary' },
                    { id: 'shortage', label: 'Shortage', color: 'red-500' },
                    { id: 'surplus', label: 'Surplus', color: 'blue-500' },
                    { id: 'matched', label: 'Matched', color: 'emerald-500' }
                ].map((f) => (
                    <button 
                        key={f.id}
                        onClick={() => setActiveFilter(f.id as any)} 
                        className={`px-5 h-10 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all flex-shrink-0 flex items-center gap-2 ${
                            activeFilter === f.id 
                            ? `bg-${f.color === 'primary' ? 'primary' : f.color} text-white border-transparent shadow-lg` 
                            : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                        }`}
                    >
                        {f.id === 'matched' && <CheckCircle2 size={12}/>}
                        {f.id === 'shortage' && <ArrowDownRight size={12}/>}
                        {f.id === 'surplus' && <ArrowUpRight size={12}/>}
                        {f.label}
                    </button>
                ))}
            </div>
        </div>
      </section>

      {/* SKU LIST - NEW MODERN CARDS */}
      <main className="px-5 space-y-4 mt-2">
        {filteredGroups.length === 0 ? (
            <div className="py-24 text-center flex flex-col items-center justify-center space-y-4 opacity-30">
                <div className="w-20 h-20 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center">
                    <Search size={40} className="text-slate-400" />
                </div>
                <div className="space-y-1">
                    <p className="text-base font-black uppercase tracking-widest text-slate-900 dark:text-white">No items found</p>
                    <p className="text-xs font-medium">Try adjusting your filters or search keywords</p>
                </div>
            </div>
        ) : filteredGroups.map(group => {
            const isShortage = group.status === 'shortage';
            const isSurplus = group.status === 'surplus';
            const isMatched = group.status === 'matched';
            
            const accentColor = isShortage ? 'bg-red-500' : isSurplus ? 'bg-blue-500' : 'bg-emerald-500';
            const textColor = isShortage ? 'text-red-600' : isSurplus ? 'text-blue-600' : 'text-emerald-600';
            const bgColor = isShortage ? 'bg-red-50' : isSurplus ? 'bg-blue-50' : 'bg-emerald-50';
            
            const progress = Math.min(100, (group.totalPhysical / Math.max(1, group.totalSystem)) * 100);
            
            return (
                <details key={group.sku} className="group bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                    <summary className="list-none cursor-pointer select-none">
                        <div className="flex items-stretch min-h-[100px]">
                            {/* Color Indicator Strip */}
                            <div className={`w-2 ${accentColor}`}></div>
                            
                            <div className="flex-1 p-5 flex flex-col justify-between">
                                <div className="flex justify-between items-start gap-4">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">{group.sku}</span>
                                            <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tight flex items-center gap-1 ${bgColor} ${textColor} dark:bg-opacity-10`}>
                                                {isMatched && <CheckCircle2 size={10}/>}
                                                {isShortage && <ArrowDownRight size={10}/>}
                                                {isSurplus && <ArrowUpRight size={10}/>}
                                                {group.status}
                                            </span>
                                        </div>
                                        <h3 className="text-sm font-black uppercase tracking-tight line-clamp-1 text-slate-800 dark:text-white">{group.name}</h3>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="flex items-baseline justify-end gap-1">
                                            <span className="text-lg font-black leading-none text-slate-900 dark:text-white">{group.totalPhysical}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">/ {group.totalSystem}</span>
                                        </div>
                                        <p className={`text-[11px] font-black mt-1.5 flex items-center justify-end gap-1 ${group.variance < 0 ? 'text-red-500' : group.variance > 0 ? 'text-blue-500' : 'text-emerald-500'}`}>
                                            {group.variance === 0 ? <Minus size={12}/> : (group.variance > 0 ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>)}
                                            {group.variance !== 0 ? Math.abs(group.variance) : 'Balance'}
                                        </p>
                                    </div>
                                </div>

                                {/* Modern Progress Bar */}
                                <div className="mt-4">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${accentColor}`}></div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Accuracy Level</span>
                                        </div>
                                        <span className={`text-[10px] font-black ${textColor}`}>{progress.toFixed(0)}%</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/30 dark:border-slate-700/30">
                                        <div 
                                            className={`h-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.1)] ${accentColor}`} 
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                            <div className="w-12 flex items-center justify-center text-slate-300 group-open:rotate-180 transition-transform">
                                <ChevronRight size={20} />
                            </div>
                        </div>
                    </summary>

                    {/* EXPANDED TIMELINE AUDIT LOGS */}
                    <div className="bg-slate-50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800 p-6 space-y-5 animate-fade-in">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                                <Clock size={14} className="text-slate-400" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Audit Activity Log</span>
                            </div>
                            <span className="text-[9px] font-bold text-slate-400">{group.logs.length} Scans</span>
                        </div>
                        
                        <div className="relative space-y-4 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800">
                            {group.logs.map((log, idx) => (
                                <div key={log.id} className="relative pl-12">
                                    {/* Timeline Marker */}
                                    <div className={`absolute left-0 top-0 w-10 h-10 rounded-xl flex items-center justify-center border-4 border-slate-50 dark:border-slate-950 z-10 ${accentColor} text-white shadow-lg shadow-black/10`}>
                                        <MapPin size={18} />
                                    </div>

                                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm group/log hover:border-primary/40 transition-colors">
                                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center gap-3">
                                                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{log.location}</h4>
                                                    <div className="flex items-center gap-1.5 text-slate-400">
                                                        <Clock size={12}/>
                                                        <span className="text-[10px] font-bold">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2 pt-1">
                                                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded text-[9px] font-bold uppercase">Batch: {log.batchNumber}</span>
                                                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded text-[9px] font-bold uppercase">EXP: {log.expiryDate}</span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center sm:flex-col items-end gap-3 self-stretch justify-between sm:justify-start">
                                                <div className="text-right">
                                                    <p className="text-base font-black text-slate-900 dark:text-white">{log.physicalQty} <span className="text-[10px] text-slate-400 uppercase">{group.unit}</span></p>
                                                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                                                        <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                                                            <span className="text-[7px] font-black text-slate-500 uppercase">{log.teamMember.charAt(0)}</span>
                                                        </div>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{log.teamMember}</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={(e) => handleEditClick(log, e)} className="p-2.5 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-xl hover:text-primary hover:bg-primary/5 transition-all"><Pencil size={14} /></button>
                                                    <button onClick={(e) => handleDelete(log.id, e)} className="p-2.5 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-xl hover:text-red-500 hover:bg-red-500/5 transition-all"><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                        </div>

                                        {log.notes && (
                                            <div className="mt-4 flex gap-3 items-start bg-blue-50/50 dark:bg-blue-900/10 p-4 rounded-2xl border border-blue-100/50 dark:border-blue-900/20">
                                                <Info size={16} className="text-primary flex-shrink-0" />
                                                <p className="text-[11px] text-slate-600 dark:text-slate-400 italic font-medium leading-relaxed">"{log.notes}"</p>
                                            </div>
                                        )}

                                        {log.evidencePhotos && log.evidencePhotos.length > 0 && (
                                            <div className="mt-5 space-y-2">
                                                <div className="flex items-center gap-2 px-1">
                                                    <ImageIcon size={12} className="text-slate-400"/>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Visual Proof ({log.evidencePhotos.length})</span>
                                                </div>
                                                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 pt-1">
                                                    {log.evidencePhotos.map((photo, pIdx) => (
                                                        <div 
                                                            key={pIdx} 
                                                            onClick={() => setPreviewImage(photo)}
                                                            className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-slate-100 dark:border-slate-800 bg-slate-100 flex-shrink-0 group/photo cursor-zoom-in hover:border-primary/50 transition-all shadow-sm"
                                                        >
                                                            <img src={photo} className="w-full h-full object-cover group-hover/photo:scale-110 transition-transform duration-500" alt="Evidence" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                                                <ZoomIn size={18} className="text-white" />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </details>
            );
        })}
      </main>

      {/* BOTTOM NAV - FLOATING DOCK STYLE */}
      <nav className="fixed bottom-6 left-6 right-6 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white/20 dark:border-white/5 rounded-[2.5rem] p-3 shadow-2xl shadow-black/20 ring-1 ring-black/5">
        <div className="flex justify-around items-center h-14 max-w-md mx-auto relative">
            <button className="flex flex-col items-center gap-1 group">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center transition-all group-active:scale-90">
                    <LayoutDashboard size={20} className="fill-current" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-primary">Beranda</span>
            </button>
            
            <button onClick={() => onNavigate(AppView.FORM)} className="w-16 h-16 bg-primary text-white rounded-3xl flex items-center justify-center shadow-xl shadow-primary/40 -mt-16 border-[6px] border-slate-50 dark:border-[#050A18] active:scale-90 active:rotate-12 transition-all">
                <span className="material-symbols-outlined text-[32px]">add_a_photo</span>
            </button>
            
            <button onClick={() => onNavigate(AppView.MASTER_DATA)} className="flex flex-col items-center gap-1 group">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center transition-all group-hover:text-slate-600 dark:group-hover:text-slate-200 group-active:scale-90">
                    <span className="material-symbols-outlined text-[20px]">database</span>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Database</span>
            </button>
        </div>
      </nav>
      
      {/* Footer Branding Overlay */}
      <div className="fixed bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-200/50 dark:from-black/50 to-transparent pointer-events-none z-30"></div>
    </div>
  );
};

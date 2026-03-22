
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
import { AuditRecord, AppView, MasterItem, LocationState, MasterLocation, AppUser } from '../types';
import { Logo } from './Logo';
import * as XLSX from 'xlsx';
import { 
  Pencil, Trash2, X, Save, AlertTriangle, 
  Image as ImageIcon, ZoomIn, Search, 
  CheckCircle2, Package, MapPin, Clock, 
  BarChart3, Info, ChevronRight, LayoutDashboard,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw,
  RotateCcw, LogOut, Plus
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (view: AppView) => void;
  currentUser: AppUser;
  onLogout: () => void;
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

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, currentUser, onLogout }) => {
  const [groupedData, setGroupedData] = useState<GroupedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  
  const [editingLog, setEditingLog] = useState<AuditRecord | null>(null);
  const [editForm, setEditForm] = useState({
      physicalQty: 0,
      location: '',
      batchNumber: '',
      expiryDate: '',
      notes: ''
  });

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  
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
      
      if (currentUser.role !== 'admin') {
          alert("Akses Ditolak: Hanya ADMIN yang dapat menghapus data scan.");
          return;
      }

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
      if (currentUser.role !== 'admin') {
          alert("Akses Ditolak: Hanya ADMIN yang dapat menghapus semua data.");
          return;
      }
      
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
      if (currentUser.role !== 'admin') {
          alert("Akses Ditolak: Hanya ADMIN yang dapat mengembalikan data.");
          return;
      }

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

  const toggleGroupExpand = (sku: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
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
      <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-8 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
            <Logo size={40} className="text-primary" />
            <div className="flex flex-col">
                <h1 className="text-2xl font-black text-[#2D5B9E] tracking-tight leading-none">SMART DASHBOARD</h1>
                <p className="text-[11px] font-medium text-slate-400 mt-1 uppercase tracking-wider">Audit Physical Management System</p>
            </div>
        </div>

        <div className="flex-1 max-w-xl mx-8">
            <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <Search size={18} className="text-slate-400 group-focus-within:text-primary transition-colors" />
                </div>
                <input 
                    type="text" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#F3F6F9] border-none rounded-xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-400" 
                    placeholder="Cari SKU atau Nama Produk..." 
                />
            </div>
        </div>

        <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-xl transition-all relative">
                <span className="material-symbols-outlined text-[24px]">notifications</span>
                <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></div>
            </button>
            
            <div className="relative">
                <button 
                    onClick={() => setShowAdminMenu(!showAdminMenu)}
                    className={`p-2 rounded-xl transition-all ${showAdminMenu ? 'text-primary bg-slate-50' : 'text-slate-400 hover:text-primary hover:bg-slate-50'}`}
                >
                    <span className="material-symbols-outlined text-[24px]">settings</span>
                </button>
                
                {showAdminMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                        <div className="px-4 py-2 border-b border-slate-50 mb-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Settings</p>
                        </div>
                        
                        <button 
                            onClick={() => { handleExportReport(); setShowAdminMenu(false); }}
                            className="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                        >
                            <BarChart3 size={16} /> Export Excel Report
                        </button>

                        {currentUser.role === 'admin' && (
                            <>
                                <div className="h-[1px] bg-slate-50 my-1"></div>
                                <button 
                                    onClick={() => { handleRestoreData(); setShowAdminMenu(false); }}
                                    disabled={isRestoring}
                                    className="w-full px-4 py-2.5 text-left text-sm font-bold text-[#2D5B9E] hover:bg-blue-50 flex items-center gap-3 transition-colors disabled:opacity-50"
                                >
                                    <RotateCcw size={16} className={isRestoring ? 'animate-spin' : ''} /> Restore from Backup
                                </button>
                                <button 
                                    onClick={() => { handleResetAllData(); setShowAdminMenu(false); }}
                                    disabled={isResetting}
                                    className="w-full px-4 py-2.5 text-left text-sm font-bold text-red-500 hover:bg-red-50 flex items-center gap-3 transition-colors disabled:opacity-50"
                                >
                                    <RefreshCw size={16} className={isResetting ? 'animate-spin' : ''} /> Reset All Audit Data
                                </button>
                            </>
                        )}

                        <div className="h-[1px] bg-slate-50 my-1"></div>
                        <button 
                            onClick={() => { onLogout(); setShowAdminMenu(false); }}
                            className="w-full px-4 py-2.5 text-left text-sm font-bold text-slate-500 hover:bg-slate-50 hover:text-red-500 flex items-center gap-3 transition-colors"
                        >
                            <LogOut size={16} /> Logout Account
                        </button>
                    </div>
                )}
            </div>

            <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
            
            <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                    <p className="text-xs font-black text-slate-800 leading-none">{currentUser.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">{currentUser.role}</p>
                </div>
            </div>
        </div>
      </header>

      {/* SUMMARY DASHBOARD CARDS */}
      <section className="px-8 pt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-50 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <div className="bg-[#E8F1FD] text-[#2D5B9E] p-3 rounded-lg">
                        <Package size={20} />
                    </div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.15em]">Live Count</p>
                </div>
                <p className="text-4xl font-black text-slate-800 leading-none mb-2">{stats.totalAudited.toLocaleString()}</p>
                <p className="text-[11px] text-slate-400 font-medium">Total Fisik Terhitung</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-50 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <div className="bg-[#E9F7EF] text-[#27AE60] p-3 rounded-lg">
                        <CheckCircle2 size={20} />
                    </div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.15em]">Reliability</p>
                </div>
                <p className="text-4xl font-black text-slate-800 leading-none mb-2">{stats.accuracy}%</p>
                <p className="text-[11px] text-slate-400 font-medium">Akurasi Audit</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-50 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <div className="bg-[#FDECEC] text-[#EB5757] p-3 rounded-lg">
                        <AlertTriangle size={20} />
                    </div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.15em]">Requires Check</p>
                </div>
                <p className="text-4xl font-black text-slate-800 leading-none mb-2">{stats.shortageCount + stats.surplusCount}</p>
                <p className="text-[11px] text-slate-400 font-medium">Selisih Item</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-50 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <div className="bg-[#F3F6F9] text-slate-500 p-3 rounded-lg">
                        <BarChart3 size={20} />
                    </div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.15em]">Net Change</p>
                </div>
                <p className={`text-4xl font-black leading-none mb-2 ${stats.netVariance < 0 ? 'text-[#EB5757]' : stats.netVariance > 0 ? 'text-[#2D5B9E]' : 'text-slate-800'}`}>
                    {stats.netVariance > 0 ? '+' : ''}{stats.netVariance}
                </p>
                <p className="text-[11px] text-slate-400 font-medium">Total Variance (Net Var)</p>
            </div>
      </section>

      {/* FILTERS & DATE */}
      <section className="px-8 mt-10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                {[
                    { id: 'all', label: 'All Items' },
                    { id: 'shortage', label: 'Shortage' },
                    { id: 'surplus', label: 'Surplus' },
                    { id: 'matched', label: 'Matched' }
                ].map((f) => (
                    <button 
                        key={f.id}
                        onClick={() => setActiveFilter(f.id as any)} 
                        className={`px-6 py-2.5 rounded-lg text-xs font-bold transition-all ${
                            activeFilter === f.id 
                            ? 'bg-[#2D5B9E] text-white shadow-md' 
                            : 'text-slate-500 hover:bg-slate-50'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-2 text-slate-500 bg-white px-4 py-2.5 rounded-xl border border-slate-100 shadow-sm">
                <Clock size={16} />
                <span className="text-xs font-bold uppercase tracking-tight">Today: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
      </section>

      {/* SKU LIST - NEW MODERN CARDS */}
      <main className="px-8 space-y-6 mt-8">
        {filteredGroups.length === 0 ? (
            <div className="py-24 text-center flex flex-col items-center justify-center space-y-4 opacity-30">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                    <Search size={40} className="text-slate-400" />
                </div>
                <div className="space-y-1">
                    <p className="text-base font-black uppercase tracking-widest text-slate-900">No items found</p>
                    <p className="text-xs font-medium">Try adjusting your filters or search keywords</p>
                </div>
            </div>
        ) : filteredGroups.map(group => {
            const isShortage = group.status === 'shortage';
            const isSurplus = group.status === 'surplus';
            const isMatched = group.status === 'matched';
            
            const statusColor = isShortage ? 'bg-[#EB5757] text-white' : isSurplus ? 'bg-[#2D5B9E] text-white' : 'bg-[#27AE60] text-white';
            const progressColor = isShortage ? 'bg-[#EB5757]' : isSurplus ? 'bg-[#2D5B9E]' : 'bg-[#27AE60]';
            
            const progress = Math.min(100, (group.totalPhysical / Math.max(1, group.totalSystem)) * 100);
            
            return (
                <div key={group.sku} className="bg-white rounded-2xl shadow-[0_4px_25px_rgba(0,0,0,0.04)] border border-slate-50 overflow-hidden flex flex-col lg:flex-row">
                    {/* Left Section: Info */}
                    <div className="flex-1 p-8 border-b lg:border-b-0 lg:border-r border-slate-100 relative">
                        <div className="flex justify-between items-start mb-6">
                            <span className="bg-[#F3F6F9] text-[#2D5B9E] px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-tight">SKU: {group.sku}</span>
                            <span className={`${statusColor} px-4 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm`}>
                                {group.status}
                            </span>
                        </div>
                        
                        <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-8 leading-tight">{group.name}</h3>
                        
                        <div className="mt-auto">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Accuracy Confidence</span>
                                <span className={`text-xs font-black ${progress === 100 ? 'text-[#27AE60]' : 'text-slate-800'}`}>{progress.toFixed(0)}%</span>
                            </div>
                            <div className="h-3 bg-[#F3F6F9] rounded-full overflow-hidden p-0.5">
                                <div 
                                    className={`h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.1)] ${progressColor}`} 
                                    style={{ width: `${progress}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* Right Section: Activity Log */}
                    <div className="lg:w-[450px] p-8 bg-[#FAFBFC]">
                        <div className="flex items-center gap-2 mb-6">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Audit Activity Log</span>
                        </div>
                        
                        <div className="space-y-6">
                            {(expandedGroups.has(group.sku) ? group.logs : group.logs.slice(0, 2)).map((log) => (
                                <div key={log.id} className="flex items-start justify-between group relative">
                                    <div className="flex gap-4">
                                        <span className="text-[11px] font-bold text-slate-400 mt-1">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-black text-slate-800 leading-tight">Physical Count Input</h4>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={(e) => handleEditClick(log, e)}
                                                        className="p-1 text-slate-400 hover:text-primary hover:bg-white rounded-md transition-all"
                                                    >
                                                        <Pencil size={12} />
                                                    </button>
                                                    {currentUser.role === 'admin' && (
                                                        <button 
                                                            onClick={(e) => handleDelete(log.id, e)}
                                                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-white rounded-md transition-all"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-[11px] text-slate-400 font-medium mt-1">Operator: {log.teamMember}</p>
                                            <div className="flex items-center gap-3 mt-2">
                                                <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-100">
                                                    <Package size={10} className="text-slate-400" />
                                                    <span className="text-[10px] font-bold text-slate-700">{log.physicalQty} {group.unit}</span>
                                                </div>
                                                <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-100">
                                                    <MapPin size={10} className="text-slate-400" />
                                                    <span className="text-[10px] font-bold text-slate-700 uppercase">{log.location}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {log.evidencePhotos && log.evidencePhotos.length > 0 ? (
                                        <div 
                                            onClick={() => setPreviewImage(log.evidencePhotos![0])}
                                            className="w-14 h-10 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:scale-105 transition-transform shrink-0"
                                        >
                                            <img src={log.evidencePhotos[0]} className="w-full h-full object-cover" alt="Proof" />
                                        </div>
                                    ) : (
                                        <div className="w-14 h-10 rounded-lg bg-slate-200/50 border border-slate-100 flex items-center justify-center shrink-0">
                                            <span className="text-[8px] font-bold text-slate-300 uppercase">Visual</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {group.logs.length === 0 && (
                                <div className="py-4 text-center">
                                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No activity recorded</p>
                                </div>
                            )}
                            {group.logs.length > 2 && (
                                <button 
                                    onClick={() => toggleGroupExpand(group.sku)}
                                    className="w-full py-2 text-[10px] font-black text-[#2D5B9E] uppercase tracking-widest hover:bg-white rounded-lg transition-colors border border-dashed border-slate-200 mt-2"
                                >
                                    {expandedGroups.has(group.sku) ? 'Show Less' : `View ${group.logs.length - 2} More Entries`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            );
        })}
      </main>

      {/* Floating Action Button */}
      <button 
        onClick={() => onNavigate(AppView.FORM)}
        className="fixed bottom-24 right-8 w-14 h-14 bg-[#2D5B9E] text-white rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50"
      >
        <Plus size={28} strokeWidth={3} />
      </button>

      {/* Footer Branding Overlay */}
      <div className="fixed bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-200/50 dark:from-black/50 to-transparent pointer-events-none z-30"></div>
    </div>
  );
};

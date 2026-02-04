
import React, { useState, useEffect, useCallback } from 'react';
import { 
  subscribeToAuditLogs, 
  subscribeToMasterData, 
  getMasterLocations, 
  subscribeToLocationStates,
  deleteAuditLog,
  updateAuditLog,
  getOfflineRecords
} from '../services/storageService';
import { AuditRecord, AppView, MasterItem, LocationState, MasterLocation } from '../types';
import { Logo } from './Logo';
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
    
    const offlineLogs = getOfflineRecords();
    const allLogsMap = new Map<string, AuditRecord>();
    offlineLogs.forEach(l => allLogsMap.set(l.id, l));
    logs.forEach(l => allLogsMap.set(l.id, l));
    const combinedLogs = Array.from(allLogsMap.values());

    const masterMap = new Map<string, MasterItem[]>();
    master.forEach(m => {
        if (!masterMap.has(m.sku)) masterMap.set(m.sku, []);
        masterMap.get(m.sku)?.push(m);
    });

    const getSystemStock = (sku: string) => {
        const items = masterMap.get(sku) || [];
        return items.reduce((sum, item) => sum + item.systemStock, 0);
    };

    const groups: Record<string, GroupedItem> = {};
    combinedLogs.forEach(log => {
        if (!groups[log.sku]) {
            const items = masterMap.get(log.sku);
            const m = items && items.length > 0 ? items[0] : undefined;
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
    getMasterLocations().then(locs => {
        dataRefs.current.locations = locs;
        processDashboardData();
    });

    const handleListenerError = (err: any) => {
        if (err.code === 'permission-denied') {
            setErrorStatus("Akses Dibatasi - Menggunakan Data Lokal");
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
      e.stopPropagation();
      if (window.confirm("Hapus data scan ini?")) {
          try {
              await deleteAuditLog(id);
              processDashboardData();
          } catch (error) {
              alert("Gagal menghapus.");
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
          processDashboardData();
      } catch (error) {
          alert("Gagal update.");
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
            "Team": log.teamMember
        }))
    );
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AuditReport");
    XLSX.writeFile(wb, `Stock_Opname_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const filteredGroups = groupedData.filter(g => {
      const matchSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase()) || g.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFilter = activeFilter === 'all' ? true : g.status === activeFilter;
      return matchSearch && matchFilter;
  });

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#050A18] text-white">
        <Logo size={80} className="animate-pulse mb-4" />
        <p className="text-sm font-bold uppercase tracking-widest">Memuat Dashboard...</p>
    </div>
  );

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen pb-24 font-display">
      
      {editingLog && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-primary text-white">
                    <h3 className="font-bold flex items-center gap-2 text-sm"><Pencil size={16} /> Edit Scan</h3>
                    <button onClick={() => setEditingLog(null)}><X size={20} /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Qty Fisik</label>
                            <input type="number" value={editForm.physicalQty} onChange={e => setEditForm({...editForm, physicalQty: Number(e.target.value)})} className="w-full rounded-lg border-slate-200 dark:bg-slate-800 p-2 text-sm font-bold" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Lokasi</label>
                            <input type="text" value={editForm.location} onChange={e => setEditForm({...editForm, location: e.target.value.toUpperCase()})} className="w-full rounded-lg border-slate-200 dark:bg-slate-800 p-2 text-sm uppercase" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Batch</label>
                            <input type="text" value={editForm.batchNumber} onChange={e => setEditForm({...editForm, batchNumber: e.target.value})} className="w-full rounded-lg border-slate-200 dark:bg-slate-800 p-2 text-xs" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Expired</label>
                            <input type="date" value={editForm.expiryDate} onChange={e => setEditForm({...editForm, expiryDate: e.target.value})} className="w-full rounded-lg border-slate-200 dark:bg-slate-800 p-2 text-xs" />
                        </div>
                    </div>
                    <textarea value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} placeholder="Catatan..." className="w-full rounded-lg border-slate-200 dark:bg-slate-800 p-2 text-xs h-16" />
                </div>
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                    <button onClick={() => setEditingLog(null)} className="flex-1 py-2 text-slate-500 font-bold text-sm">Batal</button>
                    <button onClick={handleUpdateSubmit} className="flex-1 py-2 bg-primary text-white font-bold rounded-lg text-sm shadow-lg shadow-primary/20 flex items-center justify-center gap-2"><Save size={16} /> Simpan</button>
                </div>
            </div>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-white/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <Logo size={32} />
            <div>
                <h1 className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white leading-none">Monitoring</h1>
                <p className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">MEDIKA BINA INVESTAMA</p>
            </div>
        </div>
        <button onClick={handleExportReport} className="p-2 bg-blue-50 text-primary rounded-full hover:bg-blue-100 transition-colors">
            <span className="material-symbols-outlined">download</span>
        </button>
      </header>

      {errorStatus && (
          <div className="bg-amber-600 text-white text-[10px] font-bold py-1 px-4 text-center animate-pulse">
              {errorStatus}
          </div>
      )}

      <section className="px-4 pt-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-2xl">person</span>
            </div>
            <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Team Member</label>
                <input 
                    type="text" 
                    value={teamName}
                    onChange={(e) => { setTeamName(e.target.value); localStorage.setItem('team_member_name', e.target.value); }}
                    className="w-full bg-transparent border-none p-0 text-sm font-bold text-slate-900 dark:text-white focus:ring-0"
                    placeholder="Input nama petugas..."
                />
            </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 px-4 py-4">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Total Items</p>
                <p className="text-2xl font-black text-primary">{stats.totalAudited}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Accuracy</p>
                <p className="text-2xl font-black">{stats.accuracy}%</p>
            </div>
      </section>

      <section className="px-4 pb-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center px-4 py-1">
            <span className="material-symbols-outlined text-slate-400">search</span>
            <input 
                type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-none text-sm p-3 focus:ring-0" 
                placeholder="Search SKU or Name..." 
            />
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
            <button onClick={() => setActiveFilter('all')} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${activeFilter === 'all' ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white text-slate-500 border-slate-200'}`}>All Items</button>
            <button onClick={() => setActiveFilter('shortage')} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${activeFilter === 'shortage' ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-500/20' : 'bg-white text-slate-500 border-slate-200'}`}>Shortage</button>
            <button onClick={() => setActiveFilter('surplus')} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${activeFilter === 'surplus' ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20' : 'bg-white text-slate-500 border-slate-200'}`}>Surplus</button>
        </div>
      </section>

      <main className="px-4 space-y-3 pb-4">
        {filteredGroups.map(group => (
            <details key={group.sku} className="group bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-all duration-300">
                <summary className="list-none p-4 cursor-pointer flex justify-between items-center hover:bg-slate-50 transition-colors">
                    <div className="flex gap-3 items-center">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                            <span className="material-symbols-outlined">inventory_2</span>
                        </div>
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-tight leading-none mb-1">{group.name}</h3>
                            <p className="text-[10px] font-mono text-slate-400">{group.sku}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className={`text-xs font-black ${group.variance < 0 ? 'text-red-600' : group.variance > 0 ? 'text-primary' : 'text-emerald-500'}`}>
                            {group.totalPhysical} / {group.totalSystem}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Variance: {group.variance}</p>
                    </div>
                </summary>
                <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 space-y-3">
                    {group.logs.map(log => (
                        <div key={log.id} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-start gap-3 shadow-sm">
                            <div className="flex-1">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <span className="material-symbols-outlined text-sm text-primary">location_on</span>
                                    <span className="text-xs font-black">{log.location}</span>
                                </div>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                                    Batch: {log.batchNumber} • ED: {log.expiryDate}
                                </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className="text-sm font-black text-slate-900 dark:text-white">{log.physicalQty} <span className="text-[9px] text-slate-400">{group.unit}</span></span>
                                <div className="flex gap-1">
                                    <button onClick={(e) => handleEditClick(log, e)} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"><Pencil size={12} /></button>
                                    <button onClick={(e) => handleDelete(log.id, e)} className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors"><Trash2 size={12} /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </details>
        ))}
      </main>

      <nav className="fixed bottom-0 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe pt-2 px-6 z-40">
        <div className="flex justify-between items-center h-16 max-w-md mx-auto">
            <button className="flex flex-col items-center gap-1 text-primary">
                <span className="material-symbols-outlined filled">dashboard</span>
                <span className="text-[9px] font-black uppercase tracking-widest">Home</span>
            </button>
            <button onClick={() => onNavigate(AppView.FORM)} className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-xl shadow-primary/40 -mt-8 border-4 border-white dark:border-slate-900 active:scale-90 transition-all">
                <span className="material-symbols-outlined text-3xl">qr_code_scanner</span>
            </button>
            <button onClick={() => onNavigate(AppView.MASTER_DATA)} className="flex flex-col items-center gap-1 text-slate-400">
                <span className="material-symbols-outlined">database</span>
                <span className="text-[9px] font-black uppercase tracking-widest">Data</span>
            </button>
        </div>
      </nav>
    </div>
  );
};


import React, { useState, useEffect } from 'react';
import { 
  subscribeToAuditLogs, 
  subscribeToMasterData, 
  getMasterLocations, 
  subscribeToLocationStates 
} from '../services/storageService';
import { AuditRecord, AppView, MasterItem, LocationState, MasterLocation } from '../types';
import * as XLSX from 'xlsx';

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

  useEffect(() => {
    let logsData: AuditRecord[] = [];
    let masterData: MasterItem[] = [];
    let locationsData: MasterLocation[] = [];
    let statesData: Record<string, LocationState> = {};

    const processDashboardData = () => {
        if (!logsData || !masterData) return;

        const masterMap = new Map<string, MasterItem[]>();
        masterData.forEach(m => {
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
        logsData.forEach(log => {
            if (!groups[log.sku]) {
                const master = getMasterInfo(log.sku);
                groups[log.sku] = {
                    sku: log.sku,
                    name: log.itemName,
                    unit: master?.unit || 'Pcs',
                    logs: [],
                    totalSystem: getSystemStock(log.sku),
                    totalPhysical: 0, 
                    variance: 0,
                    status: 'matched',
                    locationsCount: 0,
                    master: master
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
        Object.values(statesData).forEach((s) => {
            if (s.status === 'audited') la++;
            if (s.status === 'empty') le++;
            if (s.status === 'damaged') ld++;
        });

        const accurateItems = finalGroups.filter(g => g.variance === 0).length;
        const accuracyStr = finalGroups.length > 0 ? ((accurateItems / finalGroups.length) * 100).toFixed(1) : "100";

        setStats({
            totalAudited: totalAuditQty,
            totalLocations: locationsData.length || 1,
            locAudited: la,
            locEmpty: le,
            locDamaged: ld,
            netVariance: globalVariance,
            accuracy: accuracyStr,
            criticalItems: criticalCount
        });
        setLoading(false);
    };

    // Initialize locations first
    getMasterLocations().then(locs => {
        locationsData = locs;
        processDashboardData();
    });

    const unsubLogs = subscribeToAuditLogs(data => { logsData = data; processDashboardData(); });
    const unsubMaster = subscribeToMasterData(data => { masterData = data; processDashboardData(); });
    const unsubStates = subscribeToLocationStates(data => { statesData = data; processDashboardData(); });

    return () => {
        unsubLogs();
        unsubMaster();
        unsubStates();
    };
  }, []);

  const handleExportReport = () => {
    const exportRows = groupedData.flatMap(group => 
        group.logs.map(log => ({
            "Kode Barang": group.sku,
            "Nama Barang": group.name,
            "Nama Satuan": group.unit,
            "QTY Fisik": log.physicalQty,
            "Team Warehouse": log.teamMember,
            "batch & ED": `${log.batchNumber} / ${log.expiryDate}`,
            "Lokasi": log.location
        }))
    );
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "StockOpname");
    XLSX.writeFile(wb, `Audit_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const filteredGroups = groupedData.filter(g => {
      const matchSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase()) || g.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFilter = activeFilter === 'all' ? true : g.status === activeFilter;
      return matchSearch && matchFilter;
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-slate-400 font-display"><span className="material-symbols-outlined animate-spin text-4xl">sync</span></div>;

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen pb-24 font-display">
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">Audit Dashboard (Live)</h1>
        <button onClick={handleExportReport} className="p-2 rounded-full text-green-600 hover:bg-green-50"><span className="material-symbols-outlined">ios_share</span></button>
      </header>

      <section className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-4 space-y-4 shadow-sm z-30 relative">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-500 text-[20px]">search</span>
                <input 
                    type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none p-0 focus:ring-0 text-sm w-full" 
                    placeholder="Search SKU or Name..." 
                />
            </div>
            <button onClick={() => setActiveFilter(activeFilter === 'all' ? 'shortage' : 'all')} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${activeFilter !== 'all' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {activeFilter === 'all' ? 'Filter: All' : 'Filter: Discrepancy'}
            </button>
        </div>
      </section>

      <section className="px-4 py-4 overflow-x-auto no-scrollbar flex gap-3">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 min-w-[140px]">
                <p className="text-slate-500 text-[10px] font-bold uppercase">Audited Qty</p>
                <p className="text-xl font-bold">{stats.totalAudited}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 min-w-[140px]">
                <p className="text-slate-500 text-[10px] font-bold uppercase">Accuracy</p>
                <p className="text-xl font-bold">{stats.accuracy}%</p>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 min-w-[140px]">
                <p className="text-slate-500 text-[10px] font-bold uppercase">Pending Issues</p>
                <p className="text-xl font-bold text-red-600">{stats.criticalItems}</p>
            </div>
      </section>

      <main className="px-4 pb-4 space-y-3">
        {filteredGroups.map(group => (
            <details key={group.sku} className="group rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <summary className="cursor-pointer p-4 list-none flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex gap-3 items-center">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                            <span className="material-symbols-outlined">inventory_2</span>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold truncate w-40">{group.name}</h3>
                            <p className="text-[10px] text-slate-500 font-mono">{group.sku}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className={`text-xs font-bold ${group.variance < 0 ? 'text-red-600' : group.variance > 0 ? 'text-blue-600' : 'text-emerald-500'}`}>
                            {group.totalPhysical} / {group.totalSystem}
                        </span>
                        <span className="material-symbols-outlined text-slate-400 text-sm ml-2 group-open:rotate-180 transition-transform">expand_more</span>
                    </div>
                </summary>
                <div className="bg-slate-50 dark:bg-slate-950 p-4 space-y-2 border-t border-slate-100 dark:border-slate-800">
                    {group.logs.map(log => (
                        <div key={log.id} className="flex justify-between items-center text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
                            <div>
                                <p className="font-bold">{log.location}</p>
                                <p className="text-[10px] text-slate-400">Batch: {log.batchNumber}</p>
                            </div>
                            <span className="font-mono font-bold">{log.physicalQty} Pcs</span>
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
            <button onClick={() => onNavigate(AppView.LOCATION_CHECKLIST)} className="flex flex-col items-center gap-1 flex-1 text-slate-400">
                <span className="material-symbols-outlined">checklist</span>
                <span className="text-[10px] font-medium">Locations</span>
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

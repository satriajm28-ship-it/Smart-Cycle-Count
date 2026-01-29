
import React, { useState, useEffect } from 'react';
import { getAuditLogs, getMasterData, getMasterLocations, getLocationStates } from '../services/storageService';
import { AuditRecord, AppView, MasterItem, LocationState } from '../types';
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
  
  // Stats
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
    const fetchData = async () => {
        try {
            setLoading(true);
            const [logs, masterData, masterLocations, locationStates] = await Promise.all([
                getAuditLogs(),
                getMasterData(),
                getMasterLocations(),
                getLocationStates()
            ]);

            const masterMap = new Map<string, MasterItem>();
            masterData.forEach(m => masterMap.set(m.sku, m));

            // Group logs by SKU
            const groups: Record<string, GroupedItem> = {};

            // Initialize groups from Master Data (optional, but good to show missing items)
            // For now, let's focus on items that have been audited or exist in master
            
            // 1. Process Logs
            logs.forEach(log => {
                if (!groups[log.sku]) {
                    const master = masterMap.get(log.sku);
                    groups[log.sku] = {
                        sku: log.sku,
                        name: log.itemName,
                        unit: master?.unit || 'Pcs',
                        logs: [],
                        totalSystem: master?.systemStock || 0, // System stock is global per item usually
                        totalPhysical: 0,
                        variance: 0,
                        status: 'matched',
                        locationsCount: 0,
                        master: master
                    };
                }
                groups[log.sku].logs.push(log);
                groups[log.sku].totalPhysical += log.physicalQty;
                // Track unique locations per item
            });

            // Calculate Variances & Status
            let globalVariance = 0;
            let criticalCount = 0;
            let totalAuditQty = 0;

            const finalGroups = Object.values(groups).map(g => {
                g.variance = g.totalPhysical - g.totalSystem;
                globalVariance += g.variance;
                totalAuditQty += g.totalPhysical;
                
                if (g.variance < 0) {
                    g.status = 'shortage';
                    criticalCount++;
                } else if (g.variance > 0) {
                    g.status = 'surplus';
                }
                g.locationsCount = new Set(g.logs.map(l => l.location)).size;
                return g;
            });

            setGroupedData(finalGroups);

            // Location Stats
            const totalLocs = masterLocations.length;
            let la = 0, le = 0, ld = 0;
            Object.values(locationStates).forEach((s: LocationState) => {
                if (s.status === 'audited') la++;
                if (s.status === 'empty') le++;
                if (s.status === 'damaged') ld++;
            });

            // Accuracy (Items with 0 variance / total items audited)
            const accurateItems = finalGroups.filter(g => g.variance === 0).length;
            const accuracyStr = finalGroups.length > 0 
                ? ((accurateItems / finalGroups.length) * 100).toFixed(1) 
                : "100";

            setStats({
                totalAudited: totalAuditQty,
                totalLocations: totalLocs || 1,
                locAudited: la,
                locEmpty: le,
                locDamaged: ld,
                netVariance: globalVariance,
                accuracy: accuracyStr,
                criticalItems: criticalCount
            });

        } catch (error) {
            console.error("Error loading dashboard", error);
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, []);

  const handleExportReport = () => {
    // Flatten data for export with requested headers
    const exportRows: any[] = [];

    groupedData.forEach(group => {
        // If an item has multiple logs (locations), we list them as separate rows
        // If no logs (just master data), we list one row
        if (group.logs.length > 0) {
            group.logs.forEach(log => {
                exportRows.push({
                    "Kode Barang": group.sku,
                    "Nama Barang": group.name,
                    "Nama Satuan": group.unit,
                    "Adjustment Inventory": log.physicalQty,
                    "Warehouse": log.systemQty, // System qty per record usually refers to global system stock context or allocated
                    "Warehouse Damage & ED": `${log.batchNumber} / ${log.expiryDate}`,
                    "Total Nama Gudang": log.location
                });
            });
        } else {
             exportRows.push({
                "Kode Barang": group.sku,
                "Nama Barang": group.name,
                "Nama Satuan": group.unit,
                "Adjustment Inventory": 0,
                "Warehouse": group.totalSystem,
                "Warehouse Damage & ED": `${group.master?.batchNumber || '-'} / ${group.master?.expiryDate || '-'}`,
                "Total Nama Gudang": "Uncounted"
            });
        }
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "StockOpname_Export");
    XLSX.writeFile(wb, `StockOpname_Full_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // Filter View
  const filteredGroups = groupedData.filter(g => {
      const matchSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase()) || g.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFilter = activeFilter === 'all' ? true : g.status === activeFilter;
      return matchSearch && matchFilter;
  });

  // Chart Gradient Logic
  const stop1 = (stats.locAudited / stats.totalLocations) * 100;
  const stop2 = stop1 + ((stats.locEmpty / stats.totalLocations) * 100);
  const chartGradient = `conic-gradient(#135bec 0% ${stop1}%, #cbd5e1 ${stop1}% ${stop2}%, #f97316 ${stop2}% 100%)`;

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#f6f6f8] text-slate-400 font-display"><span className="material-symbols-outlined animate-spin text-4xl">sync</span></div>;

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen pb-24 font-display">
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-background-dark/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between transition-all">
        <h1 className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">Audit Dashboard</h1>
        <button onClick={handleExportReport} className="relative p-2 rounded-full text-green-600 hover:bg-green-50 active:scale-95 transition-all">
           <span className="material-symbols-outlined text-[24px]">ios_share</span>
        </button>
      </header>

      {/* Controls */}
      <section className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-4 space-y-4 shadow-sm z-30 relative">
        <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 text-[20px]">error_circle_rounded</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Show Only Discrepancies</span>
            </div>
            <button 
                onClick={() => setActiveFilter(activeFilter === 'all' ? 'shortage' : 'all')}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${activeFilter !== 'all' ? 'bg-primary' : 'bg-slate-200'}`}
            >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${activeFilter !== 'all' ? 'translate-x-5' : 'translate-x-0'}`}></span>
            </button>
        </div>
        
        <div className="pt-3 border-t border-slate-100 dark:border-slate-700/50 flex flex-col gap-3">
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none material-symbols-outlined text-[20px]">search</span>
                <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 pl-10 pr-4 py-2.5 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm shadow-sm transition-all" 
                    placeholder="Search SKU, Item Name..." 
                />
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                <button onClick={() => setActiveFilter('all')} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shadow-sm transition-transform active:scale-95 ${activeFilter === 'all' ? 'bg-primary text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
                    All Items
                </button>
                <button onClick={() => setActiveFilter('shortage')} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-transform active:scale-95 ${activeFilter === 'shortage' ? 'bg-red-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
                    Shortages <span className="bg-red-100 text-red-600 px-1.5 rounded-full text-[10px] ml-1">{stats.criticalItems}</span>
                </button>
            </div>
        </div>
      </section>

      {/* Metrics Scroll */}
      <section className="px-4 py-4 overflow-x-auto no-scrollbar">
        <div className="flex gap-3 min-w-max">
            {/* Location Chart Card */}
            <button onClick={() => onNavigate(AppView.LOCATION_CHECKLIST)} className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 w-48 flex flex-col gap-2 text-left relative group hover:border-primary/50 transition-colors">
                <div className="flex justify-between items-center z-10 w-full">
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Location Status</p>
                    <span className="material-symbols-outlined text-[16px] text-slate-300 group-hover:text-primary transition-colors">arrow_forward</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 z-10">
                    <div className="relative w-12 h-12 rounded-full flex-shrink-0" style={{ background: chartGradient }}>
                        <div className="absolute inset-[3px] bg-white dark:bg-slate-800 rounded-full flex items-center justify-center flex-col">
                            <span className="text-[8px] font-medium text-slate-400 leading-none">Total</span>
                            <span className="text-[11px] font-bold text-slate-900 dark:text-white leading-tight">{stats.totalLocations}</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 w-full min-w-0">
                        <div className="flex items-center justify-between text-[9px]">
                            <span className="text-slate-600 font-medium">Audited</span>
                            <span className="font-bold text-slate-900">{stats.locAudited}</span>
                        </div>
                        <div className="flex items-center justify-between text-[9px]">
                            <span className="text-slate-600 font-medium">Empty</span>
                            <span className="font-bold text-slate-900">{stats.locEmpty}</span>
                        </div>
                         <div className="flex items-center justify-between text-[9px]">
                            <span className="text-slate-600 font-medium">Damaged</span>
                            <span className="font-bold text-slate-900">{stats.locDamaged}</span>
                        </div>
                    </div>
                </div>
            </button>

            {/* Total Audited */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 w-36 flex flex-col gap-1">
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Total Audited</p>
                <p className="text-xl font-bold font-display text-slate-900 dark:text-white">{stats.totalAudited}</p>
                <div className="flex items-center text-[10px] font-medium text-emerald-600 mt-1">
                    <span className="material-symbols-outlined text-[14px]">trending_up</span>
                    <span className="ml-1">Live Count</span>
                </div>
            </div>

            {/* Accuracy */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 w-36 flex flex-col gap-1">
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Accuracy</p>
                <p className="text-xl font-bold font-display text-slate-900 dark:text-white">{stats.accuracy}%</p>
                <div className="flex items-center text-[10px] font-medium text-blue-600 mt-1">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    <span className="ml-1">Matched</span>
                </div>
            </div>

            {/* Net Variance */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 w-36 flex flex-col gap-1">
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Net Variance</p>
                <p className={`text-xl font-bold font-display ${stats.netVariance < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                    {stats.netVariance} <span className="text-xs font-normal text-slate-500">Units</span>
                </p>
                <div className="flex items-center text-[10px] font-medium text-red-600 mt-1">
                     <span className="material-symbols-outlined text-[14px]">error</span>
                     <span className="ml-1">Action</span>
                </div>
            </div>
        </div>
      </section>

      {/* Main List */}
      <main className="px-4 pb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Grouped By Item</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">Showing {filteredGroups.length} items</span>
        </div>

        {filteredGroups.map(group => {
            const isShortage = group.status === 'shortage';
            const isSurplus = group.status === 'surplus';
            const borderColor = isShortage ? 'border-red-200' : isSurplus ? 'border-blue-200' : 'border-slate-200';
            const bgColor = isShortage ? 'bg-red-50/80' : isSurplus ? 'bg-blue-50/80' : 'bg-white';
            const stripColor = isShortage ? 'bg-red-600' : isSurplus ? 'bg-blue-500' : 'bg-emerald-500';

            return (
                <details key={group.sku} className={`group rounded-xl shadow-sm border ${borderColor} bg-white dark:bg-slate-800 overflow-hidden`}>
                    <summary className={`cursor-pointer ${bgColor} dark:bg-slate-800 p-4 relative list-none hover:bg-slate-50 transition-colors`}>
                        <div className={`absolute top-0 left-0 w-1 h-full ${stripColor}`}></div>
                        <div className="flex justify-between items-start">
                            <div className="flex gap-3">
                                {/* Placeholder icon/image based on category or random */}
                                <div className="w-12 h-12 rounded-lg bg-white dark:bg-slate-700 flex-shrink-0 flex items-center justify-center text-slate-400 border border-slate-100 shadow-sm">
                                    <span className="material-symbols-outlined">inventory_2</span>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight flex items-center gap-1">
                                        {group.name}
                                        {isShortage && <span className="material-symbols-outlined text-red-600 text-[18px]">error</span>}
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">SKU: {group.sku}</p>
                                    <div className="flex items-center flex-wrap gap-2 mt-1.5">
                                        {isShortage && (
                                            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wide border border-red-200">
                                                {group.variance} Units
                                            </span>
                                        )}
                                        {isSurplus && (
                                            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wide border border-blue-200">
                                                +{group.variance} Surplus
                                            </span>
                                        )}
                                        {group.status === 'matched' && (
                                             <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wide border border-emerald-100">
                                                Matched
                                            </span>
                                        )}
                                        <span className="text-[10px] text-slate-500">{group.locationsCount} Locations</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <div className="text-right">
                                    <span className="block text-[10px] text-slate-500 uppercase tracking-wider">Global Count</span>
                                    <div className="flex items-baseline justify-end gap-1">
                                        <span className="text-lg font-bold text-slate-900 dark:text-white">{group.totalPhysical}</span>
                                        <span className="text-xs text-slate-400">/ {group.totalSystem}</span>
                                    </div>
                                </div>
                                <span className="material-symbols-outlined text-slate-400 transition-transform duration-300 group-open:rotate-180">expand_more</span>
                            </div>
                        </div>
                    </summary>
                    
                    {/* Inner Table */}
                    <div className="bg-white dark:bg-slate-800 border-t border-slate-100">
                         <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                            <div className="col-span-4">Location</div>
                            <div className="col-span-3 text-center">Batch</div>
                            <div className="col-span-2 text-center">Sys</div>
                            <div className="col-span-2 text-center">Phys</div>
                            <div className="col-span-1 text-right">Diff</div>
                        </div>
                        {group.logs.map(log => {
                            const diff = log.physicalQty - log.systemQty; // Approximate diff per location if we assume system qty is distributed? 
                            // Actually log.variance is stored directly.
                            const rowColor = log.variance < 0 ? 'bg-red-50/30' : log.variance > 0 ? 'bg-blue-50/30' : '';
                            
                            return (
                                <div key={log.id} className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-50 items-center hover:bg-slate-50 transition-colors ${rowColor}`}>
                                    <div className="col-span-4 flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${log.variance === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium text-slate-700">{log.location}</span>
                                            <span className="text-[10px] text-slate-400 truncate w-20">{log.teamMember}</span>
                                        </div>
                                    </div>
                                    <div className="col-span-3 text-center text-xs text-slate-600 font-mono flex flex-col">
                                        <span>{log.batchNumber}</span>
                                        <span className="text-[8px] text-slate-400">{log.expiryDate}</span>
                                    </div>
                                    <div className="col-span-2 text-center text-xs text-slate-500">{log.systemQty}</div>
                                    <div className="col-span-2 text-center text-xs font-bold text-slate-900 bg-slate-100 rounded py-0.5">{log.physicalQty}</div>
                                    <div className={`col-span-1 text-right text-xs font-medium ${log.variance < 0 ? 'text-red-600' : log.variance > 0 ? 'text-blue-600' : 'text-emerald-500'}`}>
                                        {log.variance}
                                    </div>
                                </div>
                            );
                        })}
                        {group.logs.length === 0 && (
                            <div className="p-4 text-center text-xs text-slate-400 italic">No audit logs yet. System data only.</div>
                        )}
                    </div>
                </details>
            );
        })}
      </main>

      {/* Floating Scan Button */}
      <button 
        onClick={() => onNavigate(AppView.FORM)}
        className="fixed bottom-24 right-4 h-14 w-14 bg-primary text-white rounded-2xl shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary/90 transition-transform active:scale-95 z-40 group"
      >
        <span className="material-symbols-outlined text-[28px] group-hover:rotate-90 transition-transform">qr_code_scanner</span>
      </button>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe pt-2 px-2 z-30">
        <div className="flex justify-around items-center h-16 pb-2">
            <button className="flex flex-col items-center gap-1 flex-1 text-primary">
                <span className="material-symbols-outlined text-[24px] filled">dashboard</span>
                <span className="text-[10px] font-medium">Dashboard</span>
            </button>
            <button onClick={() => onNavigate(AppView.FORM)} className="flex flex-col items-center gap-1 flex-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                <span className="material-symbols-outlined text-[24px]">barcode_scanner</span>
                <span className="text-[10px] font-medium">Scan</span>
            </button>
            <button onClick={() => onNavigate(AppView.LOCATION_CHECKLIST)} className="flex flex-col items-center gap-1 flex-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                <span className="material-symbols-outlined text-[24px]">checklist</span>
                <span className="text-[10px] font-medium">Locations</span>
            </button>
            <button onClick={() => onNavigate(AppView.MASTER_DATA)} className="flex flex-col items-center gap-1 flex-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                <span className="material-symbols-outlined text-[24px]">database</span>
                <span className="text-[10px] font-medium">Data</span>
            </button>
        </div>
      </nav>
      <div className="h-6"></div>
    </div>
  );
};

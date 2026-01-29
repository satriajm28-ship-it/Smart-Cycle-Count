
import React, { useState, useEffect } from 'react';
import { getAuditLogs, getMasterData, getMasterLocations, getLocationStates } from '../services/storageService';
import { AuditRecord, AppView, MasterItem } from '../types';

interface DashboardProps {
  onNavigate: (view: AppView) => void;
}

interface GroupedItem {
  sku: string;
  name: string;
  category: string;
  systemStock: number;
  totalPhysical: number;
  logs: AuditRecord[];
  variance: number;
  status: 'matched' | 'shortage' | 'surplus';
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [groupedItems, setGroupedItems] = useState<GroupedItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Stats
  const [locationStats, setLocationStats] = useState({ total: 0, audited: 0, empty: 0, damaged: 0, pending: 0 });
  const [totalVariance, setTotalVariance] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const [surplusCount, setSurplusCount] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [showDiscrepanciesOnly, setShowDiscrepanciesOnly] = useState(false);
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

            // 1. Group Logs by SKU
            const groups: Record<string, GroupedItem> = {};
            let globalVar = 0;
            
            // Initialize groups from Master Data to show everything (even if not scanned)
            // Or only show scanned? The HTML implies showing audit progress. 
            // We'll stick to "Items with Logs" for the main list to match the "Audit Dashboard" concept.
            
            logs.forEach(log => {
                if (!groups[log.sku]) {
                    const master = masterData.find(m => m.sku === log.sku);
                    groups[log.sku] = {
                        sku: log.sku,
                        name: log.itemName,
                        category: master?.category || 'General',
                        systemStock: master ? master.systemStock : log.systemQty,
                        totalPhysical: 0,
                        logs: [],
                        variance: 0,
                        status: 'matched'
                    };
                }
                groups[log.sku].logs.push(log);
                groups[log.sku].totalPhysical += log.physicalQty;
            });

            // Process Groups
            let crit = 0;
            let surp = 0;

            const processedGroups = Object.values(groups).map(g => {
                g.variance = g.totalPhysical - g.systemStock;
                globalVar += g.variance;
                
                if (g.variance < 0) {
                    g.status = 'shortage';
                    crit++;
                } else if (g.variance > 0) {
                    g.status = 'surplus';
                    surp++;
                }
                return g;
            });

            setGroupedItems(processedGroups);
            setTotalVariance(globalVar);
            setCriticalCount(crit);
            setSurplusCount(surp);

            // 2. Location Stats
            const total = masterLocations.length;
            let audited = 0, empty = 0, damaged = 0;
            
            Object.values(locationStates).forEach((state: any) => {
                if (state.status === 'audited') audited++;
                if (state.status === 'empty') empty++;
                if (state.status === 'damaged') damaged++;
            });

            setLocationStats({
                total,
                audited,
                empty,
                damaged,
                pending: total > 0 ? total - (audited + empty + damaged) : 0
            });
        } catch (error) {
            console.error("Failed to load dashboard data", error);
        } finally {
            setLoading(false);
        }
    };

    fetchData();
  }, []);

  // Filtering Logic
  const filteredGroups = groupedItems.filter(g => {
      const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            g.sku.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDiscrepancy = showDiscrepanciesOnly ? g.variance !== 0 : true;
      const matchesType = activeFilter === 'all' ? true : g.status === activeFilter;

      return matchesSearch && matchesDiscrepancy && matchesType;
  });

  // Calculate Chart Gradient
  const totalLocs = locationStats.total || 1; // avoid divide by zero
  const pctAudited = (locationStats.audited / totalLocs) * 100;
  const pctEmpty = (locationStats.empty / totalLocs) * 100;
  const pctDamaged = (locationStats.damaged / totalLocs) * 100;
  
  // Stops for conic-gradient
  // #135bec (Audited) -> from 0% to pctAudited%
  // #cbd5e1 (Empty) -> from pctAudited% to (pctAudited + pctEmpty)%
  // #f97316 (Damaged) -> from (pctAudited + pctEmpty)% to (pctAudited + pctEmpty + pctDamaged)%
  // Transparent/Grey (Pending) -> remaining
  const stop1 = pctAudited;
  const stop2 = stop1 + pctEmpty;
  const stop3 = stop2 + pctDamaged;

  const chartGradient = `conic-gradient(
      #135bec 0% ${stop1}%, 
      #cbd5e1 ${stop1}% ${stop2}%, 
      #f97316 ${stop2}% ${stop3}%, 
      #f1f5f9 ${stop3}% 100%
  )`;

  const totalAuditedQty = groupedItems.reduce((acc, curr) => acc + curr.totalPhysical, 0);
  const accuracy = groupedItems.length > 0 
    ? ((groupedItems.filter(g => g.variance === 0).length / groupedItems.length) * 100).toFixed(1)
    : "100";

  if (loading) {
      return (
          <div className="flex flex-col items-center justify-center min-h-screen bg-[#f6f6f8] text-slate-500 gap-3">
              <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
              <p className="font-medium animate-pulse">Loading Dashboard...</p>
          </div>
      );
  }

  return (
    <div className="bg-[#f6f6f8] dark:bg-[#101622] text-slate-900 dark:text-slate-100 min-h-screen pb-24 font-display">
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#101622]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between transition-all">
        <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Audit Dashboard</h1>
        <button className="relative p-2 rounded-full text-primary hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-primary/20">
            <span className="material-symbols-outlined text-[24px]">ios_share</span>
        </button>
      </header>

      {/* Filter Section */}
      <section className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-4 space-y-4 shadow-sm z-30 relative">
        <div>
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">Audit Period</label>
            <div className="flex items-center gap-3">
                <div className="relative flex-1 group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-slate-400 text-[18px]">calendar_today</span>
                    </div>
                    <input className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm" type="date" />
                </div>
                <span className="text-slate-400 font-medium">-</span>
                <div className="relative flex-1 group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="material-symbols-outlined text-slate-400 text-[18px]">event</span>
                    </div>
                    <input className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm" type="date" />
                </div>
            </div>
        </div>

        <div>
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">Assigned Team</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-slate-400 text-[20px]">diversity_3</span>
                </div>
                <select className="block w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none transition-all shadow-sm font-medium">
                    <option value="all">All Teams</option>
                    <option value="alpha">Team Alpha</option>
                    <option value="bravo">Team Bravo</option>
                    <option value="charlie">Team Charlie</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="material-symbols-outlined text-slate-400 text-[20px]">expand_more</span>
                </div>
            </div>
        </div>

        <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-500 dark:text-slate-400 text-[20px]">error_circle_rounded</span>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Show Only Discrepancies</span>
            </div>
            <button 
                role="switch" 
                aria-checked={showDiscrepanciesOnly}
                onClick={() => setShowDiscrepanciesOnly(!showDiscrepanciesOnly)}
                className={`${showDiscrepanciesOnly ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
            >
                <span aria-hidden="true" className={`${showDiscrepanciesOnly ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}></span>
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
                    placeholder="Search SKU, Item Name, or Batch" 
                />
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                <button 
                    onClick={() => setActiveFilter('all')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap shadow-sm transition-transform active:scale-95 ${activeFilter === 'all' ? 'bg-primary text-white shadow-primary/30' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}
                >
                    All Items
                </button>
                <button 
                    onClick={() => setActiveFilter('shortage')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap active:bg-slate-50 dark:active:bg-slate-700 ${activeFilter === 'shortage' ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}
                >
                    Shortages
                    <span className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 rounded-full text-[10px] ml-1">{criticalCount}</span>
                </button>
                <button 
                    onClick={() => setActiveFilter('surplus')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap active:bg-slate-50 dark:active:bg-slate-700 ${activeFilter === 'surplus' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}
                >
                    Surplus
                    <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-1.5 rounded-full text-[10px] ml-1">{surplusCount}</span>
                </button>
            </div>
        </div>
      </section>

      {/* Stats Cards (Horizontal Scroll) */}
      <section className="px-4 py-4 overflow-x-auto no-scrollbar">
        <div className="flex gap-3 min-w-max">
            {/* Location Status Card */}
            <button 
                onClick={() => onNavigate(AppView.LOCATION_CHECKLIST)}
                className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 w-48 flex flex-col gap-2 text-left relative group overflow-hidden hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 shrink-0"
            >
                <div className="flex justify-between items-center z-10 w-full">
                    <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">Location Status</p>
                    <span className="material-symbols-outlined text-[16px] text-slate-300 group-hover:text-primary transition-colors">arrow_forward</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 z-10">
                    <div className="relative w-12 h-12 rounded-full flex-shrink-0" style={{ background: chartGradient }}>
                        <div className="absolute inset-[3px] bg-white dark:bg-slate-800 rounded-full flex items-center justify-center flex-col">
                            <span className="text-[8px] font-medium text-slate-400 leading-none">Total</span>
                            <span className="text-[11px] font-bold text-slate-900 dark:text-white leading-tight">{locationStats.total}</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 w-full min-w-0">
                        <div className="flex items-center justify-between text-[9px] w-full">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                                <span className="text-slate-600 dark:text-slate-300 font-medium">Audited</span>
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white">{locationStats.audited}</span>
                        </div>
                        <div className="flex items-center justify-between text-[9px] w-full">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                <span className="text-slate-600 dark:text-slate-300 font-medium">Empty</span>
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white">{locationStats.empty}</span>
                        </div>
                        <div className="flex items-center justify-between text-[9px] w-full">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                                <span className="text-slate-600 dark:text-slate-300 font-medium">Damaged</span>
                            </div>
                            <span className="font-bold text-slate-900 dark:text-white">{locationStats.damaged}</span>
                        </div>
                    </div>
                </div>
            </button>

            {/* Critical Alerts */}
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl shadow-sm border border-red-200 dark:border-red-800/60 w-36 flex flex-col gap-1">
                <p className="text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-wider">Critical Alerts</p>
                <p className="text-xl font-bold font-display text-red-700 dark:text-red-300">{criticalCount} Items</p>
                <div className="flex items-center text-[10px] font-medium text-red-600 dark:text-red-400 mt-1">
                    <span className="material-symbols-outlined text-[14px] fill-current">warning</span>
                    <span className="ml-1">High Discrepancy</span>
                </div>
            </div>

            {/* Total Audited */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 w-36 flex flex-col gap-1">
                <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">Total Audited</p>
                <p className="text-xl font-bold font-display text-slate-900 dark:text-white">{totalAuditedQty}</p>
                <div className="flex items-center text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mt-1">
                    <span className="material-symbols-outlined text-[14px]">trending_up</span>
                    <span className="ml-1">Live</span>
                </div>
            </div>

            {/* Accuracy */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 w-36 flex flex-col gap-1">
                <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">Accuracy</p>
                <p className="text-xl font-bold font-display text-slate-900 dark:text-white">{accuracy}%</p>
                <div className="flex items-center text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mt-1">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    <span className="ml-1">Target 98%</span>
                </div>
            </div>

             {/* Net Variance */}
             <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 w-36 flex flex-col gap-1">
                <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">Net Variance</p>
                <p className={`text-xl font-bold font-display ${totalVariance < 0 ? 'text-red-600' : totalVariance > 0 ? 'text-blue-600' : 'text-slate-900'}`}>
                    {totalVariance > 0 ? '+' : ''}{totalVariance} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">Units</span>
                </p>
                <div className={`flex items-center text-[10px] font-medium mt-1 ${totalVariance !== 0 ? 'text-red-600' : 'text-slate-400'}`}>
                    <span className="material-symbols-outlined text-[14px]">{totalVariance !== 0 ? 'error' : 'check'}</span>
                    <span className="ml-1">{totalVariance !== 0 ? 'Action Req' : 'Balanced'}</span>
                </div>
            </div>
        </div>
      </section>

      {/* Main Content List */}
      <main className="px-4 pb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Grouped By Item</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400">Showing {filteredGroups.length} items</span>
        </div>

        {filteredGroups.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-slate-400">
                No items found.
            </div>
        ) : (
            filteredGroups.map(group => {
                const isShortage = group.status === 'shortage';
                const isSurplus = group.status === 'surplus';
                const isMatched = group.status === 'matched';

                let accentColor = "border-slate-200 dark:border-slate-700";
                let summaryBg = "hover:bg-slate-50 dark:hover:bg-slate-700/30";
                let barColor = "bg-primary";
                
                if (isShortage) {
                    accentColor = "border-red-200 dark:border-red-900/50";
                    summaryBg = "bg-red-50/80 dark:bg-red-950/20 hover:bg-red-100/80";
                    barColor = "bg-red-600";
                } else if (isSurplus) {
                    accentColor = "border-blue-200 dark:border-blue-900/50";
                    summaryBg = "bg-blue-50/80 dark:bg-blue-950/20 hover:bg-blue-100/80";
                    barColor = "bg-blue-600";
                } else if (isMatched) {
                    barColor = "bg-emerald-500";
                }

                return (
                    <details key={group.sku} className={`group rounded-xl shadow-sm border ${accentColor} bg-white dark:bg-slate-800 overflow-hidden`}>
                        <summary className={`cursor-pointer ${summaryBg} p-4 relative list-none transition-colors`}>
                            <div className={`absolute top-0 left-0 w-1 h-full ${barColor}`}></div>
                            <div className="flex justify-between items-start">
                                <div className="flex gap-3">
                                    {/* Item Icon Placeholder */}
                                    <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-700 flex-shrink-0 flex items-center justify-center shadow-sm">
                                        <span className="material-symbols-outlined text-slate-400 text-2xl">
                                            {group.category === 'Food' ? 'restaurant' : 
                                             group.category === 'Medicine' ? 'medication' : 
                                             group.category === 'Equipment' ? 'medical_services' : 'inventory_2'}
                                        </span>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight flex items-center gap-1">
                                            {group.name}
                                            {isShortage && <span className="material-symbols-outlined text-red-600 text-[18px]">error</span>}
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">SKU: {group.sku}</p>
                                        <div className="flex items-center flex-wrap gap-2 mt-1.5">
                                            {isMatched ? (
                                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wide border border-emerald-100 dark:border-emerald-900/30">
                                                    Matched
                                                </span>
                                            ) : (
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border flex items-center gap-1 ${isShortage ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/30'}`}>
                                                    {group.variance > 0 ? '+' : ''}{group.variance} Units
                                                </span>
                                            )}
                                            <span className="text-[10px] text-slate-500 dark:text-slate-400">{group.logs.length} Locations</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <div className="text-right">
                                        <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">Global Count</span>
                                        <div className="flex items-baseline justify-end gap-1">
                                            <span className="text-lg font-bold text-slate-900 dark:text-white">{group.totalPhysical}</span>
                                            <span className="text-xs text-slate-400">/ {group.systemStock}</span>
                                        </div>
                                    </div>
                                    <span className="material-symbols-outlined text-slate-400 transition-transform duration-300 group-open:rotate-180">expand_more</span>
                                </div>
                            </div>
                        </summary>

                        {/* Detailed Table */}
                        <div className="bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
                            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-900/50 text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700/50">
                                <div className="col-span-4">Location</div>
                                <div className="col-span-3 text-center">Batch</div>
                                <div className="col-span-2 text-center">Sys</div>
                                <div className="col-span-2 text-center">Phys</div>
                                <div className="col-span-1 text-right">Diff</div>
                            </div>

                            {group.logs.map((log) => {
                                const logVar = log.variance;
                                const isLogShortage = logVar < 0;
                                const isLogSurplus = logVar > 0;
                                let rowBg = "hover:bg-slate-50 dark:hover:bg-slate-700/30";
                                if (isLogShortage) rowBg = "bg-red-50/30 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20";
                                if (isLogSurplus) rowBg = "bg-blue-50/30 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20";

                                return (
                                    <div key={log.id} className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-50 dark:border-slate-700/30 items-center transition-colors ${rowBg} last:border-0`}>
                                        <div className="col-span-4 flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${logVar === 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{log.location}</span>
                                                <span className="text-[10px] text-slate-400">{log.teamMember.split(' - ')[0] || 'Team'}</span>
                                            </div>
                                        </div>
                                        <div className="col-span-3 text-center text-xs text-slate-600 dark:text-slate-400 font-mono truncate">{log.batchNumber}</div>
                                        <div className="col-span-2 text-center text-xs text-slate-500 dark:text-slate-400">{log.systemQty}</div>
                                        <div className="col-span-2 text-center text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 rounded py-0.5">{log.physicalQty}</div>
                                        <div className="col-span-1 text-right flex items-center justify-end gap-1">
                                            <span className={`text-xs font-medium ${logVar === 0 ? 'text-emerald-500' : 'text-red-600'}`}>
                                                {logVar}
                                            </span>
                                            {logVar !== 0 && (
                                                 <span className="material-symbols-outlined text-[16px] text-slate-400">photo_camera</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </details>
                );
            })
        )}
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

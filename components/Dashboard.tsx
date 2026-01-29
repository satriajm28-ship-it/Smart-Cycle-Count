
import React, { useState, useEffect } from 'react';
import { getAuditLogs, getMasterData, getMasterLocations, getLocationStates } from '../services/storageService';
import { AuditRecord, AppView, MasterItem, MasterLocation } from '../types';

interface DashboardProps {
  onNavigate: (view: AppView) => void;
}

// Data structures for grouping
interface GroupedItem {
  sku: string;
  name: string;
  systemStock: number;
  totalPhysical: number;
  logs: AuditRecord[];
  variance: number;
  status: 'matched' | 'shortage' | 'surplus';
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [groupedItems, setGroupedItems] = useState<GroupedItem[]>([]);
  const [pendingItems, setPendingItems] = useState<MasterItem[]>([]);
  
  // Location Stats
  const [locationStats, setLocationStats] = useState({ total: 0, audited: 0, empty: 0, damaged: 0, pending: 0 });
  
  // UI State
  const [activeTab, setActiveTab] = useState<'audited' | 'pending'>('audited');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const logs = getAuditLogs();
    const masterData = getMasterData();
    const masterLocations = getMasterLocations();
    const locationStates = getLocationStates();

    // 1. Group Logs by SKU
    const groups: Record<string, GroupedItem> = {};
    
    // Initialize groups with scanned items
    logs.forEach(log => {
        if (!groups[log.sku]) {
            // Find system stock
            const master = masterData.find(m => m.sku === log.sku);
            const systemStock = master ? master.systemStock : log.systemQty;
            
            groups[log.sku] = {
                sku: log.sku,
                name: log.itemName,
                systemStock,
                totalPhysical: 0,
                logs: [],
                variance: 0,
                status: 'matched'
            };
        }
        groups[log.sku].logs.push(log);
        groups[log.sku].totalPhysical += log.physicalQty;
    });

    // Finalize groups (calc variance)
    const processedGroups = Object.values(groups).map(g => {
        g.variance = g.totalPhysical - g.systemStock;
        if (g.variance < 0) g.status = 'shortage';
        else if (g.variance > 0) g.status = 'surplus';
        return g;
    });

    setGroupedItems(processedGroups);

    // 2. Identify Pending Items
    const scannedSkus = new Set(logs.map(l => l.sku));
    const pending = masterData.filter(m => !scannedSkus.has(m.sku));
    setPendingItems(pending);

    // 3. Location Stats
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
        pending: total - (audited + empty + damaged)
    });

  }, []);

  const toggleExpand = (sku: string) => {
    const newSet = new Set(expandedItems);
    if (newSet.has(sku)) {
        newSet.delete(sku);
    } else {
        newSet.add(sku);
    }
    setExpandedItems(newSet);
  };

  // Filtering
  const filteredGroups = groupedItems.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    g.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPending = pendingItems.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Statistics
  const totalAuditedQty = groupedItems.reduce((acc, curr) => acc + curr.totalPhysical, 0);
  const accuracy = groupedItems.length > 0 
    ? (groupedItems.filter(g => g.variance === 0).length / groupedItems.length * 100).toFixed(1) 
    : "100";

  // Calculate widths for the location breakdown bar
  const totalVisited = locationStats.audited + locationStats.empty + locationStats.damaged;
  const auditPct = locationStats.total > 0 ? (locationStats.audited / locationStats.total) * 100 : 0;
  const emptyPct = locationStats.total > 0 ? (locationStats.empty / locationStats.total) * 100 : 0;
  const dmgPct = locationStats.total > 0 ? (locationStats.damaged / locationStats.total) * 100 : 0;
  const pendingPct = 100 - (auditPct + emptyPct + dmgPct);

  return (
    <div className="bg-[#f6f6f8] text-slate-900 min-h-screen pb-24 font-display">
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between transition-all">
        <h1 className="text-lg font-bold tracking-tight text-slate-900">Dashboard</h1>
        <div className="flex gap-2">
            <button 
                onClick={() => setActiveTab('audited')}
                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${activeTab === 'audited' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}
            >
                Items
            </button>
            <button 
                onClick={() => setActiveTab('pending')}
                className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${activeTab === 'pending' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}
            >
                Pending
            </button>
        </div>
      </header>

      {/* Warehouse Status Breakdown Widget */}
      <section className="px-4 py-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div 
                onClick={() => onNavigate(AppView.LOCATION_CHECKLIST)}
                className="flex justify-between items-center mb-3 cursor-pointer group"
            >
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px]">warehouse</span>
                    Warehouse Status
                </h2>
                <span className="text-xs font-bold text-primary flex items-center gap-1 group-hover:underline">
                    Manage <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                </span>
            </div>
            
            {/* Status Bar */}
            <div className="h-4 w-full rounded-full flex overflow-hidden bg-slate-100 mb-3">
                <div style={{ width: `${auditPct}%` }} className="bg-primary h-full"></div>
                <div style={{ width: `${emptyPct}%` }} className="bg-slate-400 h-full"></div>
                <div style={{ width: `${dmgPct}%` }} className="bg-red-500 h-full"></div>
            </div>

            {/* Legend */}
            <div className="flex justify-between text-xs">
                <div className="flex flex-col items-center">
                    <span className="font-bold text-slate-900">{locationStats.audited}</span>
                    <div className="flex items-center gap-1 text-slate-500">
                        <div className="w-2 h-2 rounded-full bg-primary"></div> Audited
                    </div>
                </div>
                 <div className="flex flex-col items-center">
                    <span className="font-bold text-slate-900">{locationStats.empty}</span>
                    <div className="flex items-center gap-1 text-slate-500">
                        <div className="w-2 h-2 rounded-full bg-slate-400"></div> Empty
                    </div>
                </div>
                 <div 
                    className="flex flex-col items-center cursor-pointer hover:bg-red-50 p-1 -m-1 rounded transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (locationStats.damaged > 0) onNavigate(AppView.DAMAGED_REPORT);
                    }}
                 >
                    <span className="font-bold text-red-600 underline decoration-red-200">{locationStats.damaged}</span>
                    <div className="flex items-center gap-1 text-red-500 font-medium">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div> Damaged
                    </div>
                </div>
                 <div className="flex flex-col items-center">
                    <span className="font-bold text-slate-900">{locationStats.pending}</span>
                    <div className="flex items-center gap-1 text-slate-500">
                        <div className="w-2 h-2 rounded-full bg-slate-100 border border-slate-300"></div> Pending
                    </div>
                </div>
            </div>
        </div>
      </section>

      {/* Quick Stats (Audited Items) */}
      {activeTab === 'audited' && (
        <section className="px-4 pb-2 flex gap-3 overflow-x-auto no-scrollbar">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 min-w-[100px] flex-1">
                <p className="text-slate-500 text-[10px] font-bold uppercase">Total Qty</p>
                <p className="text-lg font-bold text-slate-900">{totalAuditedQty}</p>
            </div>
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100 min-w-[100px] flex-1">
                <p className="text-slate-500 text-[10px] font-bold uppercase">Accuracy</p>
                <p className="text-lg font-bold text-slate-900">{accuracy}%</p>
            </div>
        </section>
      )}

      {/* Search Bar */}
      <div className="px-4 py-2">
         <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none material-symbols-outlined text-[20px]">search</span>
            <input 
              type="text" 
              placeholder={activeTab === 'audited' ? "Search audited items..." : "Search pending items..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white text-slate-900 rounded-xl border border-slate-200 pl-10 pr-4 py-3 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm shadow-sm transition-all" 
            />
          </div>
      </div>

      <main className="px-4 pb-4 flex flex-col gap-3">
        
        {/* --- AUDITED ITEMS LIST --- */}
        {activeTab === 'audited' && (
            <>
                {filteredGroups.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-slate-100 text-slate-400">
                        No audited items found. Start scanning!
                    </div>
                ) : (
                    filteredGroups.map(group => {
                        const isExpanded = expandedItems.has(group.sku);
                        const statusColor = group.status === 'matched' ? 'bg-green-100 text-green-700' : group.status === 'shortage' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700';
                        const varianceText = group.variance > 0 ? `+${group.variance}` : group.variance;

                        return (
                            <div key={group.sku} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all">
                                {/* Main Row */}
                                <div 
                                    onClick={() => toggleExpand(group.sku)}
                                    className="p-4 flex items-center justify-between cursor-pointer active:bg-slate-50"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-slate-900 text-sm">{group.name}</h3>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusColor}`}>
                                                {group.status === 'matched' ? 'MATCH' : `${varianceText} VAR`}
                                            </span>
                                        </div>
                                        <div className="flex items-center text-xs text-slate-500 gap-3">
                                            <span className="font-mono">{group.sku}</span>
                                            <span>•</span>
                                            <span>{group.logs.length} Locations</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-slate-900">{group.totalPhysical}</div>
                                        <div className="text-[10px] text-slate-400 uppercase">Total Qty</div>
                                    </div>
                                    <span className={`material-symbols-outlined text-slate-400 transition-transform duration-200 ml-2 ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="bg-slate-50 border-t border-slate-100 animate-fade-in">
                                        <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between bg-slate-100/50">
                                            <span>Location Breakdown</span>
                                            <span>Sys: {group.systemStock}</span>
                                        </div>
                                        {group.logs.map((log) => (
                                            <div key={log.id} className="px-4 py-3 border-b border-slate-100/50 flex justify-between items-center last:border-0">
                                                <div>
                                                    <div className="text-sm font-medium text-slate-700 flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[14px] text-slate-400">location_on</span>
                                                        {log.location}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 pl-5">
                                                        {new Date(log.timestamp).toLocaleDateString()} • {log.teamMember}
                                                    </div>
                                                </div>
                                                <span className="font-mono font-bold text-slate-600">{log.physicalQty}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </>
        )}

        {/* --- PENDING ITEMS LIST --- */}
        {activeTab === 'pending' && (
            <>
                {filteredPending.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-slate-100 text-emerald-600">
                        <span className="material-symbols-outlined text-4xl mb-2">check_circle</span>
                        <p>All items have been counted!</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100">
                        {filteredPending.map(item => (
                            <div key={item.sku} className="p-4 flex justify-between items-center group hover:bg-slate-50 transition">
                                <div>
                                    <h3 className="font-bold text-slate-700 text-sm">{item.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-slate-400 font-mono bg-slate-100 px-1 rounded">{item.sku}</span>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider">• {item.category}</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => onNavigate(AppView.FORM)} 
                                    className="p-2 bg-slate-100 text-primary rounded-lg hover:bg-primary hover:text-white transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </>
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
      <nav className="fixed bottom-0 w-full bg-white border-t border-slate-200 pb-safe pt-2 px-2 z-30">
        <div className="flex justify-around items-center h-16 pb-2">
            <button className="flex flex-col items-center gap-1 flex-1 text-primary">
                <span className="material-symbols-outlined text-[24px] filled">dashboard</span>
                <span className="text-[10px] font-medium">Dashboard</span>
            </button>
            <button onClick={() => onNavigate(AppView.FORM)} className="flex flex-col items-center gap-1 flex-1 text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-[24px]">barcode_scanner</span>
                <span className="text-[10px] font-medium">Scan</span>
            </button>
            <button onClick={() => onNavigate(AppView.LOCATION_CHECKLIST)} className="flex flex-col items-center gap-1 flex-1 text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-[24px]">checklist</span>
                <span className="text-[10px] font-medium">Locations</span>
            </button>
            <button onClick={() => onNavigate(AppView.MASTER_DATA)} className="flex flex-col items-center gap-1 flex-1 text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined text-[24px]">database</span>
                <span className="text-[10px] font-medium">Data</span>
            </button>
        </div>
      </nav>
      <div className="h-6"></div> 
    </div>
  );
};

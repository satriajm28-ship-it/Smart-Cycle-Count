
import React, { useState, useEffect } from 'react';
import { ActivityLog } from '../types';
import { subscribeToActivityLogs } from '../services/storageService';
import { Clock, User, Info, ZoomIn, X } from 'lucide-react';

export const ActivityLogs: React.FC = () => {
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = subscribeToActivityLogs((data) => {
            setLogs(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'scan': return 'bg-cyan-400';
            case 'adjustment': return 'bg-purple-400';
            case 'alert': return 'bg-red-400';
            case 'start': return 'bg-white';
            case 'create': return 'bg-emerald-400';
            case 'update': return 'bg-amber-400';
            case 'delete': return 'bg-rose-500';
            default: return 'bg-slate-400';
        }
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-4 pb-24 animate-fade-in">
            <h1 className="text-2xl font-headline font-extrabold text-slate-900 dark:text-white mb-6">Activity Logs</h1>

            <div className="bg-slate-900/90 dark:bg-black/40 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/5">
                <div className="space-y-8 relative">
                    {/* Vertical Line */}
                    <div className="absolute left-[11px] top-2 bottom-2 w-[1px] bg-slate-700/50 z-0"></div>

                    {logs.length === 0 ? (
                        <div className="text-center py-12 text-slate-500">
                            <Clock className="mx-auto mb-3 opacity-20" size={48} />
                            <p className="font-bold uppercase tracking-widest text-xs">Belum ada aktivitas</p>
                        </div>
                    ) : (
                        logs.map((log, index) => (
                            <div key={log.id} className="relative z-10 flex gap-4 group">
                                {/* Dot */}
                                <div className="mt-1.5 relative">
                                    <div className={`w-6 h-6 rounded-full ${getTypeColor(log.type)} shadow-[0_0_10px_rgba(255,255,255,0.2)] flex items-center justify-center`}>
                                        <div className="w-2 h-2 bg-black/20 rounded-full"></div>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-bold text-white tracking-tight">{log.title}</h3>
                                        <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                            {formatTime(log.timestamp)}
                                        </span>
                                    </div>
                                    
                                    <p className="text-sm text-slate-400 leading-relaxed">
                                        {log.description}
                                    </p>

                                    {log.details && (
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                            <Info size={12} />
                                            {log.details}
                                        </div>
                                    )}

                                    {log.photos && log.photos.length > 0 && (
                                        <div className="flex gap-2 pt-2 overflow-x-auto no-scrollbar">
                                            {log.photos.map((photo, pIdx) => (
                                                <div 
                                                    key={pIdx} 
                                                    onClick={() => setPreviewImage(photo)}
                                                    className="relative w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex-shrink-0 cursor-zoom-in hover:scale-105 transition-transform"
                                                >
                                                    <img src={photo} className="w-full h-full object-cover" alt="Evidence" />
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-3 pt-1">
                                        <div className="flex items-center gap-1 text-[9px] font-black text-slate-600 uppercase tracking-tighter">
                                            <User size={10} />
                                            {log.user}
                                        </div>
                                        <div className="text-[9px] font-black text-slate-600 uppercase tracking-tighter">
                                            {formatDate(log.timestamp)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-white/5">
                    <button className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-400 font-bold text-xs uppercase tracking-[0.2em] rounded-xl transition-all">
                        View Full Audit Trail
                    </button>
                </div>
            </div>

            {/* Image Preview Modal */}
            {previewImage && (
                <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewImage(null)}>
                    <button className="absolute top-6 right-6 text-white bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
                        <X size={24} />
                    </button>
                    <img src={previewImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" alt="Preview" />
                </div>
            )}
        </div>
    );
};

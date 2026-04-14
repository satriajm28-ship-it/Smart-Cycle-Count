
import React, { useState, useEffect } from 'react';
import { AppUser } from '../types';
import { getAllUsers, saveUser, deleteUser } from '../services/authService';
import { UserPlus, Trash2, Shield, User, Key, Save, X, Search, ChevronLeft } from 'lucide-react';

interface UserManagementProps {
    onBack: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ onBack }) => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    const [isEditing, setIsEditing] = useState(false);
    const [editingUser, setEditingUser] = useState<any | null>(null);
    const [form, setForm] = useState({
        username: '',
        password: '',
        name: '',
        role: 'user' as 'admin' | 'user'
    });

    const fetchUsers = async () => {
        setLoading(true);
        const data = await getAllUsers();
        setUsers(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleAddClick = () => {
        setEditingUser(null);
        setForm({ username: '', password: '', name: '', role: 'user' });
        setIsEditing(true);
    };

    const handleEditClick = (user: any) => {
        setEditingUser(user);
        setForm({
            username: user.username,
            password: user.password || '',
            name: user.name,
            role: user.role
        });
        setIsEditing(true);
    };

    const handleDeleteClick = async (username: string) => {
        if (username === 'admin') {
            alert("Akun 'admin' utama tidak dapat dihapus.");
            return;
        }
        if (window.confirm(`Hapus user ${username}?`)) {
            const success = await deleteUser(username);
            if (success) fetchUsers();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.username || !form.password || !form.name) {
            alert("Semua field harus diisi.");
            return;
        }

        const result = await saveUser(form);
        if (result && result.success) {
            setIsEditing(false);
            fetchUsers();
        } else {
            alert(`Gagal menyimpan user: ${result?.error || 'Unknown error'}`);
        }
    };

    const filteredUsers = users.filter(u => 
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
        u.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="max-w-4xl mx-auto p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Manajemen User</h1>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Kelola Akses Pegawai di Supabase</p>
                    </div>
                </div>
                <button 
                    onClick={handleAddClick}
                    className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                >
                    <UserPlus size={18} /> Tambah User
                </button>
            </div>

            {/* Search Bar */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Cari username atau nama..."
                    className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-24 opacity-30">
                    <RefreshCw className="animate-spin mb-4" size={40} />
                    <p className="font-bold uppercase tracking-widest text-xs">Menghubungkan ke Supabase...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredUsers.map(user => (
                        <div key={user.username} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl ${user.role === 'admin' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                                        {user.role === 'admin' ? <Shield size={24} /> : <User size={24} />}
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-800 uppercase tracking-tight">{user.name}</h3>
                                        <p className="text-xs font-mono text-slate-400">{user.username}</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEditClick(user)} className="p-2 text-slate-400 hover:text-primary hover:bg-slate-50 rounded-lg transition-all">
                                        <Key size={16} />
                                    </button>
                                    <button onClick={() => handleDeleteClick(user.username)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <div className="mt-4 flex items-center gap-2">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${user.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {user.role}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Edit/Add Modal */}
            {isEditing && (
                <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden border border-white/5">
                        <div className="p-6 bg-primary text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2">
                                {editingUser ? <Key size={20} /> : <UserPlus size={20} />}
                                {editingUser ? 'Edit User' : 'Tambah User Baru'}
                            </h3>
                            <button onClick={() => setIsEditing(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Username (ID Pegawai)</label>
                                    <input 
                                        type="text" 
                                        disabled={!!editingUser}
                                        value={form.username}
                                        onChange={e => setForm({...form, username: e.target.value})}
                                        className="w-full rounded-xl border-slate-200 p-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none transition-all disabled:bg-slate-50" 
                                        placeholder="MBI-XXXX"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nama Lengkap</label>
                                    <input 
                                        type="text" 
                                        value={form.name}
                                        onChange={e => setForm({...form, name: e.target.value})}
                                        className="w-full rounded-xl border-slate-200 p-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none transition-all" 
                                        placeholder="Contoh: Budi Santoso"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Password</label>
                                    <input 
                                        type="text" 
                                        value={form.password}
                                        onChange={e => setForm({...form, password: e.target.value})}
                                        className="w-full rounded-xl border-slate-200 p-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none transition-all" 
                                        placeholder="••••••••"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Role Akses</label>
                                    <select 
                                        value={form.role}
                                        onChange={e => setForm({...form, role: e.target.value as any})}
                                        className="w-full rounded-xl border-slate-200 p-3 text-sm font-bold focus:ring-2 focus:ring-primary outline-none transition-all"
                                    >
                                        <option value="user">User (Operator)</option>
                                        <option value="admin">Admin (Full Access)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setIsEditing(false)} className="flex-1 py-3.5 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-xl transition-colors">Batal</button>
                                <button type="submit" className="flex-[2] py-3.5 bg-primary text-white font-bold rounded-xl text-sm shadow-xl shadow-primary/25 flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                                    <Save size={18} /> Simpan ke Supabase
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const RefreshCw = ({ className, size }: { className?: string, size?: number }) => (
    <span className={`material-symbols-outlined ${className}`} style={{ fontSize: size }}>sync</span>
);


import React, { useState, useEffect, useRef } from 'react';
import { MasterItem } from '../types';
import { getMasterData, saveMasterData, deleteAllMasterData } from '../services/storageService';
import { Download, Upload, FileSpreadsheet, Link as LinkIcon, Check, Sheet, ArrowRight, RefreshCw, ChevronLeft, ChevronRight, AlertTriangle, Database } from 'lucide-react';
import * as XLSX from 'xlsx';

export const MasterData: React.FC = () => {
  const [items, setItems] = useState<MasterItem[]>([]);
  const [activeTab, setActiveTab] = useState<'excel' | 'sheets'>('sheets');
  
  const [sheetUrl, setSheetUrl] = useState('');
  
  const [previewItems, setPreviewItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);
  
  // Import Progress State
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusText, setImportStatusText] = useState('Uploading...');
  const [isImporting, setIsImporting] = useState(false);
  
  // Mode: Append vs Replace
  const [replaceMode, setReplaceMode] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    const fetch = async () => {
        setLoading(true);
        const data = await getMasterData();
        setItems(data);
        setLoading(false);
    };
    fetch();
  }, []);

  // --- SMART MAPPING LOGIC FOR NEW HEADERS ---
  const normalizeHeader = (header: string): string | null => {
      const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (['kodebarang', 'kode', 'sku', 'itemcode', 'partnumber'].includes(h)) return 'sku';
      if (['namabarang', 'nama', 'name', 'description'].includes(h)) return 'name';
      if (['namasatuanbarangjasa', 'namasatuan', 'satuan', 'unit', 'uom'].includes(h)) return 'unit';
      if (['namagudang', 'warehouse', 'gudang', 'lokasi', 'namagudangwarehouse', 'kategori'].includes(h)) return 'category';
      if (['noseriproduksi', 'noseri', 'noproduksi', 'serial', 'batch', 'batchnumber', 'lot'].includes(h)) return 'batchNumber';
      if (['tglkadaluarsa', 'tgl', 'kadaluarsa', 'expired', 'expirydate', 'ed'].includes(h)) return 'expiryDate';
      if (['kuantitas', 'qty', 'quantity', 'stok', 'stock', 'systemstock', 'jumlah'].includes(h)) return 'systemStock';
      return null;
  };

  const formatDate = (raw: any): string => {
      if (!raw) return '';
      if (typeof raw === 'number' && raw > 20000) {
          const date = new Date(Math.round((raw - 25569) * 86400 * 1000));
          return date.toISOString().split('T')[0];
      }
      const str = String(raw).trim();
      if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
      if (str.match(/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/)) {
          const parts = str.split(/[/-]/);
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      return str;
  };

  // --- EXCEL HANDLERS ---
  const handleExportExcel = () => {
    const exportData = items.map(item => ({
        "Kode barang": item.sku,
        "Nama Barang": item.name,
        "Nama Satuan Barang & Jasa": item.unit,
        "Nama Gudang ( Warehouse)": item.category,
        "No Seri/Produksi": item.batchNumber,
        "Tgl Kadaluarsa": item.expiryDate,
        "Kuantitas": item.systemStock
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MasterData");
    XLSX.writeFile(wb, `master_data_template.xlsx`);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset value to allow re-uploading same file
    const target = e.target;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result;
      if (!data) return;
      try {
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(sheet);
        processToPreview(jsonData);
      } catch (err) {
        alert('Error parsing Excel file. Please use the provided template.');
      } finally {
         target.value = ''; // Reset for cross-browser compatibility
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // --- GOOGLE SHEETS URL HANDLER ---
  const fetchGoogleSheet = async () => {
      if (!sheetUrl) return;
      const matches = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (!matches || !matches[1]) {
          alert("Invalid Google Sheets URL.");
          return;
      }
      
      const sheetId = matches[1];
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

      setIsFetchingSheet(true);
      try {
          const response = await fetch(csvUrl);
          if (!response.ok) throw new Error("Failed to fetch");
          const csvText = await response.text();
          const workbook = XLSX.read(csvText, { type: 'string' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<any>(sheet);
          processToPreview(jsonData);
      } catch (error) {
          alert("Gagal mengambil data. Pastikan link Google Sheet benar dan akses 'Anyone with link' aktif.");
      } finally {
          setIsFetchingSheet(false);
      }
  };

  // --- COMMON IMPORT LOGIC ---
  const processToPreview = (jsonData: any[]) => {
    if (jsonData.length === 0) return;

    const rawHeaders = Object.keys(jsonData[0]);
    const headerMap: Record<string, string | null> = {};
    
    rawHeaders.forEach(h => {
        headerMap[h] = normalizeHeader(h);
    });

    const parsedItems: MasterItem[] = jsonData.map((row) => {
        const item: any = {
            sku: '', name: '', systemStock: 0, batchNumber: '-', expiryDate: '-', category: 'General', unit: 'Pcs'
        };

        Object.keys(row).forEach(key => {
            const fieldType = headerMap[key];
            let value = row[key];
            if (!value) return;

            if (fieldType === 'sku') item.sku = String(value).trim();
            if (fieldType === 'name') item.name = String(value).trim();
            if (fieldType === 'unit') item.unit = String(value).trim();
            if (fieldType === 'category') item.category = String(value).trim();
            if (fieldType === 'batchNumber') item.batchNumber = String(value).trim();
            
            if (fieldType === 'systemStock') {
                if (typeof value === 'string') value = parseFloat(value.replace(/,/g, '').replace(/\./g, '').trim()) || 0;
                else value = Number(value) || 0;
                item.systemStock = value;
            }

            if (fieldType === 'expiryDate') {
                item.expiryDate = formatDate(value);
            }
        });

        return item;
    }).filter(item => item.sku && String(item.sku).trim() !== '');

    setPreviewItems(parsedItems);
    setCurrentPage(1); // Reset to first page on new data
  };

  const confirmImport = async () => {
      if (previewItems.length === 0) return;
      if (replaceMode && !window.confirm("PERINGATAN: Mode 'Ganti Semua Data' akan menghapus seluruh data master lama. Lanjutkan?")) {
          return;
      }

      setIsImporting(true);
      setImportProgress(0);
      setImportStatusText("Initializing connection...");
      
      try {
          if (replaceMode) {
              setImportStatusText("Clearing old database...");
              await deleteAllMasterData((msg) => setImportStatusText(msg));
          }

          setImportStatusText("Uploading to Cloud Database...");
          // Pass progress callback to service
          await saveMasterData(previewItems, (progress) => {
              setImportProgress(progress);
              setImportStatusText(`Syncing ${progress}%...`);
          });
          
          const refreshedData = await getMasterData();
          setItems(refreshedData);
          setPreviewItems([]);
          alert(`Berhasil sinkronisasi ${previewItems.length} barang ke semua user!`);
      } catch (e) {
          console.error(e);
          alert("Terjadi kesalahan saat menyimpan data. Pastikan koneksi internet stabil.");
      } finally {
          setIsImporting(false);
          setImportProgress(0);
          setSheetUrl('');
      }
  };

  // Pagination Logic
  const displaySource = previewItems.length > 0 ? previewItems : items;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = displaySource.slice(indexOfFirstItem, indexOfLastItem);
  const totalItems = displaySource.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const nextPage = () => setCurrentPage(p => Math.min(p + 1, totalPages));
  const prevPage = () => setCurrentPage(p => Math.max(p - 1, 1));

  if (loading) return <div className="flex h-64 items-center justify-center"><span className="material-symbols-outlined animate-spin text-3xl text-slate-400">sync</span></div>;

  return (
    <div className="bg-white rounded-xl shadow-lg max-w-6xl mx-auto animate-fade-in overflow-hidden relative">
      
      {/* Import Progress Overlay */}
      {isImporting && (
          <div className="absolute inset-0 z-50 bg-white/95 flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in">
              <div className="w-64 space-y-4 text-center">
                  <span className="material-symbols-outlined text-4xl text-blue-600 animate-bounce">cloud_upload</span>
                  <div className="flex justify-between text-xs font-bold uppercase text-slate-600">
                      <span>{importStatusText}</span>
                      <span>{importProgress}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div className="h-full bg-blue-600 transition-all duration-300 ease-out" style={{ width: `${importProgress}%` }}></div>
                  </div>
                  <p className="text-[10px] text-center text-slate-400">Please do not close this window</p>
              </div>
          </div>
      )}

      <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="text-green-400" />
            Master Data & Sync
          </h2>
          <p className="text-slate-400 text-xs mt-1 font-mono">
            Format: Kode barang | Nama Barang | Nama Satuan | Nama Gudang | No Seri/Produksi | Tgl Kadaluarsa | Kuantitas
          </p>
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        <button onClick={() => { setActiveTab('sheets'); setPreviewItems([]); }} className={`flex-1 py-4 text-sm font-medium flex justify-center gap-2 ${activeTab === 'sheets' ? 'text-green-600 border-b-2 border-green-600 bg-green-50/50' : 'text-gray-500'}`}>
          <Sheet size={18} /> Google Sheets Link
        </button>
        <button onClick={() => { setActiveTab('excel'); setPreviewItems([]); }} className={`flex-1 py-4 text-sm font-medium flex justify-center gap-2 ${activeTab === 'excel' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500'}`}>
          <FileSpreadsheet size={18} /> Excel Import
        </button>
      </div>

      <div className="p-6">
        {previewItems.length > 0 ? (
            <div className="animate-fade-in space-y-4">
                
                {/* Sync Confirmation Panel */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex flex-col gap-4">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-blue-100 rounded-lg text-blue-700">
                            <Database size={24} />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-blue-900 text-lg">Konfirmasi Sinkronisasi Data</h3>
                            <p className="text-sm text-blue-700 mt-1">{previewItems.length} data barang siap di-upload ke Cloud Database.</p>
                            
                            <div className="mt-4 flex flex-col sm:flex-row gap-4">
                                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${!replaceMode ? 'bg-white border-blue-400 ring-1 ring-blue-400' : 'bg-slate-50 border-slate-200 opacity-70'}`}>
                                    <input 
                                        type="radio" 
                                        name="syncMode" 
                                        checked={!replaceMode} 
                                        onChange={() => setReplaceMode(false)}
                                        className="text-blue-600 focus:ring-blue-500"
                                    />
                                    <div>
                                        <span className="block text-sm font-bold text-slate-800">Mode: Update / Tambah</span>
                                        <span className="block text-xs text-slate-500">Data lama tetap ada, data baru ditambahkan (Merge).</span>
                                    </div>
                                </label>
                                
                                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${replaceMode ? 'bg-white border-red-400 ring-1 ring-red-400' : 'bg-slate-50 border-slate-200 opacity-70'}`}>
                                    <input 
                                        type="radio" 
                                        name="syncMode" 
                                        checked={replaceMode} 
                                        onChange={() => setReplaceMode(true)}
                                        className="text-red-600 focus:ring-red-500"
                                    />
                                    <div>
                                        <span className="block text-sm font-bold text-red-800">Mode: Ganti Semua Data</span>
                                        <span className="block text-xs text-red-600">HAPUS semua data lama, lalu upload data baru ini.</span>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-2 border-t border-blue-200 pt-4">
                        <button onClick={() => setPreviewItems([])} className="px-6 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg">Batal</button>
                        <button onClick={confirmImport} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
                            Mulai Sinkronisasi <ArrowRight size={16} />
                        </button>
                    </div>
                </div>

            </div>
        ) : (
            <>
                {activeTab === 'sheets' && (
                    <div className="space-y-6">
                        <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                            <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2"><LinkIcon size={20} /> Import via Link</h3>
                            <div className="flex gap-2">
                                <input type="url" className="flex-1 p-3 border rounded-lg text-sm" placeholder="https://docs.google.com/spreadsheets/d/..." value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} />
                                <button onClick={fetchGoogleSheet} disabled={!sheetUrl || isFetchingSheet} className="bg-green-600 text-white px-6 rounded-lg font-bold flex items-center gap-2 hover:bg-green-700 disabled:opacity-50">
                                    {isFetchingSheet ? <RefreshCw className="animate-spin" /> : <ArrowRight />} Fetch
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">Pastikan Google Sheet di-set ke <b>"Anyone with the link"</b>.</p>
                        </div>
                        <div className="bg-green-50 rounded-xl p-6 border border-green-100 flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-bold text-green-800">Download Template</h3>
                                <p className="text-xs text-green-700">Unduh template Excel dengan format header yang benar.</p>
                            </div>
                            <button onClick={handleExportExcel} className="bg-green-600 text-white px-5 py-3 rounded-lg font-medium flex items-center gap-2 hover:bg-green-700"><Download size={18} /> Download .xlsx</button>
                        </div>
                    </div>
                )}
                {activeTab === 'excel' && (
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="border border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center hover:bg-gray-50 text-center">
                            <Download size={32} className="text-blue-600 mb-4" />
                            <h3 className="font-bold mb-2">Download Template</h3>
                            <p className="text-xs text-slate-500 mb-4">Gunakan template ini agar format sesuai.</p>
                            <button onClick={handleExportExcel} className="text-blue-600 font-bold hover:underline">Download .xlsx</button>
                        </div>
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center relative hover:bg-gray-50 text-center group cursor-pointer">
                            <Upload size={32} className="text-green-600 mb-4 group-hover:scale-110 transition-transform" />
                            <h3 className="font-bold mb-2">Upload Excel</h3>
                            <p className="text-xs text-slate-500">Klik untuk memilih file .xlsx</p>
                            <input 
                                type="file" 
                                accept=".xlsx, .xls" 
                                ref={fileInputRef}
                                onChange={handleImportExcel} 
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" 
                            />
                        </div>
                    </div>
                )}
            </>
        )}
      </div>

      {/* Data Table with Pagination */}
      <div className="border-t border-gray-200">
          <div className="px-6 py-4 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
              <h3 className="text-sm font-bold text-gray-600 uppercase">
                  {previewItems.length > 0 ? `Preview Import Data (${previewItems.length} items)` : `Database Saat Ini (${items.length} items)`}
              </h3>
              
              {/* Pagination Controls */}
              {totalItems > itemsPerPage && (
                  <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1">
                      <button 
                        onClick={prevPage} disabled={currentPage === 1}
                        className="p-1.5 hover:bg-slate-100 rounded disabled:opacity-30"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-xs font-mono px-2 text-slate-500">
                        {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, totalItems)} / {totalItems}
                      </span>
                      <button 
                        onClick={nextPage} disabled={currentPage === totalPages}
                        className="p-1.5 hover:bg-slate-100 rounded disabled:opacity-30"
                      >
                        <ChevronRight size={16} />
                      </button>
                  </div>
              )}
          </div>
          
          <div className="overflow-x-auto min-h-[300px] max-h-[500px]">
              <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                      <tr>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Kode barang</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Nama Barang</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Satuan</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Gudang</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">No Seri</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tgl Kadaluarsa</th>
                          <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Kuantitas</th>
                      </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                      {currentItems.length === 0 ? (
                          <tr><td colSpan={7} className="text-center py-12 text-gray-400">Belum ada data.</td></tr>
                      ) : currentItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-xs font-mono font-medium">{item.sku}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600">{item.name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">{item.unit}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">{item.category}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500">{item.batchNumber}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500">{item.expiryDate}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-900">{item.systemStock}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>
    </div>
  );
};

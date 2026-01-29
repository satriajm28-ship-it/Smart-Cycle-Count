
import React, { useState, useEffect } from 'react';
import { MasterItem } from '../types';
import { getMasterData, saveMasterData } from '../services/storageService';
import { Download, Upload, FileSpreadsheet, Link as LinkIcon, Check, Sheet, ArrowRight, RefreshCw, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';

export const MasterData: React.FC = () => {
  const [items, setItems] = useState<MasterItem[]>([]);
  const [activeTab, setActiveTab] = useState<'excel' | 'sheets'>('sheets');
  
  const [sheetUrl, setSheetUrl] = useState('');
  
  const [previewItems, setPreviewItems] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);

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
      
      // 1. Kode barang
      if (['kodebarang', 'kode', 'sku', 'itemcode', 'partnumber'].includes(h)) return 'sku';
      
      // 2. Nama Barang
      if (['namabarang', 'nama', 'name', 'description'].includes(h)) return 'name';
      
      // 3. Nama Satuan Barang & Jasa
      if (['namasatuanbarangjasa', 'namasatuan', 'satuan', 'unit', 'uom'].includes(h)) return 'unit';
      
      // 4. Nama Gudang ( Warehouse) -> Mapped to 'category' or 'location' context in MasterItem
      // We reuse 'category' field in MasterItem types to store the Default Warehouse Name
      if (['namagudang', 'warehouse', 'gudang', 'lokasi', 'namagudangwarehouse'].includes(h)) return 'category';
      
      // 5. No Seri/Produksi
      if (['noseriproduksi', 'noseri', 'noproduksi', 'serial', 'batch', 'batchnumber', 'lot'].includes(h)) return 'batchNumber';
      
      // 6. Tgl Kadaluarsa
      if (['tglkadaluarsa', 'tgl', 'kadaluarsa', 'expired', 'expirydate', 'ed'].includes(h)) return 'expiryDate';
      
      // 7. Kuantitas (Total Sistem)
      if (['kuantitas', 'qty', 'quantity', 'stok', 'stock', 'systemstock', 'jumlah'].includes(h)) return 'systemStock';

      return null;
  };

  const formatDate = (raw: any): string => {
      if (!raw) return '';
      // Try to handle Excel serial date
      if (typeof raw === 'number' && raw > 20000) {
          const date = new Date(Math.round((raw - 25569) * 86400 * 1000));
          return date.toISOString().split('T')[0];
      }
      const str = String(raw).trim();
      // YYYY-MM-DD
      if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str;
      // DD/MM/YYYY or DD-MM-YYYY -> YYYY-MM-DD
      if (str.match(/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/)) {
          const parts = str.split(/[/-]/);
          // Assuming DD-MM-YYYY
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      return str;
  };

  // --- EXCEL HANDLERS ---
  const handleExportExcel = () => {
    // Export format strictly as requested
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
        alert('Error parsing Excel file.');
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
  };

  const confirmImport = async () => {
      if (previewItems.length === 0) return;
      setLoading(true);
      await saveMasterData(previewItems);
      const refreshedData = await getMasterData();
      setItems(refreshedData);
      setLoading(false);
      setSheetUrl('');
      setPreviewItems([]);
      alert(`Berhasil sinkronisasi ${previewItems.length} barang!`);
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><span className="material-symbols-outlined animate-spin text-3xl text-slate-400">sync</span></div>;

  return (
    <div className="bg-white rounded-xl shadow-lg max-w-6xl mx-auto animate-fade-in overflow-hidden">
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
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Check className="text-blue-600" />
                        <div>
                            <h3 className="font-bold text-blue-900">{previewItems.length} Data Siap Diimpor</h3>
                            <p className="text-xs text-blue-700">Silakan periksa tabel di bawah sebelum konfirmasi.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setPreviewItems([])} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg">Batal</button>
                        <button onClick={confirmImport} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2">
                            Konfirmasi Sync <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[400px]">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-slate-600 whitespace-nowrap">Kode barang</th>
                                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-slate-600 whitespace-nowrap">Nama Barang</th>
                                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-slate-600 whitespace-nowrap">Nama Satuan</th>
                                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-slate-600 whitespace-nowrap">Nama Gudang</th>
                                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-slate-600 whitespace-nowrap">No Seri/Produksi</th>
                                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-slate-600 whitespace-nowrap">Tgl Kadaluarsa</th>
                                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-slate-600 whitespace-nowrap">Kuantitas</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {previewItems.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50">
                                    <td className="px-4 py-2 text-xs font-mono font-medium">{item.sku}</td>
                                    <td className="px-4 py-2 text-xs">{item.name}</td>
                                    <td className="px-4 py-2 text-xs">{item.unit}</td>
                                    <td className="px-4 py-2 text-xs">{item.category}</td>
                                    <td className="px-4 py-2 text-xs font-mono">{item.batchNumber}</td>
                                    <td className="px-4 py-2 text-xs font-mono">{item.expiryDate}</td>
                                    <td className="px-4 py-2 text-xs font-bold text-center">{item.systemStock}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center relative hover:bg-gray-50 text-center">
                            <Upload size={32} className="text-green-600 mb-4" />
                            <h3 className="font-bold mb-2">Upload Excel</h3>
                            <p className="text-xs text-slate-500">Drag & drop atau klik untuk upload</p>
                            <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} className="absolute inset-0 opacity-0 cursor-pointer" />
                        </div>
                    </div>
                )}
            </>
        )}
      </div>

      {/* Existing Data Table (Read Only View) */}
      {previewItems.length === 0 && (
          <div className="border-t border-gray-200">
              <div className="px-6 py-4 bg-gray-50 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-gray-600 uppercase">Database Saat Ini ({items.length} items)</h3>
              </div>
              <div className="overflow-x-auto max-h-[500px]">
                  <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100 sticky top-0">
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
                          {items.length === 0 ? (
                              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Belum ada data master.</td></tr>
                          ) : items.slice(0, 100).map((item) => (
                              <tr key={item.sku} className="hover:bg-gray-50">
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
      )}
    </div>
  );
};

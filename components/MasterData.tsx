
import React, { useState, useEffect } from 'react';
import { MasterItem } from '../types';
import { getMasterData, saveMasterData } from '../services/storageService';
import { Download, Upload, FileSpreadsheet, Copy, Clipboard, Check, Sheet } from 'lucide-react';
import * as XLSX from 'xlsx';

export const MasterData: React.FC = () => {
  const [items, setItems] = useState<MasterItem[]>([]);
  const [activeTab, setActiveTab] = useState<'excel' | 'sheets'>('sheets');
  const [pasteContent, setPasteContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
        setLoading(true);
        const data = await getMasterData();
        setItems(data);
        setLoading(false);
    };
    fetch();
  }, []);

  // --- EXCEL HANDLERS ---
  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(items);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MasterData");
    XLSX.writeFile(wb, `master_data_${new Date().toISOString().split('T')[0]}.xlsx`);
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
        processImportedData(jsonData, 'Excel');
      } catch (err) {
        alert('Error parsing Excel file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // --- GOOGLE SHEETS (CLIPBOARD) HANDLERS ---
  const handleCopyToClipboard = () => {
    const headers = ['sku', 'name', 'systemStock', 'batchNumber', 'expiryDate', 'category', 'unit'];
    const tsvContent = [
      headers.join('\t'),
      ...items.map(item => [
        item.sku,
        item.name,
        item.systemStock,
        item.batchNumber,
        item.expiryDate,
        item.category,
        item.unit
      ].join('\t'))
    ].join('\n');

    navigator.clipboard.writeText(tsvContent).then(() => {
      alert("Data Copied! Open Google Sheets and Paste (Ctrl+V) into cell A1.");
    });
  };

  const handlePasteProcessing = () => {
    if (!pasteContent.trim()) return;

    const rows = pasteContent.split('\n').map(row => row.split('\t'));
    if (rows.length < 2) {
        alert("Invalid data format. Please copy the headers and data rows from Google Sheets.");
        return;
    }

    const headers = rows[0].map(h => h.trim().toLowerCase());
    const dataRows = rows.slice(1);

    const jsonData = dataRows.map(row => {
        const obj: any = {};
        headers.forEach((header, index) => {
            if (row[index] !== undefined) obj[header] = row[index];
        });
        return obj;
    });

    processImportedData(jsonData, 'Google Sheets Paste');
    setPasteContent('');
  };

  // --- COMMON IMPORT LOGIC ---
  const processImportedData = async (jsonData: any[], source: string) => {
    const newItems: MasterItem[] = jsonData.map((row) => ({
        sku: row.sku || row.SKU ? String(row.sku || row.SKU).trim() : '',
        name: row.name || row.Name || '',
        systemStock: Number(row.systemStock || row.SystemStock || 0),
        batchNumber: row.batchNumber || row.BatchNumber ? String(row.batchNumber || row.BatchNumber).trim() : '',
        expiryDate: row.expiryDate || row.ExpiryDate ? String(row.expiryDate || row.ExpiryDate).trim() : '',
        category: row.category || row.Category || 'General',
        unit: row.unit || row.Unit || 'Pcs'
    })).filter(item => item.sku !== '');

    if (newItems.length === 0) {
        alert("No valid data found. Check your headers (sku, name, systemStock, etc).");
        return;
    }

    setLoading(true);
    await saveMasterData(newItems);
    // Refresh
    const refreshedData = await getMasterData();
    setItems(refreshedData);
    setLoading(false);
    
    alert(`Successfully synced ${newItems.length} items from ${source}.`);
  };

  if (loading) {
      return (
          <div className="flex items-center justify-center h-64">
              <span className="material-symbols-outlined animate-spin text-3xl text-slate-400">sync</span>
          </div>
      );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg max-w-5xl mx-auto animate-fade-in overflow-hidden">
      <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="text-green-400" />
            Master Data & Sync
          </h2>
          <p className="text-slate-400 text-sm mt-1">Manage inventory items via Excel or Google Sheets</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('sheets')}
          className={`flex-1 py-4 text-sm font-medium text-center transition-colors flex items-center justify-center gap-2 ${activeTab === 'sheets' ? 'text-green-600 border-b-2 border-green-600 bg-green-50/50' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Sheet size={18} />
          Google Sheets Sync
        </button>
        <button 
          onClick={() => setActiveTab('excel')}
          className={`flex-1 py-4 text-sm font-medium text-center transition-colors flex items-center justify-center gap-2 ${activeTab === 'excel' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <FileSpreadsheet size={18} />
          Excel File Import/Export
        </button>
      </div>

      <div className="p-6">
        {activeTab === 'sheets' && (
            <div className="space-y-8">
                {/* Export Section */}
                <div className="bg-green-50 rounded-xl p-6 border border-green-100">
                    <h3 className="text-lg font-bold text-green-800 mb-2 flex items-center gap-2">
                        <Upload className="rotate-180" size={20} />
                        Export to Google Sheets
                    </h3>
                    <p className="text-sm text-green-700 mb-4">
                        Click the button below to copy all data. Then open your Google Sheet and paste (Ctrl+V).
                    </p>
                    <button 
                        onClick={handleCopyToClipboard}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-lg font-medium transition shadow-md active:scale-95"
                    >
                        <Copy size={18} />
                        Copy All Data to Clipboard
                    </button>
                </div>

                {/* Import Section */}
                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                        <Clipboard size={20} />
                        Import from Google Sheets
                    </h3>
                    <p className="text-sm text-slate-600 mb-4">
                        1. Select your headers and data in Google Sheets.<br/>
                        2. Copy (Ctrl+C).<br/>
                        3. Paste into the box below.
                    </p>
                    <textarea 
                        className="w-full h-32 p-3 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-green-500 focus:border-green-500 mb-3"
                        placeholder={`sku\tname\tsystemStock\tbatchNumber...\nBRG-01\tItem A\t100\tBATCH-01...`}
                        value={pasteContent}
                        onChange={(e) => setPasteContent(e.target.value)}
                    />
                    <button 
                        onClick={handlePasteProcessing}
                        disabled={!pasteContent}
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-3 rounded-lg font-medium transition shadow-md active:scale-95 disabled:opacity-50"
                    >
                        <Check size={18} />
                        Process & Save Data
                    </button>
                </div>
            </div>
        )}

        {activeTab === 'excel' && (
            <div className="grid md:grid-cols-2 gap-6">
                <div className="border border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                        <Download size={24} />
                    </div>
                    <h3 className="font-bold text-gray-800 mb-2">Download Excel</h3>
                    <p className="text-sm text-gray-500 mb-4">Get the full master data in .xlsx format</p>
                    <button 
                        onClick={handleExportExcel}
                        className="text-blue-600 font-medium hover:underline"
                    >
                        Download File
                    </button>
                </div>

                <div className="border border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:bg-gray-50 transition relative">
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                        <Upload size={24} />
                    </div>
                    <h3 className="font-bold text-gray-800 mb-2">Upload Excel</h3>
                    <p className="text-sm text-gray-500 mb-4">Drag & drop or click to upload .xlsx</p>
                    <input 
                        type="file" 
                        accept=".xlsx, .xls"
                        onChange={handleImportExcel}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                </div>
            </div>
        )}
      </div>
      
      {/* Table Preview */}
      <div className="border-t border-gray-200">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Current System Data ({items.length} items)</h3>
        </div>
        <div className="overflow-x-auto max-h-[400px]">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
                <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">System Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expired Date</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {items.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="text-center py-4 text-gray-400 italic">No data available.</td>
                    </tr>
                ) : items.slice(0, 50).map((item) => (
                <tr key={item.sku} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.sku}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">{item.systemStock}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{item.batchNumber}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{item.expiryDate}</td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

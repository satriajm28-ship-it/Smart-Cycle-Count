import React, { useState } from 'react';
import { Server, Key, Copy, CheckCircle2, ArrowRightLeft, Database, Activity } from 'lucide-react';

export const WMSIntegration: React.FC = () => {
  const [copied, setCopied] = useState<string | null>(null);
  
  // The default API key defined in server.ts
  const apiKey = "default_wms_key_123";
  // The current origin for the API endpoints
  const baseUrl = window.location.origin;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const endpoints = [
    {
      method: "POST",
      path: "/api/wms/items/sync",
      description: "Sinkronisasi Master Data Barang dari WMS ke Aplikasi (Bulk Upsert).",
      body: `{
  "items": [
    {
      "sku": "ITM-001",
      "name": "Paracetamol 500mg",
      "systemStock": 150,
      "batchNumber": "B-2023-10",
      "expiryDate": "2025-10-01",
      "category": "Obat Bebas",
      "unit": "Box"
    }
  ]
}`
    },
    {
      method: "POST",
      path: "/api/wms/movement",
      description: "Update stok barang secara real-time saat ada barang masuk/keluar di WMS.",
      body: `{
  "sku": "ITM-001",
  "newStockLevel": 145
}`
    },
    {
      method: "GET",
      path: "/api/wms/audit-results",
      description: "Tarik hasil Stock Opname (Audit Logs) dari Aplikasi ke WMS.",
      body: null
    },
    {
      method: "GET",
      path: "/api/wms/items",
      description: "Tarik seluruh Master Data saat ini dari Aplikasi.",
      body: null
    }
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg max-w-6xl mx-auto animate-fade-in overflow-hidden">
      <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Server className="text-purple-400" />
            WMS API Integration
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Dokumentasi REST API untuk menghubungkan aplikasi ini dengan Sistem Manajemen Gudang (WMS) Anda.
          </p>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* API Key Section */}
        <div className="bg-purple-50 border border-purple-100 rounded-xl p-6">
          <h3 className="text-lg font-bold text-purple-900 flex items-center gap-2 mb-4">
            <Key size={20} /> Autentikasi API
          </h3>
          <p className="text-sm text-purple-700 mb-4">
            Setiap request ke API harus menyertakan header <code className="bg-purple-200 px-1 rounded">x-api-key</code>.
          </p>
          <div className="flex items-center gap-4 bg-white p-3 rounded-lg border border-purple-200">
            <div className="flex-1 font-mono text-sm text-slate-800">
              {apiKey}
            </div>
            <button 
              onClick={() => handleCopy(apiKey, 'apikey')}
              className="flex items-center gap-1 text-xs font-bold text-purple-600 hover:text-purple-800 transition-colors"
            >
              {copied === 'apikey' ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} />}
              {copied === 'apikey' ? 'Copied' : 'Copy Key'}
            </button>
          </div>
        </div>

        {/* Base URL */}
        <div>
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Base URL</h3>
          <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex-1 font-mono text-sm text-slate-800">
              {baseUrl}
            </div>
            <button 
              onClick={() => handleCopy(baseUrl, 'baseurl')}
              className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors"
            >
              {copied === 'baseurl' ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} />}
              {copied === 'baseurl' ? 'Copied' : 'Copy URL'}
            </button>
          </div>
        </div>

        {/* Endpoints */}
        <div>
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Endpoints</h3>
          <div className="space-y-6">
            {endpoints.map((ep, idx) => (
              <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${ep.method === 'GET' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                    {ep.method}
                  </span>
                  <span className="font-mono text-sm font-bold text-slate-800">{ep.path}</span>
                </div>
                <div className="p-4">
                  <p className="text-sm text-slate-600 mb-4">{ep.description}</p>
                  
                  {ep.body && (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">Request Body (JSON)</span>
                        <button 
                          onClick={() => handleCopy(ep.body!, `body-${idx}`)}
                          className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                        >
                          {copied === `body-${idx}` ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                          Copy JSON
                        </button>
                      </div>
                      <pre className="bg-slate-900 text-emerald-400 p-4 rounded-lg text-xs font-mono overflow-x-auto">
                        {ep.body}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Architecture Diagram */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Activity size={20} className="text-blue-500" /> Alur Sinkronisasi
          </h3>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-center">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm w-full md:w-1/3">
              <Database size={32} className="mx-auto text-slate-400 mb-2" />
              <h4 className="font-bold text-slate-800">Sistem WMS</h4>
              <p className="text-xs text-slate-500 mt-1">Sistem Utama Gudang</p>
            </div>
            
            <div className="flex flex-col items-center text-blue-500 font-bold text-xs gap-2">
              <div className="flex items-center gap-2">
                <span>Push Master Data</span>
                <ArrowRightLeft size={24} />
                <span>Pull Hasil Audit</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm w-full md:w-1/3 ring-2 ring-blue-500/20">
              <Server size={32} className="mx-auto text-blue-500 mb-2" />
              <h4 className="font-bold text-blue-900">Aplikasi Opname</h4>
              <p className="text-xs text-blue-600 mt-1">Aplikasi Scanner & Audit</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

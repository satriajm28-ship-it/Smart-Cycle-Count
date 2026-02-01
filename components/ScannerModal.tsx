
import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  title?: string;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({ isOpen, onClose, onScanSuccess, title = "Scan QR / Barcode" }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerId = "reader-stream";

  useEffect(() => {
    if (isOpen) {
      setError(null);
      // Initialize scanner
      const scanner = new Html5Qrcode(scannerId);
      scannerRef.current = scanner;

      const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0 
      };

      // Start scanning automatically
      scanner.start(
        { facingMode: "environment" }, // Prefer back camera
        config,
        (decodedText) => {
          // Success callback
          onScanSuccess(decodedText);
          handleClose();
        },
        (errorMessage) => {
          // Ignore frame parse errors (very common while scanning)
        }
      ).catch((err) => {
        console.error("Error starting scanner", err);
        setError("Gagal akses kamera. Pastikan izin diberikan.");
      });

      return () => {
        handleClose();
      };
    }
  }, [isOpen]);

  const handleClose = async () => {
    if (scannerRef.current) {
        try {
            if (scannerRef.current.isScanning) {
                await scannerRef.current.stop();
            }
            scannerRef.current.clear();
        } catch (e) {
            console.warn("Scanner stop error", e);
        }
        scannerRef.current = null;
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative flex flex-col">
        
        {/* Header Compact */}
        <div className="absolute top-0 left-0 right-0 p-4 z-10 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
          <h3 className="text-white font-bold text-sm flex items-center gap-2 drop-shadow-md">
            <span className="material-symbols-outlined text-lg">qr_code_scanner</span>
            {title}
          </h3>
          <button 
            onClick={() => handleClose()} 
            className="bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 backdrop-blur-md transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Camera Area */}
        <div className="relative aspect-square bg-black">
            <div id={scannerId} className="w-full h-full overflow-hidden rounded-b-3xl"></div>
            
            {/* Overlay Guide (Visual only) */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-64 h-64 border-2 border-primary/70 rounded-2xl relative">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-xl -mt-1 -ml-1"></div>
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-xl -mt-1 -mr-1"></div>
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-xl -mb-1 -ml-1"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-xl -mb-1 -mr-1"></div>
                    
                    {/* Scanning Animation Line */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-[scan_2s_infinite]"></div>
                </div>
            </div>

            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 text-white p-6 text-center">
                    <div>
                        <span className="material-symbols-outlined text-4xl text-red-500 mb-2">videocam_off</span>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            )}
        </div>

        {/* Footer Instructions */}
        <div className="p-4 bg-white dark:bg-slate-900 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
                Arahkan kamera ke barcode atau QR Code.<br/>Scan akan berjalan otomatis.
            </p>
        </div>
      </div>

      <style>{`
        @keyframes scan {
            0% { top: 10%; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 90%; opacity: 0; }
        }
        #reader-stream video {
            object-fit: cover;
            width: 100% !important;
            height: 100% !important;
            border-radius: 0 0 1.5rem 1.5rem;
        }
      `}</style>
    </div>
  );
};

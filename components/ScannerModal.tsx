
import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  title?: string;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({ isOpen, onClose, onScanSuccess, title = "Scan Barcode / QR" }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannerId = "qr-reader";

  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure DOM is ready and browser focus is handled
      const timeout = setTimeout(() => {
        const scanner = new Html5QrcodeScanner(
          scannerId,
          { 
            fps: 15, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
            rememberLastUsedCamera: true,
            supportedScanTypes: [0] // Camera only
          },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText) => {
            onScanSuccess(decodedText);
            scanner.clear().catch(e => console.warn(e));
            onClose();
          },
          (errorMessage) => {
            // Successively ignored during active scanning
          }
        );
        
        scannerRef.current = scanner;
      }, 250);

      return () => {
        clearTimeout(timeout);
        if (scannerRef.current) {
          scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
        }
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-primary text-white">
          <h3 className="font-bold flex items-center gap-2">
            <span className="material-symbols-outlined">barcode_scanner</span>
            {title}
          </h3>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="p-4 bg-slate-50 dark:bg-slate-950">
          <div id={scannerId} className="overflow-hidden rounded-xl border-2 border-primary/20"></div>
          <p className="text-[10px] text-slate-500 text-center mt-4">
            Pastikan memberikan izin kamera saat diminta browser.<br/>Posisikan barcode di tengah kotak.
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 flex justify-center">
            <button 
                onClick={onClose}
                className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200"
            >
                Batal
            </button>
        </div>
      </div>
    </div>
  );
};

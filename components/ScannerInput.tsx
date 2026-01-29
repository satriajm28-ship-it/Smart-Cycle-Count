import React, { useState } from 'react';
import { Camera, ScanBarcode } from 'lucide-react';

interface ScannerInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  onScan?: (val: string) => void;
  placeholder?: string;
  type?: 'text' | 'number';
  id?: string;
  icon?: 'barcode' | 'qr';
}

export const ScannerInput: React.FC<ScannerInputProps> = ({ 
  label, 
  value, 
  onChange, 
  onScan, 
  placeholder, 
  type = 'text',
  id,
  icon = 'barcode' 
}) => {
  const [isSimulatingScan, setIsSimulatingScan] = useState(false);

  // In a real PWA, this would invoke the camera. 
  // For this web demo, we simulate a scan or allow typing (USB scanner acts as keyboard).
  const handleScanClick = () => {
    setIsSimulatingScan(true);
    // Simulate a delay for "scanning"
    setTimeout(() => {
      setIsSimulatingScan(false);
      if (onScan) {
        // Mock values for demo if user clicks the button instead of typing
        // In a real app, this opens a Modal with <QrReader />
        const mockValue = icon === 'barcode' ? '89999090901' : 'LOC-A-01'; 
        onScan(mockValue); 
      }
    }, 800);
  };

  return (
    <div className="mb-4">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative rounded-md shadow-sm">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          {icon === 'barcode' ? <ScanBarcode className="h-5 w-5 text-gray-400" /> : <Camera className="h-5 w-5 text-gray-400" />}
        </div>
        <input
          type={type}
          name={id}
          id={id}
          className="block w-full pl-10 pr-12 py-3 border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 sm:text-sm border"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="absolute inset-y-0 right-0 flex items-center">
          <button
            type="button"
            onClick={handleScanClick}
            disabled={isSimulatingScan}
            className="h-full px-3 py-0 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-r-lg border-l border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {isSimulatingScan ? (
              <span className="animate-pulse">Scanning...</span>
            ) : (
              <span className="text-xs font-medium">Scan</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
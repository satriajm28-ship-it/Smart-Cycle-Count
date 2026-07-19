import { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebaseClient';

let globalToken: string | null = null;
const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

export function useGoogleAuth() {
  const [token, setToken] = useState<string | null>(globalToken);
  const [isLoaded, setIsLoaded] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Note: we can't get the OAuth token directly from the user object on subsequent loads
      // If we don't have it in memory, we need them to re-authenticate or use a silent refresh mechanism
      // For simplicity, if globalToken is null, we force login.
      if (!user) {
        setToken(null);
        globalToken = null;
      }
    });
    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      scopes.forEach(scope => provider.addScope(scope));
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential && credential.accessToken) {
        globalToken = credential.accessToken;
        setToken(credential.accessToken);
      } else {
        console.error("No access token in credential");
      }
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const logout = async () => {
    await signOut(auth);
    globalToken = null;
    setToken(null);
  };

  return { token, login, logout, isLoaded };
}

// Function to initialize or get the spreadsheet ID
export const getOrInitializeSpreadsheet = async (accessToken: string): Promise<string> => {
  let spreadsheetId = localStorage.getItem('audit_spreadsheet_id');
  
  if (spreadsheetId) {
    return spreadsheetId;
  }

  // Create a new spreadsheet
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: `Audit Fisik - ${new Date().toISOString().split('T')[0]}`
      },
      sheets: [
        {
          properties: {
            title: 'Audit Logs'
          }
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error('Failed to create spreadsheet');
  }

  const data = await response.json();
  spreadsheetId = data.spreadsheetId;
  localStorage.setItem('audit_spreadsheet_id', spreadsheetId!);

  // Add headers
  await appendRowToSheet(accessToken, spreadsheetId!, 'Audit Logs!A1:N1', [[
    'Timestamp',
    'Kode Barang (SKU)',
    'Nama Barang',
    'Lokasi',
    'QTY System',
    'QTY Fisik',
    'Variance',
    'Batch',
    'Expired',
    'Team / Petugas',
    'Catatan',
    'Foto Bukti (Link)',
    'Log ID'
  ]]);

  return spreadsheetId!;
};

export const appendRowToSheet = async (accessToken: string, spreadsheetId: string, range: string, values: any[][]) => {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: values
    })
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      // Token expired or invalid
      globalToken = null;
      throw new Error('Google authentication expired. Please login to Google again.');
    }
    throw new Error('Failed to append to spreadsheet');
  }
  
  return response.json();
};

export const appendAuditLogToSheets = async (auditRecord: any) => {
  const token = globalToken;
  if (!token) {
    throw new Error('Google authentication required to save to Sheets');
  }

  const spreadsheetId = await getOrInitializeSpreadsheet(token);
  
  const hasPhoto = auditRecord.evidencePhotos && auditRecord.evidencePhotos.length > 0;
  const photoLink = hasPhoto ? `${window.location.origin}/?open_photo=${auditRecord.id}` : '-';

  const rowData = [
    new Date(auditRecord.timestamp).toLocaleString('id-ID'),
    auditRecord.sku,
    auditRecord.itemName,
    auditRecord.location,
    auditRecord.systemQty,
    auditRecord.physicalQty,
    auditRecord.variance,
    auditRecord.batchNumber,
    auditRecord.expiryDate,
    auditRecord.teamMember,
    auditRecord.notes || '-',
    photoLink,
    auditRecord.id
  ];

  await appendRowToSheet(token, spreadsheetId, 'Audit Logs!A:N', [rowData]);
};

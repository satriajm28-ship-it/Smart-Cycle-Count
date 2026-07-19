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
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/unauthorized-domain') {
        alert("Domain ini belum diizinkan di Firebase. Jika Anda deploy ke Vercel/host lain, silakan masuk ke Firebase Console -> Authentication -> Settings -> Authorized domains, lalu tambahkan domain ini (" + window.location.hostname + ").");
      } else {
        alert("Login Google gagal: " + error.message);
      }
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
  // Use the spreadsheet provided by the user
  const spreadsheetId = '1OH-PS33N0WLgE4AMF6PpO2pL9kXfyNuQlDuQol-KwgA';
  return spreadsheetId;
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
  
  // Get spreadsheet info to get the first sheet's title
  const spreadsheetInfoRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  let sheetTitle = 'Sheet1';
  if (spreadsheetInfoRes.ok) {
    const info = await spreadsheetInfoRes.json();
    if (info.sheets && info.sheets.length > 0) {
      sheetTitle = info.sheets[0].properties.title;
    }
  }
  
  const hasPhoto = auditRecord.evidencePhotos && auditRecord.evidencePhotos.length > 0;
  const photoLink = hasPhoto ? `${window.location.origin}/?open_photo=${auditRecord.id}` : '-';

  const rowData = [
    auditRecord.sku,
    auditRecord.itemName,
    auditRecord.systemQty,
    auditRecord.physicalQty,
    auditRecord.variance,
    auditRecord.unit || '-',
    auditRecord.location,
    auditRecord.batchNumber,
    auditRecord.expiryDate,
    auditRecord.teamMember,
    auditRecord.notes || '-',
    auditRecord.evidencePhotos ? auditRecord.evidencePhotos.length : 0,
    photoLink,
    new Date(auditRecord.timestamp).toLocaleString('id-ID')
  ];

  await appendRowToSheet(token, spreadsheetId, `${sheetTitle}!A:N`, [rowData]);
};

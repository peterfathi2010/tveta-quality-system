
/* eslint-disable @typescript-eslint/no-explicit-any */
// This service integrates with the real Google Drive API.
// It requires a valid Client ID and API Key from Google Cloud Console.

interface GoogleApi {
    client: {
        setToken: (token: any) => void;
        getToken: () => any;
        init: (config: any) => Promise<void>;
        drive: {
            files: {
                list: (params: any) => Promise<any>;
                create: (params: any) => Promise<any>;
                delete: (params: any) => Promise<any>;
                update: (params: any) => Promise<any>;
            };
            permissions: {
                create: (params: any) => Promise<any>;
            };
        }
    };
    load: (api: string, callback: () => void) => void;
}

interface GoogleAccounts {
    oauth2: {
        initTokenClient: (config: any) => any;
        hasGrantedAllScopes: (token: any, scope: string) => boolean;
    }
}

declare global {
  interface Window {
    gapi: GoogleApi;
    google: { accounts: GoogleAccounts };
  }
}

// Access environment variables safely
const getEnv = (key: string) => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
    return (import.meta as any).env[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return '';
};

// DIRECTLY USE THE PROVIDED CLIENT ID TO ENSURE CONNECTION WORKS
const HARDCODED_CLIENT_ID = '62525142794-dbo4p5r1e3922su3deeq0oh06mdbqnpq.apps.googleusercontent.com';

// Fallback logic: Try env var, if empty/missing, use hardcoded ID.
const envID = getEnv('VITE_GOOGLE_CLIENT_ID');
const CLIENT_ID = (envID && envID.trim().length > 5) ? envID.trim() : HARDCODED_CLIENT_ID;

const API_KEY = (getEnv('VITE_GOOGLE_API_KEY') || '').trim();
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const CENTRAL_FOLDER_NAME = "TVETA_QUALITY_MANAGEMENT";

let tokenClient: any;
let initPromise: Promise<void> | null = null;
let accessToken: string | null = null;

// Load GAPI scripts dynamically with Promise support
export const loadGoogleScripts = (): Promise<void> => {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();

    let gapiLoaded = false;
    let gisLoaded = false;

    const checkDone = () => {
      if (gapiLoaded && gisLoaded) {
          console.log("Google Scripts Loaded Successfully.");
          resolve();
      }
    };

    const initGapi = () => {
        window.gapi.load('client', async () => {
            try {
                await window.gapi.client.init({
                    apiKey: API_KEY || undefined,
                    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
                });
                gapiLoaded = true;
                checkDone();
            } catch (e) {
                console.error("GAPI Init Error:", e);
                // Proceed even if GAPI Init fails (authentication might still work)
                gapiLoaded = true; 
                checkDone();
            }
        });
    };

    const initGis = () => {
        // Double check Client ID presence
        if (!CLIENT_ID || CLIENT_ID.length < 10) {
            console.error("GIS Init Failed: Invalid Client ID.");
            reject(new Error("Google Client ID is missing or invalid."));
            return;
        }

        try {
            tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: () => {}, // defined at request time
            });
            gisLoaded = true;
            checkDone();
        } catch (e: unknown) {
            console.error("GIS Init Error:", e);
            const error = e as { message?: string };
            reject(new Error(`Failed to init Google Identity Services: ${error.message || String(e)}`));
        }
    };

    if (window.gapi) initGapi();
    else {
        const script1 = document.createElement('script');
        script1.src = 'https://apis.google.com/js/api.js';
        script1.async = true;
        script1.defer = true;
        script1.onload = initGapi;
        script1.onerror = () => reject(new Error("Failed to load gapi script"));
        document.body.appendChild(script1);
    }

    if (window.google && window.google.accounts) initGis();
    else {
        const script2 = document.createElement('script');
        script2.src = 'https://accounts.google.com/gsi/client';
        script2.async = true;
        script2.defer = true;
        script2.onload = initGis;
        script2.onerror = () => reject(new Error("Failed to load gsi script"));
        document.body.appendChild(script2);
    }
  });

  return initPromise;
};

export const initGoogleDrive = async () => {
    await loadGoogleScripts();
    if (!accessToken) {
        return true;
    }
    return true;
};

export const authenticateGoogle = async (): Promise<string> => {
  await loadGoogleScripts();

  return new Promise((resolve, reject) => {
    if (!tokenClient) {
        try {
             tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: () => {},
             });
        } catch (e: unknown) {
             const error = e as { message?: string };
             reject(new Error(`Token Client Init Failed: ${error.message || String(e)}`));
             return;
        }
    }

    // Check if token exists and is valid (simple check)
    if (accessToken && window.gapi?.client?.getToken()?.access_token) {
        resolve(accessToken);
        return;
    }

    tokenClient.callback = (resp: any) => {
      if (resp.error) {
        console.error("OAuth Error Response:", resp);
        reject(new Error(`OAuth Error: ${resp.error}`));
        return;
      }
      accessToken = resp.access_token;
      if (window.gapi.client) {
          window.gapi.client.setToken(resp);
      }
      resolve(resp.access_token);
    };

    // Prompt user to select account
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
};

const getAccessToken = () => {
    return accessToken || window.gapi?.client?.getToken()?.access_token;
};

export const addFilePermission = async (fileId: string) => {
    await loadGoogleScripts();
    try {
        await window.gapi.client.drive.permissions.create({
            fileId: fileId,
            resource: {
                role: 'reader',
                type: 'anyone', 
            }
        });
    } catch (e) {
        console.warn("Error setting permissions (file uploaded but not public)", e);
    }
};

export const getSystemFolderId = async (): Promise<string> => {
    await loadGoogleScripts();
    try {
        if (!getAccessToken()) await authenticateGoogle();

        const response = await window.gapi.client.drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and name='${CENTRAL_FOLDER_NAME}' and trashed=false`,
            fields: 'files(id, name)',
        });

        if (response.result.files && response.result.files.length > 0) {
            return response.result.files[0].id;
        } else {
            return await createDriveFolder(CENTRAL_FOLDER_NAME);
        }
    } catch (e: unknown) {
        console.error("Error finding system folder", e);
        const error = e as { result?: { error?: { message?: string } }; message?: string };
        if (error.result && error.result.error && error.result.error.message) {
             throw new Error(`Drive Error: ${error.result.error.message}`);
        }
        throw new Error(error.message || "Failed to access Drive folder");
    }
};

export const createDriveFolder = async (folderName: string, parentId?: string): Promise<string> => {
    let token = getAccessToken();
    if (!token) token = await authenticateGoogle();

    try {
        const fileMetadata: { name: string; mimeType: string; parents?: string[] } = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
        };
        if (parentId) {
            fileMetadata.parents = [parentId];
        }

        const response = await window.gapi.client.drive.files.create({
            resource: fileMetadata,
            fields: 'id'
        });
        
        return response.result.id;
    } catch (e: unknown) {
        console.error("Error creating folder", e);
        const error = e as { message?: string };
        throw new Error(`Create Folder Failed: ${error.message || 'Unknown error'}`);
    }
};

export const uploadFileToDrive = async (file: File, folderId?: string): Promise<unknown> => {
    let token = getAccessToken();
    if (!token) token = await authenticateGoogle();

    const metadata = {
        name: file.name,
        mimeType: file.type,
        parents: folderId ? [folderId] : [],
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    try {
        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,iconLink,mimeType,thumbnailLink,size', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + token }),
            body: form,
        });
        
        if (!res.ok) {
            const errText = await res.text();
            let errMsg = `Status ${res.status}`;
            try {
                const errObj = JSON.parse(errText);
                if(errObj.error && errObj.error.message) errMsg = errObj.error.message;
            } catch {
                /* The error response was not valid JSON, so we proceed with the raw text. */
            }
            throw new Error(`Drive API: ${errMsg}`);
        }

        const result = await res.json();
        await addFilePermission(result.id);
        return result;

    } catch (error: any) {
        console.error("Upload Error:", error);
        throw new Error(error.message || "Network error during upload");
    }
};

export const uploadStringToDrive = async (content: string, fileName: string, mimeType: string, folderId?: string): Promise<unknown> => {
    const blob = new Blob([content], { type: mimeType });
    const file = new File([blob], fileName, { type: mimeType });
    return await uploadFileToDrive(file, folderId);
};

export const listDriveFiles = async (folderId?: string) => {
     await loadGoogleScripts();
     
     if (!getAccessToken()) {
         return []; // Return empty if not authenticated yet, let component handle auth prompt
     }

     let query = "trashed=false";
     if(folderId) {
         query += ` and '${folderId}' in parents`;
     } else {
         try {
             // We won't force auth here to avoid loops, just check if we can get system folder
             const systemId = await getSystemFolderId();
             query += ` and '${systemId}' in parents`;
         } catch {
             return [];
         }
     }

     try {
        const response = await window.gapi.client.drive.files.list({
            q: query,
            fields: 'files(id, name, mimeType, webViewLink, iconLink, thumbnailLink, createdTime, size)',
            pageSize: 100,
            orderBy: 'folder, createdTime desc'
        });
        return response.result.files;
     } catch (e) {
         console.error("List files error", e);
         throw e;
     }
};

export const deleteFileFromDrive = async (fileId: string) => {
    const token = getAccessToken();
    if (!token) await authenticateGoogle();
    
    try {
        await window.gapi.client.drive.files.delete({
            fileId: fileId
        });
    } catch (e: unknown) {
        const error = e as { result?: { error?: { message?: string } }; message?: string };
        throw new Error(`Delete Failed: ${error.result?.error?.message || error.message}`);
    }
};

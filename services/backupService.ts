
import { db } from './firebase';
import { collection, writeBatch, doc } from 'firebase/firestore';

// Helper to download data as a file
const downloadFile = (content: string, fileName: string, contentType: string) => {
  const a = document.createElement("a");
  const file = new Blob([content], { type: contentType });
  a.href = URL.createObjectURL(file);
  a.download = fileName;
  a.click();
};

// 1. Export to Excel/CSV (Supports Arabic)
export const generateCSVContent = (data: Record<string, unknown>[]) => {
  if (!data || !data.length) return "";

  // Get headers
  const headers = Object.keys(data[0]);
  
  // Create CSV content with BOM for Excel Arabic support
  return "\uFEFF" + [
    headers.join(","),
    ...data.map(row => headers.map(fieldName => {
      let cell = (row[fieldName] === null || row[fieldName] === undefined) ? '' : String(row[fieldName]);
      cell = cell.replace(/"/g, '""'); // Escape quotes
      if (cell.search(/("|,|\n)/g) >= 0) cell = `"${cell}"`; // Quote complex cells
      return cell;
    }).join(","))
  ].join("\n");
};

export const exportToCSV = (data: Record<string, unknown>[], filename: string) => {
  const csvContent = generateCSVContent(data);
  if (!csvContent) return;
  downloadFile(csvContent, `${filename}_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
};

// 2. Full System Backup (JSON)
export const generateBackupJSON = (allData: Record<string, unknown>) => {
  const backup = {
    metadata: {
      timestamp: new Date().toISOString(),
      version: "1.0",
      type: "FULL_BACKUP"
    },
    data: allData
  };
  return JSON.stringify(backup, null, 2);
};

export const backupSystemData = (allData: Record<string, unknown>) => {
  const jsonContent = generateBackupJSON(allData);
  downloadFile(jsonContent, `TVETA_System_Backup_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
};

// 3. Restore Data to Firebase (JSON Backup)
export const restoreSystemData = async (jsonFile: File, onProgress: (msg: string) => void): Promise<void> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        
        if (!parsed.data) throw new Error("Invalid Backup File Format");

        if (!db) throw new Error("Firebase DB not initialized");

        // Use Firestore Batch
        if (!db) return;
    const batch = writeBatch(db);
        let count = 0;

        // Collect all operations
        const addOps = (collName: string, items: Record<string, unknown>[]) => {
          const currentDb = db;
          if (!items || !currentDb) return;
          items.forEach(item => {
            const ref = doc(currentDb, collName, (item.id as string) || Date.now().toString());
            batch.set(ref, item);
            count++;
          });
        };

        addOps('visits', parsed.data.visits);
        addOps('auditors', parsed.data.auditors);
        addOps('support', parsed.data.supportMembers);
        addOps('officers', parsed.data.officers);
        addOps('reports', parsed.data.reports);

        onProgress(`جاري استعادة ${count} سجل...`);
        await batch.commit();
        onProgress("تمت استعادة البيانات بنجاح!");
        resolve();

      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(jsonFile);
  });
};

// 4. Import from CSV (Excel)
export const parseCSV = (file: File): Promise<Record<string, string>[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            if (!text) return resolve([]);
            
            const rows = text.split('\n').filter(r => r.trim() !== '');
            const headers = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            
            const data = rows.slice(1).map(row => {
                // Corrected Regex to handle quoted CSV fields correctly
                const regex = /(?:,|^)("(?:""|[^"])*"|[^",]*)/g;
                const matches: string[] = [];
                let match;
                while ((match = regex.exec(row))) {
                    let val = match[1] || '';
                    if (val.startsWith('"') && val.endsWith('"')) {
                        val = val.slice(1, -1).replace(/""/g, '"');
                    }
                    matches.push(val.trim());
                }
                
                const cols = matches.length > 0 ? matches : row.split(',');
                
                const obj: Record<string, string> = {};
                headers.forEach((h, i) => {
                    if (cols[i] !== undefined) obj[h] = cols[i];
                });
                return obj;
            });
            resolve(data);
        };
        reader.onerror = (err) => reject(err);
        reader.readAsText(file);
    });
};

export const batchImportToFirestore = async (collectionName: string, data: Record<string, unknown>[]) => {
  if (!db) throw new Error("Firebase DB not initialized");
  const batch = writeBatch(db);
  const collRef = collection(db, collectionName);

  data.forEach((item) => {
    // Generate a new ID if not provided, or use existing
    const docRef = item.id ? doc(collRef, String(item.id)) : doc(collRef);
    batch.set(docRef, item);
  });

  await batch.commit();
};

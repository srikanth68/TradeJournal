import { db, schema } from '../db';

const FOLDER_NAME = 'TradeJournal';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const MULTIPART_BOUNDARY = '-------314159265358979323846';

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function driveRequest(token: string, path: string, options?: RequestInit) {
  const res = await fetch(`${DRIVE_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Drive API error ${res.status}: ${err}`);
  }
  return res;
}

async function getOrCreateFolder(token: string): Promise<string> {
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const res = await driveRequest(token, `/files?q=${q}&spaces=drive&fields=files(id)`);
  const data = await res.json();

  if (data.files?.length > 0) return data.files[0].id as string;

  const createRes = await driveRequest(token, '/files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  const folder = await createRes.json();
  return folder.id as string;
}

// Converts string/null timestamps back to Date objects for Drizzle timestamp_ms columns
function hydrateDates<T extends Record<string, any>>(rows: T[], fields: string[]): T[] {
  return rows.map(row => {
    const out = { ...row } as any;
    for (const f of fields) {
      if (out[f] != null) out[f] = new Date(out[f]);
    }
    return out as T;
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function listDriveBackups(token: string): Promise<DriveBackupFile[]> {
  const folderId = await getOrCreateFolder(token);
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const res = await driveRequest(
    token,
    `/files?q=${q}&spaces=drive&fields=files(id,name,createdTime,size)&orderBy=createdTime%20desc`,
  );
  const data = await res.json();
  return (data.files ?? []) as DriveBackupFile[];
}

export async function uploadBackup(token: string): Promise<DriveBackupFile> {
  const folderId = await getOrCreateFolder(token);

  const [strategies, positions, positionEntries, dailyJournals] = await Promise.all([
    db.select().from(schema.strategies),
    db.select().from(schema.positions),
    db.select().from(schema.positionEntries),
    db.select().from(schema.dailyJournals),
  ]);

  const payload = JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    strategies,
    positions,
    positionEntries,
    dailyJournals,
  });

  const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const fileName = `TradeJournal Backup ${now}.json`;

  const delim = `\r\n--${MULTIPART_BOUNDARY}\r\n`;
  const close = `\r\n--${MULTIPART_BOUNDARY}--`;
  const body =
    delim +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify({ name: fileName, parents: [folderId] }) +
    delim +
    'Content-Type: application/json\r\n\r\n' +
    payload +
    close;

  const res = await fetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,createdTime,size`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary="${MULTIPART_BOUNDARY}"`,
      },
      body,
    },
  );
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Upload failed ${res.status}: ${err}`);
  }
  return res.json();
}

export async function restoreFromDrive(token: string, fileId: string): Promise<void> {
  const res = await driveRequest(token, `/files/${fileId}?alt=media`);
  const backup = await res.json();

  // Validate version
  if (!backup?.version || !Array.isArray(backup.strategies)) {
    throw new Error('Invalid backup file format');
  }

  // Hydrate timestamps so Drizzle's timestamp_ms mapping works correctly
  const strategies = hydrateDates(backup.strategies ?? [], ['createdAt', 'deletedAt']);
  const positions = hydrateDates(backup.positions ?? [], [
    'createdAt', 'updatedAt', 'exitDate', 'expiryDate', 'lastSyncedAt', 'deletedAt',
  ]);
  const entries = hydrateDates(backup.positionEntries ?? [], [
    'entryDate', 'createdAt', 'updatedAt', 'deletedAt',
  ]);
  const journals = hydrateDates(backup.dailyJournals ?? [], ['createdAt', 'updatedAt', 'deletedAt']);

  // Clear in FK-safe order
  await db.delete(schema.positionEntries);
  await db.delete(schema.positions);
  await db.delete(schema.dailyJournals);
  await db.delete(schema.strategies);

  // Insert in FK-safe order
  if (strategies.length) await db.insert(schema.strategies).values(strategies as any);
  if (positions.length) await db.insert(schema.positions).values(positions as any);
  if (entries.length) await db.insert(schema.positionEntries).values(entries as any);
  if (journals.length) await db.insert(schema.dailyJournals).values(journals as any);
}

export async function deleteBackup(token: string, fileId: string): Promise<void> {
  await driveRequest(token, `/files/${fileId}`, { method: 'DELETE' });
}

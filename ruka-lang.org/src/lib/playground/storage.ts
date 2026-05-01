// IndexedDB-backed persistence for user projects. The playground page
// keeps its working copy in the in-memory `Project` shape; this module
// owns the durable form (`StoredProject`) — same data plus identity,
// display name, and timestamps.
//
// One object store, keyed by `id`. `schemaVersion` is recorded on every
// stored project so future shape changes can migrate per-record without
// needing a coordinated DB-version bump.

import type { Project, ProjectFile, ProjectFolder } from "./project";

const DB_NAME = "ruka-playground";
const DB_VERSION = 1;
const STORE = "projects";
const SCHEMA_VERSION = 1;

export type StoredProject = {
	id: string;
	name: string;
	schemaVersion: number;
	files: ProjectFile[];
	folders: ProjectFolder[];
	entry: string;
	createdAt: number;
	updatedAt: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise;

	dbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);

		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) {
				db.createObjectStore(STORE, { keyPath: "id" });
			}
		};

		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});

	return dbPromise;
}

// Wrap a single-request transaction. `mode` and `fn` together describe
// the whole operation; the returned promise resolves with the request's
// result (or rejects on error). Each call opens its own transaction so
// callers don't have to coordinate batching.
function runRequest<T>(
	mode: IDBTransactionMode,
	fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
	return openDb().then(
		(db) =>
			new Promise<T>((resolve, reject) => {
				const tx = db.transaction(STORE, mode);
				const store = tx.objectStore(STORE);
				const req = fn(store);

				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
			})
	);
}

export async function listProjects(): Promise<StoredProject[]> {
	const all = (await runRequest("readonly", (s) => s.getAll())) as StoredProject[];

	// Most-recently-edited first so the project picker can present them
	// in the order users almost always want.
	return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadProject(id: string): Promise<StoredProject | undefined> {
	const result = (await runRequest("readonly", (s) => s.get(id))) as StoredProject | undefined;
	return result;
}

export async function saveProject(project: StoredProject): Promise<void> {
	project.updatedAt = Date.now();
	await runRequest("readwrite", (s) => s.put(project));
}

export async function deleteProject(id: string): Promise<void> {
	await runRequest("readwrite", (s) => s.delete(id));
}

export async function renameProject(id: string, name: string): Promise<void> {
	const existing = await loadProject(id);
	if (!existing) return;

	existing.name = name;
	await saveProject(existing);
}

// Build a fresh StoredProject from an in-memory Project. Caller passes
// the display name; id and timestamps are assigned here so the storage
// layer is the single source of identity.
export function newStoredProject(name: string, project: Project): StoredProject {
	const now = Date.now();

	return {
		id: crypto.randomUUID(),
		name,
		schemaVersion: SCHEMA_VERSION,
		files: project.files,
		folders: project.folders,
		entry: project.entry,
		createdAt: now,
		updatedAt: now
	};
}

// Strip the storage-only fields off a StoredProject so the playground
// can edit it through the normal Project shape.
export function toProject(stored: StoredProject): Project {
	return {
		files: stored.files,
		folders: stored.folders,
		entry: stored.entry
	};
}

// Demo state lives only in this browser. Nothing is sent anywhere.
const KEY = 'meddent-demo-v1';
const VERSION = 1;

function fresh() {
  return { version: VERSION, role: null, progress: {}, attempts: [], instructor: {}, uploads: {}, events: [] };
}

let memory = null;

function read() {
  if (memory) return memory;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    memory = saved && saved.version === VERSION ? { ...fresh(), ...saved } : fresh();
  } catch {
    memory = fresh();
  }
  return memory;
}

function write() {
  try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* private mode: keep in memory only */ }
}

export const store = {
  get: read,
  update(change) {
    const state = read();
    change(state);
    write();
    return state;
  },
  reset() {
    memory = fresh();
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  },
};

// Files "uploaded" in the instructor view stay in this tab's memory only.
export const uploadedFiles = new Map();

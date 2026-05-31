// cloud.js — Firebase: auth, cloud save, real chat, online presence

import { FIREBASE_CONFIG, FIREBASE_ENABLED } from './firebase-config.js';

const CDN = 'https://www.gstatic.com/firebasejs/10.12.0';

let _db        = null;
let _auth      = null;
let _uid       = null;
let _userName  = 'Anonim';
let _unsubChat = null;

// ── Cached module loaders ─────────────────────────────────────────────────────

async function _FS()   { return import(`${CDN}/firebase-firestore.js`); }
async function _Auth() { return import(`${CDN}/firebase-auth.js`); }

// ── Setup (no sign-in yet) ────────────────────────────────────────────────────

export async function cloudSetup() {
  if (!FIREBASE_ENABLED) return false;
  try {
    const { initializeApp } = await import(`${CDN}/firebase-app.js`);
    const { getFirestore }  = await _FS();
    const { getAuth }       = await _Auth();
    const app = initializeApp(FIREBASE_CONFIG);
    _db   = getFirestore(app);
    _auth = getAuth(app);
    return true;
  } catch (e) {
    console.warn('[Cloud] Setup failed:', e.message);
    return false;
  }
}

// ── Check existing session (persistent auth) ──────────────────────────────────

export async function checkSession() {
  if (!_auth) return null;
  const { onAuthStateChanged } = await _Auth();
  return new Promise(resolve => {
    // onAuthStateChanged fires immediately if a session exists
    const unsub = onAuthStateChanged(_auth, user => {
      unsub();
      if (user) {
        _uid      = user.uid;
        _userName = user.displayName || 'Anonim';
      }
      resolve(user || null);
    });
  });
}

// ── Google sign-in ────────────────────────────────────────────────────────────

export async function signInGoogle() {
  if (!_auth) return null;
  try {
    const { GoogleAuthProvider, signInWithPopup } = await _Auth();
    const result = await signInWithPopup(_auth, new GoogleAuthProvider());
    _uid      = result.user.uid;
    _userName = result.user.displayName || 'Oyuncu';
    console.log('[Cloud] Google sign-in:', _userName);
    return result.user;
  } catch (e) {
    console.warn('[Cloud] Google sign-in failed:', e.message);
    return null;
  }
}

// ── Anonymous sign-in ─────────────────────────────────────────────────────────

export async function signInAnon() {
  if (!_auth) return null;
  try {
    const { signInAnonymously } = await _Auth();
    const result = await signInAnonymously(_auth);
    _uid      = result.user.uid;
    _userName = 'Anonim';
    console.log('[Cloud] Anon sign-in:', _uid.slice(0, 8));
    return result.user;
  } catch (e) {
    console.warn('[Cloud] Anon sign-in failed:', e.message);
    return null;
  }
}

// ── Save / Load ───────────────────────────────────────────────────────────────

export async function cloudSave(data, kingdomName, level, score) {
  if (!_db || !_uid) return;
  try {
    const { doc, setDoc } = await _FS();
    await setDoc(doc(_db, 'saves', _uid), {
      data: JSON.stringify(data),
      kingdomName: kingdomName || 'Anonim',
      level: level || 1,
      score: Math.floor(score) || 0,
      updatedAt: Date.now(),
    });
  } catch (e) { console.warn('[Cloud] Save failed:', e.message); }
}

export async function cloudLoad() {
  if (!_db || !_uid) return null;
  try {
    const { doc, getDoc } = await _FS();
    const snap = await getDoc(doc(_db, 'saves', _uid));
    if (snap.exists()) return JSON.parse(snap.data().data);
  } catch (e) { console.warn('[Cloud] Load failed:', e.message); }
  return null;
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export async function cloudUpdateLeaderboard(kingdomName, level, score) {
  if (!_db || !_uid) return;
  try {
    const { doc, setDoc } = await _FS();
    await setDoc(doc(_db, 'leaderboard', _uid), {
      name: kingdomName, level,
      score: Math.floor(score), uid: _uid,
      updated: Date.now(),
    });
  } catch (e) { console.warn('[Cloud] LB update failed:', e.message); }
}

export async function cloudGetLeaderboard() {
  if (!_db) return null;
  try {
    const { collection, query, orderBy, limit, getDocs } = await _FS();
    const q    = query(collection(_db, 'leaderboard'), orderBy('score', 'desc'), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map((d, i) => ({ rank: i + 1, ...d.data() }));
  } catch (e) { return null; }
}

// ── Online presence (heartbeat) ───────────────────────────────────────────────

export async function startPresence(name) {
  if (!_db || !_uid) return;
  _userName = name || _userName;

  const write = async () => {
    try {
      const { doc, setDoc, serverTimestamp } = await _FS();
      await setDoc(doc(_db, 'presence', _uid), {
        name:     _userName,
        uid:      _uid,
        lastSeen: serverTimestamp(),
      });
    } catch (e) {}
  };

  await write();
  setInterval(write, 60_000);

  window.addEventListener('beforeunload', async () => {
    try {
      const { doc, deleteDoc } = await _FS();
      await deleteDoc(doc(_db, 'presence', _uid));
    } catch (e) {}
  });
}

export async function getOnlineUsers() {
  if (!_db) return [];
  try {
    const { collection, query, where, getDocs, Timestamp } = await _FS();
    const cutoff = Timestamp.fromMillis(Date.now() - 3 * 60_000);
    const q      = query(collection(_db, 'presence'), where('lastSeen', '>', cutoff));
    const snap   = await getDocs(q);
    return snap.docs.map(d => d.data());
  } catch (e) { return []; }
}

// ── Real global chat ──────────────────────────────────────────────────────────

export async function sendChatMessage(name, text) {
  if (!_db || !_uid) return;
  try {
    const { collection, addDoc, serverTimestamp } = await _FS();
    await addDoc(collection(_db, 'chats', 'global', 'messages'), {
      uid: _uid, name, text,
      ts: serverTimestamp(),
    });
  } catch (e) { console.warn('[Cloud] Chat send failed:', e.message); }
}

export function subscribeChat(callback) {
  if (!_db) return;
  if (_unsubChat) _unsubChat();

  _FS().then(({ collection, query, orderBy, limit, onSnapshot }) => {
    const q = query(
      collection(_db, 'chats', 'global', 'messages'),
      orderBy('ts', 'desc'),
      limit(60)
    );
    const cutoff = Date.now() - 48 * 60 * 60_000;
    _unsubChat = onSnapshot(q, snap => {
      const msgs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(m => {
          const t = m.ts?.toMillis ? m.ts.toMillis() : (m.ts?.seconds * 1000 ?? 0);
          return t > cutoff;
        })
        .reverse();
      callback(msgs);
    });
  }).catch(e => console.warn('[Cloud] Chat subscribe failed:', e.message));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getUid()         { return _uid; }
export function getUserName()    { return _userName; }
export function isCloudEnabled() { return FIREBASE_ENABLED && !!_uid; }

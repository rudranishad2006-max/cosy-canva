import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection, query, where, onSnapshot,
  doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { UserPlus, X, Check, DoorOpen, Trash2, Hourglass } from 'lucide-react';
import { friendshipId } from './account.js';

const ONLINE_WINDOW_MS = 70000; // matches the ~25s global heartbeat with slack

const StatusDot = ({ status }) => (
  <span className={`w-2 h-2 rounded-full shrink-0 ${
    status === 'room' ? 'bg-amber-400' : status === 'online' ? 'bg-emerald-400' : 'bg-white/20'
  }`} style={status !== 'offline' ? { boxShadow: '0 0 6px currentColor' } : undefined} />
);

/**
 * Friends drawer: add by username, accept/decline requests, and see where
 * your people are right now — offline, online, or in a room (with its code,
 * one tap from joining them).
 */
const FriendsPanel = ({ db, uid, username, onJoinRoom, onClose }) => {
  const [friendships, setFriendships] = useState([]);
  const [statuses, setStatuses] = useState({}); // otherUid -> {online, lastSeen, currentRoom}
  const [addInput, setAddInput] = useState('');
  const [notice, setNotice] = useState(null); // {kind: 'ok'|'err', text}
  const [busy, setBusy] = useState(false);
  const [rulesBlocked, setRulesBlocked] = useState(false);

  // All friendships that involve me, live.
  useEffect(() => {
    if (!db || !uid) return;
    const q = query(collection(db, 'friendships'), where('users', 'array-contains', uid));
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setFriendships(list);
      setRulesBlocked(false);
    }, () => setRulesBlocked(true));
    return () => unsub();
  }, [db, uid]);

  const { incoming, outgoing, accepted } = useMemo(() => {
    const incoming = [], outgoing = [], accepted = [];
    for (const f of friendships) {
      if (f.status === 'accepted') accepted.push(f);
      else if (f.requestedBy === uid) outgoing.push(f);
      else incoming.push(f);
    }
    return { incoming, outgoing, accepted };
  }, [friendships, uid]);

  const otherOf = (f) => (f.users || []).find(u => u !== uid);
  const nameOf = (f) => (f.names && f.names[otherOf(f)]) || 'someone';

  // Live status for each accepted friend.
  const statusUnsubs = useRef({});
  const acceptedKey = accepted.map(otherOf).sort().join(',');
  useEffect(() => {
    if (!db) return;
    const wanted = acceptedKey ? acceptedKey.split(',') : [];
    // drop listeners we no longer need
    for (const fuid of Object.keys(statusUnsubs.current)) {
      if (!wanted.includes(fuid)) {
        statusUnsubs.current[fuid]();
        delete statusUnsubs.current[fuid];
        setStatuses(s => { const n = { ...s }; delete n[fuid]; return n; });
      }
    }
    // add missing ones
    for (const fuid of wanted) {
      if (statusUnsubs.current[fuid]) continue;
      statusUnsubs.current[fuid] = onSnapshot(doc(db, 'users', fuid), (snap) => {
        setStatuses(s => ({ ...s, [fuid]: snap.exists() ? snap.data() : null }));
      }, () => {});
    }
  }, [db, acceptedKey]);
  useEffect(() => () => {
    for (const unsub of Object.values(statusUnsubs.current)) unsub();
    statusUnsubs.current = {};
  }, []);

  const flash = (kind, text) => {
    setNotice({ kind, text });
    setTimeout(() => setNotice(null), 4000);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const name = addInput.trim().toLowerCase();
    if (!name) return;
    if (name === username) { flash('err', "That's you!"); return; }
    setBusy(true);
    try {
      const nameSnap = await getDoc(doc(db, 'usernames', name));
      if (!nameSnap.exists()) { flash('err', `No one named @${name} yet.`); return; }
      const otherUid = nameSnap.data().uid;
      const fid = friendshipId(uid, otherUid);
      const fref = doc(db, 'friendships', fid);
      // Attempt the create first: rules are create-only for new pairs, so this
      // can never clobber an existing friendship — and reading a *nonexistent*
      // doc is what the rules can't prove, so probing first would always fail.
      try {
        await setDoc(fref, {
          users: [uid, otherUid],
          names: { [uid]: username, [otherUid]: name },
          requestedBy: uid,
          status: 'pending',
          createdAt: serverTimestamp(),
        });
        setAddInput('');
        flash('ok', `Request sent to @${name}.`);
        return;
      } catch { /* doc already exists — inspect it below */ }
      const existing = await getDoc(fref);
      if (!existing.exists()) {
        flash('err', 'Could not send that request — are the new Firestore rules deployed?');
        return;
      }
      const f = existing.data();
      if (f.status === 'accepted') { flash('ok', `You're already friends with @${name}.`); return; }
      if (f.requestedBy === uid) { flash('ok', `Request to @${name} is already waiting.`); return; }
      // They asked first — accept it.
      await updateDoc(fref, { status: 'accepted' });
      flash('ok', `@${name} had already asked — you're friends now!`);
    } catch {
      flash('err', 'Could not send that request — are the new Firestore rules deployed?');
    } finally {
      setBusy(false);
    }
  };

  const accept = (f) => updateDoc(doc(db, 'friendships', f.id), { status: 'accepted' }).catch(() => flash('err', 'Could not accept.'));
  const remove = (f) => deleteDoc(doc(db, 'friendships', f.id)).catch(() => flash('err', 'Could not remove.'));

  const statusOf = (fuid) => {
    const s = statuses[fuid];
    // Clock-based liveness, same pattern as room presence: heartbeats land
    // often enough that render-time freshness stays current.
    // eslint-disable-next-line react-hooks/purity
    if (!s || !s.lastSeen || Date.now() - s.lastSeen > ONLINE_WINDOW_MS) return { kind: 'offline', label: 'Offline' };
    if (s.currentRoom) return { kind: 'room', label: 'In room', room: s.currentRoom };
    return { kind: 'online', label: 'Online' };
  };

  return (
    <div className="chat-surface fixed z-40 flex flex-col shadow-2xl glass-card-strong min-h-0 w-full h-full inset-0 sm:w-80 sm:h-auto sm:inset-auto sm:top-[68px] sm:bottom-5 sm:right-5 rounded-none sm:rounded-2xl animate-slide-in-right overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 flex justify-between items-center bg-white/[0.03]">
        <h3 className="text-sm font-bold text-white/80 font-display flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-rose-400" /> Friends
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition text-white/40 hover:text-white/80 cursor-pointer" title="Close friends">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-grow overflow-y-auto p-4 space-y-5">
        {rulesBlocked && (
          <p className="text-[11px] text-amber-300/80 bg-amber-400/10 border border-amber-400/15 rounded-xl px-3 py-2">
            Friends need the updated Firestore rules. Deploy <span className="font-mono">firestore.rules</span> to switch this on.
          </p>
        )}

        {/* Add friend */}
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            maxLength={16}
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            placeholder="add by username…"
            className="flex-grow px-3 py-2 glass-input rounded-xl text-xs transition lowercase"
          />
          <button type="submit" disabled={busy || !addInput.trim()} className="p-2 btn-gradient rounded-xl disabled:opacity-20 disabled:shadow-none transition cursor-pointer">
            <UserPlus className="w-3.5 h-3.5" />
          </button>
        </form>
        {notice && (
          <p className={`text-[11px] rounded-xl px-3 py-2 border ${notice.kind === 'ok' ? 'text-emerald-300/90 bg-emerald-400/10 border-emerald-400/15' : 'text-rose-300/90 bg-rose-400/10 border-rose-400/15'}`}>
            {notice.text}
          </p>
        )}

        {/* Incoming requests */}
        {incoming.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-2">Wants to be friends</p>
            <div className="space-y-1.5">
              {incoming.map(f => (
                <div key={f.id} className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2">
                  <span className="text-xs text-white/80 font-semibold truncate flex-grow">@{nameOf(f)}</span>
                  <button onClick={() => accept(f)} className="p-1.5 rounded-lg bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/25 transition cursor-pointer" title="Accept">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => remove(f)} className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:bg-rose-400/15 hover:text-rose-300 transition cursor-pointer" title="Decline">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends list */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-2">Your people</p>
          {accepted.length === 0 ? (
            <p className="text-xs text-white/25 italic px-1">No friends yet — add someone by their username.</p>
          ) : (
            <div className="space-y-1.5">
              {accepted.map(f => {
                const fuid = otherOf(f);
                const st = statusOf(fuid);
                return (
                  <div key={f.id} className="group flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2.5">
                    <StatusDot status={st.kind} />
                    <div className="flex-grow min-w-0">
                      <p className="text-xs text-white/80 font-semibold truncate">@{nameOf(f)}</p>
                      <p className="text-[10px] text-white/30 truncate">
                        {st.kind === 'room'
                          ? <>in room <span className="font-mono text-amber-300/80">{st.room}</span></>
                          : st.label}
                      </p>
                    </div>
                    {st.kind === 'room' && (
                      <button onClick={() => onJoinRoom(st.room)} className="p-1.5 rounded-lg bg-amber-400/15 text-amber-300 hover:bg-amber-400/25 transition cursor-pointer" title={`Join ${st.room}`}>
                        <DoorOpen className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => { if (window.confirm(`Remove @${nameOf(f)} from your friends?`)) remove(f); }}
                      className="p-1.5 rounded-lg text-white/15 hover:bg-rose-400/15 hover:text-rose-300 transition cursor-pointer opacity-0 group-hover:opacity-100"
                      title="Unfriend"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Outgoing (pending) */}
        {outgoing.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-2">Waiting on them</p>
            <div className="space-y-1.5">
              {outgoing.map(f => (
                <div key={f.id} className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.05] rounded-xl px-3 py-2">
                  <Hourglass className="w-3 h-3 text-white/25 shrink-0" />
                  <span className="text-xs text-white/50 truncate flex-grow">@{nameOf(f)}</span>
                  <button onClick={() => remove(f)} className="p-1.5 rounded-lg text-white/25 hover:bg-white/10 hover:text-white/60 transition cursor-pointer" title="Cancel request">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FriendsPanel;

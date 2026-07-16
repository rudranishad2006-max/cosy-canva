import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Heart, KeyRound, ArrowLeft } from 'lucide-react';
import { usernameToEmail, USERNAME_RE } from './account.js';

const friendlyAuthError = (code) => {
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Password sign-in is not switched on yet. In the Firebase console, open Authentication → Sign-in method and enable Email/Password.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Wrong username or password.';
    case 'auth/email-already-in-use':
      return 'That username already has an account — log in instead.';
    case 'auth/weak-password':
      return 'Password needs at least 6 characters.';
    case 'auth/too-many-requests':
      return 'Too many tries — wait a moment, then try again.';
    case 'auth/network-request-failed':
      return 'Network hiccup — check your connection and try again.';
    default:
      return 'Something went wrong signing you in. Try again.';
  }
};

/**
 * Username-first login/register card.
 * Step 1 asks only for a username; we peek at the public usernames index to
 * decide whether this is a returning drawer (password) or a first visit
 * (create password). If the index isn't readable yet (rules not deployed),
 * we fall back to letting the person choose.
 */
const LoginScreen = ({ auth, db }) => {
  const [step, setStep] = useState('username'); // 'username' | 'login' | 'register' | 'choose'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const cleanName = username.trim().toLowerCase();

  const handleUsernameContinue = async (e) => {
    e.preventDefault();
    setError('');
    if (!USERNAME_RE.test(cleanName)) {
      setError('Usernames are 3–16 characters: letters, numbers, underscores.');
      return;
    }
    setBusy(true);
    try {
      const snap = await getDoc(doc(db, 'usernames', cleanName));
      setStep(snap.exists() ? 'login' : 'register');
    } catch {
      // usernames index not readable (rules not deployed yet) — let them pick.
      setStep('choose');
    } finally {
      setBusy(false);
    }
  };

  const finishRegister = async (cred) => {
    // Best-effort profile + username index; login still works if rules
    // aren't deployed yet because the username lives in the email itself.
    const uid = cred.user.uid;
    try {
      await setDoc(doc(db, 'users', uid), {
        username: cleanName,
        createdAt: serverTimestamp(),
        online: true,
        lastSeen: Date.now(),
        currentRoom: null,
      }, { merge: true });
      await setDoc(doc(db, 'usernames', cleanName), { uid, username: cleanName });
    } catch { /* deploy firestore.rules to enable profiles/friends */ }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, usernameToEmail(cleanName), password);
    } catch (err) {
      setError(friendlyAuthError(err.code));
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password needs at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, usernameToEmail(cleanName), password);
      await finishRegister(cred);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setStep('login');
      setError(friendlyAuthError(err.code));
    } finally {
      setBusy(false);
    }
  };

  const backToUsername = () => {
    setStep('username');
    setPassword('');
    setConfirm('');
    setError('');
  };

  const passwordStep = step === 'login' || step === 'register';

  return (
    <div className="w-full max-w-sm glass-card-strong rounded-3xl p-8 flex flex-col items-center relative z-10 animate-fade-in">
      <div className="w-12 h-12 rounded-2xl bg-rose-400/10 border border-rose-400/15 flex items-center justify-center mb-4">
        {passwordStep ? <KeyRound className="w-6 h-6 text-rose-400" /> : <Heart className="w-6 h-6 text-rose-400 fill-rose-400/30" />}
      </div>

      <h2 className="text-xl font-bold text-white/90 text-center mb-1 font-display">
        {step === 'username' && "Who's drawing tonight?"}
        {step === 'login' && `Welcome back, ${cleanName}`}
        {step === 'register' && `Claim @${cleanName}`}
        {step === 'choose' && `Hi, ${cleanName}`}
      </h2>
      <p className="text-white/35 text-xs text-center mb-6">
        {step === 'username' && 'Just a username — no email, no phone.'}
        {step === 'login' && 'Enter your password to pull up your chair.'}
        {step === 'register' && 'First time here — pick a password to make it yours.'}
        {step === 'choose' && 'Log in with your password, or create this account.'}
      </p>

      {step === 'username' && (
        <form onSubmit={handleUsernameContinue} className="w-full space-y-4">
          <input
            type="text"
            maxLength={16}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your_username"
            autoComplete="username"
            className="w-full px-4 py-3 glass-input rounded-2xl text-center text-sm transition lowercase"
            autoFocus
            required
          />
          <button type="submit" disabled={busy} className="w-full btn-gradient py-3 px-6 rounded-2xl text-sm cursor-pointer disabled:opacity-50">
            {busy ? 'One sec…' : 'Continue'}
          </button>
        </form>
      )}

      {(step === 'login' || step === 'choose') && (
        <form onSubmit={handleLogin} className="w-full space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            autoComplete="current-password"
            className="w-full px-4 py-3 glass-input rounded-2xl text-center text-sm transition"
            autoFocus
            required
          />
          <button type="submit" disabled={busy} className="w-full btn-gradient py-3 px-6 rounded-2xl text-sm cursor-pointer disabled:opacity-50">
            {busy ? 'Signing in…' : 'Log in'}
          </button>
          {step === 'choose' && (
            <button type="button" onClick={() => { setStep('register'); setError(''); }} className="w-full py-2.5 px-6 rounded-2xl text-xs text-white/50 hover:text-white/80 hover:bg-white/5 border border-white/10 transition cursor-pointer">
              New here? Create this account
            </button>
          )}
        </form>
      )}

      {step === 'register' && (
        <form onSubmit={handleRegister} className="w-full space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="create a password (6+ characters)"
            autoComplete="new-password"
            className="w-full px-4 py-3 glass-input rounded-2xl text-center text-sm transition"
            autoFocus
            required
          />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="type it again"
            autoComplete="new-password"
            className="w-full px-4 py-3 glass-input rounded-2xl text-center text-sm transition"
            required
          />
          <button type="submit" disabled={busy} className="w-full btn-gradient py-3 px-6 rounded-2xl text-sm cursor-pointer disabled:opacity-50">
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>
      )}

      {error && (
        <p className="text-rose-300/90 bg-rose-400/10 border border-rose-400/15 rounded-xl px-3 py-2 text-xs text-center mt-4 w-full">{error}</p>
      )}

      {passwordStep || step === 'choose' ? (
        <button onClick={backToUsername} className="mt-5 text-[11px] text-white/30 hover:text-white/60 transition flex items-center gap-1 cursor-pointer">
          <ArrowLeft className="w-3 h-3" /> different username
        </button>
      ) : null}
    </div>
  );
};

export default LoginScreen;

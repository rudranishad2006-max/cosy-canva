// CozyCanvas accounts are username + password only — no email, no phone.
// Each username maps to a synthetic address on a domain we control, so
// Firebase Auth handles password security and enforces that a username can
// only ever be claimed once.
export const USERNAME_DOMAIN = 'users.cozycanvas.app';
export const usernameToEmail = (username) => `${username}@${USERNAME_DOMAIN}`;
export const emailToUsername = (email) => (email || '').split('@')[0];
export const USERNAME_RE = /^[a-z0-9_]{3,16}$/;

// One doc per friendship, keyed by the sorted uid pair, so both sides always
// read/write the same place and there is nothing to keep in sync.
export const friendshipId = (a, b) => [a, b].sort().join('__');

let client = null;
let currentUser = null;
let syncTimer = null;
let lastSyncedUser = null;

const $ = selector => document.querySelector(selector);
const STORAGE_KEYS = ['six-settings', 'six-favorites', 'six-charts', 'six-records'];

function localProfile() {
  return Object.fromEntries(STORAGE_KEYS.flatMap(key => {
    try {
      const value = localStorage.getItem(key);
      return value === null ? [] : [[key, JSON.parse(value)]];
    } catch { return []; }
  }));
}

function saveLocalProfile(profile) {
  for (const [key, value] of Object.entries(profile)) {
    if (STORAGE_KEYS.includes(key)) localStorage.setItem(key, JSON.stringify(value));
  }
}

function mergeProfiles(local, cloud) {
  const merged = {...cloud, ...local};
  merged['six-favorites'] = [...new Set([
    ...(cloud['six-favorites'] || []), ...(local['six-favorites'] || [])
  ])];
  merged['six-charts'] = {...(cloud['six-charts'] || {}), ...(local['six-charts'] || {})};
  const recordIds = new Set([
    ...Object.keys(cloud['six-records'] || {}), ...Object.keys(local['six-records'] || {})
  ]);
  merged['six-records'] = Object.fromEntries(Array.from(recordIds, id => [
    id, Math.max(cloud['six-records']?.[id] || 0, local['six-records']?.[id] || 0)
  ]));
  return merged;
}

async function syncProfile(userId, local = localProfile()) {
  if (!client || !userId || userId !== lastSyncedUser) return;
  const {data: row, error: readError} = await client
    .from('six_player_data').select('payload').eq('user_id', userId).maybeSingle();
  if (readError) throw readError;
  const merged = mergeProfiles(local, row?.payload || {});
  const {error} = await client.from('six_player_data').upsert({
    user_id: userId, payload: merged, updated_at: new Date().toISOString()
  }, {onConflict: 'user_id'});
  if (error) throw error;
  saveLocalProfile(merged);
  window.dispatchEvent(new CustomEvent('six-cloud-restore', {detail: merged}));
}

function scheduleSync() {
  if (!currentUser || !client) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void syncProfile(currentUser.id).catch(error => {
      console.warn('Cloud save did not finish.', error);
      setStatus('Cloud save failed. Your progress is still saved on this device.');
    });
  }, 900);
}

function setStatus(message) {
  const status = $('#authStatus');
  if (status) status.textContent = message;
}

function renderUser(user) {
  currentUser = user || null;
  const button = $('#authBtn');
  if (!button) return;
  button.textContent = user ? `♪ ${user.user_metadata?.full_name || user.email?.split('@')[0] || 'Account'}` : 'Sign in';
  button.classList.toggle('signed-in', Boolean(user));
  button.setAttribute('aria-label', user ? 'Open account' : 'Sign in with Google or Discord');
}

async function loadSupabase() {
  try {
    const response = await fetch('/api/auth-config');
    const config = await response.json();
    if (!config.url || !config.anonKey) return false;
    const sdk = await import('https://esm.sh/@supabase/supabase-js@2');
    client = sdk.createClient(config.url, config.anonKey);
    const { data } = await client.auth.getSession();
    const user = data.session?.user;
    renderUser(user);
    if (user) {
      lastSyncedUser = user.id;
      void syncProfile(user.id).catch(error => {
        console.warn('Cloud save could not load.', error);
        setStatus('Could not load cloud progress. Your device save is safe.');
      });
    }
    client.auth.onAuthStateChange((event, session) => {
      renderUser(session?.user);
      if (session?.user && event === 'SIGNED_IN') {
        lastSyncedUser = session.user.id;
        setStatus('Signed in. Syncing your progress…');
        void syncProfile(session.user.id).then(() => setStatus('Signed in. Progress syncs automatically.')).catch(error => {
          console.warn('Cloud save could not load.', error);
          setStatus('Could not load cloud progress. Your device save is safe.');
        });
      }
      if (event === 'SIGNED_OUT') lastSyncedUser = null;
    });
    window.addEventListener('six-local-change', scheduleSync);
    return true;
  } catch (error) {
    console.warn('Authentication is unavailable.', error);
    return false;
  }
}

async function signIn(provider) {
  if (!client) {
    setStatus('Login is not connected yet. Add the Supabase settings to enable it.');
    return;
  }
  setStatus('Opening secure sign-in…');
  const { error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin }
  });
  if (error) setStatus(error.message);
  else setStatus('Finish signing in in the provider window.');
}

async function openAccount() {
  if (!client) {
    $('#authDialog')?.showModal();
    setStatus('Login is not connected yet.');
    return;
  }
  if (currentUser) {
    const shouldSignOut = window.confirm('Sign out of SEKAI / SIX?');
    if (shouldSignOut) await client.auth.signOut();
  } else {
    $('#authDialog')?.showModal();
  }
}

export async function initAuth() {
  $('#authBtn')?.addEventListener('click', openAccount);
  $('#googleLogin')?.addEventListener('click', () => signIn('google'));
  $('#discordLogin')?.addEventListener('click', () => signIn('discord'));
  $('#authDialog')?.addEventListener('close', () => setStatus('Choose a provider to continue.'));
  renderUser(null);
  await loadSupabase();
}

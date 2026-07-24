import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.106.2/+esm';

const SUPABASE_URL = 'https://rkxqylhrwyxuockhsoad.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_hJ9J4fsSX2doHzCZ5Uw5fw_1EHB4SPh';

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

const googleButton = document.getElementById('google-auth-button');
const pageUrl = new URL(window.location.href);
const isGoogleReturn = pageUrl.searchParams.get('oauth') === 'google';
let sessionSyncStarted = false;
let providerSettingsPromise = null;

function showMessage(message, type = 'erro') {
  if (typeof window.mostrarLoginPopup === 'function') {
    window.mostrarLoginPopup(message, type);
  }
}

function setGoogleButtonLoading(loading) {
  if (!(googleButton instanceof HTMLButtonElement)) return;
  googleButton.disabled = loading;
  const label = googleButton.querySelector('span');
  if (label) label.textContent = loading ? 'Conectando ao Google...' : 'Continuar com Google';
}

async function isGoogleProviderEnabled() {
  if (!providerSettingsPromise) {
    providerSettingsPromise = fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((settings) => settings?.external?.google ?? null)
      .catch(() => null);
  }

  return providerSettingsPromise;
}

function cleanOAuthUrl() {
  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete('oauth');
  cleanUrl.searchParams.delete('logout');
  cleanUrl.hash = '';
  window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}`);
}

async function syncGoogleSession(session) {
  if (sessionSyncStarted || !session?.access_token) return;
  sessionSyncStarted = true;
  setGoogleButtonLoading(true);

  try {
    const response = await fetch('auth/google-session.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: session.access_token }),
    });
    const result = await response.json();

    if (!response.ok || !result.ok) {
      await supabaseClient.auth.signOut({ scope: 'local' });
      showMessage(result.message || 'Nao foi possivel entrar com Google.', 'erro');
      cleanOAuthUrl();
      return;
    }

    showMessage(result.message || 'Autenticacao concluida.', 'sucesso');
    cleanOAuthUrl();
    window.setTimeout(() => {
      window.location.href = result.redirect || 'dashboard.php';
    }, 500);
  } catch (error) {
    showMessage('Erro de conexao ao concluir o login com Google.', 'erro');
    cleanOAuthUrl();
  } finally {
    setGoogleButtonLoading(false);
  }
}

async function startGoogleLogin() {
  setGoogleButtonLoading(true);

  const googleEnabled = await isGoogleProviderEnabled();
  if (googleEnabled === false) {
    setGoogleButtonLoading(false);
    showMessage('O acesso pelo Google ainda precisa ser ativado no Supabase.', 'erro');
    return;
  }

  const redirectUrl = new URL('index.html', window.location.href);
  redirectUrl.searchParams.set('oauth', 'google');
  redirectUrl.hash = '';

  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectUrl.toString() },
  });

  if (error) {
    setGoogleButtonLoading(false);
    showMessage('O login com Google ainda nao esta disponivel. Verifique o provedor no Supabase.', 'erro');
  }
}

googleButton?.addEventListener('click', startGoogleLogin);

if (pageUrl.searchParams.get('logout') === '1') {
  supabaseClient.auth.signOut({ scope: 'local' }).finally(cleanOAuthUrl);
}

if (isGoogleReturn) {
  window.abrirModal?.();
  setGoogleButtonLoading(true);

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    showMessage('Nao foi possivel recuperar a sessao do Google.', 'erro');
    cleanOAuthUrl();
    setGoogleButtonLoading(false);
  } else if (data.session) {
    await syncGoogleSession(data.session);
  }
}

supabaseClient.auth.onAuthStateChange((event, session) => {
  if (isGoogleReturn && session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
    window.setTimeout(() => syncGoogleSession(session), 0);
  }
});

import { createClient as criarCliente } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.106.2/+esm';

const URL_SUPABASE = 'https://rkxqylhrwyxuockhsoad.supabase.co';
const CHAVE_PUBLICAVEL_SUPABASE = 'sb_publishable_hJ9J4fsSX2doHzCZ5Uw5fw_1EHB4SPh';
const CHAVE_TIPO_ACESSO = 'localbarber-tipo-acesso';

const clienteSupabase = criarCliente(URL_SUPABASE, CHAVE_PUBLICAVEL_SUPABASE, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

const botaoGoogle = document.getElementById('google-auth-button');
const enderecoPagina = new URL(window.location.href);
const retornandoDoGoogle = enderecoPagina.searchParams.get('oauth') === 'google';
let sincronizacaoIniciada = false;
let promessaConfiguracaoProvedor = null;

function obterTipoAcesso() {
  const tipoSelecionado = window.obterTipoAcessoLogin?.()
    || sessionStorage.getItem(CHAVE_TIPO_ACESSO)
    || 'administrador';

  return ['administrador', 'colaborador'].includes(tipoSelecionado)
    ? tipoSelecionado
    : 'administrador';
}

function mostrarMensagem(mensagem, tipo = 'erro') {
  if (typeof window.mostrarLoginPopup === 'function') {
    window.mostrarLoginPopup(mensagem, tipo);
  }
}

function definirCarregamentoGoogle(carregando) {
  if (!(botaoGoogle instanceof HTMLButtonElement)) return;
  botaoGoogle.disabled = carregando;
  const rotulo = botaoGoogle.querySelector('span');
  if (rotulo) {
    rotulo.textContent = carregando ? 'Conectando ao Google...' : 'Continuar com Google';
  }
}

async function provedorGoogleEstaAtivo() {
  if (!promessaConfiguracaoProvedor) {
    promessaConfiguracaoProvedor = fetch(`${URL_SUPABASE}/auth/v1/settings`, {
      headers: { apikey: CHAVE_PUBLICAVEL_SUPABASE },
    })
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then((configuracoes) => configuracoes?.external?.google ?? null)
      .catch(() => null);
  }

  return promessaConfiguracaoProvedor;
}

function limparEnderecoOAuth() {
  const enderecoLimpo = new URL(window.location.href);
  enderecoLimpo.searchParams.delete('oauth');
  enderecoLimpo.searchParams.delete('logout');
  enderecoLimpo.hash = '';
  window.history.replaceState({}, '', `${enderecoLimpo.pathname}${enderecoLimpo.search}`);
}

async function sincronizarSessaoGoogle(sessao) {
  if (sincronizacaoIniciada || !sessao?.access_token) return;
  sincronizacaoIniciada = true;
  definirCarregamentoGoogle(true);

  try {
    const resposta = await fetch('auth/google-session.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: sessao.access_token,
        tipo_acesso: obterTipoAcesso(),
      }),
    });
    const retorno = await resposta.json();

    if (!resposta.ok || !retorno.ok) {
      await clienteSupabase.auth.signOut({ scope: 'local' });
      mostrarMensagem(retorno.message || 'Não foi possível entrar com Google.', 'erro');
      limparEnderecoOAuth();
      return;
    }

    mostrarMensagem(retorno.message || 'Autenticação concluída.', 'sucesso');
    limparEnderecoOAuth();

    if (retorno.sessao_visual) {
      try {
        sessionStorage.setItem(
          'localbarber:sessao-visual',
          JSON.stringify(retorno.sessao_visual)
        );
        const corTema = retorno.sessao_visual.barbearia?.cor_tema;
        if (/^#[0-9A-F]{6}$/i.test(corTema || '')) {
          localStorage.setItem('localbarber-cor-tema', corTema.toUpperCase());
        }
      } catch {
        // O login continua mesmo se o navegador bloquear o armazenamento.
      }
    }

    window.setTimeout(() => {
      window.location.href = retorno.redirect || 'dashboard.php';
    }, 500);
  } catch (erro) {
    mostrarMensagem('Erro de conexão ao concluir o login com Google.', 'erro');
    limparEnderecoOAuth();
  } finally {
    definirCarregamentoGoogle(false);
  }
}

async function iniciarLoginGoogle() {
  definirCarregamentoGoogle(true);
  sessionStorage.setItem(CHAVE_TIPO_ACESSO, obterTipoAcesso());

  const googleAtivo = await provedorGoogleEstaAtivo();
  if (googleAtivo === false) {
    definirCarregamentoGoogle(false);
    mostrarMensagem('O acesso pelo Google ainda precisa ser ativado no Supabase.', 'erro');
    return;
  }

  const enderecoRetorno = new URL('index.html', window.location.href);
  enderecoRetorno.searchParams.set('oauth', 'google');
  enderecoRetorno.hash = '';

  const { error: erro } = await clienteSupabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: enderecoRetorno.toString() },
  });

  if (erro) {
    definirCarregamentoGoogle(false);
    mostrarMensagem(
      'O login com Google ainda não está disponível. Verifique o provedor no Supabase.',
      'erro'
    );
  }
}

botaoGoogle?.addEventListener('click', iniciarLoginGoogle);

if (enderecoPagina.searchParams.get('logout') === '1') {
  clienteSupabase.auth.signOut({ scope: 'local' }).finally(limparEnderecoOAuth);
}

if (retornandoDoGoogle) {
  window.abrirModal?.();
  definirCarregamentoGoogle(true);

  const { data: dadosSessao, error: erroSessao } = await clienteSupabase.auth.getSession();
  if (erroSessao) {
    mostrarMensagem('Não foi possível recuperar a sessão do Google.', 'erro');
    limparEnderecoOAuth();
    definirCarregamentoGoogle(false);
  } else if (dadosSessao.session) {
    await sincronizarSessaoGoogle(dadosSessao.session);
  }
}

clienteSupabase.auth.onAuthStateChange((evento, sessao) => {
  const eventoDeEntrada = evento === 'SIGNED_IN' || evento === 'INITIAL_SESSION';

  if (retornandoDoGoogle && sessao && eventoDeEntrada) {
    window.setTimeout(() => sincronizarSessaoGoogle(sessao), 0);
  }
});

(() => {
    'use strict';
    const form = document.getElementById('recuperacaoForm');
    if (!form) return;
    const redefinir = form.dataset.modo === 'redefinir';
    let token = '';
    const mensagem = document.getElementById('mensagem');
    const botao = form.querySelector('[type=submit]');
    function avisar(texto, erro = false) {
        mensagem.textContent = texto;
        mensagem.dataset.erro = String(erro);
        mensagem.focus();
    }
    function receberLink() {
        token = redefinir ? new URLSearchParams(location.hash.slice(1)).get('token') || '' : '';
        // Nao persiste o segredo nem o deixa no historico/URL depois de carregar.
        if (location.hash || location.search) history.replaceState(null, '', location.pathname);
        if (!redefinir) return;
        form.hidden = !/^[a-f0-9]{64}$/.test(token);
        form.reset();
        mensagem.textContent = '';
        if (form.hidden) avisar('Abra o link recebido por e-mail. Se ele não funcionar, solicite um novo abaixo.', true);
    }
    receberLink();
    // Abrir outro link na mesma aba pode mudar so o fragmento, sem recarregar o documento.
    window.addEventListener('hashchange', receberLink);
    document.getElementById('mostrarSenhas')?.addEventListener('click', (event) => {
        const mostrar = event.currentTarget.getAttribute('aria-pressed') !== 'true';
        for (const input of form.querySelectorAll('[autocomplete=new-password]')) input.type = mostrar ? 'text' : 'password';
        event.currentTarget.setAttribute('aria-pressed', String(mostrar));
        event.currentTarget.textContent = mostrar ? 'Ocultar senhas' : 'Mostrar senhas';
    });
    let enviando = false;
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (enviando || !form.reportValidity()) return;
        const dados = Object.fromEntries(new FormData(form));
        const csrf = dados.csrf;
        delete dados.csrf;
        if (redefinir) {
            if (dados.nova_senha !== dados.confirmacao_senha) return avisar('A confirmação da nova senha não confere.', true);
            dados.token = token;
        }
        enviando = true;
        botao.disabled = true;
        form.setAttribute('aria-busy', 'true');
        const rotulo = botao.textContent;
        botao.textContent = 'Aguarde…';
        try {
            const resposta = await fetch('auth/recuperacao-senha.php', {
                method: 'POST', credentials: 'same-origin', cache: 'no-store',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
                body: JSON.stringify({ ...dados, acao: redefinir ? 'redefinir' : 'solicitar' })
            });
            const resultado = await resposta.json();
            if (!resposta.ok || !resultado.sucesso) {
                if (resultado.codigo === 'link_invalido') { form.hidden = true; token = ''; }
                throw new Error(resultado.mensagem || 'Não foi possível concluir. Tente novamente.');
            }
            avisar(resultado.dados.mensagem);
            form.reset();
            form.hidden = true;
            token = '';
        } catch (erro) {
            avisar(erro instanceof TypeError || erro instanceof SyntaxError ? 'Não foi possível conectar ao sistema. Tente novamente.' : erro.message, true);
        } finally {
            enviando = false;
            botao.disabled = false;
            botao.textContent = rotulo;
            form.removeAttribute('aria-busy');
        }
    });
})();

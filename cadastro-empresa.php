<?php

declare(strict_types=1);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json; charset=utf-8');
    require_once __DIR__ . '/config/brasil-api.php';

    $dados = [
        'razao_social' => trim((string)($_POST['razaoSocial'] ?? '')),
        'documento' => trim((string)($_POST['cnpj'] ?? '')),
        'nome_fantasia' => trim((string)($_POST['nomeFantasia'] ?? '')),
        'email' => trim((string)($_POST['email'] ?? '')),
        'senha' => (string)($_POST['senha'] ?? ''),
        'telefone' => trim((string)($_POST['telefone'] ?? '')),
        'endereco' => trim((string)($_POST['endereco'] ?? '')),
        'numero' => trim((string)($_POST['numero'] ?? '')),
        'complemento' => trim((string)($_POST['complemento'] ?? '')),
        'uf' => strtoupper(trim((string)($_POST['uf'] ?? ''))),
        'bairro' => trim((string)($_POST['bairro'] ?? '')),
        'cidade' => trim((string)($_POST['cidade'] ?? '')),
        'cep' => trim((string)($_POST['cep'] ?? '')),
        'nome_representante' => trim((string)($_POST['nomeRepresentante'] ?? '')),
        'telefone_representante' => trim((string)($_POST['telefoneRepresentante'] ?? '')),
    ];

    $camposObrigatorios = [
        'razao_social' => 'razão social',
        'documento' => 'CNPJ',
        'nome_fantasia' => 'nome fantasia',
        'email' => 'e-mail',
        'senha' => 'senha',
        'telefone' => 'telefone da empresa',
        'endereco' => 'endereço',
        'uf' => 'UF',
        'bairro' => 'bairro',
        'cidade' => 'cidade',
        'cep' => 'CEP',
        'nome_representante' => 'nome do representante',
        'telefone_representante' => 'telefone do representante',
    ];

    foreach ($camposObrigatorios as $campo => $rotulo) {
        if ($dados[$campo] === '') {
            http_response_code(422);
            echo json_encode([
                'ok' => false,
                'code' => 'campo_obrigatorio',
                'field' => $campo,
                'message' => "Preencha o campo {$rotulo}.",
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    $dados['email'] = strtolower($dados['email']);

    if (!cnpjEhValido($dados['documento'])) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'message' => 'Informe um CNPJ válido com 14 dígitos.']);
        exit;
    }

    if (!filter_var($dados['email'], FILTER_VALIDATE_EMAIL)) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'message' => 'Informe um email valido.']);
        exit;
    }

    if (strlen($dados['senha']) < 6) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'message' => 'A senha precisa ter pelo menos 6 caracteres.']);
        exit;
    }

    if (preg_match('/^[A-Z]{2}$/', $dados['uf']) !== 1 || strlen(somenteDigitos($dados['cep'])) !== 8) {
        http_response_code(422);
        echo json_encode(['ok' => false, 'message' => 'Informe UF e CEP válidos.']);
        exit;
    }

    try {
        $empresaConsultada = consultarCnpjNaBrasilApi($dados['documento']);
    } catch (BrasilApiException $exception) {
        http_response_code($exception->getHttpStatus());
        echo json_encode(['ok' => false, 'message' => $exception->getMessage()], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $situacaoCadastral = strtoupper(trim((string)($empresaConsultada['descricao_situacao_cadastral'] ?? '')));

    if ($situacaoCadastral !== 'ATIVA') {
        http_response_code(422);
        echo json_encode([
            'ok' => false,
            'code' => 'cnpj_inativo',
            'message' => 'O CNPJ precisa estar com situação cadastral ATIVA para concluir o cadastro.',
            'situacao_cadastral' => $situacaoCadastral,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $razaoSocialOficial = trim((string)($empresaConsultada['razao_social'] ?? ''));
    $dados['documento'] = formatarCnpj($dados['documento']);

    if ($razaoSocialOficial !== '') {
        $dados['razao_social'] = $razaoSocialOficial;
    }

    try {
        require_once __DIR__ . '/config/database.php';

        $stmt = $pdo->prepare(
            "select
                exists (
                    select 1
                    from barbearias
                    where regexp_replace(coalesce(documento, ''), '[^0-9]', '', 'g') = :cnpj
                ) as cnpj_cadastrado,
                (
                    exists (select 1 from usuarios where lower(email) = :email_usuario)
                    or exists (select 1 from barbearias where lower(email) = :email_barbearia)
                ) as email_cadastrado"
        );
        $stmt->execute([
            'cnpj' => somenteDigitos($dados['documento']),
            'email_usuario' => $dados['email'],
            'email_barbearia' => $dados['email'],
        ]);
        $cadastroExistente = $stmt->fetch();

        if (($cadastroExistente['cnpj_cadastrado'] ?? false) === true) {
            http_response_code(409);
            echo json_encode([
                'ok' => false,
                'code' => 'cnpj_duplicado',
                'field' => 'documento',
                'message' => 'Este CNPJ já possui uma empresa cadastrada.',
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        if (($cadastroExistente['email_cadastrado'] ?? false) === true) {
            http_response_code(409);
            echo json_encode([
                'ok' => false,
                'code' => 'email_duplicado',
                'field' => 'email',
                'message' => 'Este e-mail já está vinculado a uma conta.',
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $pdo->beginTransaction();

        $stmt = $pdo->prepare(
            'insert into barbearias (razao_social, nome_fantasia, documento, categoria, email, telefone, status)
             values (:razao_social, :nome_fantasia, :documento, :categoria, :email, :telefone, :status)
             returning id'
        );
        $stmt->execute([
            'razao_social' => $dados['razao_social'],
            'nome_fantasia' => $dados['nome_fantasia'],
            'documento' => $dados['documento'],
            'categoria' => 'Barbearia',
            'email' => $dados['email'],
            'telefone' => $dados['telefone'],
            'status' => 'ativa',
        ]);
        $barbeariaId = $stmt->fetchColumn();

        $pdo->prepare(
            'insert into enderecos_barbearia (barbearia_id, cep, logradouro, numero, complemento, bairro, cidade, uf, pais)
             values (:barbearia_id, :cep, :logradouro, :numero, :complemento, :bairro, :cidade, :uf, :pais)'
        )->execute([
            'barbearia_id' => $barbeariaId,
            'cep' => $dados['cep'],
            'logradouro' => $dados['endereco'],
            'numero' => $dados['numero'] !== '' ? $dados['numero'] : null,
            'complemento' => $dados['complemento'] !== '' ? $dados['complemento'] : null,
            'bairro' => $dados['bairro'],
            'cidade' => $dados['cidade'],
            'uf' => $dados['uf'],
            'pais' => 'Brasil',
        ]);

        $pdo->prepare(
            'insert into usuarios (barbearia_id, nome, email, telefone, senha_hash, papel, ativo)
             values (:barbearia_id, :nome, :email, :telefone, :senha_hash, :papel, true)'
        )->execute([
            'barbearia_id' => $barbeariaId,
            'nome' => $dados['nome_representante'],
            'email' => $dados['email'],
            'telefone' => $dados['telefone_representante'],
            'senha_hash' => password_hash($dados['senha'], PASSWORD_DEFAULT),
            'papel' => 'admin',
        ]);

        $pdo->commit();

        echo json_encode([
            'ok' => true,
            'message' => 'Cadastro realizado com sucesso. Voce ja pode entrar.',
            'redirect' => 'index.html?cadastro=ok',
        ]);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        if ($e->getCode() === '23505') {
            $detalhe = strtolower((string)($e->errorInfo[2] ?? $e->getMessage()));
            $duplicidadeCnpj = str_contains($detalhe, 'documento') || str_contains($detalhe, 'barbearias_documento');

            http_response_code(409);
            echo json_encode([
                'ok' => false,
                'code' => $duplicidadeCnpj ? 'cnpj_duplicado' : 'email_duplicado',
                'field' => $duplicidadeCnpj ? 'documento' : 'email',
                'message' => $duplicidadeCnpj
                    ? 'Este CNPJ já possui uma empresa cadastrada.'
                    : 'Este e-mail já está vinculado a uma conta.',
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $referenciaErro = bin2hex(random_bytes(4));
        error_log("[LocalBarber][{$referenciaErro}] Falha no cadastro: {$e->getMessage()}");
        http_response_code(500);
        echo json_encode([
            'ok' => false,
            'code' => 'erro_banco',
            'message' => "Não foi possível concluir o cadastro. Referência: {$referenciaErro}.",
        ], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
            $pdo->rollBack();
        }

        $referenciaErro = bin2hex(random_bytes(4));
        error_log("[LocalBarber][{$referenciaErro}] Erro inesperado no cadastro: {$e->getMessage()}");
        http_response_code(500);
        echo json_encode([
            'ok' => false,
            'code' => 'erro_interno',
            'message' => "Não foi possível concluir o cadastro. Referência: {$referenciaErro}.",
        ], JSON_UNESCAPED_UNICODE);
    }

    exit;
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LocalBarber | Cadastrar Barbearia</title>
    <link rel="icon" type="image/png" href="assets/images/favicon.png?v=20260715">
    
  <script src="assets/js/theme-init.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="assets/css/cadastro-empresa.css">
  <link rel="stylesheet" href="assets/css/responsivo.css">
</head>
<body>

    <nav>
        <a href="index.html" class="nav-logo">
            <img src="assets/images/logo.png" alt="LocalBarber">
        </a>
        <ul class="nav-links">
            <li><a href="index.html">Home</a></li>
            <li><a href="index.html#features">Sobre Nós</a></li>
            <li><a href="index.html#contato">Contato</a></li>
        </ul>
        <div class="nav-cta"></div>
    </nav>

    <div class="form-container">
        <div class="form-heading">
            <span class="form-badge">Nova barbearia</span>
            <h2 class="form-title">Cadastro de empresa</h2>
            <p class="form-subtitle">Preencha os dados da sua barbearia para criar o acesso ao painel LocalBarber.</p>
        </div>

        <div id="cadastro-popup" class="auth-popup" role="alert" aria-live="polite"></div>
        
        <form id="cadastroForm">
            <section class="form-section">
                <div class="section-heading">
                    <h3>Dados da empresa</h3>
                    <p>Identificação fiscal e nome usado no atendimento.</p>
                </div>

                <div class="form-group">
                    <label for="razaoSocial">Razão social</label>
                    <input type="text" id="razaoSocial" name="razaoSocial" required>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="cnpj">CNPJ</label>
                        <div class="cnpj-input-row">
                            <input type="text" id="cnpj" name="cnpj" placeholder="00.000.000/0000-00" inputmode="numeric" autocomplete="off" aria-describedby="cnpj-status-message" required>
                            <button type="button" id="consultar-cnpj" class="btn-consultar-cnpj" data-state="idle">Consultar</button>
                        </div>
                        <div id="cnpj-status" class="cnpj-feedback" data-state="idle" role="status" aria-live="polite">
                            <span id="cnpj-status-icon" class="cnpj-feedback-icon" aria-hidden="true">i</span>
                            <span class="cnpj-feedback-content">
                                <strong id="cnpj-status-title">Consulta de CNPJ</strong>
                                <span id="cnpj-status-message">Digite o CNPJ para preencher os dados da empresa.</span>
                            </span>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="nomeFantasia">Nome fantasia</label>
                        <input type="text" id="nomeFantasia" name="nomeFantasia" required>
                    </div>
                </div>
            </section>

            <section class="form-section">
                <div class="section-heading">
                    <h3>Acesso</h3>
                    <p>Dados usados para entrar no sistema.</p>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input type="email" id="email" name="email" required>
                    </div>
                    <div class="form-group">
                        <label for="senha">Senha</label>
                        <input type="password" id="senha" name="senha" required>
                    </div>
                </div>
            </section>

            <section class="form-section">
                <div class="section-heading">
                    <h3>Endereço e contato</h3>
                    <p>Informações públicas e operacionais da barbearia.</p>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="telefone">Telefone</label>
                        <input type="tel" id="telefone" name="telefone" placeholder="(00) 00000-0000" required>
                    </div>
                    <div class="form-group">
                        <label for="endereco">Endereço</label>
                        <input type="text" id="endereco" name="endereco" required>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="numero">Número</label>
                        <input type="text" id="numero" name="numero" placeholder="123">
                    </div>
                    <div class="form-group">
                        <label for="complemento">Complemento</label>
                        <input type="text" id="complemento" name="complemento" placeholder="Sala, bloco ou referência">
                    </div>
                </div>

                <div class="form-row-three">
                    <div class="form-group">
                        <label for="uf">UF</label>
                        <input type="text" id="uf" name="uf" maxlength="2" placeholder="SP" required>
                    </div>
                    <div class="form-group">
                        <label for="bairro">Bairro</label>
                        <input type="text" id="bairro" name="bairro" required>
                    </div>
                    <div class="form-group">
                        <label for="cep">CEP</label>
                        <input type="text" id="cep" name="cep" placeholder="00000-000" required>
                    </div>
                </div>

                <div class="form-group form-group-spaced">
                    <label for="cidade">Cidade</label>
                    <input type="text" id="cidade" name="cidade" required>
                </div>
            </section>

            <section class="form-section">
                <div class="section-heading">
                    <h3>Representante</h3>
                    <p>Responsável por administrar a conta da barbearia.</p>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="nomeRepresentante">Nome do representante</label>
                        <input type="text" id="nomeRepresentante" name="nomeRepresentante" required>
                    </div>
                    <div class="form-group">
                        <label for="telefoneRepresentante">Telefone do representante</label>
                        <input type="tel" id="telefoneRepresentante" name="telefoneRepresentante" placeholder="(00) 00000-0000" required>
                    </div>
                </div>
            </section>

            <button type="submit" class="btn-cadastrar">Cadastrar</button>
        </form>
    </div>

    <script>
        // Máscaras de Input
        const applyMask = (id, maskFunc) => {
            document.getElementById(id).addEventListener('input', e => e.target.value = maskFunc(e.target.value));
        };

        const formatarCnpj = v => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2').substring(0, 18);
        const formatarTelefone = v => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2').substring(0, 15);
        const formatarCep = v => v.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').substring(0, 9);

        applyMask('cnpj', formatarCnpj);
        applyMask('telefone', formatarTelefone);
        applyMask('telefoneRepresentante', formatarTelefone);
        applyMask('cep', formatarCep);
        
        document.getElementById('uf').addEventListener('input', e => e.target.value = e.target.value.toUpperCase());

        function mostrarCadastroPopup(mensagem, tipo = 'erro') {
            const popup = document.getElementById('cadastro-popup');
            popup.textContent = mensagem;
            popup.className = `auth-popup ${tipo} show`;
            clearTimeout(popup.hideTimer);
            popup.hideTimer = setTimeout(() => popup.classList.remove('show'), 4500);
        }

        const camposRespostaServidor = {
            razao_social: 'razaoSocial',
            documento: 'cnpj',
            nome_fantasia: 'nomeFantasia',
            email: 'email',
            senha: 'senha',
            telefone: 'telefone',
            endereco: 'endereco',
            uf: 'uf',
            bairro: 'bairro',
            cidade: 'cidade',
            cep: 'cep',
            nome_representante: 'nomeRepresentante',
            telefone_representante: 'telefoneRepresentante',
        };

        function focarCampoComErro(campoServidor) {
            const idCampo = camposRespostaServidor[campoServidor];

            if (idCampo) {
                document.getElementById(idCampo)?.focus();
            }
        }

        const cnpjInput = document.getElementById('cnpj');
        const consultarCnpjBtn = document.getElementById('consultar-cnpj');
        const cnpjStatus = document.getElementById('cnpj-status');
        const cnpjStatusIcon = document.getElementById('cnpj-status-icon');
        const cnpjStatusTitle = document.getElementById('cnpj-status-title');
        const cnpjStatusMessage = document.getElementById('cnpj-status-message');
        let consultaCnpjAtual = null;

        const estadosConsulta = {
            idle: { titulo: 'Consulta de CNPJ', icone: 'i', botao: 'Consultar' },
            loading: { titulo: 'Consultando CNPJ', icone: '…', botao: 'Consultando' },
            success: { titulo: 'Empresa ativa', icone: '✓', botao: 'Validado' },
            inactive: { titulo: 'Empresa não está ativa', icone: '!', botao: 'Consultar novamente' },
            error: { titulo: 'Não foi possível consultar', icone: '×', botao: 'Tentar novamente' },
        };

        function atualizarStatusCnpj(mensagem, estado = 'idle') {
            const configuracao = estadosConsulta[estado] || estadosConsulta.idle;
            cnpjStatus.dataset.state = estado;
            cnpjStatusIcon.textContent = configuracao.icone;
            cnpjStatusTitle.textContent = configuracao.titulo;
            cnpjStatusMessage.textContent = mensagem;
        }

        function atualizarBotaoConsulta(estado = 'idle') {
            const configuracao = estadosConsulta[estado] || estadosConsulta.idle;
            consultarCnpjBtn.dataset.state = estado;
            consultarCnpjBtn.textContent = configuracao.botao;
        }

        function preencherCampo(id, valor, formatador = valorAtual => valorAtual, preservarAtualSeVazio = false) {
            const campo = document.getElementById(id);

            if (campo) {
                const valorNormalizado = valor === null || valor === undefined ? '' : String(valor).trim();

                if (preservarAtualSeVazio && valorNormalizado === '') {
                    return;
                }

                campo.value = valorNormalizado === '' ? '' : formatador(valorNormalizado);
            }
        }

        async function executarConsultaCnpj() {
            const cnpj = cnpjInput.value.replace(/\D/g, '');

            if (cnpj.length !== 14) {
                cnpjInput.dataset.validado = '';
                atualizarStatusCnpj('Digite os 14 dígitos do CNPJ para continuar.', 'error');
                atualizarBotaoConsulta('error');
                cnpjInput.focus();
                return false;
            }

            consultarCnpjBtn.disabled = true;
            atualizarBotaoConsulta('loading');
            atualizarStatusCnpj('Buscando os dados oficiais na Receita Federal.', 'loading');

            try {
                const resposta = await fetch(`api/consultar-cnpj.php?cnpj=${encodeURIComponent(cnpj)}`, {
                    headers: { Accept: 'application/json' },
                });
                const retorno = await resposta.json();

                if (!resposta.ok || !retorno.ok) {
                    const erroConsulta = new Error(retorno.message || 'Não foi possível consultar este CNPJ.');
                    erroConsulta.code = retorno.code || 'consulta_indisponivel';
                    erroConsulta.situacaoCadastral = retorno.situacao_cadastral || '';
                    throw erroConsulta;
                }

                const empresa = retorno.empresa;
                const logradouro = [empresa.tipo_logradouro, empresa.logradouro]
                    .filter(Boolean)
                    .join(' ')
                    .replace(/\s+/g, ' ')
                    .trim();

                preencherCampo('cnpj', empresa.cnpj, formatarCnpj);
                preencherCampo('razaoSocial', empresa.razao_social);
                preencherCampo('nomeFantasia', empresa.nome_fantasia || empresa.razao_social);
                preencherCampo('email', empresa.email, valor => valor, true);
                preencherCampo('telefone', empresa.telefone, formatarTelefone, true);
                preencherCampo('endereco', logradouro, valor => valor, true);
                preencherCampo('numero', empresa.numero, valor => valor, true);
                preencherCampo('complemento', empresa.complemento, valor => valor, true);
                preencherCampo('bairro', empresa.bairro, valor => valor, true);
                preencherCampo('cidade', empresa.cidade, valor => valor, true);
                preencherCampo('uf', empresa.uf, valor => valor.toUpperCase(), true);
                preencherCampo('cep', empresa.cep, formatarCep, true);

                cnpjInput.dataset.validado = cnpj;
                const localidade = [empresa.cidade, empresa.uf].filter(Boolean).join('/');
                const atividade = empresa.atividade_principal ? ` · ${empresa.atividade_principal}` : '';
                atualizarStatusCnpj(`Cadastro regular${localidade ? ` · ${localidade}` : ''}${atividade}`, 'success');
                atualizarBotaoConsulta('success');
                return true;
            } catch (erro) {
                cnpjInput.dataset.validado = '';
                const estado = erro.code === 'cnpj_inativo' ? 'inactive' : 'error';
                atualizarStatusCnpj(erro.message || 'Erro ao consultar o CNPJ.', estado);
                atualizarBotaoConsulta(estado);
                return false;
            } finally {
                consultarCnpjBtn.disabled = false;
            }
        }

        function consultarCnpj() {
            if (!consultaCnpjAtual) {
                consultaCnpjAtual = executarConsultaCnpj().finally(() => {
                    consultaCnpjAtual = null;
                });
            }

            return consultaCnpjAtual;
        }

        consultarCnpjBtn.addEventListener('click', consultarCnpj);
        cnpjInput.addEventListener('input', () => {
            cnpjInput.dataset.validado = '';
            atualizarStatusCnpj('Digite o CNPJ para preencher os dados da empresa.', 'idle');
            atualizarBotaoConsulta('idle');
        });
        cnpjInput.addEventListener('blur', () => {
            const cnpj = cnpjInput.value.replace(/\D/g, '');

            if (cnpj.length === 14 && cnpjInput.dataset.validado !== cnpj) {
                consultarCnpj();
            }
        });

        document.getElementById('cadastroForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const btn = document.querySelector('.btn-cadastrar');

            const cnpj = cnpjInput.value.replace(/\D/g, '');
            if (cnpjInput.dataset.validado !== cnpj && !(await consultarCnpj())) {
                mostrarCadastroPopup('Valide o CNPJ antes de concluir o cadastro.', 'erro');
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Cadastrando...';

            try {
                const resposta = await fetch('cadastro-empresa.php', {
                    method: 'POST',
                    body: new FormData(this),
                });
                const retorno = await resposta.json();

                if (!resposta.ok || !retorno.ok) {
                    const tipoPopup = retorno.code === 'cnpj_inativo' ? 'alerta' : 'erro';
                    mostrarCadastroPopup(retorno.message || 'Nao foi possivel cadastrar.', tipoPopup);
                    focarCampoComErro(retorno.field);
                    return;
                }

                mostrarCadastroPopup(retorno.message || 'Cadastro realizado com sucesso.', 'sucesso');
                setTimeout(() => {
                    window.location.href = retorno.redirect || 'index.html?cadastro=ok';
                }, 900);
            } catch (erro) {
                mostrarCadastroPopup('Erro de conexao. Verifique o servidor e tente novamente.', 'erro');
            } finally {
                btn.disabled = false;
                btn.textContent = 'Cadastrar';
            }
        });
    </script>
<script src="assets/js/theme-toggle.js"></script>
</body>
</html>





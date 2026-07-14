<?php

declare(strict_types=1);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json; charset=utf-8');
    require_once __DIR__ . '/config/database.php';

    $dados = [
        'razao_social' => trim((string)($_POST['razaoSocial'] ?? '')),
        'documento' => trim((string)($_POST['cnpj'] ?? '')),
        'nome_fantasia' => trim((string)($_POST['nomeFantasia'] ?? '')),
        'email' => trim((string)($_POST['email'] ?? '')),
        'senha' => (string)($_POST['senha'] ?? ''),
        'telefone' => trim((string)($_POST['telefone'] ?? '')),
        'endereco' => trim((string)($_POST['endereco'] ?? '')),
        'uf' => strtoupper(trim((string)($_POST['uf'] ?? ''))),
        'bairro' => trim((string)($_POST['bairro'] ?? '')),
        'cep' => trim((string)($_POST['cep'] ?? '')),
        'nome_representante' => trim((string)($_POST['nomeRepresentante'] ?? '')),
        'telefone_representante' => trim((string)($_POST['telefoneRepresentante'] ?? '')),
    ];

    foreach (['razao_social', 'documento', 'nome_fantasia', 'email', 'senha', 'telefone', 'endereco', 'uf', 'bairro', 'cep', 'nome_representante', 'telefone_representante'] as $campo) {
        if ($dados[$campo] === '') {
            http_response_code(422);
            echo json_encode(['ok' => false, 'message' => 'Preencha todos os campos obrigatorios.']);
            exit;
        }
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

    try {
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
            'insert into enderecos_barbearia (barbearia_id, cep, logradouro, bairro, cidade, uf, pais)
             values (:barbearia_id, :cep, :logradouro, :bairro, :cidade, :uf, :pais)'
        )->execute([
            'barbearia_id' => $barbeariaId,
            'cep' => $dados['cep'],
            'logradouro' => $dados['endereco'],
            'bairro' => $dados['bairro'],
            'cidade' => null,
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
            http_response_code(409);
            echo json_encode(['ok' => false, 'message' => 'Este email ou CNPJ ja esta cadastrado.']);
            exit;
        }

        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Erro ao salvar cadastro no banco de dados.']);
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
                        <input type="text" id="cnpj" name="cnpj" placeholder="00.000.000/0000-00" required>
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

        applyMask('cnpj', v => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2').substring(0, 18));
        applyMask('telefone', v => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2').substring(0, 15));
        applyMask('telefoneRepresentante', v => v.replace(/\D/g, '').replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d)(\d{4})$/, '$1-$2').substring(0, 15));
        applyMask('cep', v => v.replace(/\D/g, '').replace(/^(\d{5})(\d)/, '$1-$2').substring(0, 9));
        
        document.getElementById('uf').addEventListener('input', e => e.target.value = e.target.value.toUpperCase());

        function mostrarCadastroPopup(mensagem, tipo = 'erro') {
            const popup = document.getElementById('cadastro-popup');
            popup.textContent = mensagem;
            popup.className = `auth-popup ${tipo} show`;
            clearTimeout(popup.hideTimer);
            popup.hideTimer = setTimeout(() => popup.classList.remove('show'), 4500);
        }

        document.getElementById('cadastroForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            const btn = document.querySelector('.btn-cadastrar');
            btn.textContent = 'Cadastrando...';

            try {
                const resposta = await fetch('cadastro-empresa.php', {
                    method: 'POST',
                    body: new FormData(this),
                });
                const retorno = await resposta.json();

                if (!resposta.ok || !retorno.ok) {
                    mostrarCadastroPopup(retorno.message || 'Nao foi possivel cadastrar.', 'erro');
                    return;
                }

                mostrarCadastroPopup(retorno.message || 'Cadastro realizado com sucesso.', 'sucesso');
                setTimeout(() => {
                    window.location.href = retorno.redirect || 'index.html?cadastro=ok';
                }, 900);
            } catch (erro) {
                mostrarCadastroPopup('Erro de conexao. Verifique o servidor e tente novamente.', 'erro');
            } finally {
                btn.textContent = 'Cadastrar';
            }
        });
    </script>
<script src="assets/js/theme-toggle.js"></script>
</body>
</html>





<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $redefinir ? 'Nova senha' : 'Recuperar acesso' ?> | LocalBarber</title>
    <link rel="icon" href="assets/images/favicon.png">
    <link rel="stylesheet" href="assets/css/recuperacao-senha.css">
    <script src="assets/js/recuperacao-senha.js" defer></script>
</head>
<body>
<main class="recuperacao">
    <a class="marca" href="index.html" aria-label="LocalBarber — início"><img src="assets/images/logo.png" alt="LocalBarber"></a>
    <p class="etiqueta">SEU ACESSO, EM SEGURANÇA</p>
    <h1><?= $redefinir ? 'Crie sua nova senha' : 'Esqueceu sua senha?' ?></h1>
    <p class="introducao"><?= $redefinir ? 'Escolha uma senha que você ainda não usa em outros sites.' : 'Acontece. Informe o e-mail da sua conta e enviaremos um link para você recuperar o acesso.' ?></p>
    <form id="recuperacaoForm" data-modo="<?= $redefinir ? 'redefinir' : 'solicitar' ?>">
        <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>">
        <?php if ($redefinir): ?>
        <label for="novaSenha">Nova senha</label>
        <input id="novaSenha" name="nova_senha" type="password" autocomplete="new-password" minlength="8" maxlength="72" required aria-describedby="ajudaSenha">
        <p class="ajuda" id="ajudaSenha">Pelo menos 8 caracteres, com uma letra e um número. Máximo de 72 bytes; acentos ocupam mais espaço.</p>
        <label for="confirmacaoSenha">Confirme a nova senha</label>
        <input id="confirmacaoSenha" name="confirmacao_senha" type="password" autocomplete="new-password" minlength="8" maxlength="72" required>
        <button class="mostrar" type="button" id="mostrarSenhas" aria-pressed="false">Mostrar senhas</button>
        <?php else: ?>
        <label for="email">E-mail da sua conta</label>
        <input id="email" name="email" type="email" autocomplete="email" maxlength="254" placeholder="voce@exemplo.com" required>
        <?php endif; ?>
        <button class="principal" type="submit"><?= $redefinir ? 'Salvar nova senha' : 'Enviar link de recuperação' ?></button>
    </form>
    <p id="mensagem" role="status" aria-live="polite" tabindex="-1"></p>
    <noscript><p>Ative o JavaScript para recuperar sua senha com segurança.</p></noscript>
    <nav aria-label="Acesso"><a href="index.html">Voltar para o início e entrar</a>
        <?php if ($redefinir): ?><a href="esqueci-senha.php">Solicitar um novo link</a><?php endif; ?>
    </nav>
    <p class="rodape">LocalBarber · Gestão simples, acesso protegido.</p>
</main>
</body>
</html>

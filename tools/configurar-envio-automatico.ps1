param(
    [string]$PhpExecutable = 'C:\xampp\php\php-win.exe'
)
$ErrorActionPreference = 'Stop'
$taskName = 'LocalBarber-RecuperacaoSenha'
$projectDirectory = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$workerPath = Join-Path $projectDirectory 'tools\enviar-recuperacoes.php'
$phpPath = (Resolve-Path -LiteralPath $PhpExecutable).Path
if ([IO.Path]::GetFileName($phpPath) -ne 'php-win.exe') {
    throw 'Use php-win.exe para executar sem abrir janela.'
}
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    throw 'A tarefa já existe. Confira sua configuração antes de substituir ou remover.'
}
$action = New-ScheduledTaskAction -Execute $phpPath -Argument ('"' + $workerPath + '"') -WorkingDirectory $projectDirectory
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 3) -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Processa a fila de recuperação LocalBarber por Gmail, enquanto este usuário estiver conectado.' | Select-Object TaskName, State

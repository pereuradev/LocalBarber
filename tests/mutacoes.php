<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/api.php';
require_once __DIR__ . '/../config/agendamento.php';

// Exercita os handlers reais, substituindo somente transporte, autenticação e PDO.
// As constraints e consultas PostgreSQL são verificadas separadamente por database.sql.
class ComandoTeste extends PDOStatement {
    private BancoMutacaoTeste $banco;
    private string $sql;
    private $resultado;
    public function __construct(BancoMutacaoTeste $banco, string $sql) { $this->banco=$banco; $this->sql=$sql; }
    public function execute(?array $params = null): bool {
        $this->banco->comandos[] = ['sql'=>$this->sql, 'params'=>$params];
        if (str_contains($this->sql, 'select * from agendamentos')) $this->resultado=$this->banco->agendamento;
        elseif (str_contains($this->sql, 'from agendamentos a') && str_contains($this->sql, 'not exists')) $this->resultado=$this->banco->agendamento;
        elseif (str_contains($this->sql, 'select * from servicos')) $this->resultado=['nome'=>'Serviço novo','preco'=>90,'duracao_minutos'=>30];
        elseif (str_contains($this->sql, 'insert into transacoes')) {
            $chave=$params['chave_idempotencia'];
            $this->resultado=isset($this->banco->transacoes[$chave]) ? false : ['id'=>'transacao-teste','codigo'=>'TX-TESTE'];
            if ($this->resultado) $this->banco->transacoes[$chave]=$this->resultado+['requisicao_hash'=>$params['requisicao_hash']];
        } elseif (str_contains($this->sql, 'select id, codigo, requisicao_hash')) $this->resultado=$this->banco->transacoes[$params['chave']] ?? false;
        else $this->resultado=['id'=>'registro-teste','codigo'=>'TESTE'];
        return true;
    }
    public function fetch(int $mode=PDO::FETCH_DEFAULT,int $cursorOrientation=PDO::FETCH_ORI_NEXT,int $cursorOffset=0) { return $this->resultado; }
}
class BancoMutacaoTeste extends PDO {
    public array $agendamento=[];
    public array $comandos=[];
    public array $transacoes=[];
    private bool $transacao=false;
    public function __construct() {}
    public function prepare(string $query,array $options=[]): PDOStatement { return new ComandoTeste($this,$query); }
    public function beginTransaction(): bool { $this->transacao=true; return true; }
    public function inTransaction(): bool { return $this->transacao; }
    public function commit(): bool { $this->transacao=false; return true; }
    public function rollBack(): bool { $this->transacao=false; return true; }
}
function registrarHandler(callable $operacao): void { $GLOBALS['handler']=$operacao; }
function carregarHandler(string $arquivo): callable {
    global $pdo;
    $codigo=file_get_contents(__DIR__.'/../api/'.$arquivo.'.php');
    $codigo=preg_replace('/^<\?php\s*|declare\(strict_types=1\);|require_once[^;]+;/m','',$codigo);
    $codigo=str_replace(['executarApi(', 'exigirAutenticacao($pdo)', 'exigirTokenCsrf();', 'lerCorpoJson()'],
        ['registrarHandler(', '$GLOBALS["sessaoTeste"]', '', '$GLOBALS["corpoTeste"]'],$codigo);
    eval($codigo);
    return $GLOBALS['handler'];
}
function confirmarTeste(bool $ok,string $mensagem): void { if (!$ok) throw new RuntimeException($mensagem); }
$pdo=new BancoMutacaoTeste();
$sessaoTeste=['usuario_id'=>'22222222-2222-4222-8222-222222222222','barbearia_id'=>'11111111-1111-4111-8111-111111111111','usuario_papel'=>'admin'];
$id='33333333-3333-4333-8333-333333333333';
$servico='44444444-4444-4444-8444-444444444444';
$funcionario='55555555-5555-4555-8555-555555555555';
$pdo->agendamento=['id'=>$id,'codigo'=>'AG-TESTE','servico_id'=>$servico,'funcionario_id'=>$funcionario,'cliente_id'=>null,
    'nome_cliente_snapshot'=>'Cliente teste',
    'servico_snapshot'=>'Preço contratado','valor_previsto'=>'50.00','horario_inicio'=>'10:00:00','horario_fim'=>'11:00:00'];
$corpoTeste=['id'=>$id,'cliente'=>'Teste','servico_id'=>$servico,'funcionario_id'=>$funcionario,
    'data_agendamento'=>'2030-01-07','horario_inicio'=>'10:00','observacoes'=>'Observação nova'];
$_SERVER['REQUEST_METHOD']='PATCH';
$agenda=carregarHandler('agendamentos');
$agenda();
$salvo=end($pdo->comandos)['params'];
confirmarTeste($salvo['valor_previsto']==50 && $salvo['horario_fim']==='11:00' && $salvo['servico']==='Preço contratado', 'Edição perdeu o preço/duração históricos.');
confirmarTeste(count($pdo->comandos)===2,'Edição consultou indevidamente vínculos ativos históricos.');
$corpoTeste['servico_id']='66666666-6666-4666-8666-666666666666';
$agenda();
$salvo=end($pdo->comandos)['params'];
confirmarTeste($salvo['valor_previsto']==90 && $salvo['horario_fim']==='10:30','Troca de serviço não aplicou novas condições.');

$financeiro=carregarHandler('transacoes');
$_SERVER['REQUEST_METHOD']='POST';
$_SERVER['HTTP_IDEMPOTENCY_KEY']='77777777-7777-4777-8777-777777777777';
$corpoTeste=['agendamento_id'=>$id,'tipo'=>'entrada','descricao'=>'Pagamento','metodo_pagamento'=>'pix','valor'=>'50','status'=>'concluido','data_transacao'=>'2026-09-10T10:00'];
$primeiro=$financeiro();
$salvo=end($pdo->comandos)['params'];
confirmarTeste($salvo['data_transacao']==='2026-09-10 10:00:00-03:00','Financeiro não enviou offset explícito.');
confirmarTeste($salvo['agendamento_id']===$id,'Financeiro não vinculou o agendamento selecionado.');
$repetido=$financeiro();
confirmarTeste($primeiro===$repetido && count($pdo->transacoes)===1,'Repetição não retornou a transação original.');
$corpoTeste['valor']='60';
try { $financeiro(); throw new RuntimeException('Chave repetida aceitou outro valor.'); }
catch (ExcecaoApi $erro) { confirmarTeste($erro->codigo==='idempotencia_conflitante','Erro inesperado na idempotência.'); }
echo "Mutações: histórico, troca de serviço, fuso, repetição e conflito passaram.\n";

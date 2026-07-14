<?php

$host = getenv("SUPABASE_DB_HOST") ?: "db.rkxqylhrwyxuockhsoad.supabase.co";
$port = getenv("SUPABASE_DB_PORT") ?: "5432";
$dbname = getenv("SUPABASE_DB_NAME") ?: "postgres";
$user = getenv("SUPABASE_DB_USER") ?: "postgres";
$password = getenv("SUPABASE_DB_PASSWORD") ?: "Piperson10+--";
$schema = getenv("SUPABASE_DB_SCHEMA") ?: "locaalbarber";

try {
    $pdo = new PDO(
        "pgsql:host=$host;port=$port;dbname=$dbname;sslmode=require",
        $user,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );
    $pdo->exec('SET search_path TO "' . str_replace('"', '""', $schema) . '", public');
} catch (PDOException $e) {
    die("Erro ao conectar com o Supabase: " . $e->getMessage());
}

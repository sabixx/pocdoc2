<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

// Read JSON body
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!is_array($data) || !isset($data['visibleUseCases']) || !is_array($data['visibleUseCases'])) {
    http_response_code(400);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Invalid payload. Expected {"visibleUseCases": [...]}'
    ]);
    exit;
}

// Normalise: unique strings, keep order
$seen = [];
$visibleUseCases = [];
foreach ($data['visibleUseCases'] as $uc) {
    $uc = (string)$uc;
    if ($uc === '') {
        continue;
    }
    if (!isset($seen[$uc])) {
        $seen[$uc] = true;
        $visibleUseCases[] = $uc;
    }
}

// Build config structure
$config = [
    'visibleUseCases' => $visibleUseCases
];

$configPath = __DIR__ . '/config/activeUsecases.json';

// Ensure directory exists and is writable
if (!is_dir(__DIR__ . '/config')) {
    if (!mkdir(__DIR__ . '/config', 0775, true) && !is_dir(__DIR__ . '/config')) {
        http_response_code(500);
        echo json_encode([
            'status'  => 'error',
            'message' => 'Failed to create config directory.'
        ]);
        exit;
    }
}

$json = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

if (file_put_contents($configPath, $json) === false) {
    http_response_code(500);
    echo json_encode([
        'status'  => 'error',
        'message' => 'Failed to write activeUsecases.json (check permissions).'
    ]);
    exit;
}

echo json_encode([
    'status'  => 'success',
    'message' => 'Configuration saved.',
    'visibleUseCases' => $visibleUseCases
]);

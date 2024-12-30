<?php
// Allow requests from any origin
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Requested-With");

$clientAddress = $_SERVER['REMOTE_ADDR'];
$clientPort = $_SERVER['REMOTE_PORT'];

logMessage("{$clientPort} [200]: Request received: " . $_SERVER['REQUEST_METHOD'] . ' ' . $_SERVER['REQUEST_URI']);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // Handle preflight request
    http_response_code(200);
    logMessage("{$clientPort} [200]: OPTIONS request handled.");
    logMessage("{$clientPort} Closing");
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    logMessage("{$clientPort} [200]: POST request received.");

    // Set response header to JSON
    header('Content-Type: application/json');

    // Get the raw POST data
    $rawData = file_get_contents('php://input');
    logMessage("{$clientPort} Raw POST data: " . $rawData);

    // Decode the raw JSON data
    $data = json_decode($rawData, true);

    // Check if JSON decoding failed
    if (json_last_error() !== JSON_ERROR_NONE) {
        logMessage("{$clientPort} Invalid JSON data received: " . json_last_error_msg());
        echo json_encode(['status' => 'error', 'message' => 'Invalid JSON data received']);
        logMessage("{$clientPort} Closing");
        exit();
    }

    // Log the received data for debugging
    logMessage("{$clientPort} Data received: " . print_r($data, true));

    // Check if data is empty
    if (empty($data)) {
        logMessage("{$clientPort} No data provided.");
        echo json_encode(['status' => 'error', 'message' => 'No data provided']);
        logMessage("{$clientPort} Closing");
        exit();
    }

    // Define the file path
    $filePath = '/var/www/html/data/completedUseCases.json';
    logMessage("{$clientPort} File path: " . $filePath);

    // Make sure the directory exists and is writable
    if (!is_dir(dirname($filePath)) || !is_writable(dirname($filePath))) {
        logMessage("{$clientPort} Directory does not exist or is not writable: " . dirname($filePath));
        echo json_encode(['status' => 'error', 'message' => 'Directory does not exist or is not writable']);
        logMessage("{$clientPort} Closing");
        exit();
    }

    // Encode data to JSON
    $jsonData = json_encode($data, JSON_PRETTY_PRINT);
    if ($jsonData === false) {
        logMessage("{$clientPort} Failed to encode data to JSON: " . json_last_error_msg());
        echo json_encode(['status' => 'error', 'message' => 'Failed to encode data to JSON']);
        logMessage("{$clientPort} Closing");
        exit();
    }

    // Attempt to write data to file
    $writeResult = file_put_contents($filePath, $jsonData);
    if ($writeResult === false) {
        logMessage("{$clientPort} Failed to write data to " . $filePath);
        echo json_encode(['status' => 'error', 'message' => 'Failed to save data']);
    } else {
        logMessage("{$clientPort} Data written successfully to " . $filePath);
        echo json_encode(['status' => 'success', 'message' => 'Data saved successfully']);
    }
    logMessage("{$clientPort} Closing");
} else {
    logMessage("{$clientPort} Invalid request method: " . $_SERVER['REQUEST_METHOD']);
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method']);
    logMessage("{$clientPort} Closing");
}

// Helper function to log messages to the server log
function logMessage($message) {
    $timestamp = date("[D M d H:i:s Y]");
    error_log("{$timestamp} [::1]:{$message}");
}
?>

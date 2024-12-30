<?php
// Allow requests from any origin
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    // Handle preflight request
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Get the raw POST data (assumes JSON is sent)
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (isset($data['message'])) {
        $useCase = isset($data['use_case']) ? $data['use_case'] : 'Unknown Use Case';
        $smiley = isset($data['smiley']) ? $data['smiley'] : '';
        $feedbackLabel = isset($data['feedback_label']) ? $data['feedback_label'] : '';

        // Path to the configuration file
        $configPath = '/var/www/html/config/config.json';

        // Initialize default values
        $prospect = 'Unknown Prospect';
        $user = 'Unknown Solution Architect';

        // Check if the configuration file exists
        if (file_exists($configPath)) {
            $config = json_decode(file_get_contents($configPath), true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $prospect = isset($config['prospect']) ? $config['prospect'] : $prospect;
                $user = isset($config['user']) ? $config['user'] : $user;
            } else {
                error_log("Error decoding config.json: " . json_last_error_msg());
            }
        } else {
            error_log("Configuration file not found at: $configPath");
        }


        // Define the webhook URL oben ist real channel, unten testing...
        $webhookUrl = "https://cyberark365.webhook.office.com/webhookb2/c022e33e-22ce-4ba1-a12d-c455770224cf@dc5c35ed-5102-4908-9a31-244d3e0134c6/IncomingWebhook/d839f55c53c04e688dabebddb8ce4684/c7b858bf-c84f-41c8-8da6-2e32d4276fc8/V27L_HK5y1ys_sAx1VTobRojZN1cves7Tjiv0sIEqPlwM1";
        //$webhookUrl = "https://cyberark365.webhook.office.com/webhookb2/70352d7c-73ff-43d4-bff9-dbbfd4a21b5b@dc5c35ed-5102-4908-9a31-244d3e0134c6/IncomingWebhook/354cbb72c5f743b5a450625424cc191c/c7b858bf-c84f-41c8-8da6-2e32d4276fc8/V2N47DNpJ3FO31KzMlSU0KX0zSjKrceSdilvNPt-B5J8U1";



        // Extract the message
        $userMessage = $data['message'];

        // Create a formatted message for Teams using Markdown
        $formattedMessage = "**Prospect:** " . $prospect . "\n\n";
        $formattedMessage .= "**Solution Architect:** " . $user . "\n\n";
        $formattedMessage .= "**Use Case:** " . $useCase . "\n\n";

        // Include smiley and feedback label if available
        if ($smiley !== '' || $feedbackLabel !== '') {
            $formattedMessage .= "**Feedback Smiley:** " . $feedbackLabel . " " . $smiley . "\n\n";
        }

        $formattedMessage .= "**Message:**\n\n" . $userMessage;

        // Create JSON payload
        $payload = json_encode(['text' => $formattedMessage]);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            echo json_encode(['status' => 'error', 'message' => 'JSON encoding failed: ' . json_last_error_msg()]);
            exit();
        }

        $ch = curl_init($webhookUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);

        // Disable SSL verification (for testing purposes)
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($httpCode == 200) {
            echo json_encode(['status' => 'success', 'message' => 'Message sent successfully']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'Failed to send message. HTTP Code: ' . $httpCode . '. Error: ' . $curlError . '. Response: ' . $response]);
        }
    } else {
        echo json_encode(['status' => 'error', 'message' => 'No message provided']);
    }
} else {
    echo json_encode(['status' => 'error', 'message' => 'Invalid request method']);
}

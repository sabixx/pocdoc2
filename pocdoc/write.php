<?php
// Define the path to your JSON file
$filePath = '/var/www/html/data/completedUseCases.json';

// Sample data to write to the JSON file
$data = [
    "test" => "write",
    "use-case-1" => true
];

// Encode data to JSON format
$jsonData = json_encode($data, JSON_PRETTY_PRINT);
if ($jsonData === false) {
    die("JSON encoding failed: " . json_last_error_msg());
}

// Write JSON data to the file
if (file_put_contents($filePath, $jsonData) !== false) {
    echo "Data successfully written to " . $filePath;
} else {
    die("Failed to write data to file.");
}
?>
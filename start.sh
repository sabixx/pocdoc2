#!/bin/bash

# Set a default value if HTACCESS is not set
HTACCESS="${HTACCESS:-$DEFAULT_HTACCESS}"

# Write to the .htpasswd file
echo "$HTACCESS" > /etc/nginx/.htpasswd

USERNAME="${USERNAME:-venafi}"

# Define the target file
CONFIG_FILE="/var/www/html/config/config.json"

# Write the soluition archtiect and prospect to the config file
echo "{    \"prospect\": \"$PROSPECT\",    \"user\": \"$USER\"}" > "$CONFIG_FILE"

# Overwrite the default use cases with the environment variable:
ACTIVE_USE_CASES_CONFIG_FILE="/var/www/html/config/activeUsecases.json"

ACTIVEUSECASES=$(echo "$ACTIVEUSECASES" | sed 's/[,]*$//')

# Check if the required environment variable is set
if [[ -z "$ACTIVEUSECASES" ]]; then
    echo "Error: ACTIVEUSECASES environment variable must be set."
    exit 1
fi

JSON_ARRAY=$(echo "$ACTIVEUSECASES" | tr -d '\n' | awk -v RS=',' '{printf "\"%s\", ", $0}' | sed 's/, $//')
export JSON_ARRAY

echo "activated use cases:"
echo "$JSON_ARRAY"

# Write the JSON content to the file
echo "{ \"visibleUseCases\": [ $JSON_ARRAY ] }" > "$ACTIVE_USE_CASES_CONFIG_FILE"

# Confirm the file was created
echo "activeUsecases.json file created at $ACTIVE_USE_CASES_CONFIG_FILE"

# insert to download the files from a repo..
#  infoContent.json
#  hiddenUseCases.json
#
#
#

# Set correct permissions
chown -R www-data:www-data /var/www/html

# Ensure PHP log file exists
touch /var/log/php_errors.log
chown www-data:www-data /var/log/php_errors.log

# Start PHP-FPM
php-fpm -D

echo 'version 020'

# Start Nginx
nginx -g "daemon off;"

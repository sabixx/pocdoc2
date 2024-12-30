#!/bin/bash

# Set correct permissions
chown -R www-data:www-data /var/www/html

# Ensure PHP log file exists
touch /var/log/php_errors.log
chown www-data:www-data /var/log/php_errors.log

# Start PHP-FPM
php-fpm -D

# Start Nginx
nginx -g "daemon off;"
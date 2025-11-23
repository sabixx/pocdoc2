# Use the official PHP-FPM image
FROM php:8.3-fpm-alpine

# Set environment variables
ENV Prospect="EvalCompanyDemo"
ENV USER="jens.sabitzer_default"
ENV DEFAULT_HTACCESS='venafilab:$apr1$uj332HzM$rTn6EmoRtF0UJAkhL77xV0'
ENV WEBUSER="venafilab"
ENV WEBPASS="ChangeMe123!"
ENV PUBLICDOMAIN="doc-fargate.mimlab.io"
ENV TLSPCURL="https://ui.venafi.cloud"
ENV DEFAULT_HTACCESS='ttyd_vencon:$apr1$U686jomW$FBjMMv6e7vcc.7VU1KLqo0'


# Install required packages for Nginx and utilities
RUN apk add --no-cache nginx bash curl at ttyd certbot certbot-nginx apache2-utils libc6-compat \
    && mkdir -p /run/nginx /var/www/html /etc/nginx/conf.d \
    && chmod -R 777 /var/www/html \
    && chown -R www-data:www-data /var/www/html

# Copy application files to the container
COPY ./pocdoc /var/www/html

COPY ./test.php /var/www/html
# Copy Nginx configuration files
COPY nginx.conf /etc/nginx/nginx.conf
# COPY default.conf /etc/nginx/conf.d/default.conf
COPY default_ssl.conf /etc/nginx/conf.d/default.conf


# Make sure the config dir exists and is writable by PHP (www-data)
RUN mkdir -p /var/www/html/config \
    && chown -R www-data:www-data /var/www/html/config \
    && chmod 775 /var/www/html/config

# Configure PHP-FPM error logging
RUN echo "log_errors = On" >> /usr/local/etc/php/conf.d/php-custom.ini \
    && echo "error_log = /var/log/php_errors.log" >> /usr/local/etc/php/conf.d/php-custom.ini

# Ensure PHP-FPM runs as root
#RUN sed -i 's/^user = www-data/user = root/' /usr/local/etc/php-fpm.d/www.conf \
#    && sed -i 's/^group = www-data/group = root/' /usr/local/etc/php-fpm.d/www.conf

# PHP Configuration: Enable error logging and display errors
RUN echo "display_errors = On" >> /usr/local/etc/php/conf.d/docker-php.ini \
    && echo "log_errors = On" >> /usr/local/etc/php/conf.d/docker-php.ini \
    && echo "error_log = /var/log/php_errors.log" >> /usr/local/etc/php/conf.d/docker-php.ini

# Ensure PHP error log file exists and is writable
RUN touch /var/log/php_errors.log \
    && chown www-data:www-data /var/log/php_errors.log

# Expose HTTP and HTTPS ports
EXPOSE 80 443

# Start Nginx and PHP-FPM
COPY start.sh /start.sh
RUN chmod +x /start.sh

ENTRYPOINT ["/start.sh"]

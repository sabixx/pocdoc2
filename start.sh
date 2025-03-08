#!/bin/bash

set -x
set -e

################## Public Cert ##################

echo "PLAYBOOK_URL=$PLAYBOOK_URL"
#echo "TLSPC_APIKEY=$TLSPC_APIKEY"
echo "PUBLICDOMAIN=$PUBLICDOMAIN"

if [ -n "$PLAYBOOK_URL" ] && [ -n "$TLSPC_APIKEY" ] && [ -n "$PUBLICDOMAIN" ]; then
    echo "All required environment variables (PLAYBOOK_URL, TLSPC_APIKEY, PUBLICDOMAIN) are set. Will get a public certifiate"

    VCERT_URL="https://github.com/Venafi/vcert/releases/download/v5.7.1/vcert_v5.7.1_linux.zip"
    export PLAYBOOK_URL="$PLAYBOOK_URL"
    DOWNLOAD_DIR="$HOME"
    TARGET_DIR="/usr/local/bin"

    curl -L -o "$DOWNLOAD_DIR/vcert.zip" "$VCERT_URL"
    echo "Unzipping vcert to $DOWNLOAD_DIR..."
    unzip -o "$DOWNLOAD_DIR/vcert.zip" -d "$DOWNLOAD_DIR"
    chmod +x "$DOWNLOAD_DIR/vcert"
    echo "Moving vcert to $TARGET_DIR..."
    mv "$DOWNLOAD_DIR/vcert" "$TARGET_DIR/"
    echo "Cleaning up..."
    rm "$DOWNLOAD_DIR/vcert.zip"

    echo "Downloading Playbook..."
    curl -L -o "$DOWNLOAD_DIR/playbook.yaml" "$PLAYBOOK_URL"

    vcert run -f /root/playbook.yaml

    #set the config to use SSL
    mv /etc/nginx/conf.d/default_ssl.conf /etc/nginx/conf.d/default.conf


else
    echo "Error: One or more environment variables (PLAYBOOK_URL, TLSPC_APIKEY, PUBLICDOMAIN) are not set."
fi


################## Set Access creds to the console page ##################

# Set a default value if HTACCESS is not set
HTACCESS="${HTACCESS:-$DEFAULT_HTACCESS}"

# Write to the .htpasswd file
echo "$HTACCESS" > /etc/nginx/.htpasswd
#echo 'admin:$apr1$U686jomW$FBjMMv6e7vcc.7VU1KLqo0' > /etc/nginx/.htpasswd_ttyd
#echo 'ttyd_vencon:$2y$05$hLhX8vBeb6vVebCRmAl8AecCDYXDpsDkDEN.pPsWGffU/ttSQGycO' >> /etc/nginx/.htpasswd_ttyd

echo 'ttyd_vencon:$2y$05$LKXlIsDm83fIRndBEOvKI.4jZ5Jld1jO8IwJiiukp8UycQKZpHJEu'  > /etc/nginx/.htpasswd_ttyd
#echo 'jens:$2y$05$9BHX.xX66eae0N4ExfdGoOaipogzSWFn0h4hakO0Ug3t9JwMBxRSK' > /etc/nginx/.htpasswd_ttyd
#echo 'admin:$2y$05$3/6AIyo5Jn4gphhZgVlMAO86YOU9Eu02v8m5DsjMkkMGqR/kNooTW'  >> /etc/nginx/.htpasswd_ttyd


#htpasswd -bB /etc/nginx/.htpasswd_ttyd ttyd_vencon 12345
#htpasswd -bB /etc/nginx/.htpasswd_ttyd ttyd_vencon 12345

htpasswd -bBn "$WEBUSER" "$WEBPASS" > /etc/nginx/.htpasswd


################## Customer Sepcific settings ##################


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

sed -i 's|@@PASSWORD@@|'"$WEBPASS"'|g; s|@@PROSPECT@@|'"$PROSPECT"'|g'  /var/www/html/config/infoContent.json /var/www/html/index.html
sed -i "s|@@TLSPCURL@@|${TLSPCURL}|g; s|@@PASSWORD@@|${WEBPASS}|g; s|@@PROSPECT@@|${PROSPECT}|g" /var/www/html/config/infoContent.json /var/www/html/index.html


################## Webpage config and nginx startup ##################

# Set correct permissions
chown -R www-data:www-data /var/www/html

# Ensure PHP log file exists
touch /var/log/php_errors.log
chown www-data:www-data /var/log/php_errors.log

# Start PHP-FPM
php-fpm -D

echo 'version 039'

# Start Nginx
nginx -g "daemon off;" &
#nginx 2>&1 &


################## run ttyd ##################


# Start ttyd as the main foreground process
#ttyd --writable -p 7681 /bin/sh -l 

ttyd -p 7681 --writable -c "$WEBUSER:$WEBPASS" sh -l

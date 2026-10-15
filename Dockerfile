# Official PHP 8.2 with Apache
FROM php:8.2-apache

# Install PostgreSQL client libraries and build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    && docker-php-ext-install pdo pdo_pgsql pgsql \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Enable Apache rewrite and headers modules
RUN a2enmod rewrite headers

# Allow .htaccess overrides in /var/www/html
RUN sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ s/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf

# Configure Apache to dynamically listen on Render's $PORT env var (defaults to 80 if not set)
RUN printf '#!/bin/sh\nset -e\nPORT="${PORT:-80}"\nsed -ri -e "s/Listen 80/Listen $PORT/" /etc/apache2/ports.conf\nsed -ri -e "s/:80>/:$PORT>/" /etc/apache2/sites-available/000-default.conf\nexec "$@"\n' > /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

# Set working directory and copy application code
WORKDIR /var/www/html
COPY . /var/www/html/

# Set proper ownership for Apache
RUN chown -R www-data:www-data /var/www/html

# Expose default HTTP port
EXPOSE 80

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["apache2-foreground"]

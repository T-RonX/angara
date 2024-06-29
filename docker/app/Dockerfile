FROM php:8.3.8-fpm

# System packages
RUN apt-get update
RUN apt-get install vim -y
RUN apt-get install git -y
RUN apt-get install curl -y
RUN apt-get install nodejs -y
RUN apt-get install npm -y

# System config
RUN echo "alias ll='ls -alh --color=auto'\n" >> ~/.bashrc
RUN echo "alias php-debug='php -dxdebug.mode=debug -dxdebug.start_with_request=1'\n" >> ~/.bashrc
RUN echo "export PHP_IDE_CONFIG=\"serverName=angara.dev\"" >> ~/.bashrc

# Composer
COPY --from=composer:2.5.8 /usr/bin/composer /usr/bin/composer

# Symfony command
RUN curl -sS https://get.symfony.com/cli/installer | bash
RUN mv /root/.symfony5/bin/symfony /usr/local/bin/symfony

# php.ini
RUN cp /usr/local/etc/php/php.ini-development /usr/local/etc/php/php.ini
RUN sed -i 's/short_open_tag = On/short_open_tag = Off/g' /usr/local/etc/php/php.ini

# ext-pdo_mysql
RUN docker-php-ext-install pdo_mysql

# ext-opcache
RUN docker-php-ext-enable opcache

# ext-zip
RUN apt-get install -y \
        libzip-dev \
        zip \
    && docker-php-ext-install zip

# ext-intl
RUN apt-get -y update \
    && apt-get install -y libicu-dev \
    && docker-php-ext-configure intl \
    && docker-php-ext-install intl \
    && docker-php-ext-enable intl

## ext-apcu
RUN yes | pecl install apcu \
    && docker-php-ext-enable apcu --ini-name 10-docker-php-ext-apcu.ini

# ext-xdebug
RUN yes | pecl install xdebug \
    && echo "zend_extension=$(find /usr/local/lib/php/extensions/ -name xdebug.so)" > /usr/local/etc/php/conf.d/xdebug.ini \
    && echo "xdebug.client_host=\"host.docker.internal\"" >> /usr/local/etc/php/conf.d/xdebug.ini \
    && echo "xdebug.client_port=9000" >> /usr/local/etc/php/conf.d/xdebug.ini \
    && echo "xdebug.mode=\"debug,coverage\"" >> /usr/local/etc/php/conf.d/xdebug.ini \
    && echo "xdebug.start_with_request=trigger" >> /usr/local/etc/php/conf.d/xdebug.ini

# ext-gd
RUN apt-get install -y \
      libpng-dev -y \
      libwebp-dev -y \
      libjpeg-dev -y \
      libfreetype6-dev -y \
  && docker-php-ext-configure gd --enable-gd --with-freetype --with-jpeg --with-webp \
  && docker-php-ext-install gd

WORKDIR /var/www

EXPOSE 5173

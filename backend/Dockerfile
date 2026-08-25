FROM php:8.2-apache

RUN docker-php-ext-install pdo_mysql

# APIのJSONレスポンスをgzip圧縮する。
# mod_deflate 自体は既定で有効だが、圧縮対象に application/json が
# 含まれていないため、対象を追加する設定だけを足している。
COPY apache-json-gzip.conf /etc/apache2/conf-available/json-gzip.conf
RUN a2enconf json-gzip
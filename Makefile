bash:
	docker exec -it angara-app bash

rebuild: rebuild-app rebuild-db rebuild-web up vendors database

rebuild-app:
	docker stop angara-app && docker rm angara-app && docker rmi angara-app && make up

rebuild-db:
	docker stop angara-db && docker rm angara-db && docker rmi mysql:8.4.0 && make up

rebuild-web:
	docker stop angara-web && docker rm angara-web && docker rmi nginx:alpine && docker-compose up -d

up:
	docker-compose up -d

down:
	docker-compose down

vendors:
	docker exec -t angara-app composer --working-dir /var/www/html install

database:
	docker exec -t angara-app php /var/www/html/bin/console doctrine:database:drop --if-exists --force \
	&& docker exec -t angara-app php /var/www/html/bin/console doctrine:database:create --no-interaction \
	&& docker exec -t angara-app php /var/www/html/bin/console doctrine:schema:create --no-interaction \
	&& docker exec -t angara-app php /var/www/html/bin/console doctrine:migrations:version --add --all --no-interaction \
    && doc
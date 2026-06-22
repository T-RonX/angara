help: ## Display this help
	@printf "\nUsage: make <commands> \n\nthe following commands are available: \n"
	@awk 'BEGIN {FS = ":.*##"; printf "\033[36m\033[0m\n"} /^[0-9a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-40s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
	@printf "\n"

bash: ## Shell into the app container
	docker exec -it angara-app bash

dev: ## Start Encore dev-server on port 4101
	docker exec -it angara-app npm run dev-server

rebuild: rebuild-app rebuild-db rebuild-web up vendors database ## Full rebuild (app + db + web + vendors + database)

rebuild-app: ## Rebuild only the app container
	docker stop angara-app && docker rm angara-app && docker rmi angara-app && make up

rebuild-db: ## Rebuild only the database container
	docker stop angara-db && docker rm angara-db && docker rmi mysql:8.4.0 && make up

rebuild-web: ## Rebuild only the web (nginx) container
	docker stop angara-web && docker rm angara-web && docker rmi nginx:alpine && docker-compose up -d

up: ## Start all containers
	docker-compose up -d

down: ## Stop all containers
	docker-compose down

vendors: ## Install Composer dependencies
	docker exec -t angara-app composer --working-dir /var/www/html install

database: ## Drop, recreate and initialise the database
	docker exec -t angara-app php /var/www/html/bin/console doctrine:database:drop --if-exists --force \
	&& docker exec -t angara-app php /var/www/html/bin/console doctrine:database:create --no-interaction \
	&& docker exec -t angara-app php /var/www/html/bin/console doctrine:schema:create --no-interaction \
	&& docker exec -t angara-app php /var/www/html/bin/console doctrine:migrations:version --add --all --no-interaction \
    && docker exec -t angara-app php /var/www/html/bin/console doctrine:migrations:sync-metadata-storage --no-interaction
	make fixtures

fixtures: ## Load Doctrine fixtures
	 docker exec -t angara-app php /var/www/html/bin/console doctrine:fixtures:load --no-interaction

test: ## Reset the dedicated test database schema and run the PHPUnit test suite
	docker exec -t angara-app php /var/www/html/bin/console --env=test doctrine:database:create --if-not-exists --no-interaction
	docker exec -t angara-app php /var/www/html/bin/console --env=test doctrine:schema:drop --force --full-database --no-interaction
	docker exec -t angara-app php /var/www/html/bin/console --env=test doctrine:schema:create --no-interaction
	docker exec -t angara-app php /var/www/html/vendor/bin/phpunit


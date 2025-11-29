.PHONY: help dev build test lint clean docker-up docker-down docker-build

help:
	@echo "0Sync Development Commands"
	@echo ""
	@echo "  make dev              - Start development servers"
	@echo "  make build            - Build for production"
	@echo "  make test             - Run tests"
	@echo "  make lint             - Lint code"
	@echo "  make clean            - Remove build artifacts"
	@echo "  make docker-build     - Build Docker images"
	@echo "  make docker-up        - Start Docker containers"
	@echo "  make docker-down      - Stop Docker containers"
	@echo "  make install          - Install all dependencies"

install:
	npm install

dev:
	npm run dev

build:
	npm run build

test:
	npm run test

lint:
	npm run lint

clean:
	rm -rf backend/dist frontend/dist
	rm -rf backend/coverage
	rm -rf node_modules backend/node_modules frontend/node_modules

docker-build:
	docker-compose build

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

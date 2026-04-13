.PHONY: proto run build test clean docker-up docker-down migrate-up migrate-down migrate-create

# Go parameters
GOCMD=go
GOBUILD=$(GOCMD) build
GORUN=$(GOCMD) run
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
BINARY_NAME=esnack-api
MAIN_PATH=./cmd/server

# Proto parameters
PROTO_DIR=proto
GEN_DIR=gen

# Database
DATABASE_URL?=postgres://esnack:esnack_secret@localhost:5432/esnack_db?sslmode=disable
MIGRATIONS_DIR=migrations

# Build the application
build:
	$(GOBUILD) -o bin/$(BINARY_NAME) $(MAIN_PATH)

# Run the application
run:
	$(GORUN) $(MAIN_PATH)/main.go

# Run tests
test:
	$(GOTEST) -v ./...

# Run tests with coverage
test-coverage:
	$(GOTEST) -v -coverprofile=coverage.out ./...
	$(GOCMD) tool cover -html=coverage.out -o coverage.html

# Clean build artifacts
clean:
	rm -rf bin/
	rm -rf $(GEN_DIR)/
	rm -f coverage.out coverage.html

# Generate protobuf code
proto:
	@mkdir -p $(GEN_DIR)/auth/v1
	@mkdir -p $(GEN_DIR)/restaurant/v1
	@mkdir -p $(GEN_DIR)/menu/v1
	@mkdir -p $(GEN_DIR)/upload/v1
	@mkdir -p $(GEN_DIR)/order/v1
	@mkdir -p $(GEN_DIR)/payment/v1
	@mkdir -p $(GEN_DIR)/promo/v1
	@mkdir -p $(GEN_DIR)/delivery/v1
	protoc -I $(PROTO_DIR) \
		--go_out=$(GEN_DIR) --go_opt=paths=source_relative \
		--go-grpc_out=$(GEN_DIR) --go-grpc_opt=paths=source_relative \
		--grpc-gateway_out=$(GEN_DIR) --grpc-gateway_opt=paths=source_relative \
		$(PROTO_DIR)/auth/v1/auth.proto \
		$(PROTO_DIR)/restaurant/v1/restaurant.proto \
		$(PROTO_DIR)/menu/v1/menu.proto \
		$(PROTO_DIR)/upload/v1/upload.proto \
		$(PROTO_DIR)/order/v1/order.proto \
		$(PROTO_DIR)/payment/v1/payment.proto \
		$(PROTO_DIR)/promo/v1/promo.proto \
		$(PROTO_DIR)/delivery/v1/delivery.proto

# Install protoc plugins
proto-tools:
	go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
	go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-grpc-gateway@latest
	go install github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-openapiv2@latest

# Docker commands
docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

# Migration commands
migrate-up:
	migrate -path $(MIGRATIONS_DIR) -database "$(DATABASE_URL)" up

migrate-down:
	migrate -path $(MIGRATIONS_DIR) -database "$(DATABASE_URL)" down 1

migrate-drop:
	@echo "WARNING: This will DROP ALL TABLES in the database. Are you sure? [y/N] " && read ans && [ $${ans:-N} = y ]
	migrate -path $(MIGRATIONS_DIR) -database "$(DATABASE_URL)" drop -f

migrate-create:
	@read -p "Enter migration name: " name; \
	migrate create -ext sql -dir $(MIGRATIONS_DIR) -seq $$name

# Install golang-migrate
migrate-tools:
	go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@v4.18.3

# Development setup
setup: proto-tools migrate-tools
	go mod download
	cp -n .env.example .env || true

# Format code
fmt:
	gofmt -s -w .

# Lint code
lint:
	golangci-lint run

# Documentation commands
docs-validate:
	@echo "Validating OpenAPI specification..."
	@command -v npx >/dev/null 2>&1 || { echo "npx not found. Install Node.js first."; exit 1; }
	npx @redocly/cli lint docs/openapi.yaml

docs-serve:
	@echo "Starting API documentation server on http://localhost:8081"
	@command -v npx >/dev/null 2>&1 || { echo "npx not found. Install Node.js first."; exit 1; }
	npx @redocly/cli preview-docs docs/openapi.yaml --port 8081

docs-swagger:
	@echo "Starting Swagger UI on http://localhost:8082"
	docker run -d -p 8082:8080 \
		-e SWAGGER_JSON=/docs/openapi.yaml \
		-v $(PWD)/docs:/docs \
		--name esnack-swagger \
		swaggerapi/swagger-ui
	@echo "Swagger UI is running at http://localhost:8082"
	@echo "To stop: make docs-swagger-stop"

docs-swagger-stop:
	@docker stop esnack-swagger 2>/dev/null || true
	@docker rm esnack-swagger 2>/dev/null || true
	@echo "Swagger UI stopped"

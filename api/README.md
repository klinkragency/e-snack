# Beldys Club API

Food ordering platform API (like Uber Eats) supporting delivery, click & collect, and dine-in orders.

## 🚀 Quick Start

```bash
# Clone and setup
git clone <repository-url>
cd api

# Install dependencies
make setup

# Start infrastructure (PostgreSQL, Redis)
docker-compose up -d

# Run migrations
make migrate-up

# Start server
make run
```

Server will run on:
- gRPC: `localhost:50051`
- REST: `http://localhost:8080`

## 📚 Documentation

**OpenAPI Documentation**: [docs/openapi.yaml](docs/openapi.yaml)

View the interactive API documentation:

```bash
# Redoc (recommended)
make docs-serve
# Visit http://localhost:8081

# Swagger UI
make docs-swagger
# Visit http://localhost:8082
```

**Development Workflow**: See [docs/WORKFLOW.md](docs/WORKFLOW.md) for how to maintain API documentation when developing.

## 🔧 Development

```bash
# Generate protobuf code
make proto

# Run server
make run

# Run tests
make test

# Run with coverage
make test-coverage

# Format code
make fmt

# Lint
make lint

# Validate API documentation
make docs-validate
```

## 📖 API Examples

### Register a new user

```bash
curl -X POST http://localhost:8080/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepass123",
    "phone": "+1234567890"
  }'
```

### Login

```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securepass123"
  }'
```

### List restaurants

```bash
curl http://localhost:8080/api/v1/restaurants
```

### Get restaurant menu

```bash
curl http://localhost:8080/api/v1/restaurants/restaurant-slug/menu
```

For more examples, see [docs/README.md](docs/README.md).

## 🏗️ Architecture

```
cmd/server/main.go          # Entry point
proto/                      # Protobuf definitions (.proto files)
internal/
  config/                   # Configuration loading
  server/
    grpc.go                 # gRPC server setup
    gateway.go              # REST gateway setup
  service/                  # Business logic (one folder per domain)
    auth/                   # AuthService (Register, Login, JWT)
    restaurant/             # RestaurantService
    menu/                   # MenuService
    upload/                 # UploadService (UploadThing)
  repository/postgres/      # Database access layer
  middleware/               # JWT auth, logging middleware
  storage/                  # External storage (UploadThing)
pkg/utils/                  # Shared utilities
migrations/                 # SQL migration files
docs/                       # API documentation
```

## 🔐 Authentication

Most endpoints require authentication. Include the JWT token in the `Authorization` header:

```bash
Authorization: Bearer <access_token>
```

### User Roles

- **admin**: Full access to all admin endpoints
- **client**: Can place orders, track delivery, leave reviews
- **livreur**: Can accept deliveries and update location

## 🗄️ Database

PostgreSQL database with migrations managed by `golang-migrate`.

```bash
# Apply all migrations
make migrate-up

# Rollback last migration
make migrate-down

# Create new migration
make migrate-create
# Enter migration name when prompted
```

## 📦 Tech Stack

- **Language**: Go 1.22+
- **API**: gRPC + REST Gateway (grpc-gateway)
- **Database**: PostgreSQL
- **Cache**: Redis
- **Storage**: UploadThing (for images)
- **Migrations**: golang-migrate
- **Documentation**: OpenAPI 3.0

## 🌐 Endpoints

All REST endpoints follow `/api/v1/{resource}` pattern.

### Public Endpoints

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/restaurants` - List restaurants
- `GET /api/v1/restaurants/{slug}` - Get restaurant details
- `GET /api/v1/restaurants/{slug}/menu` - Get restaurant menu

### Admin Endpoints

- `POST /api/v1/admin/restaurants` - Create restaurant
- `PUT /api/v1/admin/restaurants/{id}` - Update restaurant
- `POST /api/v1/admin/restaurants/{id}/categories` - Create menu category
- `POST /api/v1/admin/categories/{id}/products` - Create product

For complete API reference, see the [OpenAPI documentation](docs/openapi.yaml).

## 📝 Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Server
GRPC_PORT=50051
HTTP_PORT=8080

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/beldys_db?sslmode=disable

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=168h

# UploadThing (for image uploads)
UPLOADTHING_SECRET=your-uploadthing-secret
```

## 📜 License

[Add your license here]

## 🤝 Contributing

1. Create feature branch from `main`
2. Implement changes (code + tests + documentation)
3. **IMPORTANT**: Update `docs/openapi.yaml` for any API changes (see [docs/WORKFLOW.md](docs/WORKFLOW.md))
4. Validate documentation: `make docs-validate`
5. Run tests: `make test`
6. Submit pull request

## 📞 Support

For issues and questions, please open an issue on GitHub or contact support@beldys.club.

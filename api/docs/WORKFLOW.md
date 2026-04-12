# API Documentation Workflow

This guide explains how to maintain the OpenAPI documentation when developing endpoints.

## 🔴 MANDATORY RULE

**Every endpoint implementation or modification MUST be accompanied by a documentation update in `docs/openapi.yaml`.**

This is not optional. Documentation is part of the feature.

## Development Workflow

### 1. Define Endpoint in Protobuf

First, define your endpoint in a `.proto` file:

```protobuf
service OrderService {
  rpc CreateOrder(CreateOrderRequest) returns (Order) {
    option (google.api.http) = {
      post: "/api/v1/orders"
      body: "*"
    };
  }
}
```

### 2. Generate Code

```bash
make proto
```

### 3. Implement Service Logic

Implement your service in `internal/service/`

### 4. Update OpenAPI Documentation

**Before testing**, update `docs/openapi.yaml`:

```yaml
paths:
  /api/v1/orders:
    post:
      tags:
        - Orders
      summary: Create a new order
      description: Place a new food order
      operationId: createOrder
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateOrderRequest'
      responses:
        '200':
          description: Order created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
        '401':
          $ref: '#/components/responses/UnauthorizedError'
        '400':
          description: Invalid order data

# Add schemas if new
components:
  schemas:
    CreateOrderRequest:
      type: object
      required:
        - restaurant_id
        - items
      properties:
        restaurant_id:
          type: string
          format: uuid
        items:
          type: array
          items:
            $ref: '#/components/schemas/OrderItem'
        delivery_address:
          type: string
```

### 5. Validate Documentation

```bash
make docs-validate
```

Fix any errors before proceeding. The spec must be valid.

### 6. Test Endpoint

```bash
# Start server
go run cmd/server/main.go

# Test endpoint
curl -X POST http://localhost:8080/api/v1/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"restaurant_id": "uuid", "items": []}'
```

### 7. View Documentation

```bash
# Option 1: Redoc (recommended)
make docs-serve
# Visit http://localhost:8081

# Option 2: Swagger UI
make docs-swagger
# Visit http://localhost:8082
```

### 8. Commit Changes

Commit both the code AND documentation together:

```bash
git add proto/order/v1/order.proto
git add internal/service/order/
git add docs/openapi.yaml
git commit -m "feat: implement order creation endpoint"
```

## OpenAPI Documentation Checklist

When adding/modifying an endpoint, ensure you've documented:

- [ ] **Path and method** (`/api/v1/resource` with correct HTTP verb)
- [ ] **Tags** (for grouping in docs)
- [ ] **Summary and description** (what the endpoint does)
- [ ] **operationId** (unique identifier for the operation)
- [ ] **Security** (`bearerAuth: []` for protected, `security: []` for public)
- [ ] **Request parameters** (path, query, header parameters)
- [ ] **Request body** (with schema and required fields)
- [ ] **All response codes** (200, 400, 401, 404, etc.)
- [ ] **Response schemas** (with correct references)
- [ ] **Component schemas** (if defining new types)

## Common Patterns

### Public Endpoint (No Auth)

```yaml
paths:
  /api/v1/restaurants:
    get:
      operationId: listRestaurants
      security: []  # Public endpoint
      responses:
        '200':
          description: List of restaurants
```

### Protected Endpoint (Requires Auth)

```yaml
paths:
  /api/v1/admin/restaurants:
    post:
      operationId: createRestaurant
      security:
        - bearerAuth: []  # Requires JWT
      responses:
        '200':
          description: Restaurant created
        '401':
          $ref: '#/components/responses/UnauthorizedError'
```

### Path Parameters

```yaml
paths:
  /api/v1/restaurants/{slug}:
    get:
      parameters:
        - name: slug
          in: path
          required: true
          schema:
            type: string
```

### Query Parameters

```yaml
paths:
  /api/v1/restaurants:
    get:
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
        - name: active_only
          in: query
          schema:
            type: boolean
            default: true
```

### Reusing Schemas

```yaml
# Define once
components:
  schemas:
    Restaurant:
      type: object
      properties:
        id:
          type: string
        name:
          type: string

# Reference everywhere
paths:
  /api/v1/restaurants:
    get:
      responses:
        '200':
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Restaurant'
```

## Tools and Commands

```bash
# Validate OpenAPI spec
make docs-validate

# View docs locally with Redoc
make docs-serve

# View docs with Swagger UI
make docs-swagger
make docs-swagger-stop  # Stop Swagger UI

# Generate protobuf code
make proto

# Run server
make run
```

## Why This Matters

1. **Single Source of Truth**: Developers and clients have accurate API documentation
2. **API Contracts**: Frontend can develop against documented contracts
3. **Testing**: Can generate test cases from OpenAPI spec
4. **Client Generation**: Can auto-generate client libraries
5. **API Validation**: Can validate requests/responses against spec

## Getting Help

- OpenAPI 3.0 Specification: https://swagger.io/specification/
- OpenAPI Examples: https://github.com/OAI/OpenAPI-Specification/tree/main/examples
- Redocly CLI: https://redocly.com/docs/cli/

---

**Remember**: Code without documentation is incomplete. Always update both together.

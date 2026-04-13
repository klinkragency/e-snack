# e-Snack API Documentation

This directory contains the API documentation for the e-Snack platform.

## OpenAPI Specification

The complete API specification is available in `openapi.yaml`. This file documents all available endpoints, request/response schemas, and authentication requirements.

### Viewing the Documentation

You can view the OpenAPI documentation using:

1. **Swagger UI** (online): Upload `openapi.yaml` to [editor.swagger.io](https://editor.swagger.io/)

2. **Swagger UI** (local):
   ```bash
   docker run -p 8081:8080 -e SWAGGER_JSON=/docs/openapi.yaml -v $(pwd)/docs:/docs swaggerapi/swagger-ui
   # Visit http://localhost:8081
   ```

3. **Redoc** (local):
   ```bash
   npx @redocly/cli preview-docs docs/openapi.yaml
   ```

4. **VS Code Extension**: Install "OpenAPI (Swagger) Editor" extension

## API Base URLs

- **Development**: `http://localhost:8080`
- **Production**: Configured via `$DOMAIN` environment variable

## Authentication

Most endpoints require authentication. To authenticate:

1. Register or login via `/api/v1/auth/register` or `/api/v1/auth/login`
2. Use the returned `access_token` in the `Authorization` header:
   ```
   Authorization: Bearer <access_token>
   ```

## Quick Examples

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

### Upload a file (requires authentication)
```bash
# Step 1: Get presigned URL
TOKEN="your_access_token"
RESPONSE=$(curl -X POST http://localhost:8080/api/v1/upload/presign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "category": "product",
    "content_type": "image/jpeg",
    "filename": "pizza.jpg"
  }')

# Step 2: Upload file to presigned URL
UPLOAD_URL=$(echo $RESPONSE | jq -r '.upload_url')
curl -X PUT "$UPLOAD_URL" -F "file=@pizza.jpg"

# Step 3: Confirm upload (optional)
FILE_KEY=$(echo $RESPONSE | jq -r '.file_key')
curl -X POST http://localhost:8080/api/v1/upload/confirm \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"file_key\": \"$FILE_KEY\"}"
```

## Endpoint Categories

### Auth
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/profile` - Get user profile

### Restaurants (Public)
- `GET /api/v1/restaurants` - List restaurants
- `GET /api/v1/restaurants/{slug}` - Get restaurant details

### Restaurants (Admin)
- `POST /api/v1/admin/restaurants` - Create restaurant
- `PUT /api/v1/admin/restaurants/{id}` - Update restaurant
- `PUT /api/v1/admin/restaurants/{restaurant_id}/customization` - Update customization

### Menu (Public)
- `GET /api/v1/restaurants/{restaurant_slug}/menu` - Get restaurant menu

### Menu (Admin)
- `POST /api/v1/admin/restaurants/{restaurant_id}/categories` - Create category
- `PUT /api/v1/admin/categories/{id}` - Update category
- `DELETE /api/v1/admin/categories/{id}` - Delete category
- `POST /api/v1/admin/categories/{category_id}/products` - Create product
- `PUT /api/v1/admin/products/{id}` - Update product
- `DELETE /api/v1/admin/products/{id}` - Delete product
- `PATCH /api/v1/admin/products/{id}/availability` - Set availability
- `POST /api/v1/admin/products/{product_id}/options` - Create product option
- `POST /api/v1/admin/options/{option_id}/choices` - Add option choice
- `DELETE /api/v1/admin/options/{id}` - Delete option

### Upload
- `POST /api/v1/upload/presign` - Get presigned upload URL
- `POST /api/v1/upload/confirm` - Confirm upload

## User Roles

| Role | Access |
|------|--------|
| **admin** | Full access to all admin endpoints |
| **client** | Can place orders, track delivery, leave reviews |
| **livreur** | Can accept deliveries and update location |

## Error Responses

All error responses follow this format:
```json
{
  "code": 5,
  "message": "Not Found",
  "details": []
}
```

Common error codes:
- `5` - Not Found
- `13` - Internal Server Error
- `16` - Unauthenticated
- `7` - Permission Denied

## Rate Limiting

Currently no rate limiting is implemented. This will be added in future versions.

## Versioning

The API uses URL-based versioning (`/api/v1/`). Breaking changes will result in a new version (`/api/v2/`).

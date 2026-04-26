# invoice-invoices-service

Invoice generation microservice (business logic) for the Invoice System

This service is the core of the application. It communicates synchronously with the Customers Service and Products Service to fetch data, calculates totals with 19% VAT, and persists the generated invoice.

## Endpoints

| Method | Path | Description | Auth required |
|--------|------|-------------|---------------|
| GET | /invoices | List all invoices | Yes |
| GET | /invoices/:id | Get invoice with line items | Yes |
| POST | /invoices | Generate a new invoice | Yes |
| PATCH | /invoices/:id/status | Update invoice status | Yes |

**Invoice statuses:** `draft` → `sent` → `paid` / `cancelled`

## Example requests

**Generate invoice:**
```bash
curl -X POST http://localhost:3004/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "customer_id": 1,
    "items": [
      {"product_id": 1, "quantity": 2},
      {"product_id": 2, "quantity": 1}
    ],
    "notes": "Invoice for Q1 order"
  }'
```

**Response includes:** invoice number (INV-timestamp-random), customer details, line items, subtotal, VAT (19%), total.

**Update status:**
```bash
curl -X PATCH http://localhost:3004/invoices/1/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"status":"sent"}'
```

## Internal communication

```
POST /invoices
  → GET customers-service/customers/:id
  → GET products-service/products/:id  (for each item)
  → calculate subtotal + 19% VAT
  → persist invoice + invoice_items to DB
```

## Environment variables

```
PORT=3004
DB_HOST=postgres
DB_NAME=invoices_db
DB_USER=invoice_user
DB_PASSWORD=invoice_pass
AUTH_SERVICE_URL=http://auth:3001
CUSTOMERS_SERVICE_URL=http://customers:3002
PRODUCTS_SERVICE_URL=http://products:3003
```


## Tech stack

- Node.js + Express.js
- PostgreSQL (schema: `invoices_schema`, tables: `invoices` + `invoice_items`)
- axios (HTTP calls to Customers and Products services)
- JWT validation via Auth Service

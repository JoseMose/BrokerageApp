# API Documentation - Realtor Lead Platform

## Base URL

```
https://your-api-id.execute-api.us-east-1.amazonaws.com/prod
```

## Authentication

All API endpoints (except webhooks) require a JWT token from AWS Cognito.

Include the token in the Authorization header:

```
Authorization: Bearer <id_token>
```

## Endpoints

### Lead Management

#### Submit New Lead

```http
POST /leads
```

**Request Body:**
```json
{
  "leadType": "buyer",
  "contact": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "5551234567"
  },
  "location": {
    "address": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94105"
  },
  "responses": {
    "timeline": "30-60 days",
    "budget": "$500,000-$750,000",
    "preapproved": "Yes",
    "propertyType": "Single family home"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "leadId": "uuid",
    "message": "Lead submitted successfully and is being processed",
    "status": "pending_scoring"
  }
}
```

### Marketplace

#### Get Available Leads

```http
GET /marketplace?leadType=buyer&minScore=7&maxPrice=100
```

**Query Parameters:**
- `leadType` (optional): "buyer" or "seller"
- `minScore` (optional): 1-9
- `maxScore` (optional): 2-10
- `maxPrice` (optional): Maximum price in dollars

**Response:**
```json
{
  "success": true,
  "data": {
    "leads": [...],
    "total": 15,
    "filters": {...},
    "agentRadius": 15
  }
}
```

#### Get Lead Details

```http
GET /leads/:leadId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "leadId": "uuid",
    "leadType": "buyer",
    "score": 8,
    "price": 80,
    "aiReason": "Strong buyer with preapproval...",
    "location": {...},
    "responses": {...},
    "contact": {
      "nameInitial": "J",
      "emailDomain": "example.com",
      "phoneArea": "555"
    }
  }
}
```

### Agent Profile

#### Get Agent Profile

```http
GET /agents
```

**Response:**
```json
{
  "success": true,
  "data": {
    "profile": {...},
    "purchasedLeads": [...],
    "stats": {
      "totalPurchased": 10,
      "totalSpent": 750,
      "conversionRate": 0.3
    }
  }
}
```

#### Create Agent Profile

```http
POST /agents
```

**Request Body:**
```json
{
  "name": "Jane Smith",
  "licenseId": "CA-12345",
  "brokerage": "Acme Realty",
  "phone": "5551234567",
  "location": {
    "address": "456 Agent Ave",
    "city": "Los Angeles",
    "state": "CA",
    "zip": "90001"
  },
  "radius": 20,
  "preferences": {
    "leadTypes": ["buyer", "seller"],
    "minScore": 6,
    "maxPrice": 150,
    "propertyTypes": ["residential"]
  }
}
```

#### Update Agent Profile

```http
PUT /agents
```

**Request Body:** (same as POST, all fields optional)

### Payments

#### Purchase Lead

```http
POST /payments/purchase
```

**Request Body:**
```json
{
  "leadId": "uuid",
  "paymentMethodId": "pm_card_visa"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "uuid",
    "paymentIntentId": "pi_xxx",
    "status": "succeeded",
    "amount": 80,
    "lead": {
      "leadId": "uuid",
      "contact": {
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "5551234567"
      },
      "location": {...}
    }
  }
}
```

#### Stripe Webhook

```http
POST /payments/webhook
```

No authentication required. Verified via Stripe signature.

### Admin (Requires Admin Role)

#### Get Dashboard Stats

```http
GET /admin?action=dashboard
```

#### List All Leads

```http
GET /admin?action=leads&status=available&page=1&limit=50
```

#### List All Agents

```http
GET /admin?action=agents&status=active
```

#### List All Transactions

```http
GET /admin?action=transactions&status=completed
```

#### Perform Admin Actions

```http
POST /admin
```

**Request Body Examples:**

Suspend Agent:
```json
{
  "action": "suspend_agent",
  "agentId": "uuid",
  "reason": "Terms violation"
}
```

Activate Agent:
```json
{
  "action": "activate_agent",
  "agentId": "uuid"
}
```

Update Lead Status:
```json
{
  "action": "update_lead_status",
  "leadId": "uuid",
  "status": "expired"
}
```

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**Common Status Codes:**
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict
- 410: Gone (resource expired)
- 500: Internal Server Error

## Rate Limits

- 1000 requests per minute per API key
- 100 lead submissions per hour per agent
- Throttled automatically by API Gateway

## Testing

### Using curl

```bash
# Get JWT token (requires AWS CLI and jq)
TOKEN=$(aws cognito-idp initiate-auth \
  --client-id YOUR_CLIENT_ID \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=user@example.com,PASSWORD=password \
  --query 'AuthenticationResult.IdToken' \
  --output text)

# Make authenticated request
curl -H "Authorization: Bearer $TOKEN" \
  https://your-api.execute-api.us-east-1.amazonaws.com/prod/marketplace
```

### Using Postman

1. Import the API collection
2. Set environment variable `{{token}}` with your JWT
3. All requests will automatically include the token

## Webhook Events

### Stripe Webhooks

The platform listens for these events:

- `payment_intent.succeeded`: Payment completed successfully
- `payment_intent.payment_failed`: Payment failed
- `charge.refunded`: Charge was refunded

Configure webhook endpoint in Stripe:
```
https://your-api.execute-api.us-east-1.amazonaws.com/prod/payments/webhook
```

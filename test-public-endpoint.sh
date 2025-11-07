#!/bin/bash

# Test the public lead generation endpoint

echo "🧪 Testing Public Lead Generation Endpoint"
echo "==========================================="
echo ""

ENDPOINT="https://sn03irrpo0.execute-api.us-east-1.amazonaws.com/prod/create-lead"

echo "Endpoint: $ENDPOINT"
echo "Method: POST"
echo ""

# Test payload (buyer lead)
PAYLOAD='{
  "leadType": "buyer",
  "hasRealtor": false,
  "contact": {
    "name": "Test User",
    "email": "test@example.com",
    "phone": "(555) 123-4567"
  },
  "location": {
    "address": "123 Main Street",
    "city": "Boston",
    "state": "MA",
    "zipCode": "02108"
  },
  "responses": {
    "priceRange": "$300,000 - $500,000",
    "bedrooms": "3",
    "bathrooms": "2",
    "propertyType": "Single Family Home",
    "buyingTimeline": "Within 3 months",
    "preApproved": true,
    "firstTimeBuyer": true
  }
}'

echo "📤 Sending test lead..."
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

# Extract status code and body
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ SUCCESS! Lead created"
  echo ""
  echo "Response:"
  echo "$BODY" | jq .
  echo ""
  echo "✅ Lead ID: $(echo "$BODY" | jq -r .leadId)"
  echo "✅ AI Score: $(echo "$BODY" | jq -r .score)/10"
  echo "✅ Price: $$(echo "$BODY" | jq -r .price)"
  echo "✅ Status: $(echo "$BODY" | jq -r .status)"
else
  echo "❌ FAILED! HTTP $HTTP_CODE"
  echo ""
  echo "Response:"
  echo "$BODY" | jq . || echo "$BODY"
fi

echo ""
echo "==========================================="
echo "Test complete!"

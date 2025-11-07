# 🔄 Backend Lambda Flow - Detailed Process Documentation

## Overview

This document details the complete backend processing flow for the Realtor Lead Platform, from lead submission through AI scoring, agent matching, and final claim.

---

## 🎯 FLOW 1: PUBLIC LEAD SUBMISSION (Direct Path)

**Entry Point**: Client submits form on public landing page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FLOW 1: PUBLIC LEAD CREATION                             │
│                      (No Authentication Required)                           │
└─────────────────────────────────────────────────────────────────────────────┘

CLIENT BROWSER
     │
     │ (1) User fills 6-step form
     │     • Lead type (buyer/seller)
     │     • Realtor check (compliance gate)
     │     • Basic info (name, email, phone)
     │     • Location (address, city, state, ZIP)
     │     • Details (timeline, budget, preferences)
     │
     ▼
┌─────────────────────────────────────┐
│   POST /create-lead                 │  ◄─── PUBLIC ENDPOINT (No Auth)
│   API Gateway                       │
└─────────────┬───────────────────────┘
              │
              │ (2) Routes to Lambda
              │
              ▼
┌──────────────────────────────────────────────────────────────────────┐
│  LAMBDA: create-lead.js                                              │
│  Runtime: Node.js 18                                                 │
│  Timeout: 30 seconds                                                 │
│  Memory: 512 MB                                                      │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  STEP 1: VALIDATE INPUT                                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ function validateLeadData(body)                            │    │
│  │   • Check required fields exist                            │    │
│  │   • Validate email format                                  │    │
│  │   • Validate phone (10 digits)                             │    │
│  │   • Validate ZIP code (5 digits)                           │    │
│  │   • Ensure leadType is "buyer" or "seller"                 │    │
│  │   • Ensure hasRealtor === false (compliance)               │    │
│  │   • Return errors array if invalid                         │    │
│  └────────────────────────────────────────────────────────────┘    │
│         │                                                            │
│         │ If invalid → Return 400 error                             │
│         ▼                                                            │
│                                                                      │
│  STEP 2: GENERATE LEAD ID                                            │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ const leadId = uuidv4()                                    │    │
│  │ const timestamp = new Date().toISOString()                 │    │
│  └────────────────────────────────────────────────────────────┘    │
│         │                                                            │
│         ▼                                                            │
│                                                                      │
│  STEP 3: GEOCODE ADDRESS                                             │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ AWS Location Service (Esri PlaceIndex)                     │    │
│  │                                                            │    │
│  │ Input:                                                     │    │
│  │   "123 Main St, Boston, MA 02108"                         │    │
│  │                                                            │    │
│  │ Output:                                                    │    │
│  │   {                                                        │    │
│  │     lat: 42.3601,                                          │    │
│  │     lng: -71.0589,                                         │    │
│  │     formattedAddress: "123 Main St, Boston, MA 02108"     │    │
│  │   }                                                        │    │
│  │                                                            │    │
│  │ Fallback: If geocoding fails, use ZIP centroid            │    │
│  └────────────────────────────────────────────────────────────┘    │
│         │                                                            │
│         ▼                                                            │
│                                                                      │
│  STEP 4: AI SCORING (1-10)                                           │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ async function calculateLeadScore(leadData)                │    │
│  │                                                            │    │
│  │ (4a) Build AI Prompt                                       │    │
│  │   • Different prompts for buyers vs sellers                │    │
│  │   • Include: timeline, budget, location, responses         │    │
│  │                                                            │    │
│  │   Example Buyer Prompt:                                    │    │
│  │   "Score this home buyer lead from 1-10 (10 best):        │    │
│  │    - Timeline: immediately                                 │    │
│  │    - Pre-approved: Yes                                     │    │
│  │    - Price range: $400k - $600k                            │    │
│  │    - Location: Boston, MA                                  │    │
│  │    Consider urgency, financial readiness, seriousness.     │    │
│  │    Return only a number 1-10."                             │    │
│  │                                                            │    │
│  │ (4b) Invoke Amazon Bedrock                                 │    │
│  │   • Model: amazon.nova-micro-v1:0                          │    │
│  │   • Temperature: 0.3 (consistent)                          │    │
│  │   • Max tokens: 100                                        │    │
│  │                                                            │    │
│  │ (4c) Parse AI Response                                     │    │
│  │   • Extract number 1-10 from response                      │    │
│  │   • Validate and constrain to range                        │    │
│  │                                                            │    │
│  │ (4d) Fallback Scoring (if AI fails)                        │    │
│  │   function calculateFallbackScore(leadData) {              │    │
│  │     let score = 5 // Base                                  │    │
│  │     if (timeline === 'immediately') score += 3             │    │
│  │     if (preApproved === true) score += 2                   │    │
│  │     if (priceRange === '$600k+') score += 1                │    │
│  │     return Math.min(score, 10)                             │    │
│  │   }                                                        │    │
│  │                                                            │    │
│  │ Return: score (integer 1-10)                               │    │
│  └────────────────────────────────────────────────────────────┘    │
│         │                                                            │
│         ▼                                                            │
│                                                                      │
│  STEP 5: CALCULATE DYNAMIC PRICING                                   │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ function calculateLeadPrice(score, leadType)               │    │
│  │   const basePrice = 80                                     │    │
│  │   const maxPrice = 150                                     │    │
│  │   const priceRange = maxPrice - basePrice                  │    │
│  │   const price = basePrice +                                │    │
│  │                 ((score - 1) / 9) * priceRange             │    │
│  │   return Math.round(price)                                 │    │
│  │                                                            │    │
│  │ Examples:                                                  │    │
│  │   Score 1  → $80                                           │    │
│  │   Score 5  → $103                                          │    │
│  │   Score 7  → $123                                          │    │
│  │   Score 10 → $150                                          │    │
│  └────────────────────────────────────────────────────────────┘    │
│         │                                                            │
│         ▼                                                            │
│                                                                      │
│  STEP 6: DETERMINE LEAD TIER                                         │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ function getTier(score) {                                  │    │
│  │   if (score >= 8) return 'premium'   // 8-10              │    │
│  │   if (score >= 5) return 'standard'  // 5-7               │    │
│  │   return 'bulk'                      // 1-4               │    │
│  │ }                                                          │    │
│  └────────────────────────────────────────────────────────────┘    │
│         │                                                            │
│         ▼                                                            │
│                                                                      │
│  STEP 7: WRITE TO DYNAMODB                                           │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ Table: RealtorLeads                                        │    │
│  │                                                            │    │
│  │ Item Structure:                                            │    │
│  │ {                                                          │    │
│  │   leadId: "uuid-12345",                                    │    │
│  │   timestamp: "2025-11-06T10:30:00.000Z",                   │    │
│  │   leadType: "buyer",                                       │    │
│  │   status: "available",                                     │    │
│  │   tier: "premium", // or "standard" or "bulk"             │    │
│  │   score: 8,                                                │    │
│  │   price: 130.00,                                           │    │
│  │   contact: {                                               │    │
│  │     name: "John Doe",                                      │    │
│  │     email: "john@example.com",                             │    │
│  │     phone: "(555) 123-4567"                                │    │
│  │   },                                                       │    │
│  │   location: {                                              │    │
│  │     address: "123 Main St",                                │    │
│  │     city: "Boston",                                        │    │
│  │     state: "MA",                                           │    │
│  │     zipCode: "02108",                                      │    │
│  │     coordinates: {                                         │    │
│  │       lat: 42.3601,                                        │    │
│  │       lng: -71.0589                                        │    │
│  │     }                                                      │    │
│  │   },                                                       │    │
│  │   responses: {                                             │    │
│  │     timeline: "immediately",                               │    │
│  │     preApproved: true,                                     │    │
│  │     priceRange: "$400k - $600k"                            │    │
│  │   },                                                       │    │
│  │   lockedBy: null,                                          │    │
│  │   lockExpiresAt: null,                                     │    │
│  │   claimedBy: null,                                         │    │
│  │   claimedAt: null,                                         │    │
│  │   aiReason: "High urgency, pre-approved buyer",           │    │
│  │   createdAt: "2025-11-06T10:30:00.000Z",                   │    │
│  │                                                            │    │
│  │   // GSI fields for querying                               │    │
│  │   statusType: "available#buyer",                           │    │
│  │   scorePrice: "08#0130"                                    │    │
│  │ }                                                          │    │
│  │                                                            │    │
│  │ PutItem with ConditionExpression to prevent duplicates     │    │
│  └────────────────────────────────────────────────────────────┘    │
│         │                                                            │
│         ▼                                                            │
│                                                                      │
│  STEP 8: BROADCAST TO AGENTS (AppSync)                               │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ AppSync GraphQL Mutation                                   │    │
│  │                                                            │    │
│  │ mutation newLeadCreated($lead: LeadInput!) {               │    │
│  │   newLeadCreated(lead: $lead) {                            │    │
│  │     leadId                                                 │    │
│  │     leadType                                               │    │
│  │     score                                                  │    │
│  │     price                                                  │    │
│  │     location { city, state }                               │    │
│  │   }                                                        │    │
│  │ }                                                          │    │
│  │                                                            │    │
│  │ All connected agents receive WebSocket update              │    │
│  │ Lead appears in Marketplace instantly                      │    │
│  └────────────────────────────────────────────────────────────┘    │
│         │                                                            │
│         ▼                                                            │
│                                                                      │
│  STEP 9: RETURN SUCCESS                                              │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ HTTP 201 Created                                           │    │
│  │ {                                                          │    │
│  │   success: true,                                           │    │
│  │   message: "Lead submitted successfully",                  │    │
│  │   data: {                                                  │    │
│  │     leadId: "uuid-12345",                                  │    │
│  │     estimatedResponse: "24 hours"                          │    │
│  │   }                                                        │    │
│  │ }                                                          │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
              │
              ▼
CLIENT SEES SUCCESS SCREEN
• "Your information has been submitted"
• "Agent will contact within 24 hours"
```

---

## 🔄 FLOW 2: STEP FUNCTIONS WORKFLOW (Alternative Path)

**Entry Point**: Admin or automated system triggers workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              FLOW 2: STEP FUNCTIONS LEAD PROCESSING                         │
│                 (Orchestrated Multi-Step Workflow)                          │
└─────────────────────────────────────────────────────────────────────────────┘

TRIGGER
  │
  │ (Admin creates lead manually, or batch import)
  │
  ▼
┌─────────────────────────────────────┐
│  AWS STEP FUNCTIONS                 │
│  LeadProcessingWorkflow             │
└─────────────┬───────────────────────┘
              │
              │
┌─────────────▼──────────────────────────────────────────────────────────────┐
│  STATE 1: LEAD INTAKE                                                      │
│  Lambda: lead-intake.ts                                                    │
│                                                                            │
│  Input:                                                                    │
│    {                                                                       │
│      leadType: "buyer",                                                    │
│      contact: {...},                                                       │
│      location: {...},                                                      │
│      responses: {...}                                                      │
│    }                                                                       │
│                                                                            │
│  Actions:                                                                  │
│    1. Validate all input fields                                            │
│    2. Generate leadId (UUID)                                               │
│    3. Geocode address via Location Service                                 │
│    4. Write to DynamoDB with status "pending"                              │
│    5. Set GSI1PK to "pending#buyer" (for tracking)                         │
│                                                                            │
│  Output:                                                                   │
│    {                                                                       │
│      leadId: "uuid-12345",                                                 │
│      leadType: "buyer",                                                    │
│      location: { lat: 42.36, lng: -71.05, ... },                          │
│      responses: {...},                                                     │
│      contact: {...}                                                        │
│    }                                                                       │
│                                                                            │
└────────────────────────────┬───────────────────────────────────────────────┘
                             │
                             │ Pass output to next state
                             │
┌────────────────────────────▼────────────────────────────────────────────────┐
│  STATE 2: AI SCORING                                                        │
│  Lambda: ai-scoring.ts                                                      │
│                                                                             │
│  Input: (from previous state)                                               │
│    { leadId, leadType, location, responses, contact }                       │
│                                                                             │
│  Actions:                                                                   │
│    1. Build AI prompt based on leadType                                     │
│       • Buyer: timeline, pre-approval, budget, urgency                      │
│       • Seller: timeline, property value, listing experience                │
│                                                                             │
│    2. Call Amazon Bedrock                                                   │
│       Model: amazon.nova-micro-v1:0                                         │
│       Input: JSON with lead details                                         │
│       Output: { lead_score: 7, reason: "..." }                              │
│                                                                             │
│    3. Calculate price                                                       │
│       price = lead_score * PRICE_PER_POINT ($10)                            │
│       Example: Score 7 → $70 base (adjusted to $80-$150 range)             │
│                                                                             │
│    4. Determine tier                                                        │
│       • 8-10 → "premium"                                                    │
│       • 5-7  → "standard"                                                   │
│       • 1-4  → "bulk"                                                       │
│                                                                             │
│    5. Update DynamoDB                                                       │
│       SET score = 7,                                                        │
│           price = 120,                                                      │
│           tier = "standard",                                                │
│           status = "scored",                                                │
│           aiReason = "Qualified buyer, 1-3 month timeline",                 │
│           GSI1PK = "scored#buyer",                                          │
│           GSI1SK = "07#0120"                                                │
│                                                                             │
│  Output:                                                                    │
│    {                                                                        │
│      leadId: "uuid-12345",                                                  │
│      leadType: "buyer",                                                     │
│      score: 7,                                                              │
│      price: 120,                                                            │
│      tier: "standard",                                                      │
│      location: { lat: 42.36, lng: -71.05, ... }                            │
│    }                                                                        │
│                                                                             │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
                             │ Pass to final state
                             │
┌────────────────────────────▼────────────────────────────────────────────────┐
│  STATE 3: AGENT MATCHING                                                    │
│  Lambda: lead-matching.ts                                                   │
│                                                                             │
│  Input: (from previous state)                                               │
│    { leadId, leadType, score, tier, location }                              │
│                                                                             │
│  Actions:                                                                   │
│    1. Query all active agents from RealtorAgents table                      │
│       Filter: status = "active" AND SK = "profile"                          │
│                                                                             │
│    2. Filter by agent preferences                                           │
│       • Check if agent accepts this leadType (buyer/seller)                 │
│       • Check if score >= agent.preferences.minScore                        │
│       • Check if price <= agent.preferences.maxPrice                        │
│                                                                             │
│    3. Calculate distance for each agent                                     │
│       • Use AWS Location Service RouteCalculator                            │
│       • Calculate miles between lead location and agent location            │
│       • Filter agents within radius (default 15 miles)                      │
│                                                                             │
│    4. Sort and match                                                        │
│       • Sort by distance (closest first)                                    │
│       • For STANDARD leads (score 5-7):                                     │
│           → Use round-robin: Get agent with oldest last assignment          │
│           → Query agent.lastAssignedAt from DynamoDB                        │
│           → Assign to agent with earliest timestamp                         │
│           → Update agent.lastAssignedAt = now                               │
│       • For PREMIUM leads (score 8-10):                                     │
│           → No auto-assignment, available in marketplace                    │
│       • For BULK leads (score 1-4):                                         │
│           → Pool for bulk purchase, no individual assignment                │
│                                                                             │
│    5. Update lead in DynamoDB                                               │
│       IF tier === "standard":                                               │
│         SET status = "assigned",                                            │
│             assignedTo = agentId,                                           │
│             assignedAt = timestamp,                                         │
│             matchedAgentCount = eligibleCount                               │
│       ELSE:                                                                 │
│         SET status = "available",                                           │
│             matchedAgentCount = eligibleCount                               │
│                                                                             │
│    6. Notify matched agent (if auto-assigned)                               │
│       • Send email via SES                                                  │
│       • Send AppSync subscription update                                    │
│       • Agent sees lead in "My Assigned Leads" dashboard                    │
│                                                                             │
│  Output:                                                                    │
│    {                                                                        │
│      leadId: "uuid-12345",                                                  │
│      status: "assigned" | "available",                                      │
│      matchedAgents: [                                                       │
│        {                                                                    │
│          agentId: "agent-abc",                                              │
│          agentName: "Jane Smith",                                           │
│          distance: 8.3,                                                     │
│          email: "jane@realty.com"                                           │
│        }                                                                    │
│      ],                                                                     │
│      assignedTo: "agent-abc" // (if auto-assigned)                          │
│    }                                                                        │
│                                                                             │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
                             ▼
                      WORKFLOW COMPLETE
                             │
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  POST-WORKFLOW ACTIONS                                                       │
│                                                                              │
│  • Lead is now in marketplace (if premium)                                   │
│  • Lead is assigned to agent (if standard)                                   │
│  • Lead is in bulk pool (if bulk)                                            │
│  • All connected agents notified via AppSync                                 │
│  • CloudWatch logs capture full workflow                                     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 💰 FLOW 3: AGENT LEAD PURCHASE (PREMIUM LEADS)

**Entry Point**: Agent browses marketplace and clicks "Buy Lead"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                FLOW 3: AGENT PURCHASES PREMIUM LEAD                         │
│               (First-Come, First-Serve Marketplace)                         │
└─────────────────────────────────────────────────────────────────────────────┘

AGENT DASHBOARD
     │
     │ (1) Agent navigates to Marketplace
     │     GET /marketplace?minScore=8&leadType=buyer
     │
     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  LAMBDA: marketplace.ts                                                      │
│                                                                              │
│  Query DynamoDB:                                                             │
│    • Use GSI: StatusTypeIndex                                                │
│    • PK: "available#buyer"                                                   │
│    • SK: begins_with("08#") // Scores 8-10                                   │
│    • FilterExpression: status = "available" AND claimedBy = NULL             │
│    • Sort by score DESC (highest first)                                      │
│                                                                              │
│  Return:                                                                     │
│    [                                                                         │
│      {                                                                       │
│        leadId: "lead-001",                                                   │
│        score: 10,                                                            │
│        price: 150,                                                           │
│        location: { city: "Boston", state: "MA" },                            │
│        timeline: "immediately",                                              │
│        aiReason: "Perfect buyer - pre-approved, immediate"                   │
│      },                                                                      │
│      { ... }                                                                 │
│    ]                                                                         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
     │
     │ (2) Agent sees leads, clicks "Buy Lead" on lead-001
     │     POST /leads/lock
     │     { leadId: "lead-001", agentId: "agent-123" }
     │
     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  LAMBDA: lock-lead.js                                                        │
│                                                                              │
│  STEP 1: ATOMIC LOCK (Prevents double-purchase)                              │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ DynamoDB UpdateItem with ConditionExpression:                  │         │
│  │                                                                │         │
│  │ UPDATE RealtorLeads                                            │         │
│  │ SET lockedBy = :agentId,                                       │         │
│  │     lockExpiresAt = :expiryTime, // 15 seconds from now        │         │
│  │     status = "locked"                                          │         │
│  │ WHERE leadId = :leadId                                         │         │
│  │   AND timestamp = :timestamp                                   │         │
│  │   AND (lockedBy IS NULL OR lockExpiresAt < :now)              │         │
│  │   AND claimedBy IS NULL                                        │         │
│  │                                                                │         │
│  │ If condition fails → Another agent already locked it!          │         │
│  │ Return 409 Conflict                                            │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  STEP 2: BROADCAST LOCK (Real-time notification)                             │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ AppSync Mutation: onLeadLocked                                 │         │
│  │                                                                │         │
│  │ All other agents see:                                          │         │
│  │   "This lead is locked by Agent Jane Smith"                    │         │
│  │   [15 second countdown timer]                                  │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  Return 200 Success:                                                         │
│    {                                                                         │
│      success: true,                                                          │
│      lockExpiresAt: "2025-11-06T10:30:15Z",                                  │
│      message: "Lead locked for 15 seconds"                                   │
│    }                                                                         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
     │
     │ (3) Frontend opens Stripe payment modal
     │     Amount: $150
     │     Agent enters card info
     │
     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND: Stripe.js                                                         │
│                                                                              │
│  • Collect payment method (card details)                                     │
│  • Create payment intent with Stripe API                                     │
│  • Get paymentIntentId                                                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
     │
     │ (4) Send payment to backend
     │     POST /payments/purchase
     │     {                                                                    │
     │       leadId: "lead-001",                                                │
     │       agentId: "agent-123",                                              │
     │       paymentIntentId: "pi_abc123",                                      │
     │       amount: 150                                                        │
     │     }                                                                    │
     │
     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  LAMBDA: payment.ts                                                          │
│                                                                              │
│  STEP 1: VERIFY LOCK                                                         │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ Query DynamoDB:                                                │         │
│  │   • Check if lead is locked by this agent                      │         │
│  │   • Check if lock has not expired                              │         │
│  │   • Return 403 if invalid                                      │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  STEP 2: CONFIRM STRIPE PAYMENT                                              │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ Stripe API:                                                    │         │
│  │   stripe.paymentIntents.confirm(paymentIntentId)               │         │
│  │                                                                │         │
│  │ If payment fails → Release lock, return error                  │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  STEP 3: CREATE TRANSACTION RECORD                                           │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ DynamoDB PutItem to RealtorTransactions:                       │         │
│  │ {                                                              │         │
│  │   transactionId: "txn-uuid",                                   │         │
│  │   timestamp: "2025-11-06T10:30:20Z",                           │         │
│  │   agentId: "agent-123",                                        │         │
│  │   leadId: "lead-001",                                          │         │
│  │   amount: 150.00,                                              │         │
│  │   stripeChargeId: "ch_abc123",                                 │         │
│  │   status: "completed",                                         │         │
│  │   metadata: { score: 10, tier: "premium" }                     │         │
│  │ }                                                              │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  STEP 4: CLAIM LEAD                                                          │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ Call claim-lead Lambda internally                              │         │
│  │   OR                                                           │         │
│  │ Direct DynamoDB update:                                        │         │
│  │   SET status = "claimed",                                      │         │
│  │       claimedBy = :agentId,                                    │         │
│  │       claimedAt = :timestamp,                                  │         │
│  │       lockedBy = NULL,                                         │         │
│  │       lockExpiresAt = NULL                                     │         │
│  │   WHERE leadId = :leadId                                       │         │
│  │     AND lockedBy = :agentId // Still owned by this agent       │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  STEP 5: BROADCAST CLAIM                                                     │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ AppSync Mutation: onLeadClaimed                                │         │
│  │                                                                │         │
│  │ All agents see:                                                │         │
│  │   "This lead has been purchased"                               │         │
│  │   [Lead removed from marketplace]                              │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  STEP 6: RETURN LEAD DETAILS TO AGENT                                        │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ HTTP 200 Success:                                              │         │
│  │ {                                                              │         │
│  │   success: true,                                               │         │
│  │   message: "Lead purchased successfully",                      │         │
│  │   lead: {                                                      │         │
│  │     leadId: "lead-001",                                        │         │
│  │     contact: {                                                 │         │
│  │       name: "John Doe",             ← NOW VISIBLE              │         │
│  │       email: "john@example.com",    ← NOW VISIBLE              │         │
│  │       phone: "(555) 123-4567"       ← NOW VISIBLE              │         │
│  │     },                                                         │         │
│  │     location: {...},                                           │         │
│  │     responses: {...}                                           │         │
│  │   }                                                            │         │
│  │ }                                                              │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
     │
     │ (5) Agent sees success screen with contact info
     │     Lead appears in "My Purchased Leads" dashboard
     │     Agent can now contact client
     │
     ▼
COMPLETE - AGENT CALLS CLIENT
```

---

## 🔄 FLOW 4: ROUND-ROBIN ASSIGNMENT (STANDARD LEADS)

**Entry Point**: Lead scored 5-7 by AI, triggers auto-assignment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│             FLOW 4: ROUND-ROBIN AUTO-ASSIGNMENT                             │
│                  (Standard Leads, Score 5-7)                                │
└─────────────────────────────────────────────────────────────────────────────┘

TRIGGER: Lead scored as "standard" (score 5-7)
     │
     │ From: ai-scoring Lambda or create-lead Lambda
     │
     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  LAMBDA: lead-matching.ts (called by Step Functions or directly)            │
│                                                                              │
│  Input:                                                                      │
│    {                                                                         │
│      leadId: "lead-456",                                                     │
│      leadType: "seller",                                                     │
│      score: 6,                                                               │
│      tier: "standard",                                                       │
│      location: { lat: 34.05, lng: -118.24, city: "Los Angeles" }            │
│    }                                                                         │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: FETCH ACTIVE AGENTS                                                 │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ Query RealtorAgents table:                                     │         │
│  │   FilterExpression: status = "active" AND SK = "profile"       │         │
│  │                                                                │         │
│  │ Returns: [                                                     │         │
│  │   {                                                            │         │
│  │     agentId: "agent-A",                                        │         │
│  │     location: { lat: 34.06, lng: -118.23 },                   │         │
│  │     preferences: {                                             │         │
│  │       leadTypes: ["buyer", "seller"],                          │         │
│  │       minScore: 4,                                             │         │
│  │       maxPrice: 100,                                           │         │
│  │       radius: 20                                               │         │
│  │     },                                                         │         │
│  │     lastAssignedAt: "2025-11-06T09:00:00Z"                     │         │
│  │   },                                                           │         │
│  │   { agentId: "agent-B", lastAssignedAt: "2025-11-06T08:30:00Z" },       │
│  │   { agentId: "agent-C", lastAssignedAt: "2025-11-06T10:00:00Z" },       │
│  │   ...                                                          │         │
│  │ ]                                                              │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  STEP 2: FILTER BY PREFERENCES                                               │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ For each agent:                                                │         │
│  │   1. Check leadType: "seller" in agent.preferences.leadTypes   │         │
│  │   2. Check minScore: 6 >= agent.preferences.minScore (4)       │         │
│  │   3. Calculate price: 6 * $10 = $60                            │         │
│  │      Check: $60 <= agent.preferences.maxPrice ($100) ✓         │         │
│  │                                                                │         │
│  │ Eligible agents after filter:                                  │         │
│  │   [agent-A, agent-B, agent-C] // All match criteria            │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  STEP 3: CALCULATE DISTANCES                                                 │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ AWS Location Service - CalculateRoute                          │         │
│  │                                                                │         │
│  │ For each agent:                                                │         │
│  │   • Distance from lead (34.05, -118.24) to agent location      │         │
│  │                                                                │         │
│  │ Results:                                                       │         │
│  │   agent-A: 1.2 miles ✓ (within 20-mile radius)                │         │
│  │   agent-B: 5.8 miles ✓                                         │         │
│  │   agent-C: 3.4 miles ✓                                         │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  STEP 4: ROUND-ROBIN SELECTION                                               │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ Algorithm:                                                     │         │
│  │   1. Sort eligible agents by lastAssignedAt (oldest first)     │         │
│  │                                                                │         │
│  │   Sorted:                                                      │         │
│  │     agent-B: 08:30:00 ← OLDEST (select this one!)             │         │
│  │     agent-A: 09:00:00                                          │         │
│  │     agent-C: 10:00:00                                          │         │
│  │                                                                │         │
│  │   2. Assign lead to agent-B                                    │         │
│  │   3. Update agent-B.lastAssignedAt = NOW                       │         │
│  │                                                                │         │
│  │ This ensures fair distribution over time!                      │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  STEP 5: ASSIGN LEAD                                                         │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ DynamoDB UpdateItem (RealtorLeads):                            │         │
│  │   SET status = "assigned",                                     │         │
│  │       assignedTo = "agent-B",                                  │         │
│  │       assignedAt = "2025-11-06T10:30:00Z",                     │         │
│  │       matchedAgentCount = 3                                    │         │
│  │   WHERE leadId = "lead-456"                                    │         │
│  │     AND status = "available" // Prevent double-assignment      │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  STEP 6: UPDATE AGENT RECORD                                                 │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ DynamoDB UpdateItem (RealtorAgents):                           │         │
│  │   SET lastAssignedAt = "2025-11-06T10:30:00Z",                 │         │
│  │       stats.totalAssigned = stats.totalAssigned + 1            │         │
│  │   WHERE agentId = "agent-B"                                    │         │
│  │     AND SK = "profile"                                         │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  STEP 7: NOTIFY AGENT                                                        │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ (a) AppSync Subscription                                       │         │
│  │     onLeadAssigned(agentId: "agent-B") {                       │         │
│  │       leadId, score, price, location                           │         │
│  │     }                                                          │         │
│  │     → Agent-B's dashboard updates instantly                    │         │
│  │                                                                │         │
│  │ (b) Email Notification (AWS SES)                               │         │
│  │     To: agent-B@realty.com                                     │         │
│  │     Subject: "New Lead Assigned - Seller in Los Angeles"       │         │
│  │     Body: "You've been assigned a new lead (Score 6)..."       │         │
│  │                                                                │         │
│  │ (c) SMS Notification (AWS SNS) [Optional]                      │         │
│  │     "New lead assigned! Check dashboard."                      │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  Return:                                                                     │
│    {                                                                         │
│      success: true,                                                          │
│      leadId: "lead-456",                                                     │
│      assignedTo: "agent-B",                                                  │
│      message: "Lead assigned to Agent Bob Smith"                             │
│    }                                                                         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
     │
     │ Agent-B logs into dashboard
     │
     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  AGENT DASHBOARD                                                             │
│                                                                              │
│  "My Assigned Leads" tab shows:                                              │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────┐             │
│  │ 🏠 NEW LEAD ASSIGNED                                       │             │
│  │                                                            │             │
│  │ Type: Seller                                               │             │
│  │ Score: 6/10 ⭐⭐⭐⭐⭐⭐                                        │             │
│  │ Location: Los Angeles, CA                                  │             │
│  │ Timeline: 1-3 months                                       │             │
│  │                                                            │             │
│  │ Contact: John Seller                                       │             │
│  │ Phone: (555) 987-6543                                      │             │
│  │ Email: john.seller@example.com                             │             │
│  │                                                            │             │
│  │ [Contact Now] [Mark Complete]                              │             │
│  └────────────────────────────────────────────────────────────┘             │
│                                                                              │
│  Agent can immediately contact the client - NO PAYMENT REQUIRED!             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔒 FLOW 5: LOCK CLEANUP (Automated Background Process)

**Trigger**: EventBridge runs every 1 minute

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 FLOW 5: AUTOMATIC LOCK CLEANUP                              │
│              (Prevents Abandoned Locks from Blocking Leads)                 │
└─────────────────────────────────────────────────────────────────────────────┘

AMAZON EVENTBRIDGE
     │
     │ Cron: Every 1 minute
     │ Rule: CleanupExpiredLocksRule
     │
     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  LAMBDA: cleanup-expired-locks.js                                            │
│  Runtime: Node.js 18                                                         │
│  Timeout: 60 seconds                                                         │
│                                                                              │
│  STEP 1: SCAN FOR EXPIRED LOCKS                                              │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ DynamoDB Query:                                                │         │
│  │   • Scan RealtorLeads table                                    │         │
│  │   • FilterExpression:                                          │         │
│  │       status = "locked"                                        │         │
│  │       AND lockExpiresAt < :currentTimestamp                    │         │
│  │       AND claimedBy IS NULL                                    │         │
│  │                                                                │         │
│  │ Returns expired locks:                                         │         │
│  │   [                                                            │         │
│  │     {                                                          │         │
│  │       leadId: "lead-789",                                      │         │
│  │       lockedBy: "agent-X",                                     │         │
│  │       lockExpiresAt: 1730896200, // 30 seconds ago             │         │
│  │       status: "locked"                                         │         │
│  │     }                                                          │         │
│  │   ]                                                            │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  STEP 2: RELEASE EACH EXPIRED LOCK                                           │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ For each expired lead:                                         │         │
│  │                                                                │         │
│  │   DynamoDB UpdateItem:                                         │         │
│  │     SET status = "available",                                  │         │
│  │         lockedBy = NULL,                                       │         │
│  │         lockExpiresAt = NULL                                   │         │
│  │     WHERE leadId = :leadId                                     │         │
│  │       AND lockExpiresAt = :expiredTime                         │         │
│  │       AND claimedBy IS NULL // Don't unlock claimed leads      │         │
│  │                                                                │         │
│  │   Log: "Released lock for lead-789 (was locked by agent-X)"   │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  STEP 3: BROADCAST UPDATES                                                   │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ For each released lead:                                        │         │
│  │                                                                │         │
│  │   AppSync Mutation: onLeadUnlocked                             │         │
│  │   Variables: { leadId: "lead-789" }                            │         │
│  │                                                                │         │
│  │   All connected agents see:                                    │         │
│  │     "Lead is now available again"                              │         │
│  │     [Lock indicator removed]                                   │         │
│  │     [Buy button re-enabled]                                    │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  STEP 4: LOG METRICS                                                         │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ CloudWatch Metrics:                                            │         │
│  │   • ExpiredLocksReleased: count                                │         │
│  │   • LockCleanupDuration: milliseconds                          │         │
│  │                                                                │         │
│  │ CloudWatch Logs:                                               │         │
│  │   "Cleanup complete: Released 3 expired locks"                 │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  Return:                                                                     │
│    {                                                                         │
│      statusCode: 200,                                                        │
│      body: {                                                                 │
│        message: "Cleanup complete",                                          │
│        releasedCount: 3                                                      │
│      }                                                                       │
│    }                                                                         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
     │
     │ Next run in 1 minute...
     │
     ▼
CONTINUOUS MONITORING

Alternative: DynamoDB TTL
┌──────────────────────────────────────────────────────────────────────────────┐
│  DynamoDB TTL (Time To Live)                                                 │
│                                                                              │
│  • Attribute: lockExpiresAt (epoch timestamp)                                │
│  • DynamoDB automatically deletes expired items                              │
│  • Pros: No Lambda cost, automatic                                           │
│  • Cons: No AppSync notifications, up to 48-hour delay                       │
│                                                                              │
│  Hybrid Approach (Recommended):                                              │
│    • Use EventBridge Lambda for immediate cleanup + notifications            │
│    • Enable TTL as backup for missed items                                   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Flow Summary

| Flow | Trigger | Path | Authentication | Result |
|------|---------|------|----------------|--------|
| **1. Public Lead Submission** | Client form submit | Direct to create-lead Lambda | None (public) | Lead created, scored, available in marketplace |
| **2. Step Functions Workflow** | Admin/batch import | Intake → Scoring → Matching | Admin only | Lead processed through orchestrated workflow |
| **3. Agent Purchase** | Agent clicks "Buy" | Lock → Payment → Claim | Cognito JWT (Agent) | Agent purchases premium lead |
| **4. Round-Robin Assignment** | Standard lead scored | Auto-triggered matching | System (internal) | Lead auto-assigned to fair agent |
| **5. Lock Cleanup** | EventBridge schedule | Every 1 minute scan | System (internal) | Expired locks released |

---

## 🔑 Key Design Principles

1. **Atomic Operations**: All lead claims use DynamoDB conditional writes to prevent double-selling
2. **Real-time Updates**: AppSync subscriptions keep all agents in sync
3. **Fairness**: Round-robin ensures equal distribution of standard leads
4. **Performance**: GSI indexes enable fast marketplace queries
5. **Scalability**: Serverless architecture scales automatically
6. **Cost Optimization**: Pay-per-use pricing for all services
7. **Security**: Cognito auth for agents, public endpoint for clients
8. **Observability**: CloudWatch logs and metrics for all operations

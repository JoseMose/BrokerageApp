# 🏗️ Realtor Lead Platform - Complete Architecture

## 📊 System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           AWS REALTOR LEAD PLATFORM                              │
│                     AI-Powered Lead Scoring & Distribution                       │
└─────────────────────────────────────────────────────────────────────────────────┘

                                   INTERNET
                                      │
                  ┌───────────────────┴───────────────────┐
                  │                                       │
          ┌───────▼────────┐                    ┌────────▼──────────┐
          │   PUBLIC WEB   │                    │   AGENT PORTAL    │
          │   (Clients)    │                    │   (Realtors)      │
          └───────┬────────┘                    └────────┬──────────┘
                  │                                      │
                  │ Lead Submission                      │ Auth Required
                  │ (No Auth)                            │
                  │                                      │
    ┌─────────────▼──────────────────────────────────────▼─────────────────┐
    │                      AWS AMPLIFY HOSTING                              │
    │  ┌────────────────────────────────────────────────────────────────┐  │
    │  │         REACT FRONTEND (JavaScript)                            │  │
    │  │  • LandingPage.jsx (Public)                                    │  │
    │  │  • LeadForm.jsx (6-step multi-step form)                       │  │
    │  │  • Dashboard.jsx (Protected - Agent)                           │  │
    │  │  • Marketplace.jsx (Protected - Agent)                         │  │
    │  │  • AdminDashboard.jsx (Protected - Admin)                      │  │
    │  └────────────────────────────────────────────────────────────────┘  │
    └────────────────────────────────────┬───────────────────────────────────┘
                                         │
                    ┌────────────────────┴────────────────────┐
                    │                                         │
                    │                                         │
         ┌──────────▼──────────┐                 ┌───────────▼──────────────┐
         │ AWS API GATEWAY     │                 │   AWS APPSYNC (GraphQL)  │
         │                     │                 │                          │
         │ REST Endpoints:     │                 │  • Real-time subscriptions│
         │ • /create-lead      │                 │  • Lead lock/unlock      │
         │   (PUBLIC)          │                 │  • WebSocket updates     │
         │ • /leads            │                 │                          │
         │ • /marketplace      │                 │                          │
         │ • /payments         │                 │                          │
         │ • /agents           │                 │                          │
         │ • /admin            │                 │                          │
         └──────────┬──────────┘                 └───────────┬──────────────┘
                    │                                        │
                    │ Cognito JWT                            │ Cognito JWT
                    │ Authorization                          │ Authorization
                    │                                        │
         ┌──────────▼──────────────────────────────────────────────────────┐
         │                    AWS COGNITO USER POOLS                       │
         │  • Realtor Agents (Group: Agents)                               │
         │  • Platform Admins (Group: Admins)                              │
         │  • Email/Password Auth + MFA                                    │
         │  • Custom Attributes: role, licenseId, brokerage                │
         └──────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════
                            BACKEND PROCESSING LAYER
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│                          AWS LAMBDA FUNCTIONS                               │
│                           (Node.js 18 Runtime)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────┐      ┌────────────────────────┐                │
│  │ 1. create-lead.js     │      │ 2. lead-intake.ts      │                │
│  │    (PUBLIC)           │      │    (Step Functions)    │                │
│  │                       │      │                        │                │
│  │ • Validate form       │      │ • Validate lead data   │                │
│  │ • Geocode address     │      │ • Create pending lead  │                │
│  │ • AI score (1-10)     │      │ • Trigger workflow     │                │
│  │ • Calculate price     │      │                        │                │
│  │ • Write to DynamoDB   │      └────────────────────────┘                │
│  │ • Broadcast to agents │                                                │
│  └───────────────────────┘      ┌────────────────────────┐                │
│                                  │ 3. ai-scoring.ts       │                │
│  ┌───────────────────────┐      │    (Step Functions)    │                │
│  │ 4. lead-matching.ts   │      │                        │                │
│  │    (Step Functions)   │      │ • Bedrock Nova Micro   │                │
│  │                       │      │ • Score 1-10           │                │
│  │ • Find nearby agents  │      │ • Calculate price      │                │
│  │ • Filter by prefs     │      │ • Update DynamoDB      │                │
│  │ • Round-robin logic   │      │ • Set tier (premium/   │                │
│  │ • Distance calc       │      │   standard/bulk)       │                │
│  └───────────────────────┘      └────────────────────────┘                │
│                                                                             │
│  ┌───────────────────────┐      ┌────────────────────────┐                │
│  │ 5. marketplace.ts     │      │ 6. payment.ts          │                │
│  │    (API Gateway)      │      │    (API Gateway)       │                │
│  │                       │      │                        │                │
│  │ • Query available     │      │ • Stripe integration   │                │
│  │   leads               │      │ • Process payments     │                │
│  │ • Filter by score     │      │ • Create transactions  │                │
│  │ • Filter by location  │      │ • Atomic lead claim    │                │
│  │ • Sort by price       │      │ • Send confirmations   │                │
│  └───────────────────────┘      └────────────────────────┘                │
│                                                                             │
│  ┌───────────────────────┐      ┌────────────────────────┐                │
│  │ 7. lock-lead.js       │      │ 8. unlock-lead.js      │                │
│  │    (API Gateway)      │      │    (API Gateway)       │                │
│  │                       │      │                        │                │
│  │ • Atomic lock (15s)   │      │ • Release lock         │                │
│  │ • DynamoDB condition  │      │ • Broadcast update     │                │
│  │ • Broadcast update    │      │                        │                │
│  └───────────────────────┘      └────────────────────────┘                │
│                                                                             │
│  ┌───────────────────────┐      ┌────────────────────────┐                │
│  │ 9. claim-lead.js      │      │ 10. cleanup-expired-   │                │
│  │    (API Gateway)      │      │     locks.js           │                │
│  │                       │      │    (EventBridge)       │                │
│  │ • Finalize purchase   │      │                        │                │
│  │ • Mark as claimed     │      │ • Scan expired locks   │                │
│  │ • Update transactions │      │ • Auto-release         │                │
│  │ • Notify agent        │      │ • Runs every 1 min     │                │
│  └───────────────────────┘      └────────────────────────┘                │
│                                                                             │
│  ┌───────────────────────┐      ┌────────────────────────┐                │
│  │ 11. agent-management  │      │ 12. admin.ts           │                │
│  │     .ts               │      │     (API Gateway)      │                │
│  │    (API Gateway)      │      │                        │                │
│  │                       │      │ • Platform analytics   │                │
│  │ • CRUD agent profiles │      │ • Lead distribution    │                │
│  │ • Update preferences  │      │ • Revenue reports      │                │
│  │ • Manage locations    │      │ • Agent performance    │                │
│  └───────────────────────┘      └────────────────────────┘                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════
                       AWS STEP FUNCTIONS ORCHESTRATION
═══════════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│              LEAD PROCESSING WORKFLOW (Step Functions)                      │
│                                                                             │
│   ┌─────────────┐         ┌──────────────┐         ┌──────────────┐       │
│   │   START     │────────▶│  Score Lead  │────────▶│ Match Agents │       │
│   │  (Trigger)  │         │  (Lambda)    │         │  (Lambda)    │       │
│   └─────────────┘         └──────────────┘         └──────────────┘       │
│         │                        │                        │                │
│         │                        │                        ▼                │
│         │                        │                  ┌──────────────┐       │
│         │                        │                  │   SUCCESS    │       │
│         │                        │                  │  Lead Ready  │       │
│         │                        │                  └──────────────┘       │
│         │                        │                                         │
│         │                        ▼                                         │
│         │                  [ AI Scoring ]                                  │
│         │                  • Amazon Bedrock                                │
│         │                  • Nova Micro Model                              │
│         │                  • 1-10 score                                    │
│         │                  • Pricing calc                                  │
│         │                                                                  │
│         ▼                                                                  │
│   [ Lead Intake ]                                                          │
│   • Validation                                                             │
│   • Geocoding                                                              │
│   • DynamoDB write                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════
                           DATA STORAGE & AI SERVICES
═══════════════════════════════════════════════════════════════════════════════

┌──────────────────────────────────────────────────────────────────────────────┐
│                       AMAZON DYNAMODB TABLES                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ RealtorLeads Table                                             │         │
│  │ PK: leadId (UUID)                                              │         │
│  │ SK: timestamp (ISO-8601)                                       │         │
│  │                                                                │         │
│  │ Attributes:                                                    │         │
│  │  • leadType: "buyer" | "seller"                                │         │
│  │  • status: "available" | "locked" | "claimed" | "expired"      │         │
│  │  • score: 1-10 (integer)                                       │         │
│  │  • price: $10-$150 (float)                                     │         │
│  │  • tier: "premium" | "standard" | "bulk"                       │         │
│  │  • contact: { name, email, phone }                             │         │
│  │  • location: { address, city, state, zipCode, lat, lng }      │         │
│  │  • responses: { timeline, budget, etc }                        │         │
│  │  • lockedBy: agentId | null                                    │         │
│  │  • lockExpiresAt: epoch timestamp (TTL enabled)                │         │
│  │  • claimedBy: agentId | null                                   │         │
│  │  • claimedAt: timestamp | null                                 │         │
│  │  • aiReason: string (scoring explanation)                      │         │
│  │  • createdAt: timestamp                                        │         │
│  │                                                                │         │
│  │ GSI1: StatusTypeIndex                                          │         │
│  │  • PK: statusType (e.g., "available#buyer")                    │         │
│  │  • SK: scorePrice (e.g., "09#0120" for score 9, $120)         │         │
│  │  • Used for: Marketplace queries by status/type/score          │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ RealtorAgents Table                                            │         │
│  │ PK: agentId (UUID)                                             │         │
│  │ SK: "profile" | "stats#YYYY-MM"                                │         │
│  │                                                                │         │
│  │ Attributes:                                                    │         │
│  │  • email: string (unique)                                      │         │
│  │  • name: string                                                │         │
│  │  • phone: string                                               │         │
│  │  • licenseId: string                                           │         │
│  │  • brokerage: string                                           │         │
│  │  • status: "active" | "inactive" | "suspended"                 │         │
│  │  • preferences: {                                              │         │
│  │      leadTypes: ["buyer", "seller"],                           │         │
│  │      minScore: 5,                                              │         │
│  │      maxPrice: 150,                                            │         │
│  │      radius: 15                                                │         │
│  │    }                                                           │         │
│  │  • location: { city, state, zipCode, lat, lng }               │         │
│  │  • stats: { totalPurchased, totalSpent, avgScore }            │         │
│  │  • createdAt: timestamp                                        │         │
│  │                                                                │         │
│  │ GSI: EmailIndex                                                │         │
│  │  • PK: email                                                   │         │
│  │  • Used for: Login and profile lookups                         │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────┐         │
│  │ RealtorTransactions Table                                      │         │
│  │ PK: transactionId (UUID)                                       │         │
│  │ SK: timestamp (ISO-8601)                                       │         │
│  │                                                                │         │
│  │ Attributes:                                                    │         │
│  │  • agentId: string                                             │         │
│  │  • leadId: string                                              │         │
│  │  • amount: float ($)                                           │         │
│  │  • stripeChargeId: string                                      │         │
│  │  • status: "pending" | "completed" | "refunded"                │         │
│  │  • metadata: object                                            │         │
│  │  • createdAt: timestamp                                        │         │
│  │                                                                │         │
│  │ GSI: AgentTransactionsIndex                                    │         │
│  │  • PK: agentId                                                 │         │
│  │  • SK: timestamp                                               │         │
│  │  • Used for: Purchase history queries                          │         │
│  └────────────────────────────────────────────────────────────────┘         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                        AI & GEOLOCATION SERVICES                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────┐                               │
│  │ AMAZON BEDROCK                           │                               │
│  │ • Model: amazon.nova-micro-v1:0          │                               │
│  │ • Fallback: claude-3-sonnet              │                               │
│  │ • Purpose: AI lead scoring (1-10)        │                               │
│  │ • Input: Lead data (timeline, budget,    │                               │
│  │          location, responses)            │                               │
│  │ • Output: Score + reasoning              │                               │
│  └──────────────────────────────────────────┘                               │
│                                                                              │
│  ┌──────────────────────────────────────────┐                               │
│  │ AWS LOCATION SERVICE                     │                               │
│  │ • PlaceIndex: Esri data source           │                               │
│  │ • Purpose: Geocoding addresses           │                               │
│  │ • RouteCalculator: Distance calculations │                               │
│  │ • Radius matching for agent assignment   │                               │
│  └──────────────────────────────────────────┘                               │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════
                     EVENT-DRIVEN ARCHITECTURE & MONITORING
═══════════════════════════════════════════════════════════════════════════════

┌──────────────────────────────────────────────────────────────────────────────┐
│                    AMAZON EVENTBRIDGE RULES                                  │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │ CleanupExpiredLocksRule                                     │            │
│  │ • Schedule: Every 1 minute (cron)                           │            │
│  │ • Target: cleanup-expired-locks Lambda                      │            │
│  │ • Purpose: Auto-release expired lead locks                  │            │
│  └─────────────────────────────────────────────────────────────┘            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                      CLOUDWATCH MONITORING                                   │
│                                                                              │
│  • Lambda execution logs (1 week retention)                                 │
│  • API Gateway access logs                                                  │
│  • DynamoDB read/write metrics                                              │
│  • Alarms:                                                                  │
│    - Lambda errors > 10 in 1 minute                                         │
│    - API 4XX errors > 50 in 2 minutes                                       │
│    - API 5XX errors > 10 in 1 minute                                        │
│  • SNS topic for alarm notifications                                        │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════
                           SECURITY & COMPLIANCE
═══════════════════════════════════════════════════════════════════════════════

┌──────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY LAYERS                                      │
│                                                                              │
│  1. PUBLIC ENDPOINTS (No Auth)                                               │
│     • /create-lead - Lead form submission                                    │
│     • Rate limiting via API Gateway                                          │
│     • CORS configured for frontend domain                                    │
│     • Input validation & sanitization                                        │
│                                                                              │
│  2. PROTECTED ENDPOINTS (Cognito JWT)                                        │
│     • /marketplace - View available leads                                    │
│     • /leads/lock - Lock lead for purchase                                   │
│     • /leads/claim - Finalize lead purchase                                  │
│     • /payments - Stripe payment processing                                  │
│     • /agents - Agent profile management                                     │
│                                                                              │
│  3. ADMIN ENDPOINTS (Cognito JWT + Admin Group)                              │
│     • /admin - Platform analytics & management                               │
│     • Restricted to users in "Admins" group                                  │
│                                                                              │
│  4. DATA PROTECTION                                                          │
│     • DynamoDB encryption at rest                                            │
│     • S3 encryption for logs                                                 │
│     • Point-in-time recovery enabled                                         │
│     • Versioned backups                                                      │
│                                                                              │
│  5. COMPLIANCE FEATURES                                                      │
│     • Realtor check modal - prevents tortious interference                   │
│     • Atomic lead claims - prevents double-selling                           │
│     • Audit trail in transactions table                                      │
│     • GDPR-ready data structure                                              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════
                        PRICING & DISTRIBUTION MODEL
═══════════════════════════════════════════════════════════════════════════════

┌──────────────────────────────────────────────────────────────────────────────┐
│                    LEAD TIERS & PRICING STRUCTURE                            │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────┐             │
│  │ PREMIUM LEADS (Score 8-10)                                 │             │
│  │ • Price: $80 - $150 per lead                               │             │
│  │ • Distribution: First-come, first-serve marketplace        │             │
│  │ • Visibility: All agents in area                           │             │
│  │ • Lock time: 15 seconds for payment                        │             │
│  │ • Characteristics:                                         │             │
│  │   - Immediate timeline                                     │             │
│  │   - Pre-approved (buyers)                                  │             │
│  │   - High budget/value                                      │             │
│  │   - Complete information                                   │             │
│  └────────────────────────────────────────────────────────────┘             │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────┐             │
│  │ STANDARD LEADS (Score 5-7)                                 │             │
│  │ • Price: $50 - $79 per lead                                │             │
│  │ • Distribution: Round-robin to matched agents              │             │
│  │ • Auto-assignment based on:                                │             │
│  │   - Agent location (within radius)                         │             │
│  │   - Agent preferences (lead type, min score)               │             │
│  │   - Fair rotation algorithm                                │             │
│  │ • Characteristics:                                         │             │
│  │   - 1-3 month timeline                                     │             │
│  │   - Qualified but not urgent                               │             │
│  │   - Realistic budget                                       │             │
│  └────────────────────────────────────────────────────────────┘             │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────┐             │
│  │ BULK LEADS (Score 1-4)                                     │             │
│  │ • Price: $10 - $40 per lead                                │             │
│  │ • Distribution: Bulk packages (50-100 leads)               │             │
│  │ • Volume discount: ~70% off                                │             │
│  │ • Best for: Cold outreach campaigns                        │             │
│  │ • Characteristics:                                         │             │
│  │   - 6+ month timeline                                      │             │
│  │   - Exploratory phase                                      │             │
│  │   - May need nurturing                                     │             │
│  └────────────────────────────────────────────────────────────┘             │
│                                                                              │
│  PRICING FORMULA:                                                            │
│  • Base: $10 per point                                                       │
│  • Score 1 = $10                                                             │
│  • Score 10 = $150 (with premium markup)                                     │
│  • Linear scaling between scores                                             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════
                             DATA FLOW SUMMARY
═══════════════════════════════════════════════════════════════════════════════

CLIENT SUBMISSION:
1. Client fills form on LandingPage → POST /create-lead
2. Lambda validates, geocodes, scores with AI (1-10)
3. Lead written to DynamoDB with status "available"
4. AppSync broadcasts to all connected agents
5. Client sees success screen

AGENT PURCHASE (PREMIUM LEADS):
1. Agent views Marketplace → GET /marketplace
2. Agent clicks "Buy Lead" → POST /leads/lock
3. 15-second lock created (atomic DynamoDB write)
4. Agent completes Stripe payment → POST /payments/purchase
5. Payment success → POST /leads/claim
6. Lead marked "claimed", agent receives contact info

AGENT ASSIGNMENT (STANDARD LEADS):
1. Step Function triggers lead-matching Lambda
2. Lambda queries agents within radius
3. Filters by preferences (lead type, min score, max price)
4. Round-robin assignment to next eligible agent
5. Agent notified via AppSync subscription
6. Lead appears in agent's dashboard

BULK LEADS:
1. Low-score leads pooled in DynamoDB
2. Admin creates bulk packages (50-100 leads)
3. Agents purchase packages at discounted rate
4. All leads in package claimed at once
5. Delivered as CSV or in dashboard

LOCK CLEANUP:
1. EventBridge triggers every 1 minute
2. cleanup-expired-locks Lambda scans table
3. Releases locks older than 15 seconds (via TTL)
4. Lead status reset to "available"
5. AppSync broadcasts update to agents

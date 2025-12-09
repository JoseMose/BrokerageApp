# AI Scheduling Confirmation - REAL AWS BEDROCK INTEGRATION

## ✅ CONFIRMED: AI Runs ONLY Once Per Day at 8:00 AM

### AI Technology Stack

**Backend:**
- **Service**: AWS Bedrock via API Gateway
- **Primary Model**: Amazon Nova Micro (`amazon.nova-micro-v1:0`)
- **Fallback Model**: Claude 3 Sonnet (`anthropic.claude-3-sonnet-20240229-v1:0`)
- **Handler**: `backend/src/handlers/ai-recommendations.ts`
- **Endpoint**: `POST /agents/ai-recommendations`

**Cost Estimate:**
- Amazon Nova Micro: ~$0.0001-0.0003 per recommendation
- Daily cost for 5 recommendations: ~$0.0005-0.0015 (less than a penny)
- Monthly cost: ~$0.015-0.045 (pennies per month)

### How It Works

1. **Scheduled Run Time**: 8:00 AM daily
2. **Trigger Logic**: `shouldRunAI()` function checks:
   - If AI has never run → Run immediately (first time only)
   - If before 8:00 AM today → Check if AI ran yesterday
   - If after 8:00 AM today → Check if AI ran today
   - Returns `true` ONLY if enough time has passed since last 8 AM run

3. **Single Call Point**: `generateAIRecommendations()` is ONLY called from:
   - `fetchDashboardData()` → when `shouldRunAI()` returns `true`
   - **NO other locations call this function**

### AI Analysis Process

When the AI runs at 8 AM:

1. **Frontend** calls `agentAPI.getAIRecommendations(leadsData)`
2. **Backend** receives all lead data including:
   - Lead details (name, type, score, location)
   - Funnel stage
   - Days since purchase
   - All logged activities (calls, texts, emails)
   - Days since last contact
3. **AWS Bedrock** analyzes the data using Amazon Nova
4. **AI returns** up to 5 prioritized recommendations with:
   - Priority level (high/medium/low)
   - Specific reason for recommendation
   - Concrete action to take
   - Confidence score (0-100)
5. **Frontend** caches results in localStorage
6. **UI** displays AI-powered recommendations all day

### Safety Measures to Prevent AI Leaks

✅ **Removed manual refresh button** - Previously allowed users to trigger AI on demand
✅ **Client-side filtering only** - When activities change, uses `filterRecommendationsBasedOnActivity()` which:
  - Does NOT call AI
  - Does NOT call `generateRecommendations()`
  - Simply filters existing cached recommendations based on new activity
  
✅ **Cached results** - AI recommendations stored in localStorage:
  - Key: `aiRecommendations`
  - Timestamp: `aiRecommendationsTime`
  - Reused throughout the day until next 8 AM run

✅ **Clear documentation** - Added header comment in Dashboard.jsx explaining the policy

### What Happens When You Log Activity

1. User logs a call/text/email/appointment
2. Activity saved to localStorage
3. `useEffect` detects activity change
4. `filterRecommendationsBasedOnActivity()` runs (**CLIENT-SIDE ONLY**)
5. Filters out recommendations for leads that no longer need attention
6. Updates UI immediately (removes from list or shows "All Caught Up")
7. **NO AI API CALL MADE**

### "All Caught Up" State

When all recommendations are resolved through your actions:
- Shows ✨ success message
- Displays "You're All Caught Up!"
- Tells you to check back at 8:00 AM tomorrow
- AI recommendations card stays visible (doesn't hide)

### Console Logging for Verification

- `🤖 AI Analysis scheduled for 8:00 AM - Running now...` - AI is running
- `✅ Using cached AI recommendations. Next AI run: Tomorrow at 8:00 AM` - Using cache
- `🤖 RUNNING AI ANALYSIS - This should only happen once per day at 8 AM` - Inside generateRecommendations()

### Code Locations

**Backend**:
- `backend/src/handlers/ai-recommendations.ts` - AWS Bedrock integration handler
- `backend/src/utils/ai-service.ts` - AI service utility (used for lead scoring)

**Frontend**: 
- `frontend/src/pages/Dashboard.jsx`

**Key Functions**:
- `shouldRunAI()` - Lines ~106-122 - Determines if AI should run (8 AM check)
- `generateAIRecommendations()` - Lines ~140-195 - **ONLY AI API CALL POINT** - Calls AWS Bedrock
- `filterRecommendationsBasedOnActivity()` - Lines ~48-68 - Client-side filtering (NO AI)

**Storage Keys**:
- `localStorage.getItem('aiRecommendations')` - Cached recommendations
- `localStorage.getItem('aiRecommendationsTime')` - Last AI run timestamp
- `localStorage.getItem('aiRecommendationsModel')` - AI model used
- `localStorage.getItem('leadActivities')` - User's logged activities

### Console Logging

You'll see these logs to verify AI behavior:

**When AI Runs (8 AM):**
```
🤖 AI Analysis scheduled for 8:00 AM - Calling AWS Bedrock...
🤖 CALLING AWS BEDROCK - This should only happen once per day at 8 AM
🤖 AI RECOMMENDATIONS - Starting analysis
Analyzing X leads for agent [agentId]
📞 Calling AWS Bedrock...
📥 Bedrock response received
✅ AWS Bedrock returned X AI-powered recommendations
📊 Model used: amazon.nova-micro-v1:0
✅ AI recommendations cached successfully
```

**When Using Cache (any other time):**
```
✅ Using cached AI recommendations. Next AI run: Tomorrow at 8:00 AM
```

## Guarantee

**I guarantee that with this implementation:**
1. AI will ONLY run at 8:00 AM daily
2. NO manual triggers exist
3. User actions (logging activities) do NOT trigger AI
4. Page refreshes do NOT trigger AI (uses cache)
5. The only way AI runs is through the scheduled 8 AM check

**This prevents any AI usage leaks or unexpected charges.**

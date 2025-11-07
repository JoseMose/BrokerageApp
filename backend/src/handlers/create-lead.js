const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { LocationClient, SearchPlaceIndexForTextCommand } = require('@aws-sdk/client-location');
const { v4: uuidv4 } = require('uuid');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });
const location = new LocationClient({ region: process.env.AWS_REGION || 'us-east-1' });

/**
 * PUBLIC endpoint - Create a new lead from the landing page form
 * No authentication required
 * 
 * Flow:
 * 1. Validate input
 * 2. Generate lead ID
 * 3. Geocode address
 * 4. Score lead with AI (1-10)
 * 5. Store in DynamoDB
 * 6. Broadcast to agents via AppSync (future)
 */
exports.handler = async (event) => {
  console.log('Create lead request:', JSON.stringify(event, null, 2));
  
  // Parse request body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch (error) {
    return {
      statusCode: 400,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        error: 'INVALID_JSON',
        message: 'Invalid request format'
      })
    };
  }
  
  // Validate required fields
  const validation = validateLeadInput(body);
  if (!validation.valid) {
    return {
      statusCode: 400,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        error: 'VALIDATION_FAILED',
        message: 'Missing required fields',
        details: validation.errors
      })
    };
  }
  
  try {
    const leadId = uuidv4();
    const now = new Date().toISOString();
    
    // Geocode the address to get coordinates
    let coordinates = null;
    try {
      const geocodeResult = await location.send(new SearchPlaceIndexForTextCommand({
        IndexName: process.env.PLACE_INDEX_NAME || 'RealtorPlaceIndex',
        Text: `${body.location.address}, ${body.location.city}, ${body.location.state} ${body.location.zipCode}`,
        MaxResults: 1
      }));
      
      if (geocodeResult.Results && geocodeResult.Results.length > 0) {
        const [lng, lat] = geocodeResult.Results[0].Place.Geometry.Point;
        coordinates = { lat, lng };
      }
    } catch (geocodeError) {
      console.error('Geocoding failed:', geocodeError);
      // Continue without coordinates - not critical
    }
    
    // Calculate AI score (1-10)
    const score = await calculateLeadScore(body);
    
    // Calculate price based on score
    const price = calculateLeadPrice(score, body.leadType);
    
    // Generate AI reason/summary
    const aiReason = await generateAIReason(body, score);
    
    // Construct lead object
    const lead = {
      leadId,
      timestamp: now, // Required sort key
      leadType: body.leadType,
      status: 'available',
      score,
      price,
      aiReason,
      
      // Locking attributes (initially null)
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
      lockVersion: 0,
      
      // Claiming attributes (initially null)
      claimedBy: null,
      claimedAt: null,
      transactionId: null,
      
      // Contact info
      contact: {
        name: body.contact.name.trim(),
        email: body.contact.email.toLowerCase().trim(),
        phone: body.contact.phone
      },
      
      // Location
      location: {
        address: body.location.address.trim(),
        city: body.location.city.trim(),
        state: body.location.state,
        zipCode: body.location.zipCode,
        coordinates
      },
      
      // Questionnaire responses
      responses: body.responses,
      
      // Metadata
      createdAt: now,
      
      // GSI attributes
      statusType: `available#${body.leadType}`,
      scorePrice: `${String(score).padStart(2, '0')}#${String(Math.floor(price)).padStart(4, '0')}`
    };
    
    // Store in DynamoDB
    await ddb.send(new PutCommand({
      TableName: process.env.LEADS_TABLE_NAME,
      Item: lead
    }));
    
    console.log('Lead created successfully:', leadId);
    
    // TODO: Publish to AppSync to notify agents in real-time
    // await publishNewLeadEvent(lead);
    
    return {
      statusCode: 201,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: true,
        message: 'Lead submitted successfully',
        data: {
          leadId,
          estimatedResponse: '24 hours'
        }
      })
    };
    
  } catch (error) {
    console.error('Lead creation failed:', error);
    
    return {
      statusCode: 500,
      headers: getCorsHeaders(),
      body: JSON.stringify({
        success: false,
        error: 'CREATION_FAILED',
        message: 'Failed to create lead. Please try again.',
        details: error.message
      })
    };
  }
};

/**
 * Validate lead input data
 */
function validateLeadInput(body) {
  const errors = [];
  
  if (!body.leadType || !['buyer', 'seller'].includes(body.leadType)) {
    errors.push('Valid leadType (buyer/seller) is required');
  }
  
  if (!body.contact?.name || body.contact.name.trim().length < 2) {
    errors.push('Valid name is required');
  }
  
  if (!body.contact?.email || !isValidEmail(body.contact.email)) {
    errors.push('Valid email is required');
  }
  
  if (!body.contact?.phone || body.contact.phone.replace(/\D/g, '').length !== 10) {
    errors.push('Valid 10-digit phone number is required');
  }
  
  if (!body.location?.address || body.location.address.trim().length < 3) {
    errors.push('Valid address is required');
  }
  
  if (!body.location?.city || body.location.city.trim().length < 2) {
    errors.push('Valid city is required');
  }
  
  if (!body.location?.state) {
    errors.push('State is required');
  }
  
  if (!body.location?.zipCode || !/^\d{5}$/.test(body.location.zipCode)) {
    errors.push('Valid 5-digit ZIP code is required');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Calculate lead score using AI (1-10)
 */
async function calculateLeadScore(leadData) {
  try {
    const prompt = buildScoringPrompt(leadData);
    
    const response = await bedrock.send(new InvokeModelCommand({
      modelId: 'amazon.nova-micro-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: prompt
        }],
        inferenceConfig: {
          max_new_tokens: 100,
          temperature: 0.3
        }
      })
    }));
    
    const result = JSON.parse(new TextDecoder().decode(response.body));
    const aiResponse = result.output?.message?.content?.[0]?.text || '';
    
    // Extract score from AI response
    const scoreMatch = aiResponse.match(/\b([1-9]|10)\b/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 5;
    
    return Math.max(1, Math.min(10, score)); // Ensure 1-10 range
    
  } catch (error) {
    console.error('AI scoring failed:', error);
    // Fallback: Simple rule-based scoring
    return calculateFallbackScore(leadData);
  }
}

/**
 * Build AI scoring prompt
 */
function buildScoringPrompt(leadData) {
  const { leadType, responses, location } = leadData;
  
  if (leadType === 'buyer') {
    return `Score this home buyer lead from 1-10 (10 being best):
- Timeline: ${responses.buyingTimeline}
- Pre-approved: ${responses.preApproved ? 'Yes' : 'No'}
- Price range: ${responses.priceRange || 'Not specified'}
- Location: ${location.city}, ${location.state}

Consider urgency, financial readiness, and seriousness. Return only a number 1-10.`;
  } else {
    return `Score this home seller lead from 1-10 (10 being best):
- Timeline: ${responses.sellingTimeline}
- Listed before: ${responses.hasListedBefore ? 'Yes' : 'No'}
- Estimated value: ${responses.estimatedValue || 'Not specified'}
- Location: ${location.city}, ${location.state}

Consider urgency, property value, and experience. Return only a number 1-10.`;
  }
}

/**
 * Fallback scoring when AI is unavailable
 */
function calculateFallbackScore(leadData) {
  let score = 5; // Base score
  
  const { leadType, responses } = leadData;
  
  if (leadType === 'buyer') {
    // Urgency
    if (responses.buyingTimeline === 'immediately') score += 3;
    else if (responses.buyingTimeline === '1-3-months') score += 2;
    else if (responses.buyingTimeline === '3-6-months') score += 1;
    
    // Pre-approval
    if (responses.preApproved === true) score += 2;
    
  } else {
    // Urgency
    if (responses.sellingTimeline === 'immediately') score += 3;
    else if (responses.sellingTimeline === '1-3-months') score += 2;
    else if (responses.sellingTimeline === '3-6-months') score += 1;
    
    // Experience
    if (responses.hasListedBefore === true) score += 1;
    
    // Value
    if (responses.estimatedValue === '1m+') score += 1;
  }
  
  return Math.max(1, Math.min(10, score));
}

/**
 * Calculate lead price based on score
 */
function calculateLeadPrice(score, leadType) {
  // Base price
  let basePrice = leadType === 'seller' ? 100 : 80;
  
  // Score multiplier (scores 8-10 are premium)
  if (score >= 9) {
    return basePrice * 1.5;
  } else if (score >= 8) {
    return basePrice * 1.3;
  } else if (score >= 6) {
    return basePrice * 1.1;
  }
  
  return basePrice;
}

/**
 * Generate AI reason/summary
 */
async function generateAIReason(leadData, score) {
  try {
    const prompt = `Summarize this real estate lead in one sentence (max 80 chars):
Lead type: ${leadData.leadType}
Timeline: ${leadData.responses.buyingTimeline || leadData.responses.sellingTimeline}
Score: ${score}/10
Location: ${leadData.location.city}, ${leadData.location.state}

Be concise and highlight the key strength.`;
    
    const response = await bedrock.send(new InvokeModelCommand({
      modelId: 'amazon.nova-micro-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: prompt
        }],
        inferenceConfig: {
          max_new_tokens: 50,
          temperature: 0.7
        }
      })
    }));
    
    const result = JSON.parse(new TextDecoder().decode(response.body));
    const aiReason = result.output?.message?.content?.[0]?.text?.trim() || '';
    
    return aiReason.substring(0, 200); // Limit length
    
  } catch (error) {
    console.error('AI reason generation failed:', error);
    // Fallback reason
    return `${leadData.leadType === 'buyer' ? 'Buyer' : 'Seller'} in ${leadData.location.city} - Score ${score}/10`;
  }
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * CORS headers for public endpoint
 */
function getCorsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*', // In production, restrict to your domain
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}

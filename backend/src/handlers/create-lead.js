const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const { LocationClient, SearchPlaceIndexForTextCommand } = require('@aws-sdk/client-location');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { v4: uuidv4 } = require('uuid');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });
const location = new LocationClient({ region: process.env.AWS_REGION || 'us-east-1' });
const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

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
    
    // Determine lead tier and status
    let leadStatus = 'available'; // Default for premium (8-10) and bulk (1-4)
    let assignedTo = null;
    
    // Standard leads (5-7) get auto-assigned via round-robin
    if (score >= 5 && score <= 7) {
      const agent = await assignLeadRoundRobin(body.leadType, coordinates || { lat: 33.7490, lng: -84.3880 });
      if (agent) {
        leadStatus = 'assigned';
        assignedTo = agent.agentId;
        console.log(`Lead auto-assigned to agent ${agent.agentId} via round-robin`);
      } else {
        console.log('No eligible agents found, lead will be available in marketplace');
      }
    }
    
    // Construct lead object
    const lead = {
      leadId,
      timestamp: now, // Required sort key
      leadType: body.leadType,
      status: leadStatus,
      score,
      price,
      aiReason,
      
      // Assignment attributes
      assignedTo: assignedTo,
      assignedAt: assignedTo ? now : null,
      
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
        zip: body.location.zipCode,
        lat: coordinates?.lat || 33.7490, // Default to Atlanta if geocoding fails
        lng: coordinates?.lng || -84.3880
      },
      
      // Questionnaire responses
      responses: body.responses,
      
      // Behavioral telemetry (if provided)
      behaviorMetrics: body.behaviorMetrics || null,
      
      // Metadata
      createdAt: now,
      expiresAt: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days from now
      
      // GSI attributes
      GSI1PK: `${leadStatus}#${body.leadType}`, // 'available#buyer', 'assigned#seller', etc.
      GSI1SK: `${String(score).padStart(2, '0')}#${now}`, // Sort by score desc, then timestamp
      scorePrice: `${String(score).padStart(2, '0')}#${String(Math.floor(price)).padStart(4, '0')}`
    };
    
    // Store in DynamoDB
    await ddb.send(new PutCommand({
      TableName: process.env.LEADS_TABLE_NAME,
      Item: lead
    }));
    
    console.log('Lead created successfully:', leadId);
    
    // Send confirmation email to client (async, don't block response)
    sendLeadConfirmationEmail(body.contact.email, body.contact.name, body.leadType).catch(err => {
      console.error('Failed to send confirmation email:', err);
      // Don't fail lead creation if email fails
    });
    
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
          score,
          price,
          aiReason,
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
 * Assign lead to next agent in round-robin rotation
 * Only assigns to agents who:
 * - Accept this lead type
 * - Are active
 * - Are within reasonable distance (50 miles default)
 */
async function assignLeadRoundRobin(leadType, leadCoordinates) {
  try {
    // Get all active agents
    const scanResult = await ddb.send(new ScanCommand({
      TableName: process.env.AGENTS_TABLE_NAME,
      FilterExpression: '#status = :active AND #sk = :profile',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#sk': 'SK'
      },
      ExpressionAttributeValues: {
        ':active': 'active',
        ':profile': 'profile'
      }
    }));
    
    if (!scanResult.Items || scanResult.Items.length === 0) {
      console.log('No active agents found');
      return null;
    }
    
    // Filter agents who accept this lead type
    const eligibleAgents = scanResult.Items.filter(agent => {
      // Check if agent accepts this lead type
      if (!agent.preferences?.leadTypes?.includes(leadType)) {
        return false;
      }
      
      // Check distance (basic check - could be improved with actual location service)
      if (agent.location?.lat && agent.location?.lng && leadCoordinates.lat && leadCoordinates.lng) {
        const distance = calculateDistance(
          agent.location.lat,
          agent.location.lng,
          leadCoordinates.lat,
          leadCoordinates.lng
        );
        
        const maxRadius = agent.radius || 50; // Default 50 miles
        if (distance > maxRadius) {
          return false;
        }
      }
      
      return true;
    });
    
    if (eligibleAgents.length === 0) {
      console.log('No eligible agents for this lead type and location');
      return null;
    }
    
    // Sort by lastAssignedAt (oldest first) for fair rotation
    eligibleAgents.sort((a, b) => {
      const aTime = a.lastAssignedAt || 0;
      const bTime = b.lastAssignedAt || 0;
      return aTime - bTime; // Oldest assignment first
    });
    
    // Select the agent who was assigned longest ago
    const selectedAgent = eligibleAgents[0];
    
    // Update agent's lastAssignedAt timestamp
    await ddb.send(new UpdateCommand({
      TableName: process.env.AGENTS_TABLE_NAME,
      Key: {
        agentId: selectedAgent.agentId,
        SK: 'profile'
      },
      UpdateExpression: 'SET lastAssignedAt = :now, assignedLeadsCount = if_not_exists(assignedLeadsCount, :zero) + :one',
      ExpressionAttributeValues: {
        ':now': new Date().toISOString(),
        ':zero': 0,
        ':one': 1
      }
    }));
    
    return selectedAgent;
  } catch (error) {
    console.error('Round-robin assignment error:', error);
    return null;
  }
}

/**
 * Calculate distance between two coordinates (in miles)
 * Using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

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
  // Always use AI - no fallback, fail fast if Bedrock is not working
  const prompt = buildScoringPrompt(leadData);
  
  const response = await bedrock.send(new ConverseCommand({
    modelId: 'amazon.nova-micro-v1:0',
    messages: [{
      role: 'user',
      content: [{
        text: prompt
      }]
    }],
    inferenceConfig: {
      maxTokens: 100,
      temperature: 0.3
    }
  }));
  
  const aiResponse = response.output?.message?.content?.[0]?.text || '';
  
  // Extract score from AI response
  const scoreMatch = aiResponse.match(/\b([1-9]|10)\b/);
  if (!scoreMatch) {
    throw new Error(`AI scoring failed to return a valid score. Response: ${aiResponse}`);
  }
  
  const score = parseInt(scoreMatch[1]);
  
  return Math.max(1, Math.min(10, score)); // Ensure 1-10 range
}

/**
 * Build AI scoring prompt
 */
function buildScoringPrompt(leadData) {
  const { leadType, responses, location, behaviorMetrics } = leadData;
  
  // Add behavioral insights if available
  let behaviorContext = '';
  if (behaviorMetrics?.behavior_summary) {
    const flags = [];
    if (behaviorMetrics.behavior_summary.fast_filler) flags.push('completed quickly');
    if (behaviorMetrics.behavior_summary.hesitant) flags.push('hesitant/edited answers');
    if (behaviorMetrics.behavior_summary.likely_bot) flags.push('possible bot');
    if (flags.length > 0) {
      behaviorContext = `\nBehavior: ${flags.join(', ')}`;
    }
  }
  
  if (leadType === 'buyer') {
    return `Score this home buyer lead from 1-10 (10 being best):
- Motivation: ${responses.motivation || 'Not specified'}
- Timeline: ${responses.buyingTimeline || responses.timeline || 'Not specified'}
- Pre-approved: ${responses.preApproved || 'Unknown'}
- Price range: ${responses.priceRange || 'Not specified'}
- Current situation: ${responses.rentingOrSelling || 'Not specified'}
- Earnest money ready: ${responses.earnestMoney || 'Not specified'}
- Location: ${location.city}, ${location.state}${behaviorContext}

Consider urgency, financial readiness, seriousness, and behavior patterns. Return only a number 1-10.`;
  } else {
    return `Score this home seller lead from 1-10 (10 being best):
- Motivation: ${responses.motivation || 'Not specified'}
- Timeline: ${responses.sellingTimeline || responses.timeline || 'Not specified'}
- Estimated value: ${responses.estimatedValue || 'Not specified'}
- Occupancy status: ${responses.occupiedStatus || 'Not specified'}
- Major repairs needed: ${responses.majorRepairs || 'Not specified'}
- Location: ${location.city}, ${location.state}${behaviorContext}

Consider urgency, property value, condition, and behavior patterns. Return only a number 1-10.`;
  }
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
  const { leadType, responses, location } = leadData;
  
  const prompt = `Summarize this real estate lead in one sentence (max 80 chars):
Lead type: ${leadType}
Motivation: ${responses.motivation || 'N/A'}
Timeline: ${responses.buyingTimeline || responses.sellingTimeline || responses.timeline}
Score: ${score}/10
Location: ${location.city}, ${location.state}

Be concise and highlight the key strength.`;
  
  const response = await bedrock.send(new ConverseCommand({
    modelId: 'amazon.nova-micro-v1:0',
    messages: [{
      role: 'user',
      content: [{
        text: prompt
      }]
    }],
    inferenceConfig: {
      maxTokens: 50,
      temperature: 0.7
    }
  }));
  
  const aiReason = response.output?.message?.content?.[0]?.text?.trim() || '';
  
  if (!aiReason) {
    throw new Error('AI failed to generate lead summary');
  }
  
  return aiReason.substring(0, 200); // Limit length
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Send confirmation email to client
 */
async function sendLeadConfirmationEmail(clientEmail, clientName, leadType) {
  const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@realtorleads.com';
  
  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f7f9fc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f7f9fc; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px;">🎉 Thank You!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <p style="font-size: 18px; color: #0B1D38; margin: 0 0 20px 0;">Hi ${clientName},</p>
              <p style="font-size: 16px; color: #4B5563; line-height: 1.6; margin: 0 0 20px 0;">
                Thank you for submitting your information! We've received your <strong>${leadType}</strong> inquiry and our top-rated real estate agents are reviewing your details now.
              </p>
              <div style="background-color: #f0f7ff; border-left: 4px solid #667eea; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 15px 0; color: #0B1D38; font-size: 18px;">What happens next:</h3>
                <ol style="margin: 0; padding-left: 20px; color: #4B5563;">
                  <li style="margin-bottom: 10px;">Our AI matches you with the best agents in your area</li>
                  <li style="margin-bottom: 10px;">A qualified agent will reach out within 24 hours</li>
                  <li>They'll help you achieve your real estate goals</li>
                </ol>
              </div>
              <p style="font-size: 16px; color: #4B5563; margin: 30px 0 0 0;">
                Best regards,<br><strong>Realtor Lead Generation Team</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f7f9fc; padding: 30px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="font-size: 14px; color: #6B7280; margin: 0;">© 2025 Realtor Lead Generation Platform</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const command = new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [clientEmail] },
    Message: {
      Subject: { Data: '🎉 Thank you for your interest!', Charset: 'UTF-8' },
      Body: {
        Html: { Data: htmlBody, Charset: 'UTF-8' },
        Text: { 
          Data: `Hi ${clientName},\n\nThank you for submitting your information! We've received your ${leadType} inquiry and our top-rated real estate agents are reviewing your details now.\n\nWhat happens next:\n1. Our AI matches you with the best agents in your area\n2. A qualified agent will reach out within 24 hours\n3. They'll help you achieve your real estate goals\n\nBest regards,\nRealtor Lead Generation Team`,
          Charset: 'UTF-8'
        }
      }
    }
  });

  await ses.send(command);
  console.log('Confirmation email sent to:', clientEmail);
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

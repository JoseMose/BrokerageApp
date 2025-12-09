import { v4 as uuidv4 } from 'uuid';
import { DynamoDBService } from '../utils/dynamodb';
import { LocationService } from '../utils/location';
import { ResponseBuilder, RequestValidator, addHours } from '../utils/helpers';
import { getConfig, APIGatewayEvent, LeadSubmissionRequest, Lead } from '../utils/types';

const config = getConfig();

/**
 * Lead Intake Handler
 * Accepts new lead submissions, validates data, geocodes location, and stores in DynamoDB
 */
export const handler = async (event: APIGatewayEvent) => {
  try {
    console.log('Lead intake request:', event);

    // Parse and validate request
    const body = RequestValidator.parseBody<LeadSubmissionRequest>(event);

    // Validate required fields
    RequestValidator.validateRequired({
      leadType: body.leadType,
      'contact.name': body.contact?.name,
      'contact.email': body.contact?.email,
      'contact.phone': body.contact?.phone,
      'location.address': body.location?.address,
      'location.city': body.location?.city,
      'location.state': body.location?.state,
      'location.zip': body.location?.zip,
    });

    // Validate lead type
    if (!['buyer', 'seller'].includes(body.leadType)) {
      return ResponseBuilder.error('Invalid lead type. Must be "buyer" or "seller"');
    }

    // Validate email and phone
    if (!RequestValidator.validateEmail(body.contact.email)) {
      return ResponseBuilder.error('Invalid email format');
    }

    if (!RequestValidator.validatePhone(body.contact.phone)) {
      return ResponseBuilder.error('Invalid phone number format');
    }

    if (!RequestValidator.validateZipCode(body.location.zip)) {
      return ResponseBuilder.error('Invalid zip code format');
    }

    // Validate responses
    if (!body.responses || Object.keys(body.responses).length < 3) {
      return ResponseBuilder.error('Minimum 3 questionnaire responses required');
    }

    // Geocode the address
    let coordinates;
    try {
      coordinates = await LocationService.geocodeAddress(
        body.location.address,
        body.location.city,
        body.location.state,
        body.location.zip
      );
    } catch (error) {
      console.error('Geocoding failed:', error);
      return ResponseBuilder.error('Could not geocode address. Please verify the address is correct.');
    }

    // Create lead record
    const leadId = uuidv4();
    const timestamp = new Date().toISOString();
    const expiresAt = addHours(new Date(), config.LEAD_EXPIRY_HOURS).toISOString();

    const lead: Lead = {
      leadId,
      timestamp,
      leadType: body.leadType,
      score: 0, // Will be set by AI scoring
      price: 0, // Will be calculated after scoring
      status: 'available',
      contact: {
        name: body.contact.name.trim(),
        email: body.contact.email.toLowerCase().trim(),
        phone: body.contact.phone.replace(/\D/g, ''),
      },
      location: {
        lat: coordinates.lat,
        lng: coordinates.lng,
        address: body.location.address.trim(),
        city: body.location.city.trim(),
        state: body.location.state.trim().toUpperCase(),
        zip: body.location.zip.trim(),
      },
      responses: body.responses,
      behaviorMetrics: body.behaviorMetrics || null, // Include behavioral telemetry if provided
      aiReason: '', // Will be set by AI scoring
      createdAt: timestamp,
      expiresAt,
      GSI1PK: `pending#${body.leadType}`, // Will be updated after scoring
      GSI1SK: `0#${timestamp}`, // Will be updated after scoring
    };

    // Store lead in DynamoDB
    await DynamoDBService.putItem(config.LEADS_TABLE_NAME, lead);

    console.log('Lead created successfully:', leadId);

    // Return lead ID for Step Function processing
    return ResponseBuilder.success(
      {
        leadId,
        message: 'Lead submitted successfully and is being processed',
        status: 'pending_scoring',
      },
      201
    );
  } catch (error: any) {
    console.error('Lead intake error:', error);
    return ResponseBuilder.serverError('Failed to process lead submission', error);
  }
};

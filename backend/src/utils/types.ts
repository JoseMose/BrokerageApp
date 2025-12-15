// Database Models

export interface BehaviorMetrics {
  timing_metrics?: {
    [key: string]: number; // step_X_time_ms, step_X_typing_ms, total_form_time_ms
  };
  interaction_metrics?: {
    edits_count?: Record<string, number>;
    focus_events?: number;
    copy_paste_flag?: boolean;
    device_type?: string;
    user_agent?: string;
    screen_size?: string;
  };
  behavior_summary?: {
    fast_filler?: boolean;
    hesitant?: boolean;
    likely_bot?: boolean;
  };
}

export interface Lead {
  leadId: string;
  timestamp: string;
  leadType: 'buyer' | 'seller';
  score: number;
  price: number;
  status: 'available' | 'assigned' | 'sold' | 'expired';
  contact: {
    name: string;
    email: string;
    phone: string;
  };
  location: {
    lat: number;
    lng: number;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  responses: Record<string, any>;
  behaviorMetrics?: BehaviorMetrics | null; // Behavioral telemetry data
  aiReason: string;
  createdAt: string;
  expiresAt: string;
  purchasedBy?: string;
  purchasedAt?: string;
  assignedTo?: string;
  assignedAt?: string;
  GSI1PK: string; // status#leadType
  GSI1SK: string; // score#timestamp
}

export interface Agent {
  agentId: string;
  SK: string;
  email: string;
  name: string;
  licenseId: string;
  brokerage: string;
  phone: string;
  location: {
    lat: number;
    lng: number;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  radius: number;
  preferences: {
    leadTypes: ('buyer' | 'seller')[];
    minScore: number;
    maxPrice: number;
    propertyTypes: string[];
    priceRange: {
      min: number;
      max: number;
    };
  };
  performanceMetrics: {
    leadsOwned: number;
    leadsConverted: number;
    conversionRate: number;
    totalSpent: number;
  };
  roundRobin?: {
    lastAssignedAt?: string;
    assignedLeadCount: number;
    maxCapacity: number;
    isOnline: boolean;
  };
  stripeCustomerId?: string;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  transactionId: string;
  timestamp: string;
  agentId: string;
  leadId: string;
  amount: number;
  score: number;
  stripePaymentIntentId?: string; // Optional for assigned leads (no payment)
  status: 'pending' | 'completed' | 'refunded';
  createdAt: string;
  refundedAt?: string;
  refundReason?: string;
}

// API Request/Response Types

export interface LeadSubmissionRequest {
  leadType: 'buyer' | 'seller';
  contact: {
    name: string;
    email: string;
    phone: string;
  };
  location: {
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  responses: Record<string, any>;
  behaviorMetrics?: BehaviorMetrics; // Optional behavioral telemetry
}

export interface AIScoreResponse {
  lead_score: number;
  lead_type: 'buyer' | 'seller';
  reason: string;
}

export interface MarketplaceQueryParams {
  leadType?: 'buyer' | 'seller';
  minScore?: number;
  maxScore?: number;
  maxPrice?: number;
  radius?: number;
}

export interface PurchaseLeadRequest {
  leadId: string;
  paymentMethodId: string;
}

export interface AgentProfileUpdateRequest {
  name?: string;
  phone?: string;
  licenseId?: string;
  brokerage?: string;
  location?: {
    address: string;
    city: string;
    state: string;
    zip: string;
  };
  radius?: number;
  preferences?: Partial<Agent['preferences']>;
}

// Lambda Event Types

export interface APIGatewayEvent {
  body: string | null;
  headers: Record<string, string>;
  queryStringParameters: Record<string, string> | null;
  pathParameters: Record<string, string> | null;
  requestContext: {
    authorizer: {
      claims: {
        sub: string;
        email: string;
        'cognito:groups'?: string;
      };
    };
    requestId: string;
  };
  httpMethod: string;
  path: string;
}

export interface StepFunctionEvent {
  leadId: string;
  leadType: 'buyer' | 'seller';
  responses: Record<string, any>;
  contact: {
    name: string;
    email: string;
    phone: string;
  };
  location: {
    lat: number;
    lng: number;
    address: string;
    city: string;
    state: string;
    zip: string;
  };
}

// Configuration

export interface Config {
  LEADS_TABLE_NAME: string;
  AGENTS_TABLE_NAME: string;
  TRANSACTIONS_TABLE_NAME: string;
  PLACE_INDEX_NAME: string;
  ROUTE_CALCULATOR_NAME: string;
  AWS_REGION: string;
  BEDROCK_MODEL_ID: string;
  BEDROCK_FALLBACK_MODEL_ID: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  PRICE_PER_POINT: number;
  DEFAULT_RADIUS_MILES: number;
  LEAD_EXPIRY_HOURS: number;
}

export const getConfig = (): Config => ({
  LEADS_TABLE_NAME: process.env.LEADS_TABLE_NAME || 'RealtorLeads',
  AGENTS_TABLE_NAME: process.env.AGENTS_TABLE_NAME || 'RealtorAgents',
  TRANSACTIONS_TABLE_NAME: process.env.TRANSACTIONS_TABLE_NAME || 'RealtorTransactions',
  PLACE_INDEX_NAME: process.env.PLACE_INDEX_NAME || 'RealtorPlaceIndex',
  ROUTE_CALCULATOR_NAME: process.env.ROUTE_CALCULATOR_NAME || 'RealtorRouteCalculator',
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID || 'amazon.nova-micro-v1:0',
  BEDROCK_FALLBACK_MODEL_ID: process.env.BEDROCK_FALLBACK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  PRICE_PER_POINT: parseInt(process.env.PRICE_PER_POINT || '10'),
  DEFAULT_RADIUS_MILES: parseInt(process.env.DEFAULT_RADIUS_MILES || '15'),
  LEAD_EXPIRY_HOURS: parseInt(process.env.LEAD_EXPIRY_HOURS || '72'),
});

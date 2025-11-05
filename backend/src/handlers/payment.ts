import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBService } from '../utils/dynamodb';
import { ResponseBuilder, RequestValidator, isExpired } from '../utils/helpers';
import { getConfig, APIGatewayEvent, PurchaseLeadRequest, Transaction, Lead } from '../utils/types';

const config = getConfig();
const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

/**
 * Payment Handler
 * Handles Stripe payments for lead purchases and webhooks
 */
export const handler = async (event: APIGatewayEvent) => {
  try {
    console.log('Payment request:', event.path, event.httpMethod);

    const path = event.path;
    const httpMethod = event.httpMethod;

    // POST /payments/purchase - Create payment intent and purchase lead
    if (path.includes('/purchase') && httpMethod === 'POST') {
      return await purchaseLead(event);
    }

    // POST /payments/webhook - Handle Stripe webhooks
    if (path.includes('/webhook') && httpMethod === 'POST') {
      return await handleWebhook(event);
    }

    return ResponseBuilder.error('Invalid payment endpoint', 404);
  } catch (error: any) {
    console.error('Payment handler error:', error);
    return ResponseBuilder.serverError('Payment processing failed', error);
  }
};

/**
 * Purchase a lead with Stripe payment
 */
async function purchaseLead(event: APIGatewayEvent) {
  try {
    const agentId = RequestValidator.getUserId(event);
    const body = RequestValidator.parseBody<PurchaseLeadRequest>(event);

    RequestValidator.validateRequired({
      leadId: body.leadId,
      paymentMethodId: body.paymentMethodId,
    });

    // Get agent profile
    const agent = await DynamoDBService.getItem(config.AGENTS_TABLE_NAME, {
      agentId,
      SK: 'profile',
    });

    if (!agent) {
      return ResponseBuilder.error('Agent profile not found', 404);
    }

    if (agent.status !== 'active') {
      return ResponseBuilder.forbidden('Your account is not active');
    }

    // Get lead
    const leads = await DynamoDBService.queryItems(
      config.LEADS_TABLE_NAME,
      'leadId = :leadId',
      {
        ':leadId': body.leadId,
      }
    );

    if (leads.length === 0) {
      return ResponseBuilder.notFound('Lead not found');
    }

    const lead = leads[0] as Lead;

    // Validate lead is available
    if (lead.status !== 'available') {
      return ResponseBuilder.error('Lead is no longer available', 410);
    }

    if (isExpired(lead.expiresAt)) {
      return ResponseBuilder.error('Lead has expired', 410);
    }

    // Validate agent preferences
    if (!agent.preferences.leadTypes.includes(lead.leadType)) {
      return ResponseBuilder.forbidden('This lead type does not match your preferences');
    }

    if (lead.score < agent.preferences.minScore) {
      return ResponseBuilder.forbidden('Lead score is below your minimum preference');
    }

    if (lead.price > agent.preferences.maxPrice) {
      return ResponseBuilder.forbidden('Lead price exceeds your maximum budget');
    }

    // Check if agent already purchased this lead (prevent double purchase)
    const existingTransactions = await DynamoDBService.queryItems(
      config.TRANSACTIONS_TABLE_NAME,
      'agentId = :agentId',
      {
        ':agentId': agentId,
      },
      'AgentTransactionsIndex'
    );

    const alreadyPurchased = existingTransactions.some(
      (tx: Transaction) => tx.leadId === body.leadId && tx.status === 'completed'
    );

    if (alreadyPurchased) {
      return ResponseBuilder.error('You have already purchased this lead', 409);
    }

    // Create or get Stripe customer
    let stripeCustomerId = agent.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: agent.email,
        name: agent.name,
        metadata: {
          agentId: agent.agentId,
          licenseId: agent.licenseId,
        },
      });

      stripeCustomerId = customer.id;

      // Save customer ID to agent profile
      await DynamoDBService.updateItem(
        config.AGENTS_TABLE_NAME,
        { agentId, SK: 'profile' },
        'SET stripeCustomerId = :customerId',
        {
          ':customerId': stripeCustomerId,
        }
      );
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(lead.price * 100), // Convert to cents
      currency: 'usd',
      customer: stripeCustomerId,
      payment_method: body.paymentMethodId,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      metadata: {
        leadId: lead.leadId,
        agentId: agentId,
        leadType: lead.leadType,
        leadScore: lead.score.toString(),
      },
      description: `Lead purchase - ${lead.leadType} lead (Score: ${lead.score}/10)`,
    });

    // Create transaction record
    const transactionId = uuidv4();
    const timestamp = new Date().toISOString();

    const transaction: Transaction = {
      transactionId,
      timestamp,
      agentId,
      leadId: lead.leadId,
      amount: lead.price,
      score: lead.score,
      stripePaymentIntentId: paymentIntent.id,
      status: paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
      createdAt: timestamp,
    };

    await DynamoDBService.putItem(config.TRANSACTIONS_TABLE_NAME, transaction);

    // If payment succeeded immediately, update lead and agent
    if (paymentIntent.status === 'succeeded') {
      await completePurchase(lead.leadId, agentId, agent, lead);
    }

    return ResponseBuilder.success({
      transactionId,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      amount: lead.price,
      lead: {
        leadId: lead.leadId,
        leadType: lead.leadType,
        score: lead.score,
        // Return full contact info upon successful payment
        contact: paymentIntent.status === 'succeeded' ? lead.contact : undefined,
        location: paymentIntent.status === 'succeeded' ? lead.location : undefined,
      },
      message:
        paymentIntent.status === 'succeeded'
          ? 'Lead purchased successfully'
          : 'Payment processing',
    });
  } catch (error: any) {
    console.error('Purchase lead error:', error);

    // Handle Stripe-specific errors
    if (error.type === 'StripeCardError') {
      return ResponseBuilder.error(`Payment failed: ${error.message}`, 402);
    }

    throw error;
  }
}

/**
 * Handle Stripe webhooks for payment confirmations
 */
async function handleWebhook(event: APIGatewayEvent) {
  try {
    const sig = event.headers['Stripe-Signature'] || event.headers['stripe-signature'];

    if (!sig) {
      return ResponseBuilder.error('Missing Stripe signature', 400);
    }

    // Verify webhook signature
    const webhookEvent = stripe.webhooks.constructEvent(
      event.body || '',
      sig,
      config.STRIPE_WEBHOOK_SECRET
    );

    console.log('Webhook event:', webhookEvent.type);

    // Handle payment intent succeeded
    if (webhookEvent.type === 'payment_intent.succeeded') {
      const paymentIntent = webhookEvent.data.object as Stripe.PaymentIntent;
      await handlePaymentSuccess(paymentIntent);
    }

    // Handle payment intent failed
    if (webhookEvent.type === 'payment_intent.payment_failed') {
      const paymentIntent = webhookEvent.data.object as Stripe.PaymentIntent;
      await handlePaymentFailure(paymentIntent);
    }

    // Handle refunds
    if (webhookEvent.type === 'charge.refunded') {
      const charge = webhookEvent.data.object as Stripe.Charge;
      await handleRefund(charge);
    }

    return ResponseBuilder.success({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return ResponseBuilder.error('Webhook processing failed', 400);
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const { leadId, agentId } = paymentIntent.metadata;

  if (!leadId || !agentId) {
    console.error('Missing metadata in payment intent:', paymentIntent.id);
    return;
  }

  // Update transaction status
  const transactions = await DynamoDBService.queryItems(
    config.TRANSACTIONS_TABLE_NAME,
    'agentId = :agentId',
    {
      ':agentId': agentId,
    },
    'AgentTransactionsIndex'
  );

  const transaction = transactions.find(
    (tx: Transaction) => tx.stripePaymentIntentId === paymentIntent.id
  );

  if (transaction) {
    await DynamoDBService.updateItem(
      config.TRANSACTIONS_TABLE_NAME,
      { transactionId: transaction.transactionId, timestamp: transaction.timestamp },
      'SET #status = :status',
      {
        ':status': 'completed',
      },
      {
        '#status': 'status',
      }
    );
  }

  // Get lead and agent
  const leads = await DynamoDBService.queryItems(
    config.LEADS_TABLE_NAME,
    'leadId = :leadId',
    {
      ':leadId': leadId,
    }
  );

  const agent = await DynamoDBService.getItem(config.AGENTS_TABLE_NAME, {
    agentId,
    SK: 'profile',
  });

  if (leads.length > 0 && agent) {
    await completePurchase(leadId, agentId, agent, leads[0]);
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  // Update transaction status to failed (implementation depends on requirements)
  console.log('Payment failed:', paymentIntent.id, paymentIntent.last_payment_error);
}

/**
 * Handle refund
 */
async function handleRefund(charge: Stripe.Charge) {
  const paymentIntentId = charge.payment_intent as string;

  // Find transaction by payment intent ID
  const allTransactions = await DynamoDBService.scanItems(
    config.TRANSACTIONS_TABLE_NAME,
    'stripePaymentIntentId = :piId',
    {
      ':piId': paymentIntentId,
    }
  );

  if (allTransactions.length > 0) {
    const transaction = allTransactions[0];

    await DynamoDBService.updateItem(
      config.TRANSACTIONS_TABLE_NAME,
      { transactionId: transaction.transactionId, timestamp: transaction.timestamp },
      'SET #status = :status, refundedAt = :refundedAt',
      {
        ':status': 'refunded',
        ':refundedAt': new Date().toISOString(),
      },
      {
        '#status': 'status',
      }
    );

    // Optionally: Make lead available again or handle as per business logic
  }
}

/**
 * Complete the purchase by updating lead and agent records
 */
async function completePurchase(leadId: string, agentId: string, agent: any, lead: Lead) {
  const timestamp = new Date().toISOString();

  // Update lead status to sold
  await DynamoDBService.updateItem(
    config.LEADS_TABLE_NAME,
    { leadId, timestamp: leadId },
    'SET #status = :status, purchasedBy = :agentId, purchasedAt = :timestamp, GSI1PK = :gsi1pk',
    {
      ':status': 'sold',
      ':agentId': agentId,
      ':timestamp': timestamp,
      ':gsi1pk': `sold#${lead.leadType}`,
    },
    {
      '#status': 'status',
    }
  );

  // Update agent metrics
  const newLeadsOwned = (agent.performanceMetrics?.leadsOwned || 0) + 1;
  const newTotalSpent = (agent.performanceMetrics?.totalSpent || 0) + lead.price;

  await DynamoDBService.updateItem(
    config.AGENTS_TABLE_NAME,
    { agentId, SK: 'profile' },
    'SET performanceMetrics.leadsOwned = :leadsOwned, performanceMetrics.totalSpent = :totalSpent, updatedAt = :updatedAt',
    {
      ':leadsOwned': newLeadsOwned,
      ':totalSpent': newTotalSpent,
      ':updatedAt': timestamp,
    }
  );

  console.log(`Purchase completed: Lead ${leadId} sold to agent ${agentId}`);
}

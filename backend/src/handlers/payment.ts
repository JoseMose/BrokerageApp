import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDBService } from '../utils/dynamodb';
import { ResponseBuilder, RequestValidator, isExpired } from '../utils/helpers';
import { getConfig, APIGatewayEvent, PurchaseLeadRequest, Transaction, Lead } from '../utils/types';
import { EmailService } from '../utils/email-service';
import { SMSService } from '../utils/sms-service';

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

    // POST /payments/refund - Process refund for a transaction
    if (path.includes('/refund') && httpMethod === 'POST') {
      return await processRefund(event);
    }

    // GET /payments/receipt/:transactionId - Get receipt for a transaction
    if (path.includes('/receipt') && httpMethod === 'GET') {
      return await generateReceipt(event);
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
    const body = RequestValidator.parseBody<any>(event);

    // Check if this is a bulk package purchase
    if (body.type === 'bulk_package' && body.packageId) {
      return await purchaseBulkPackage(agentId, body);
    }

    // Regular lead purchase
    RequestValidator.validateRequired({
      leadId: body.leadId,
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

    // Check verification status
    if (agent.verificationStatus === 'pending') {
      return ResponseBuilder.error(
        'Your account is pending verification. You will receive an email once approved.',
        403
      );
    } else if (agent.verificationStatus === 'denied') {
      return ResponseBuilder.error(
        'Your verification request was denied. Please contact support for more information.',
        403
      );
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

    // Check if this is an assigned lead (different validation rules)
    const isAssignedLead = lead.status === 'assigned' && lead.assignedTo === agentId;

    // Validate lead is available or assigned to this agent
    if (lead.status !== 'available' && !isAssignedLead) {
      return ResponseBuilder.error('Lead is no longer available', 410);
    }

    if (isExpired(lead.expiresAt)) {
      return ResponseBuilder.error('Lead has expired', 410);
    }

    // Payment method is required for all purchases
    if (!body.paymentMethodId) {
      return ResponseBuilder.error('Payment method required', 400);
    }

    // For marketplace leads, validate agent preferences
    if (!isAssignedLead) {
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

    let paymentIntentId = null;
    let stripeCustomerId = agent.stripeCustomerId;

    // Process Stripe payment for all purchases (assigned and marketplace)
    if (body.paymentMethodId) {
      // Create or get Stripe customer
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

      paymentIntentId = paymentIntent.id;

      // Check payment status
      if (paymentIntent.status !== 'succeeded') {
        return ResponseBuilder.error(
          `Payment ${paymentIntent.status}. Please check your payment method.`,
          402
        );
      }
    }

    // For assigned leads, no payment required (already paid for via round-robin)

    // Create transaction record
    const transactionId = uuidv4();
    const timestamp = new Date().toISOString();

    const paymentStatus = paymentIntentId ? 'completed' : 'pending';

    const transaction: Transaction = {
      transactionId,
      timestamp,
      agentId,
      leadId: lead.leadId,
      amount: lead.price, // Charge full price for all leads
      score: lead.score,
      stripePaymentIntentId: paymentIntentId || undefined,
      status: paymentStatus,
      createdAt: timestamp,
    };

    await DynamoDBService.putItem(config.TRANSACTIONS_TABLE_NAME, transaction);

    // Complete purchase for successful payments
    if (paymentStatus === 'completed') {
      await completePurchase(lead.leadId, agentId, agent, lead);
    }

    return ResponseBuilder.success({
      transactionId,
      paymentIntentId: paymentIntentId,
      status: paymentStatus,
      amount: lead.price,
      lead: {
        leadId: lead.leadId,
        leadType: lead.leadType,
        score: lead.score,
        // Return full contact info upon successful claim/purchase
        contact: lead.contact,
        location: lead.location,
      },
      message: 'Lead purchased successfully',
    });
  } catch (error: any) {
    console.error('Purchase lead error:', error);

    // Handle Stripe-specific errors
    if (error.type === 'StripeCardError') {
      return ResponseBuilder.error(`Payment failed: ${error.message}`, 402);
    }

    if (error.type === 'StripeInvalidRequestError') {
      return ResponseBuilder.error(`Invalid payment request: ${error.message}`, 400);
    }

    if (error.type === 'StripeAPIError') {
      return ResponseBuilder.error('Payment processing error. Please try again.', 503);
    }

    if (error.type === 'StripeConnectionError') {
      return ResponseBuilder.error('Unable to connect to payment processor. Please try again.', 503);
    }

    if (error.type === 'StripeAuthenticationError') {
      console.error('Stripe authentication error - check API keys');
      return ResponseBuilder.error('Payment configuration error. Please contact support.', 500);
    }

    throw error;
  }
}

/**
 * Purchase a bulk package with Stripe payment
 */
async function purchaseBulkPackage(agentId: string, body: any) {
  try {
    // Get the bulk package
    const packages = await DynamoDBService.queryItems(
      config.LEADS_TABLE_NAME,
      'GSI1PK = :pk',
      {
        ':pk': 'available#bulk-package',
      },
      'StatusTypeIndex'
    );

    const bulkPackage = packages.find((pkg: any) => pkg.packageId === body.packageId);

    if (!bulkPackage) {
      return ResponseBuilder.notFound('Bulk package not found');
    }

    // Check if package is still available
    if (bulkPackage.status !== 'available') {
      return ResponseBuilder.error('Package is no longer available', 410);
    }

    // Check if expired
    const now = Math.floor(Date.now() / 1000);
    if (bulkPackage.expiresAt && bulkPackage.expiresAt < now) {
      return ResponseBuilder.error('Package has expired', 410);
    }

    // Get agent
    const agent = await DynamoDBService.getItem(config.AGENTS_TABLE_NAME, {
      agentId,
      SK: 'profile',
    });

    if (!agent) {
      return ResponseBuilder.error('Agent profile not found', 404);
    }

    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(bulkPackage.totalPrice * 100), // Convert to cents
      currency: 'usd',
      payment_method: body.paymentMethodId,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never',
      },
      metadata: {
        packageId: bulkPackage.packageId,
        agentId,
        type: 'bulk_package',
        leadCount: bulkPackage.leadCount.toString(),
      },
    });

    if (paymentIntent.status !== 'succeeded') {
      return ResponseBuilder.error('Payment failed', 402);
    }

    // Create transaction
    const transactionId = uuidv4();
    const timestamp = new Date().toISOString();

    const transaction: Transaction = {
      transactionId,
      timestamp,
      agentId,
      leadId: bulkPackage.packageId, // Use packageId as leadId for bulk purchases
      amount: bulkPackage.totalPrice,
      score: 0, // Bulk packages don't have a single score
      stripePaymentIntentId: paymentIntent.id,
      status: 'completed',
      createdAt: timestamp,
    };

    await DynamoDBService.putItem(config.TRANSACTIONS_TABLE_NAME, transaction);

    // Update package status
    await DynamoDBService.updateItem(
      config.LEADS_TABLE_NAME,
      { leadId: bulkPackage.leadId || bulkPackage.packageId, timestamp: bulkPackage.timestamp },
      'SET #status = :purchased, purchasedBy = :agentId, purchasedAt = :now, transactionId = :txnId, GSI1PK = :gsi1pk',
      {
        ':purchased': 'purchased',
        ':agentId': agentId,
        ':now': timestamp,
        ':txnId': transactionId,
        ':gsi1pk': `purchased#bulk-package`,
      },
      {
        '#status': 'status',
      }
    );

    // Mark all leads in package as claimed by this agent
    const leadUpdatePromises = bulkPackage.leadIds.map(async (leadId: string) => {
      const leads = await DynamoDBService.queryItems(
        config.LEADS_TABLE_NAME,
        'leadId = :leadId',
        { ':leadId': leadId }
      );

      if (leads.length > 0) {
        const lead = leads[0];
        return DynamoDBService.updateItem(
          config.LEADS_TABLE_NAME,
          { leadId: lead.leadId, timestamp: lead.timestamp },
          'SET #status = :claimed, claimedBy = :agentId, claimedAt = :now, transactionId = :txnId, funnelStage = :funnelStage',
          {
            ':claimed': 'claimed',
            ':agentId': agentId,
            ':now': timestamp,
            ':txnId': transactionId,
            ':funnelStage': 'new_match',
          },
          {
            '#status': 'status',
          }
        );
      }
    });

    await Promise.all(leadUpdatePromises);

    // Update agent metrics
    await DynamoDBService.updateItem(
      config.AGENTS_TABLE_NAME,
      { agentId, SK: 'profile' },
      'SET performanceMetrics.totalSpent = if_not_exists(performanceMetrics.totalSpent, :zero) + :amount, performanceMetrics.leadsOwned = if_not_exists(performanceMetrics.leadsOwned, :zero) + :leadCount, updatedAt = :now',
      {
        ':amount': bulkPackage.totalPrice,
        ':leadCount': bulkPackage.leadCount,
        ':zero': 0,
        ':now': timestamp,
      }
    );

    console.log(`Bulk package ${bulkPackage.packageId} purchased by agent ${agentId}`);

    return ResponseBuilder.success({
      transaction,
      package: bulkPackage,
      message: `Successfully purchased ${bulkPackage.leadCount} leads for $${bulkPackage.totalPrice}`,
    });
  } catch (error: any) {
    console.error('Bulk package purchase error:', error);
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
  const { leadId, agentId } = paymentIntent.metadata;

  console.log('Payment failed:', paymentIntent.id, paymentIntent.last_payment_error);

  if (!leadId || !agentId) {
    console.error('Missing metadata in failed payment intent:', paymentIntent.id);
    return;
  }

  // Find and update transaction status
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
      'SET #status = :status, failureReason = :reason, failedAt = :failedAt',
      {
        ':status': 'failed',
        ':reason': paymentIntent.last_payment_error?.message || 'Unknown error',
        ':failedAt': new Date().toISOString(),
      },
      {
        '#status': 'status',
      }
    );
  }

  // Release lead lock if it exists
  const leads = await DynamoDBService.queryItems(
    config.LEADS_TABLE_NAME,
    'leadId = :leadId',
    {
      ':leadId': leadId,
    }
  );

  if (leads.length > 0) {
    const lead = leads[0];
    // If lead is locked by this agent, unlock it
    if (lead.lockedBy === agentId) {
      await DynamoDBService.updateItem(
        config.LEADS_TABLE_NAME,
        { leadId: lead.leadId, timestamp: lead.timestamp },
        'REMOVE lockedBy, lockedUntil',
        {}
      );
    }
  }
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

  // Update lead status to sold using the lead's actual timestamp
  await DynamoDBService.updateItem(
    config.LEADS_TABLE_NAME,
    { leadId, timestamp: lead.timestamp },
    'SET #status = :status, claimedBy = :agentId, claimedAt = :timestamp, GSI1PK = :gsi1pk',
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
    'SET performanceMetrics = :metrics, updatedAt = :updatedAt',
    {
      ':metrics': {
        leadsOwned: newLeadsOwned,
        totalSpent: newTotalSpent,
      },
      ':updatedAt': timestamp,
    }
  );

  console.log(`Purchase completed: Lead ${leadId} sold to agent ${agentId}`);

  // Send purchase confirmation notifications (async, don't block)
  const leadInfo = {
    leadId: lead.leadId,
    leadType: lead.leadType,
    score: lead.score,
    city: lead.location?.city || 'Unknown',
    state: lead.location?.state || '',
    price: lead.price,
  };

  // Send email confirmation
  EmailService.sendPurchaseConfirmation(agent.email, agent.name, leadInfo).catch((err) => {
    console.error('Failed to send purchase confirmation email:', err);
  });

  // Send SMS confirmation
  if (agent.phone) {
    SMSService.sendPurchaseConfirmationSMS(
      agent.phone,
      agent.name,
      lead.contact?.name || 'the client'
    ).catch((err) => {
      console.error('Failed to send purchase confirmation SMS:', err);
    });
  }
}

/**
 * Process a refund for a transaction
 */
async function processRefund(event: APIGatewayEvent) {
  try {
    const agentId = RequestValidator.getUserId(event);
    const body = RequestValidator.parseBody<any>(event);

    RequestValidator.validateRequired({
      transactionId: body.transactionId,
    });

    // Get transaction
    const transaction = await DynamoDBService.getItem(config.TRANSACTIONS_TABLE_NAME, {
      transactionId: body.transactionId,
      timestamp: body.timestamp || await getTransactionTimestamp(body.transactionId),
    });

    if (!transaction) {
      return ResponseBuilder.notFound('Transaction not found');
    }

    // Verify agent owns this transaction (or is admin)
    if (transaction.agentId !== agentId) {
      return ResponseBuilder.forbidden('You can only refund your own transactions');
    }

    // Check if already refunded
    if (transaction.status === 'refunded') {
      return ResponseBuilder.error('Transaction already refunded', 409);
    }

    // Check if transaction has a Stripe payment intent
    if (!transaction.stripePaymentIntentId) {
      return ResponseBuilder.error('No payment to refund', 400);
    }

    // Process Stripe refund
    const refund = await stripe.refunds.create({
      payment_intent: transaction.stripePaymentIntentId,
      reason: body.reason || 'requested_by_customer',
      metadata: {
        transactionId: transaction.transactionId,
        agentId,
      },
    });

    // Update transaction status
    await DynamoDBService.updateItem(
      config.TRANSACTIONS_TABLE_NAME,
      { transactionId: transaction.transactionId, timestamp: transaction.timestamp },
      'SET #status = :status, refundId = :refundId, refundedAt = :refundedAt, refundReason = :reason',
      {
        ':status': 'refunded',
        ':refundId': refund.id,
        ':refundedAt': new Date().toISOString(),
        ':reason': body.reason || 'requested_by_customer',
      },
      {
        '#status': 'status',
      }
    );

    // Update agent metrics
    const agent = await DynamoDBService.getItem(config.AGENTS_TABLE_NAME, {
      agentId,
      SK: 'profile',
    });

    if (agent) {
      const newTotalSpent = Math.max(0, (agent.performanceMetrics?.totalSpent || 0) - transaction.amount);
      const newLeadsOwned = Math.max(0, (agent.performanceMetrics?.leadsOwned || 0) - 1);

      await DynamoDBService.updateItem(
        config.AGENTS_TABLE_NAME,
        { agentId, SK: 'profile' },
        'SET performanceMetrics.totalSpent = :totalSpent, performanceMetrics.leadsOwned = :leadsOwned',
        {
          ':totalSpent': newTotalSpent,
          ':leadsOwned': newLeadsOwned,
        }
      );
    }

    // Optionally: Release the lead back to marketplace
    if (body.releaseLead && transaction.leadId) {
      const leads = await DynamoDBService.queryItems(
        config.LEADS_TABLE_NAME,
        'leadId = :leadId',
        {
          ':leadId': transaction.leadId,
        }
      );

      if (leads.length > 0) {
        const lead = leads[0];
        await DynamoDBService.updateItem(
          config.LEADS_TABLE_NAME,
          { leadId: lead.leadId, timestamp: lead.timestamp },
          'SET #status = :status, GSI1PK = :gsi1pk REMOVE claimedBy, claimedAt',
          {
            ':status': 'available',
            ':gsi1pk': `available#${lead.leadType}`,
          },
          {
            '#status': 'status',
          }
        );
      }
    }

    console.log(`Refund processed: ${refund.id} for transaction ${transaction.transactionId}`);

    return ResponseBuilder.success({
      refundId: refund.id,
      amount: transaction.amount,
      status: refund.status,
      message: 'Refund processed successfully',
    });
  } catch (error: any) {
    console.error('Refund error:', error);

    if (error.type?.startsWith('Stripe')) {
      return ResponseBuilder.error(`Refund failed: ${error.message}`, 400);
    }

    throw error;
  }
}

/**
 * Generate a receipt for a transaction
 */
async function generateReceipt(event: APIGatewayEvent) {
  try {
    const agentId = RequestValidator.getUserId(event);
    const transactionId = event.pathParameters?.transactionId;

    if (!transactionId) {
      return ResponseBuilder.error('Transaction ID required', 400);
    }

    // Get transaction
    const timestamp = await getTransactionTimestamp(transactionId);
    const transaction = await DynamoDBService.getItem(config.TRANSACTIONS_TABLE_NAME, {
      transactionId,
      timestamp,
    });

    if (!transaction) {
      return ResponseBuilder.notFound('Transaction not found');
    }

    // Verify agent owns this transaction
    if (transaction.agentId !== agentId) {
      return ResponseBuilder.forbidden('You can only view your own receipts');
    }

    // Get agent info
    const agent = await DynamoDBService.getItem(config.AGENTS_TABLE_NAME, {
      agentId,
      SK: 'profile',
    });

    // Get lead info if available
    let leadInfo = null;
    if (transaction.leadId) {
      const leads = await DynamoDBService.queryItems(
        config.LEADS_TABLE_NAME,
        'leadId = :leadId',
        {
          ':leadId': transaction.leadId,
        }
      );
      if (leads.length > 0) {
        leadInfo = leads[0];
      }
    }

    // Generate receipt data
    const receipt = {
      receiptNumber: `RCP-${transaction.transactionId.slice(0, 8).toUpperCase()}`,
      transactionId: transaction.transactionId,
      date: transaction.createdAt,
      status: transaction.status,
      agent: {
        name: agent?.name || 'N/A',
        email: agent?.email || 'N/A',
        licenseId: agent?.licenseId || 'N/A',
      },
      items: [
        {
          description: leadInfo
            ? `${leadInfo.leadType.charAt(0).toUpperCase() + leadInfo.leadType.slice(1)} Lead - Score ${leadInfo.score}/10`
            : 'Lead Purchase',
          location: leadInfo?.location
            ? `${leadInfo.location.city}, ${leadInfo.location.state}`
            : 'N/A',
          amount: transaction.amount,
        },
      ],
      subtotal: transaction.amount,
      tax: 0, // Add tax calculation if needed
      total: transaction.amount,
      paymentMethod: 'Credit Card',
      last4: transaction.stripePaymentIntentId ? 'XXXX' : null, // Could fetch from Stripe if needed
      refunded: transaction.status === 'refunded',
      refundedAt: transaction.refundedAt || null,
    };

    return ResponseBuilder.success(receipt);
  } catch (error: any) {
    console.error('Receipt generation error:', error);
    throw error;
  }
}

/**
 * Helper function to get transaction timestamp by transactionId
 */
async function getTransactionTimestamp(transactionId: string): Promise<string> {
  const transactions = await DynamoDBService.scanItems(
    config.TRANSACTIONS_TABLE_NAME,
    'transactionId = :txnId',
    {
      ':txnId': transactionId,
    }
  );

  if (transactions.length > 0) {
    return transactions[0].timestamp;
  }

  throw new Error('Transaction not found');
}

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as location from 'aws-cdk-lib/aws-location';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

export class RealtorLeadPlatformStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly leadsTable: dynamodb.Table;
  public readonly userPool: cognito.UserPool;
  public readonly authorizer: apigateway.CognitoUserPoolsAuthorizer;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ============================================
    // DYNAMODB TABLES
    // ============================================

    // Leads Table
    const leadsTable = new dynamodb.Table(this, 'LeadsTable', {
      tableName: 'RealtorLeads',
      partitionKey: { name: 'leadId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // GSI for querying available leads by type and score
    leadsTable.addGlobalSecondaryIndex({
      indexName: 'StatusTypeIndex',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING }, // status#leadType
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING }, // score#timestamp
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Agents Table
    const agentsTable = new dynamodb.Table(this, 'AgentsTable', {
      tableName: 'RealtorAgents',
      partitionKey: { name: 'agentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    // GSI for querying agents by email
    agentsTable.addGlobalSecondaryIndex({
      indexName: 'EmailIndex',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Transactions Table
    const transactionsTable = new dynamodb.Table(this, 'TransactionsTable', {
      tableName: 'RealtorTransactions',
      partitionKey: { name: 'transactionId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    });

    // GSI for agent transaction history
    transactionsTable.addGlobalSecondaryIndex({
      indexName: 'AgentTransactionsIndex',
      partitionKey: { name: 'agentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ============================================
    // COGNITO USER POOLS
    // ============================================

    const userPool = new cognito.UserPool(this, 'RealtorUserPool', {
      userPoolName: 'RealtorLeadPlatform',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: false,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
        fullname: {
          required: true,
          mutable: true,
        },
        phoneNumber: {
          required: false,
          mutable: true,
        },
      },
      customAttributes: {
        role: new cognito.StringAttribute({ mutable: true }), // agent or admin
        licenseId: new cognito.StringAttribute({ mutable: true }),
        brokerage: new cognito.StringAttribute({ mutable: true }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'RealtorUserPoolClient', {
      userPool,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
      preventUserExistenceErrors: true,
    });

    // Admin group
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Admins',
      description: 'Platform administrators',
      precedence: 1,
    });

    // Agent group
    new cognito.CfnUserPoolGroup(this, 'AgentGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Agents',
      description: 'Real estate agents',
      precedence: 10,
    });

    // ============================================
    // S3 BUCKETS
    // ============================================

    // Frontend hosting bucket
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `realtor-lead-frontend-${this.account}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      versioned: true,
    });

    // Logs and backups bucket
    const logsBucket = new s3.Bucket(this, 'LogsBucket', {
      bucketName: `realtor-lead-logs-${this.account}`,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      lifecycleRules: [
        {
          id: 'DeleteOldLogs',
          enabled: true,
          expiration: cdk.Duration.days(90),
        },
      ],
    });

    // ============================================
    // AWS LOCATION SERVICE
    // ============================================

    const placeIndex = new location.CfnPlaceIndex(this, 'PlaceIndex', {
      dataSource: 'Esri',
      indexName: 'RealtorPlaceIndex',
      description: 'Place index for geocoding lead and agent addresses',
      pricingPlan: 'RequestBasedUsage',
    });

    const routeCalculator = new location.CfnRouteCalculator(this, 'RouteCalculator', {
      calculatorName: 'RealtorRouteCalculator',
      dataSource: 'Esri',
      description: 'Route calculator for distance calculations',
      pricingPlan: 'RequestBasedUsage',
    });

    // ============================================
    // IAM ROLES AND POLICIES
    // ============================================

    // Lambda execution role with Bedrock permissions
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Bedrock permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
        ],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-micro-v1:0`,
          `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-pro-v1:0`,
          `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
          `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`,
        ],
      })
    );

    // Location Service permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'geo:SearchPlaceIndexForText',
          'geo:SearchPlaceIndexForPosition',
          'geo:CalculateRoute',
        ],
        resources: [placeIndex.attrArn, routeCalculator.attrArn],
      })
    );

    // DynamoDB permissions
    leadsTable.grantReadWriteData(lambdaRole);
    agentsTable.grantReadWriteData(lambdaRole);
    transactionsTable.grantReadWriteData(lambdaRole);

    // S3 permissions
    logsBucket.grantReadWrite(lambdaRole);

    // ============================================
    // LAMBDA FUNCTIONS
    // ============================================

    const commonEnvironment = {
      LEADS_TABLE_NAME: leadsTable.tableName,
      AGENTS_TABLE_NAME: agentsTable.tableName,
      TRANSACTIONS_TABLE_NAME: transactionsTable.tableName,
      PLACE_INDEX_NAME: placeIndex.indexName,
      ROUTE_CALCULATOR_NAME: routeCalculator.calculatorName,
      BEDROCK_MODEL_ID: 'amazon.nova-micro-v1:0',
      BEDROCK_FALLBACK_MODEL_ID: 'anthropic.claude-3-sonnet-20240229-v1:0',
      PRICE_PER_POINT: '10',
      DEFAULT_RADIUS_MILES: '15',
      LEAD_EXPIRY_HOURS: '72',
    };

    const lambdaProps = {
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      role: lambdaRole,
      environment: commonEnvironment,
      logRetention: logs.RetentionDays.ONE_WEEK,
    };

    // Lead Intake Lambda
    const leadIntakeFunction = new lambda.Function(this, 'LeadIntakeFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      functionName: 'RealtorLeadIntake',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist/lead-intake')),
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      role: lambdaRole,
      environment: commonEnvironment,
      description: 'Handles new lead submissions and validation',
    });

    // AI Scoring Lambda
    const aiScoringFunction = new lambda.Function(this, 'AIScoringFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      functionName: 'RealtorAIScoring',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist/ai-scoring')),
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
      role: lambdaRole,
      environment: commonEnvironment,
      description: 'AI-powered lead scoring using Bedrock',
    });

        // Lead Matching Lambda
    const leadMatchingFunction = new lambda.Function(this, 'LeadMatchingFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      functionName: 'RealtorLeadMatching',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist/lead-matching')),
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      role: lambdaRole,
      environment: commonEnvironment,
      description: 'Matches scored leads with agents',
    });

    // Marketplace Lambda
    const marketplaceFunction = new lambda.Function(this, 'MarketplaceFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      functionName: 'RealtorMarketplace',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist/marketplace')),
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      role: lambdaRole,
      environment: commonEnvironment,
      description: 'Handles lead marketplace queries and filtering',
    });

    // Payment Lambda
    const paymentFunction = new lambda.Function(this, 'PaymentFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      functionName: 'RealtorPayment',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist/payment')),
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      role: lambdaRole,
      environment: {
        ...commonEnvironment,
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'PLACEHOLDER',
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'PLACEHOLDER',
      },
      description: 'Handles Stripe payments and transactions',
    });

    // Agent Management Lambda
    const agentManagementFunction = new lambda.Function(this, 'AgentManagementFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      functionName: 'RealtorAgentManagement',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist/agent-management')),
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      role: lambdaRole,
      environment: commonEnvironment,
      description: 'Handles agent profile CRUD operations',
    });

    // Bulk Packages Lambda
    const bulkPackagesFunction = new lambda.Function(this, 'BulkPackagesFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      functionName: 'RealtorBulkPackages',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist/bulk-packages')),
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      role: lambdaRole,
      environment: commonEnvironment,
      description: 'Handles bulk lead package creation and purchase',
    });

        // Admin Lambda
    const adminFunction = new lambda.Function(this, 'AdminFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      functionName: 'RealtorAdmin',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist/admin')),
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      role: lambdaRole,
      environment: commonEnvironment,
      description: 'Handles admin operations and analytics',
    });

    // AI Recommendations Lambda (daily 8 AM only)
    const aiRecommendationsFunction = new lambda.Function(this, 'AIRecommendationsFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      functionName: 'RealtorAIRecommendations',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist/ai-recommendations')),
      handler: 'index.handler',
      timeout: cdk.Duration.seconds(60),
      memorySize: 1024,
      role: lambdaRole,
      environment: commonEnvironment,
      description: 'AI-powered daily lead recommendations using Bedrock (8 AM only)',
    });

    // ============================================
    // STEP FUNCTIONS
    // ============================================

    // Lead processing workflow
    const scoreLeadTask = new tasks.LambdaInvoke(this, 'ScoreLead', {
      lambdaFunction: aiScoringFunction,
      outputPath: '$.Payload',
    });

    const matchAgentsTask = new tasks.LambdaInvoke(this, 'MatchAgents', {
      lambdaFunction: leadMatchingFunction,
      outputPath: '$.Payload',
    });

    const leadWorkflow = new stepfunctions.StateMachine(this, 'LeadProcessingWorkflow', {
      stateMachineName: 'RealtorLeadProcessing',
      definition: scoreLeadTask.next(matchAgentsTask),
      timeout: cdk.Duration.minutes(5),
    });

    // ============================================
    // API GATEWAY
    // ============================================

    const api = new apigateway.RestApi(this, 'RealtorLeadAPI', {
      restApiName: 'Realtor Lead Platform API',
      description: 'API for AI-powered lead scoring and distribution platform',
      deployOptions: {
        stageName: 'prod',
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // Cognito authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      identitySource: 'method.request.header.Authorization',
    });

    // API Resources
    const leadsResource = api.root.addResource('leads');
    const agentsResource = api.root.addResource('agents');
    const marketplaceResource = api.root.addResource('marketplace');
    const paymentsResource = api.root.addResource('payments');
    const adminResource = api.root.addResource('admin');

    // Lead endpoints
    leadsResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(leadIntakeFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    leadsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(marketplaceFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    const leadByIdResource = leadsResource.addResource('{leadId}');
    leadByIdResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(marketplaceFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // Marketplace endpoints
    marketplaceResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(marketplaceFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // Agent endpoints
    agentsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(agentManagementFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    agentsResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(agentManagementFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    agentsResource.addMethod(
      'PUT',
      new apigateway.LambdaIntegration(agentManagementFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // Agent assigned leads endpoint
    const assignedLeadsResource = agentsResource.addResource('assigned-leads');
    assignedLeadsResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(agentManagementFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // Agent pass lead endpoint
    const passLeadResource = agentsResource.addResource('pass-lead');
    const passLeadByIdResource = passLeadResource.addResource('{leadId}');
    passLeadByIdResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(agentManagementFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // AI Recommendations endpoint (daily 8 AM only)
    const aiRecommendationsResource = agentsResource.addResource('ai-recommendations');
    aiRecommendationsResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(aiRecommendationsFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // Payment endpoints
    const purchaseResource = paymentsResource.addResource('purchase');
    purchaseResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(paymentFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    const webhookResource = paymentsResource.addResource('webhook');
    webhookResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(paymentFunction)
    );

    // Admin endpoints
    adminResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(adminFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    adminResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(adminFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // Admin bulk packages endpoints
    const adminBulkPackagesResource = adminResource.addResource('bulk-packages');
    adminBulkPackagesResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(bulkPackagesFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    adminBulkPackagesResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(bulkPackagesFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // Agent bulk packages endpoints
    const bulkPackagesResource = api.root.addResource('bulk-packages');
    bulkPackagesResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(bulkPackagesFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    const bulkPackageByIdResource = bulkPackagesResource.addResource('{packageId}');
    const purchasePackageResource = bulkPackageByIdResource.addResource('purchase');
    purchasePackageResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(bulkPackagesFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // ============================================
    // APPSYNC GRAPHQL API FOR REAL-TIME UPDATES
    // ============================================

    const appsyncApi = new appsync.GraphqlApi(this, 'LeadLockingAPI', {
      name: 'realtor-lead-locking-api',
      definition: appsync.Definition.fromFile(
        path.join(__dirname, '../../graphql/schema.graphql')
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.USER_POOL,
          userPoolConfig: {
            userPool: userPool,
          },
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.IAM,
          },
        ],
      },
      xrayEnabled: true,
    });

    // ============================================
    // LEAD LOCKING LAMBDA FUNCTIONS
    // ============================================

    // Lock Lead Lambda
    const lockLeadLambda = new lambda.Function(this, 'LockLeadFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist/lock-lead')),
      environment: {
        LEADS_TABLE_NAME: leadsTable.tableName,
        APPSYNC_API_ID: appsyncApi.apiId,
        APPSYNC_ENDPOINT: appsyncApi.graphqlUrl,
      },
      timeout: cdk.Duration.seconds(15),
    });

    leadsTable.grantReadWriteData(lockLeadLambda);
    appsyncApi.grant(lockLeadLambda, appsync.IamResource.all(), 'appsync:GraphQL');

    // Unlock Lead Lambda
    const unlockLeadLambda = new lambda.Function(this, 'UnlockLeadFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist/unlock-lead')),
      environment: {
        LEADS_TABLE_NAME: leadsTable.tableName,
        APPSYNC_API_ID: appsyncApi.apiId,
        APPSYNC_ENDPOINT: appsyncApi.graphqlUrl,
      },
      timeout: cdk.Duration.seconds(15),
    });

    leadsTable.grantReadWriteData(unlockLeadLambda);
    appsyncApi.grant(unlockLeadLambda, appsync.IamResource.all(), 'appsync:GraphQL');

    // Claim Lead Lambda
    const claimLeadLambda = new lambda.Function(this, 'ClaimLeadFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist/claim-lead')),
      environment: {
        LEADS_TABLE_NAME: leadsTable.tableName,
        APPSYNC_API_ID: appsyncApi.apiId,
        APPSYNC_ENDPOINT: appsyncApi.graphqlUrl,
      },
      timeout: cdk.Duration.seconds(15),
    });

    leadsTable.grantReadWriteData(claimLeadLambda);
    appsyncApi.grant(claimLeadLambda, appsync.IamResource.all(), 'appsync:GraphQL');

    // Cleanup Expired Locks Lambda
    const cleanupLambda = new lambda.Function(this, 'CleanupExpiredLocksFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist/cleanup-expired-locks')),
      environment: {
        LEADS_TABLE_NAME: leadsTable.tableName,
        APPSYNC_API_ID: appsyncApi.apiId,
        APPSYNC_ENDPOINT: appsyncApi.graphqlUrl,
      },
      timeout: cdk.Duration.seconds(60),
    });

    leadsTable.grantReadWriteData(cleanupLambda);
    appsyncApi.grant(cleanupLambda, appsync.IamResource.all(), 'appsync:GraphQL');

    // EventBridge rule to run cleanup every minute
    const cleanupRule = new events.Rule(this, 'CleanupExpiredLocksRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
      description: 'Clean up expired lead locks every minute',
    });
    cleanupRule.addTarget(new targets.LambdaFunction(cleanupLambda));

    // Public Lead Creation Lambda (no auth)
    const createLeadLambda = new lambda.Function(this, 'CreateLeadFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist/create-lead')),
      environment: {
        LEADS_TABLE_NAME: leadsTable.tableName,
        AGENTS_TABLE_NAME: agentsTable.tableName,
        APPSYNC_API_ID: appsyncApi.apiId,
        APPSYNC_ENDPOINT: appsyncApi.graphqlUrl,
        PLACE_INDEX_NAME: placeIndex.indexName,
      },
      timeout: cdk.Duration.seconds(30),
    });

    leadsTable.grantWriteData(createLeadLambda);
    agentsTable.grantReadWriteData(createLeadLambda);
    appsyncApi.grant(createLeadLambda, appsync.IamResource.all(), 'appsync:GraphQL');

    // Grant Location Service permissions for geocoding
    createLeadLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['geo:SearchPlaceIndexForText'],
      resources: [placeIndex.attrArn],
    }));

    // Grant Bedrock permissions for AI scoring
    createLeadLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['*'],
    }));

    // ============================================
    // API GATEWAY ENDPOINTS FOR LEAD LOCKING
    // ============================================

    // Add /leads/lock endpoint
    const lockResource = leadsResource.addResource('lock');
    lockResource.addMethod('POST', new apigateway.LambdaIntegration(lockLeadLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Add /leads/unlock endpoint
    const unlockResource = leadsResource.addResource('unlock');
    unlockResource.addMethod('POST', new apigateway.LambdaIntegration(unlockLeadLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Add /leads/claim endpoint
    const claimResource = leadsResource.addResource('claim');
    claimResource.addMethod('POST', new apigateway.LambdaIntegration(claimLeadLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Add public /create-lead endpoint (NO AUTH)
    const createLeadResource = api.root.addResource('create-lead');
    createLeadResource.addMethod('POST', new apigateway.LambdaIntegration(createLeadLambda));

    // ============================================
    // CLOUDWATCH ALARMS
    // ============================================

    const alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      displayName: 'Realtor Lead Platform Alarms',
    });

    // Lambda error alarm
    const lambdaErrorAlarm = new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
      metric: aiScoringFunction.metricErrors(),
      threshold: 10,
      evaluationPeriods: 1,
      alarmDescription: 'Alert when Lambda function errors exceed threshold',
      alarmName: 'RealtorLead-LambdaErrors',
    });
    lambdaErrorAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));

    // API Gateway 4XX errors
    const api4xxAlarm = new cloudwatch.Alarm(this, 'API4xxAlarm', {
      metric: api.metricClientError(),
      threshold: 50,
      evaluationPeriods: 2,
      alarmDescription: 'Alert when API 4XX errors exceed threshold',
      alarmName: 'RealtorLead-API4xxErrors',
    });
    api4xxAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));

    // API Gateway 5XX errors
    const api5xxAlarm = new cloudwatch.Alarm(this, 'API5xxAlarm', {
      metric: api.metricServerError(),
      threshold: 10,
      evaluationPeriods: 1,
      alarmDescription: 'Alert when API 5XX errors exceed threshold',
      alarmName: 'RealtorLead-API5xxErrors',
    });
    api5xxAlarm.addAlarmAction(new actions.SnsAction(alarmTopic));

    // ============================================
    // OUTPUTS
    // ============================================

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'RealtorLeadUserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: 'RealtorLeadUserPoolClientId',
    });

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
      exportName: 'RealtorLeadApiEndpoint',
    });

    new cdk.CfnOutput(this, 'StepFunctionArn', {
      value: leadWorkflow.stateMachineArn,
      description: 'Lead processing Step Function ARN',
      exportName: 'RealtorLeadWorkflowArn',
    });

    new cdk.CfnOutput(this, 'AppSyncGraphQLEndpoint', {
      value: appsyncApi.graphqlUrl,
      description: 'AppSync GraphQL API endpoint for real-time subscriptions',
      exportName: 'AppSyncGraphQLEndpoint',
    });

    new cdk.CfnOutput(this, 'AppSyncAPIKey', {
      value: appsyncApi.apiId,
      description: 'AppSync API ID',
      exportName: 'AppSyncAPIId',
    });

    new cdk.CfnOutput(this, 'PublicLeadFormEndpoint', {
      value: `${api.url}create-lead`,
      description: 'PUBLIC endpoint for lead generation form (no auth required)',
      exportName: 'PublicLeadFormEndpoint',
    });

    new cdk.CfnOutput(this, 'EnableTTLCommand', {
      value: `aws dynamodb update-time-to-live --table-name ${leadsTable.tableName} --time-to-live-specification "Enabled=true, AttributeName=lockExpiresAt"`,
      description: 'Run this command to enable TTL on the Leads table',
    });

    // Export resources for use by other stacks
    this.api = api;
    this.leadsTable = leadsTable;
    this.userPool = userPool;
    this.authorizer = authorizer;
  }
}

const cdk = require('aws-cdk-lib');
const { Stack, Duration, CfnOutput } = require('aws-cdk-lib');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const lambda = require('aws-cdk-lib/aws-lambda');
const apigateway = require('aws-cdk-lib/aws-apigateway');
const appsync = require('aws-cdk-lib/aws-appsync');
const events = require('aws-cdk-lib/aws-events');
const targets = require('aws-cdk-lib/aws-events-targets');
const cognito = require('aws-cdk-lib/aws-cognito');
const iam = require('aws-cdk-lib/aws-iam');
const path = require('path');

/**
 * Lead Locking Infrastructure Stack
 * Adds AppSync GraphQL API and lock management to existing platform
 */
class LeadLockingStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);
    
    // Use resources passed from RealtorLeadPlatformStack
    const leadsTable = props.leadsTable;
    const userPool = props.userPool;
    const apiGatewayApi = props.api;
    const authorizer = props.authorizer;
    
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
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
      },
    });
    
    // DynamoDB data source for AppSync
    const leadsDataSource = appsyncApi.addDynamoDbDataSource(
      'LeadsDataSource',
      leadsTable
    );
    
    // ============================================
    // APPSYNC RESOLVERS
    // ============================================
    
    // Query: getLead
    leadsDataSource.createResolver('GetLeadResolver', {
      typeName: 'Query',
      fieldName: 'getLead',
      requestMappingTemplate: appsync.MappingTemplate.dynamoDbGetItem('leadId', 'leadId'),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultItem(),
    });
    
    // Query: listAvailableLeads
    leadsDataSource.createResolver('ListAvailableLeadsResolver', {
      typeName: 'Query',
      fieldName: 'listAvailableLeads',
      requestMappingTemplate: appsync.MappingTemplate.fromString(`
        {
          "version": "2017-02-28",
          "operation": "Query",
          "index": "StatusTypeIndex",
          "query": {
            "expression": "statusType = :statusType",
            "expressionValues": {
              ":statusType": $util.dynamodb.toDynamoDBJson("available#\${ctx.args.leadType}")
            }
          },
          "limit": $util.defaultIfNull($ctx.args.limit, 20),
          "nextToken": $util.toJson($util.defaultIfNullOrEmpty($ctx.args.nextToken, null))
        }
      `),
      responseMappingTemplate: appsync.MappingTemplate.dynamoDbResultList(),
    });
    
    // ============================================
    // LAMBDA FUNCTIONS FOR LEAD LOCKING
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
      timeout: Duration.seconds(10),
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
      timeout: Duration.seconds(10),
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
      timeout: Duration.seconds(10),
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
      timeout: Duration.seconds(60),
    });
    
    leadsTable.grantReadWriteData(cleanupLambda);
    appsyncApi.grant(cleanupLambda, appsync.IamResource.all(), 'appsync:GraphQL');
    
    // ============================================
    // EVENTBRIDGE SCHEDULE FOR CLEANUP
    // ============================================
    
    // Run cleanup every minute to unlock expired leads
    const cleanupRule = new events.Rule(this, 'CleanupSchedule', {
      schedule: events.Schedule.rate(Duration.minutes(1)),
      description: 'Cleanup expired lead locks every minute',
    });
    
    cleanupRule.addTarget(new targets.LambdaFunction(cleanupLambda));
    
    // ============================================
    // API GATEWAY INTEGRATION
    // ============================================
    
    // Get /leads resource (or create if doesn't exist)
    const leadsResource = apiGatewayApi.root.resourceForPath('leads') || 
                          apiGatewayApi.root.addResource('leads');
    
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
    
    // ============================================
    // PUBLIC LEAD GENERATION ENDPOINT
    // ============================================
    
    // Create Lead Lambda (PUBLIC - no auth)
    const createLeadLambda = new lambda.Function(this, 'CreateLeadFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist/create-lead')),
      environment: {
        LEADS_TABLE_NAME: leadsTable.tableName,
        APPSYNC_API_ID: appsyncApi.apiId,
        APPSYNC_ENDPOINT: appsyncApi.graphqlUrl,
        PLACE_INDEX_NAME: process.env.PLACE_INDEX_NAME || 'RealtorPlaceIndex',
      },
      timeout: Duration.seconds(30),
    });
    
    leadsTable.grantWriteData(createLeadLambda);
    appsyncApi.grant(createLeadLambda, appsync.IamResource.all(), 'appsync:GraphQL');
    
    // Grant Location Service permissions for geocoding
    createLeadLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['geo:SearchPlaceIndexForText'],
      resources: [`arn:aws:geo:${this.region}:${this.account}:place-index/*`],
    }));
    
    // Grant Bedrock permissions for AI scoring
    createLeadLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['*'],
    }));
    
    // Add public /create-lead endpoint (NO AUTH)
    // Note: CORS is already configured globally on the API Gateway
    const createLeadResource = apiGatewayApi.root.addResource('create-lead');
    createLeadResource.addMethod('POST', new apigateway.LambdaIntegration(createLeadLambda));
    
    // ============================================
    // OUTPUTS
    // ============================================
    
    new CfnOutput(this, 'AppSyncGraphQLEndpoint', {
      value: appsyncApi.graphqlUrl,
      description: 'AppSync GraphQL API endpoint for real-time subscriptions',
      exportName: 'AppSyncGraphQLEndpoint',
    });
    
    new CfnOutput(this, 'AppSyncAPIKey', {
      value: appsyncApi.apiId,
      description: 'AppSync API ID',
      exportName: 'AppSyncAPIId',
    });
    
    new CfnOutput(this, 'LeadLockingEndpoints', {
      value: JSON.stringify({
        lock: `${apiGatewayApi.url}leads/lock`,
        unlock: `${apiGatewayApi.url}leads/unlock`,
        claim: `${apiGatewayApi.url}leads/claim`,
        createLead: `${apiGatewayApi.url}create-lead`,
      }),
      description: 'API endpoints for lead locking operations',
    });
    
    new CfnOutput(this, 'PublicLeadFormEndpoint', {
      value: `${apiGatewayApi.url}create-lead`,
      description: 'PUBLIC endpoint for lead generation form (no auth required)',
      exportName: 'PublicLeadFormEndpoint',
    });
    
    new CfnOutput(this, 'EnableTTLCommand', {
      value: `aws dynamodb update-time-to-live --table-name ${leadsTable.tableName} --time-to-live-specification "Enabled=true, AttributeName=lockExpiresAt"`,
      description: 'Run this command to enable TTL on the Leads table',
    });
  }
}

module.exports = { LeadLockingStack };

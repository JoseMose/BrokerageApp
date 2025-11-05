#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { RealtorLeadPlatformStack } from '../lib/realtor-lead-platform-stack';

const app = new cdk.App();

new RealtorLeadPlatformStack(app, 'RealtorLeadPlatformStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'AI-Powered Real Estate Lead Scoring and Distribution Platform',
});

app.synth();

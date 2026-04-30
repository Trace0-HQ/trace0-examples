#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PythonLambdaStack } from '../lib/stack';

const app = new cdk.App();

const environment = app.node.tryGetContext('environment') ?? process.env.ENVIRONMENT ?? 'dev';

new PythonLambdaStack(app, `PythonLambdaStack-${environment}`, {
  environment,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'eu-west-1',
  },
  tags: {
    Project: 'python-lambda',
    Environment: environment,
    ManagedBy: 'cdk',
  },
});

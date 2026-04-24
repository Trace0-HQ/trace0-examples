import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
const OTEL_LAYER_ARN = 'arn:aws:lambda:eu-west-1:184161586896:layer:opentelemetry-nodejs-0_21_0:1';

interface NodeJsLambdaStackProps extends cdk.StackProps {
  environment?: string;
}

export class NodeJsLambdaStack extends cdk.Stack {
  public readonly apiUrl: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: NodeJsLambdaStackProps = {}) {
    super(scope, id, props);

    const env = props.environment ?? 'dev';

    // DynamoDB table for users
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: `node-js-lambda-users-${env}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // use RETAIN for production
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    // CloudWatch log group for the Lambda
    const logGroup = new logs.LogGroup(this, 'LambdaLogGroup', {
      logGroupName: `/aws/lambda/node-js-lambda-${env}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const otelLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OtelLayer', OTEL_LAYER_ARN);

    // Lambda function — NodejsFunction compiles and bundles the TypeScript automatically
    const userLambda = new lambdaNodejs.NodejsFunction(this, 'UserLambda', {
      functionName: `node-js-lambda-${env}`,
      entry: path.join(__dirname, '../../lambda/src/index.ts'),
      projectRoot: path.join(__dirname, '../../lambda'),
      depsLockFilePath: path.join(__dirname, '../../lambda/package-lock.json'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_24_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logGroup,
      layers: [otelLayer],
      environment: {
        USERS_TABLE_NAME: usersTable.tableName,
        ENVIRONMENT: env,
        OTEL_SERVICE_NAME: `node-js-lambda-${env}`,
        OTEL_EXPORTER_OTLP_ENDPOINT: 'https://app.trace0hq.com/api',
        OTEL_EXPORTER_OTLP_HEADERS: 'X-API-KEY=YOUR_TRACE0_ENV_API_KEY',
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-handler',
      },
      bundling: {
        // @aws-sdk/* is in the Node runtime so does not need to be bundled.
        // @opentelemetry/api is bundled rather than externalised because although the OTel Lambda layer
        // provides it internally, it is not exposed on the Node.js module resolution path. This is required
        // by otel-logger.ts which wraps the global console methods with OTel trace context (traceId/spanId)
        // so that logs can be correlated with traces/
        externalModules: ['@aws-sdk/*'],
        minify: false,
        sourceMap: true,
        target: 'node24'
      },
    });

    // Grant Lambda read/write access to DynamoDB
    usersTable.grantReadWriteData(userLambda);

    // Allow Lambda to write structured logs to its log group
    logGroup.grantWrite(userLambda);

    // API Gateway REST API
    const api = new apigateway.RestApi(this, 'UserApi', {
      restApiName: `node-js-lambda-api-${env}`,
      description: 'User management API backed by Node.js Lambda and DynamoDB',
      deployOptions: {
        stageName: env,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: false,
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'traceparent', 'tracestate'],
      },
    });

    const lambdaIntegration = new apigateway.LambdaIntegration(userLambda);

    // POST /users
    const usersResource = api.root.addResource('users');
    usersResource.addMethod('POST', lambdaIntegration, {
      operationName: 'StoreUser',
      requestModels: {
        'application/json': new apigateway.Model(this, 'StoreUserModel', {
          restApi: api,
          modelName: 'StoreUserRequest',
          schema: {
            type: apigateway.JsonSchemaType.OBJECT,
            required: ['name', 'email'],
            properties: {
              name: { type: apigateway.JsonSchemaType.STRING },
              email: { type: apigateway.JsonSchemaType.STRING },
            },
          },
        }),
      },
    });

    // GET /users/{userId}
    const userResource = usersResource.addResource('{userId}');
    userResource.addMethod('GET', lambdaIntegration, {
      operationName: 'LoadUser',
    });

    // Outputs
    this.apiUrl = new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway base URL',
    });

    new cdk.CfnOutput(this, 'UsersTableName', {
      value: usersTable.tableName,
      description: 'DynamoDB users table name',
    });

    new cdk.CfnOutput(this, 'LambdaFunctionName', {
      value: userLambda.functionName,
      description: 'Lambda function name',
    });
  }
}

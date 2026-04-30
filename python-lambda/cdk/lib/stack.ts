import * as path from 'path';
import { execSync } from 'child_process';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';

const OTEL_LAYER_ARN = 'arn:aws:lambda:eu-west-1:184161586896:layer:opentelemetry-python-0_19_0:1';

interface PythonLambdaStackProps extends cdk.StackProps {
  environment?: string;
}

export class PythonLambdaStack extends cdk.Stack {
  public readonly apiUrl: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: PythonLambdaStackProps = {}) {
    super(scope, id, props);

    const env = props.environment ?? 'dev';

    // DynamoDB table for users
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: `python-lambda-users-${env}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // use RETAIN for production
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    // CloudWatch log group for the Lambda
    const logGroup = new logs.LogGroup(this, 'LambdaLogGroup', {
      logGroupName: `/aws/lambda/python-lambda-${env}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const otelLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OtelLayer', OTEL_LAYER_ARN);

    // Lambda function — the Python source is deployed as-is; boto3 comes from the runtime,
    // opentelemetry packages come from the OTel Lambda layer, and the trace0_lambda_otel_logger package
    // comes from the requirements.txt file.
    const userLambda = new lambda.Function(this, 'UserLambda', {
      functionName: `python-lambda-${env}`,
      runtime: lambda.Runtime.PYTHON_3_14,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda'), {
        bundling: {
          local: {
            tryBundle(outputDir: string): boolean {
              const lambdaDir = path.join(__dirname, '../../lambda');
              execSync(
                `pip3 install -r "${lambdaDir}/requirements.txt" -t "${outputDir}" --no-cache-dir`,
                { stdio: 'inherit' }
              );
              execSync(`cp -r "${lambdaDir}/." "${outputDir}/"`, { stdio: 'inherit' });
              return true;
            },
          },
          image: lambda.Runtime.PYTHON_3_14.bundlingImage,
        },
      }),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logGroup,
      layers: [otelLayer],
      environment: {
        USERS_TABLE_NAME: usersTable.tableName,
        ENVIRONMENT: env,
        OTEL_SERVICE_NAME: `python-lambda-${env}`,
        OTEL_EXPORTER_OTLP_ENDPOINT: 'https://app.trace0hq.com/api',
        OTEL_EXPORTER_OTLP_HEADERS: 'X-API-KEY=YOUR_TRACE0_ENV_API_KEY',
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-handler',
      },
    });

    // Grant Lambda read/write access to DynamoDB
    usersTable.grantReadWriteData(userLambda);

    // Allow Lambda to write structured logs to its log group
    logGroup.grantWrite(userLambda);

    // API Gateway REST API
    const api = new apigateway.RestApi(this, 'UserApi', {
      restApiName: `python-lambda-api-${env}`,
      description: 'User management API backed by Python Lambda and DynamoDB',
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

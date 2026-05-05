import * as path from 'path';
import { execSync } from 'child_process';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';

// Check https://github.com/open-telemetry/opentelemetry-lambda/releases for the latest Java layer ARN.
const OTEL_LAYER_ARN = 'arn:aws:lambda:eu-west-1:184161586896:layer:opentelemetry-javaagent-0_19_0:1';

interface JavaLambdaStackProps extends cdk.StackProps {
  environment?: string;
}

export class JavaLambdaStack extends cdk.Stack {
  public readonly apiUrl: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: JavaLambdaStackProps = {}) {
    super(scope, id, props);

    const env = props.environment ?? 'dev';

    // DynamoDB table for users
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: `java-lambda-users-${env}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // use RETAIN for production
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    // CloudWatch log group for the Lambda
    const logGroup = new logs.LogGroup(this, 'LambdaLogGroup', {
      logGroupName: `/aws/lambda/java-lambda-${env}`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const otelLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'OtelLayer', OTEL_LAYER_ARN);

    // Build the fat JAR locally via Gradle, then deploy it.
    const lambdaDir = path.join(__dirname, '../../lambda');

    const userLambda = new lambda.Function(this, 'UserLambda', {
      functionName: `java-lambda-${env}`,
      runtime: lambda.Runtime.JAVA_25,
      handler: 'com.trace0.javalambda.Handler::handleRequest',
      code: lambda.Code.fromAsset(lambdaDir, {
        bundling: {
          local: {
            tryBundle(outputDir: string): boolean {
              execSync(`"${lambdaDir}/gradlew" shadowJar --project-dir "${lambdaDir}"`, { stdio: 'inherit' });
              execSync(`cp "${lambdaDir}/build/libs/java-lambda.jar" "${outputDir}/java-lambda.jar"`, { stdio: 'inherit' });
              return true;
            },
          },
          image: lambda.Runtime.JAVA_25.bundlingImage,
        },
      }),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      logGroup,
      layers: [otelLayer],
      environment: {
        USERS_TABLE_NAME: usersTable.tableName,
        ENVIRONMENT: env,
        OTEL_SERVICE_NAME: `java-lambda-${env}`,
        OTEL_EXPORTER_OTLP_ENDPOINT: 'https://app.trace0hq.com/api',
        OTEL_EXPORTER_OTLP_HEADERS: 'X-API-KEY=YOUR_TRACE0_ENV_API_KEY',
        OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/otel-handler'
      },
    });

    // Grant Lambda read/write access to DynamoDB
    usersTable.grantReadWriteData(userLambda);

    // Allow Lambda to write structured logs to its log group
    logGroup.grantWrite(userLambda);

    // API Gateway REST API
    const api = new apigateway.RestApi(this, 'UserApi', {
      restApiName: `java-lambda-api-${env}`,
      description: 'User management API backed by Java Lambda and DynamoDB',
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

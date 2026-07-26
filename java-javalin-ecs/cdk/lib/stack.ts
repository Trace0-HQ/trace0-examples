import * as path from 'path';
import { execSync } from 'child_process';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecrAssets from 'aws-cdk-lib/aws-ecr-assets';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as logs from 'aws-cdk-lib/aws-logs';

const OTEL_AGENT_VERSION = '2.30.0';

interface JavaJavalinEcsStackProps extends cdk.StackProps {
  environment?: string;
}

export class JavaJavalinEcsStack extends cdk.Stack {
  public readonly apiUrl: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: JavaJavalinEcsStackProps = {}) {
    super(scope, id, props);

    const env = props.environment ?? 'dev';
    const appDir = path.join(__dirname, '../../app');

    // Build the fat JAR. Requires JDK 21 installed locally. The Dockerfile copies
    // this output in as part of the container image build below.
    execSync('./gradlew shadowJar', { cwd: appDir, stdio: 'inherit' });

    // DynamoDB table for users
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: `java-javalin-ecs-users-${env}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    // Dedicated VPC across 2 AZs (required for a public ALB) — no NAT gateways.
    // Tasks run in the public subnets with a public IP so they can reach ECR/OTLP
    // without paying for NAT.
    const vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `java-javalin-ecs-vpc-${env}`,
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: 'Public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
      ],
    });

    const cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: `java-javalin-ecs-${env}`,
      vpc,
    });

    // Builds the container image from app/Dockerfile. Requires Docker running locally.
    // The Dockerfile bundles the fat JAR (built by `./gradlew shadowJar` as part of this
    // asset build) together with the OpenTelemetry Java agent.
    // Platform is pinned to linux/amd64 (Fargate's default runtimePlatform) so the
    // build produces a runnable image regardless of the host machine's architecture
    // (e.g. Apple Silicon Macs build arm64 by default).
    const image = ecs.ContainerImage.fromAsset(appDir, {
      buildArgs: { OTEL_AGENT_VERSION },
      platform: ecrAssets.Platform.LINUX_AMD64,
    });

    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'Service', {
      serviceName: `java-javalin-ecs-${env}`,
      cluster,
      cpu: 512,
      memoryLimitMiB: 1024,
      desiredCount: 1,
      publicLoadBalancer: true,
      assignPublicIp: true,
      taskSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      listenerPort: 80,
      taskImageOptions: {
        image,
        containerPort: 8000,
        environment: {
          USERS_TABLE_NAME: usersTable.tableName,
          AWS_REGION: this.region,
          OTEL_SERVICE_NAME: `java-javalin-ecs-${env}`,
          OTEL_EXPORTER_OTLP_ENDPOINT: 'https://app.trace0hq.com/api',
          OTEL_EXPORTER_OTLP_HEADERS: 'X-API-KEY=YOUR_TRACE0_ENV_API_KEY',
          OTEL_EXPORTER_OTLP_PROTOCOL: 'http/protobuf',
          OTEL_RESOURCE_PROVIDERS_AWS_ENABLED: 'true'
        },
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'java-javalin-ecs',
          logRetention: logs.RetentionDays.ONE_WEEK,
        }),
      },
    });

    // Javalin has no route for "/" (the ALB default health check path), so point
    // the target group at the dedicated /health endpoint instead.
    service.targetGroup.configureHealthCheck({ path: '/health' });

    usersTable.grantReadWriteData(service.taskDefinition.taskRole);

    this.apiUrl = new cdk.CfnOutput(this, 'ApiUrl', {
      value: `http://${service.loadBalancer.loadBalancerDnsName}`,
      description: 'Javalin API URL (behind the Application Load Balancer)',
    });

    new cdk.CfnOutput(this, 'ClusterName', {
      value: cluster.clusterName,
      description: 'ECS cluster name',
    });

    new cdk.CfnOutput(this, 'UsersTableName', {
      value: usersTable.tableName,
      description: 'DynamoDB users table name',
    });
  }
}

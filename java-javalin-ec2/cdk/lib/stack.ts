import * as path from 'path';
import { execSync } from 'child_process';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3assets from 'aws-cdk-lib/aws-s3-assets';

const OTEL_AGENT_VERSION = '2.28.1';

interface JavaJavalinEc2StackProps extends cdk.StackProps {
  environment?: string;
}

export class JavaJavalinEc2Stack extends cdk.Stack {
  public readonly apiUrl: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: JavaJavalinEc2StackProps = {}) {
    super(scope, id, props);

    const env = props.environment ?? 'dev';
    const appDir = path.join(__dirname, '../../app');

    // Build the fat JAR. Requires JDK 21 installed locally.
    execSync('./gradlew shadowJar', { cwd: appDir, stdio: 'inherit' });

    // DynamoDB table for users
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: `java-javalin-ec2-users-${env}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    // Upload the built fat JAR to S3.
    const appJar = new s3assets.Asset(this, 'AppJar', {
      path: path.join(appDir, 'build/libs/java-javalin-ec2.jar'),
    });

    // IAM role: SSM Session Manager + S3 asset read + DynamoDB read/write.
    const instanceRole = new iam.Role(this, 'InstanceRole', {
      roleName: `java-javalin-ec2-${env}`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });
    appJar.grantRead(instanceRole);
    usersTable.grantReadWriteData(instanceRole);

    // Dedicated VPC with a single public subnet — no NAT gateways.
    const vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `java-javalin-ec2-vpc-${env}`,
      maxAzs: 1,
      natGateways: 0,
      subnetConfiguration: [
        { name: 'Public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
      ],
    });

    const sg = new ec2.SecurityGroup(this, 'AppSg', {
      securityGroupName: `java-javalin-ec2-sg-${env}`,
      vpc,
      description: 'Java Javalin EC2 example - HTTP on port 8000',
      allowAllOutbound: true,
    });
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8000), 'HTTP');
    sg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(8000), 'HTTP IPv6');

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'dnf update -y',
      'dnf install -y java-21-amazon-corretto-headless',
      // Download the OTel Java agent. The agent provides zero-code instrumentation
      // for traces, metrics, and logs via -javaagent at JVM startup.
      `curl -L -o /opt/opentelemetry-javaagent.jar https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v${OTEL_AGENT_VERSION}/opentelemetry-javaagent.jar`,
    );

    userData.addS3DownloadCommand({
      bucket: appJar.bucket,
      bucketKey: appJar.s3ObjectKey,
      localFile: '/opt/java-javalin-ec2.jar',
    });

    userData.addCommands(
      `cat > /etc/systemd/system/java-javalin-ec2.service << 'EOF'
[Unit]
Description=Java Javalin Service (port 8000)
After=network.target

[Service]
Type=simple
Environment="USERS_TABLE_NAME=${usersTable.tableName}"
Environment="AWS_REGION=${this.region}"
Environment="OTEL_SERVICE_NAME=java-javalin-ec2-${env}"
Environment="OTEL_EXPORTER_OTLP_ENDPOINT=https://app.trace0hq.com/api"
Environment="OTEL_EXPORTER_OTLP_HEADERS=X-API-KEY=YOUR_TRACE0_ENV_API_KEY"
ExecStart=/usr/bin/java -javaagent:/opt/opentelemetry-javaagent.jar -Xmx400m -jar /opt/java-javalin-ec2.jar
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF`,

      'systemctl daemon-reload',
      'systemctl enable java-javalin-ec2',
      'systemctl start java-javalin-ec2',
    );

    // t3.small — sufficient for a demo Javalin service at low traffic.
    const instance = new ec2.Instance(this, 'AppInstance', {
      instanceName: `java-javalin-ec2-${env}`,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      role: instanceRole,
      securityGroup: sg,
      userData,
      associatePublicIpAddress: true,
    });

    this.apiUrl = new cdk.CfnOutput(this, 'ApiUrl', {
      value: `http://${instance.instancePublicDnsName}:8000`,
      description: 'Javalin API URL (DNS changes on instance restart without Elastic IP)',
    });

    new cdk.CfnOutput(this, 'InstanceId', {
      value: instance.instanceId,
      description: 'EC2 instance ID - use with SSM Session Manager to shell in',
    });

    new cdk.CfnOutput(this, 'UsersTableName', {
      value: usersTable.tableName,
      description: 'DynamoDB users table name',
    });
  }
}

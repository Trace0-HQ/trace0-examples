import * as path from 'path';
import { execSync } from 'child_process';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3assets from 'aws-cdk-lib/aws-s3-assets';

interface NodeJsExpressEc2StackProps extends cdk.StackProps {
  environment?: string;
}

export class NodeJsExpressEc2Stack extends cdk.Stack {
  public readonly apiUrl: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: NodeJsExpressEc2StackProps = {}) {
    super(scope, id, props);

    const env = props.environment ?? 'dev';
    const appDir = path.join(__dirname, '../../app');

    // Compile TypeScript before creating the S3 asset.
    execSync('npm install && npm run build', { cwd: appDir, stdio: 'inherit' });

    // DynamoDB table for users
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: `node-js-express-ec2-users-${env}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    // Upload compiled dist/ + package.json to S3. node_modules is excluded —
    // EC2 installs production dependencies itself on first boot.
    const appAsset = new s3assets.Asset(this, 'AppAsset', {
      path: appDir,
      exclude: ['node_modules', 'src', 'tsconfig.json', '*.md'],
    });

    // IAM role: SSM Session Manager + S3 asset read + DynamoDB read/write.
    const instanceRole = new iam.Role(this, 'InstanceRole', {
      roleName: `node-js-express-ec2-${env}`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });
    appAsset.grantRead(instanceRole);
    usersTable.grantReadWriteData(instanceRole);

    // Dedicated VPC with a single public subnet — no NAT gateways.
    const vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `node-js-express-ec2-vpc-${env}`,
      maxAzs: 1,
      natGateways: 0,
      subnetConfiguration: [
        { name: 'Public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
      ],
    });

    const sg = new ec2.SecurityGroup(this, 'AppSg', {
      securityGroupName: `node-js-express-ec2-sg-${env}`,
      vpc,
      description: 'Node.js EC2 example - HTTP on port 3000',
      allowAllOutbound: true,
    });
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(3000), 'HTTP');
    sg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(3000), 'HTTP IPv6');

    const userData = ec2.UserData.forLinux();
    userData.addCommands('dnf update -y', 'dnf install -y nodejs npm unzip');
    userData.addS3DownloadCommand({
      bucket: appAsset.bucket,
      bucketKey: appAsset.s3ObjectKey,
      localFile: '/opt/node-js-express-ec2.zip',
    });
    userData.addCommands(
      'mkdir -p /opt/node-js-express-ec2',
      'unzip -o /opt/node-js-express-ec2.zip -d /opt/node-js-express-ec2',
      'cd /opt/node-js-express-ec2 && npm install --production',

      `cat > /etc/systemd/system/node-js-express-ec2.service << 'EOF'
[Unit]
Description=Node.js Express Service (port 3000)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/node-js-express-ec2
Environment="USERS_TABLE_NAME=${usersTable.tableName}"
Environment="AWS_REGION=${this.region}"
Environment="PORT=3000"
Environment="NODE_ENV=production"
Environment="OTEL_SERVICE_NAME=node-js-express-ec2-${env}"
Environment="OTEL_EXPORTER_OTLP_ENDPOINT=https://app.trace0hq.com/api"
Environment="OTEL_EXPORTER_OTLP_HEADERS=X-API-KEY=YOUR_TRACE0_ENV_API_KEY"
Environment="OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf"
ExecStart=/usr/bin/node --require @opentelemetry/auto-instrumentations-node/register dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF`,

      'systemctl daemon-reload',
      'systemctl enable node-js-express-ec2',
      'systemctl start node-js-express-ec2',
    );

    // t3.small — sufficient for a demo Express service at low traffic.
    const instance = new ec2.Instance(this, 'AppInstance', {
      instanceName: `node-js-express-ec2-${env}`,
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
      value: `http://${instance.instancePublicDnsName}:3000`,
      description: 'Express API URL (DNS changes on instance restart without Elastic IP)',
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

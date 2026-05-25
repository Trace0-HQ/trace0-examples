import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3assets from 'aws-cdk-lib/aws-s3-assets';

interface PythonFastApiEc2StackProps extends cdk.StackProps {
  environment?: string;
}

export class PythonFastApiEc2Stack extends cdk.Stack {
  public readonly apiUrl: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: PythonFastApiEc2StackProps = {}) {
    super(scope, id, props);

    const env = props.environment ?? 'dev';
    const appDir = path.join(__dirname, '../../app');

    // DynamoDB table for users
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: `python-fast-api-ec2-users-${env}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    // Upload app/ to S3. The EC2 instance installs dependencies itself on first boot.
    const appAsset = new s3assets.Asset(this, 'AppAsset', {
      path: appDir,
      exclude: ['venv', '__pycache__', '*.pyc', '*.md'],
    });

    // IAM role: SSM Session Manager + S3 asset read + DynamoDB read/write.
    const instanceRole = new iam.Role(this, 'InstanceRole', {
      roleName: `python-fast-api-ec2-${env}`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });
    appAsset.grantRead(instanceRole);
    usersTable.grantReadWriteData(instanceRole);

    // Dedicated VPC with a single public subnet — no NAT gateways.
    const vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `python-fast-api-ec2-vpc-${env}`,
      maxAzs: 1,
      natGateways: 0,
      subnetConfiguration: [
        { name: 'Public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
      ],
    });

    const sg = new ec2.SecurityGroup(this, 'AppSg', {
      securityGroupName: `python-fast-api-ec2-sg-${env}`,
      vpc,
      description: 'Python FastAPI EC2 example - HTTP on port 8000',
      allowAllOutbound: true,
    });
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8000), 'HTTP');
    sg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(8000), 'HTTP IPv6');

    const userData = ec2.UserData.forLinux();
    userData.addCommands('dnf update -y', 'dnf install -y python3 python3-pip unzip');
    userData.addS3DownloadCommand({
      bucket: appAsset.bucket,
      bucketKey: appAsset.s3ObjectKey,
      localFile: '/opt/python-fast-api-ec2.zip',
    });
    userData.addCommands(
      'mkdir -p /opt/python-fast-api-ec2',
      'unzip -o /opt/python-fast-api-ec2.zip -d /opt/python-fast-api-ec2',
      'cd /opt/python-fast-api-ec2 && python3 -m venv venv',
      'cd /opt/python-fast-api-ec2 && ./venv/bin/pip install --upgrade pip --quiet',
      'cd /opt/python-fast-api-ec2 && ./venv/bin/pip install -r requirements.txt --quiet',
      // Install instrumentation libraries for all detected packages (fastapi, boto3, etc.)
      'cd /opt/python-fast-api-ec2 && ./venv/bin/opentelemetry-bootstrap -a install',

      `cat > /etc/systemd/system/python-fast-api-ec2.service << 'EOF'
[Unit]
Description=Python FastAPI Service (port 8000)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/python-fast-api-ec2
Environment="USERS_TABLE_NAME=${usersTable.tableName}"
Environment="AWS_REGION=${this.region}"
Environment="OTEL_SERVICE_NAME=python-fast-api-ec2-${env}"
Environment="OTEL_EXPORTER_OTLP_ENDPOINT=https://app.trace0hq.com/api"
Environment="OTEL_EXPORTER_OTLP_HEADERS=X-API-KEY=YOUR_TRACE0_ENV_API_KEY"
Environment="OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf"
Environment="OTEL_PYTHON_LOG_CORRELATION=true"
Environment="OTEL_PYTHON_LOG_CODE_ATTRIBUTES=true"
ExecStart=/opt/python-fast-api-ec2/venv/bin/opentelemetry-instrument /opt/python-fast-api-ec2/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF`,

      'systemctl daemon-reload',
      'systemctl enable python-fast-api-ec2',
      'systemctl start python-fast-api-ec2',
    );

    // t3.small — sufficient for a demo FastAPI service at low traffic.
    const instance = new ec2.Instance(this, 'AppInstance', {
      instanceName: `python-fast-api-ec2-${env}`,
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
      description: 'FastAPI URL (DNS changes on instance restart without Elastic IP)',
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

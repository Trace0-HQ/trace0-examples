import * as path from 'path';
import { execSync } from 'child_process';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3assets from 'aws-cdk-lib/aws-s3-assets';

interface SpringBootStackProps extends cdk.StackProps {
  environment?: string;
}

export class SpringBootStack extends cdk.Stack {
  public readonly apiUrl: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: SpringBootStackProps = {}) {
    super(scope, id, props);

    const env = props.environment ?? 'dev';
    const appDir = path.join(__dirname, '../../app');

    // Build all three service JARs.
    execSync(
      `"${appDir}/gradlew" :hello-service:bootJar :user-service:bootJar :greeting-service:bootJar --project-dir "${appDir}"`,
      { stdio: 'inherit' },
    );

    // DynamoDB table for users
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: `java-spring-boot-users-${env}`,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.NUMBER },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    // Upload each JAR as a separate S3 asset.
    const helloJar = new s3assets.Asset(this, 'HelloServiceJar', {
      path: path.join(appDir, 'hello-service/build/libs/hello-service-0.0.1-SNAPSHOT.jar'),
    });
    const userJar = new s3assets.Asset(this, 'UserServiceJar', {
      path: path.join(appDir, 'user-service/build/libs/user-service-0.0.1-SNAPSHOT.jar'),
    });
    const greetingJar = new s3assets.Asset(this, 'GreetingServiceJar', {
      path: path.join(appDir, 'greeting-service/build/libs/greeting-service-0.0.1-SNAPSHOT.jar'),
    });

    // IAM role for the EC2 instance — SSM Session Manager + S3 asset access.
    const instanceRole = new iam.Role(this, 'InstanceRole', {
      roleName: `spring-boot-example-ec2-${env}`,
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });
    helloJar.grantRead(instanceRole);
    userJar.grantRead(instanceRole);
    greetingJar.grantRead(instanceRole);
    usersTable.grantReadWriteData(instanceRole);

    // Dedicated VPC with a single public subnet — no NAT gateways.
    const vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `spring-boot-example-vpc-${env}`,
      maxAzs: 1,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
      ],
    });

    // Only hello-service (8090) is the public entry point.
    // user-service (8081) and greeting-service (8082) are internal only.
    const sg = new ec2.SecurityGroup(this, 'AppSg', {
      securityGroupName: `spring-boot-example-sg-${env}`,
      vpc,
      description: 'Spring Boot example - exposes hello-service on port 8090',
      allowAllOutbound: true,
    });
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8090), 'hello-service HTTP');
    sg.addIngressRule(ec2.Peer.anyIpv6(), ec2.Port.tcp(8090), 'hello-service HTTP (IPv6)');

    // User data: install Corretto 25, download the JARs, run each as a systemd service.
    const userData = ec2.UserData.forLinux();
    userData.addCommands('dnf update -y', 'dnf install -y java-25-amazon-corretto-headless');

    userData.addS3DownloadCommand({ bucket: userJar.bucket,     bucketKey: userJar.s3ObjectKey,     localFile: '/opt/user-service.jar'     });
    userData.addS3DownloadCommand({ bucket: greetingJar.bucket, bucketKey: greetingJar.s3ObjectKey, localFile: '/opt/greeting-service.jar' });
    userData.addS3DownloadCommand({ bucket: helloJar.bucket,    bucketKey: helloJar.s3ObjectKey,    localFile: '/opt/hello-service.jar'    });

    userData.addCommands(
      `cat > /etc/systemd/system/user-service.service << 'EOF'
[Unit]
Description=User Service (port 8081)
After=network.target

[Service]
Type=simple
Environment="USERS_TABLE_NAME=${usersTable.tableName}"
Environment="AWS_REGION=${this.region}"
ExecStart=/usr/bin/java -Xmx350m -jar /opt/user-service.jar
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF`,

      `cat > /etc/systemd/system/greeting-service.service << 'EOF'
[Unit]
Description=Greeting Service (port 8082)
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/java -Xmx350m -jar /opt/greeting-service.jar
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF`,

      // hello-service starts after the other two and retries if they aren't ready yet.
      `cat > /etc/systemd/system/hello-service.service << 'EOF'
[Unit]
Description=Hello Service (port 8090) — public entry point
After=network.target user-service.service greeting-service.service

[Service]
Type=simple
ExecStart=/usr/bin/java -Xmx350m -jar /opt/hello-service.jar
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF`,

      'systemctl daemon-reload',
      'systemctl enable user-service greeting-service hello-service',
      'systemctl start user-service greeting-service hello-service',
    );

    // t3.small (2 vCPU / 2 GiB) is sufficient for three lightweight Spring Boot services
    // at demo load with -Xmx350m each (~1.05 GiB heap total).
    const instance = new ec2.Instance(this, 'AppInstance', {
      instanceName: `spring-boot-example-${env}`,
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
      value: `http://${instance.instancePublicDnsName}:8090`,
      description: 'Hello service URL — the public entry point (DNS changes on restart without Elastic IP)',
    });

    new cdk.CfnOutput(this, 'InstanceId', {
      value: instance.instanceId,
      description: 'EC2 instance ID — use with SSM Session Manager to shell in',
    });
  }
}

# Initial requirements for backend infrastructure

# use aws serverless for backend

# postgresql db
user AWS ligthsail with os amazon linuz 2023 and install postgress db following this guide: https://hbayraktar.medium.com/how-to-install-postgresql-15-on-amazon-linux-2023-a-step-by-step-guide-57eebb7ad9fc
Follow key steps:
- create initial user data to setup completely the db, services (at boot and to ensure postgres will be running) and basic postgresql db setup, so its DB is ready for serving data: seeding, restore or serve data already there
    - setup codedeploy agent
      - setup service
    - setup codedeploy agent restart service in case it stops for any reason
    - use https://aws.amazon.com/blogs/devops/using-codedeploy-environment-variables/ to manage env var
        - use ssm to create require env var within the instance.
- script utility to: register as on-prem instance, manage instance, deployment group,
- setup instance profile: check two options
    - aim user: create user put creds in ssm then use those inside instance
    - or using sts token/ssm/temp-creds with refresh, research about best way to create creds refresh and use them inside instance. research aws recommeded pattern to give on-prem instance AIM access with desired policies
- create devOps scripts required to manage live cicle of deployment with code deploy follow A example reference: context/initial/backend-reference/lightsail-references Its just a reference, improve change it, dont use same names specific for example refernce WSC a ficticial example stack called WSC.
- create a backup artifacts that store on s3: stack/env/db-identifier/{db backup name date}.sql

Create all these artifacts in backend/infrastructure/db/** 
Ask important questions before starting the plan, use sub agents, todo list Task tools.
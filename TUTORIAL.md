# Setting up and Running ICC on Desk Tutorial

This tutorial will guide you through setting up and running the Internal Container Cloud (ICC) on desk using the OSS profile.

## Prerequisites

- Docker running locally
- kubectl installed
- helm installed
- k3d installed
- git installed
- pnpm installed
- psql (PostgreSQL client) installed
- Node.js 20.x or 22.x installed

## Installing desk

To install desk globally, follow these steps:

1. Clone the repository:
   ```bash
   git clone git@github.com:platformatic/desk.git
   cd desk
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Install desk globally:
   ```bash
   npm link
   ```

This will make the `desk` command available globally on your system.

## Step 1: Configure Environment

### Create a GitHub OAuth App

Before setting up the environment, you need to create a GitHub OAuth application:

1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Click "New OAuth App"
3. Fill in the details:
   - **Application name**: ICC Local Development
   - **Homepage URL**: https://icc.plt
   - **Authorization callback URL**: https://icc.plt/api/login/github/callback
4. Note down the Client ID and generate a Client Secret

### Configure the .env file

Create a `.env` file from the sample template:

```bash
cp .env.sample .env
```

Edit the `.env` file and configure the following mandatory settings:

**GitHub OAuth (Required):**
- `GITHUB_OAUTH_CLIENT_ID` - Your GitHub OAuth App Client ID
- `GITHUB_OAUTH_CLIENT_SECRET` - Your GitHub OAuth App Client Secret
- `GITHUB_OAUTH_VALID_EMAILS` - Comma-separated list of admin email addresses. Must match GitHub account emails. 

**Docker Registry (only required for private images):**
If using public images (the default for the OSS profile), skip this step.
- `PULL_SECRET_USER` - Your Docker registry username
- `PULL_SECRET_TOKEN` - Your Docker registry token

## Step 2: Start the Cluster

Start the desk cluster using the OSS profile:

```bash
desk cluster up --profile oss
```

This will create a local Kubernetes cluster with k3d and deploy all necessary components.

To verify everything is running correctly:

```bash
# Check all pods across all namespaces
kubectl get pods --all-namespaces

# Check the platformatic namespace
kubectl get pods -n platformatic

# Watch pod status in real-time
kubectl get pods --all-namespaces --watch
```

To shut down the cluster when you're done:

```bash
desk cluster down --profile oss
```

## Step 3: Deploy an Application

Now let's deploy a sample application to test the ICC setup.
You need a Watt application with a `Dockerfile`. Below is an example:

**Note:** You must configure the correct `PLT_BASE_PATH` for your application, which should be your application name. 

```dockerfile
FROM node:22-alpine

ENV APP_HOME=/home/app/node/

RUN mkdir -p $APP_HOME/node_modules && chown -R node:node $APP_HOME

RUN npm install -g "@platformatic/watt-extra@latest"

WORKDIR $APP_HOME

COPY ./ ./

RUN npm install

COPY --chown=node:node . .

EXPOSE 3042
EXPOSE 9090

ENV PLT_BASE_PATH="/APPLICATION_NAME"

RUN npm run build

ENV PLT_ICC_URL="http://icc.platformatic.svc.cluster.local"

CMD [ "watt-extra", "start" ]

```


### Deploy the application

Use `desk deploy` specifying the application path:

```bash
desk deploy --profile oss --dir APPLICATION_PATH
```

### Access the application

The application will be accessible at: `https://svcs.gw.plt/APPLICATION_NAME/` 



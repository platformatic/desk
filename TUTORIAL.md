# Setting up and Running ICC on Desk Tutorial

This tutorial will guide you through setting up and running the Internal Container Cloud (ICC) on desk using the OSS profile.

## Prerequisites

- Docker running locally
- kubectl installed
- helm installed
- k3d installed
- git installed
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
4. Note down the Client ID
5. Click on "Generate a Client Secret" and note down the secret

### Configure the .env file

Create a `.env` file from the sample template:

```bash
cp .env.sample .env
```

Edit the `.env` file and configure the following mandatory settings:

**GitHub OAuth (Required):**
- `GITHUB_OAUTH_CLIENT_ID` - Your GitHub OAuth App Client ID
- `GITHUB_OAUTH_CLIENT_SECRET` - Your GitHub OAuth App Client Secret
- `GITHUB_OAUTH_VALID_EMAILS` - Comma-separated list of admin email addresses. One must match your GitHub account email. 

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
The creation is done when `desk` prints out "ICC Ready"

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
desk clpuster down --profile oss
```

## Step 3: Deploy an Application

Now let's deploy a sample application to test the ICC setup.
You need a Watt application with a `Dockerfile`. Below is an example:


```dockerfile
FROM node:22-alpine
ENV APP_HOME=/home/app/node/
RUN mkdir -p $APP_HOME/node_modules && chown -R node:node $APP_HOME

RUN npm install -g "@platformatic/watt-extra@^1.0.0"

WORKDIR $APP_HOME

# Copy the package.json & lock file first so that they are cached
COPY ./package.json ./package.json
COPY ./package-lock.json ./package-lock.json
RUN npm ci

COPY --chown=node:node . .

# Default Watt port
EXPOSE 3042

# Prometheus port to query metrics
EXPOSE 9090

ENV PLT_ICC_URL="http://icc.platformatic.svc.cluster.local"
CMD [ "watt-extra", "start" ]
```

### Deploy the application

> **Important:** Your Watt application must be configured to listen on `0.0.0.0` to be accessible within the Kubernetes cluster. You can do this by setting `PLT_SERVER_HOSTNAME=0.0.0.0` in your application's `.env` file if `PLT_SERVER_HOSTNAME=` , or by configuring it in your Platformatic configuration directly.

Use `desk deploy` specifying the application path:

```bash
desk deploy --profile oss --dir APPLICATION_PATH
```
If you are in the application folder, this is also OK:

```
desk deploy --profile oss --dir .
```

After the deploy is done, it prints out the URL of the deployed app:

```
Application deployed successfully!
URL: https://svcs.gw.plt/MY_APP/
```


### Access the application

The application will be accessible at: `https://svcs.gw.plt/APPLICATION_NAME/` 



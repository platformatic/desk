import { spawn } from './utils.js'
import { addToRun } from './run-directory.js'

export async function createDeployment (name, imageNameTag, namespace, envVars, dryRun, { context, version, isWorkflow, hostname }) {
  const defaultResources = {
    // Minimum
    requests: {
      memory: '1Gi',
      cpu: '1000m'
    },

    // Maximum
    limits: {
      memory: '2Gi',
      cpu: '1500m'
    }
  }

  const resourceName = version ? `${name}-${version}` : name
  const instanceLabel = version ? `${name}-${version}` : name
  const nameLabel = name

  const labels = {
    'app.kubernetes.io/name': nameLabel,
    'app.kubernetes.io/instance': instanceLabel
  }
  if (version) {
    labels['plt.dev/version'] = version
  }
  if (isWorkflow) {
    labels['plt.dev/workflow'] = 'true'
  }

  const podLabels = {
    ...labels,
    'platformatic.dev/monitor': 'prometheus'
  }
  if (hostname) {
    podLabels['plt.dev/hostname'] = hostname
  }

  const deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: resourceName,
      labels
    },
    spec: {
      selector: {
        matchLabels: { 'app.kubernetes.io/instance': instanceLabel }
      },
      template: {
        metadata: {
          labels: podLabels
        },
        spec: {
          containers: [
            {
              name: resourceName,
              image: imageNameTag,
              imagePullPolicy: 'Always',
              ports: [
                { name: 'app', containerPort: 3042, protocol: 'TCP' },
                { name: 'metrics', containerPort: 9090, protocol: 'TCP' }
              ],
              readinessProbe: {
                httpGet: {
                  path: '/ready',
                  port: 'metrics',
                  scheme: 'HTTP'
                },
                periodSeconds: 15,
                failureThreshold: 5
              },
              livenessProbe: {
                httpGet: {
                  path: '/status',
                  port: 'metrics',
                  scheme: 'HTTP'
                },
                periodSeconds: 2,
                successThreshold: 1,
                timeoutSeconds: 1,
                failureThreshold: 5
              },
              startupProbe: {
                httpGet: {
                  path: '/ready',
                  port: 'metrics',
                  scheme: 'HTTP'
                },
                initialDelaySeconds: 5,
                periodSeconds: 3,
                successThreshold: 1,
                failureThreshold: 15
              },
              env: [
                ...Object.entries(envVars).map(([name, value]) => ({ name, value })),
                {
                  name: 'PLT_INSTANCE_ID',
                  valueFrom: { fieldRef: { fieldPath: 'metadata.name' } }
                },
                // Workflow apps need to know their deployment version for queue routing.
                // For versioned deploys use the explicit version; for non-versioned
                // derive from the image tag (matching ICC's auto-version logic).
                ...(isWorkflow
                  ? [{ name: 'PLT_WORLD_DEPLOYMENT_VERSION', value: version || imageNameTag.split(':').pop() }]
                  : []),
              ],
              resources: defaultResources
            }
          ]
        }
      }
    }
  }

  const filePath = await addToRun(context.runDir, 'deployment.json', JSON.stringify(deployment))

  if (!dryRun) {
    await spawn('kubectl', [
      `--namespace=${namespace}`,
      'apply',
      `--filename=${filePath}`,
      '--wait'
    ])
  }

  return resourceName
}

export async function createService (name, imageNameTag, namespace, dryRun, { context, version, isWorkflow }) {
  const resourceName = version ? `${name}-${version}` : name
  const instanceLabel = version ? `${name}-${version}` : name
  const nameLabel = name

  const labels = {
    'app.kubernetes.io/name': nameLabel,
    'app.kubernetes.io/instance': instanceLabel
  }
  if (version) {
    labels['plt.dev/version'] = version
  }
  if (isWorkflow) {
    labels['plt.dev/workflow'] = 'true'
  }

  const service = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name: resourceName,
      labels
    },
    spec: {
      type: 'ClusterIP',
      selector: {
        'app.kubernetes.io/instance': instanceLabel
      },
      ports: [
        {
          name: 'app',
          protocol: 'TCP',
          port: 3042,
          targetPort: 'app'
        },
        {
          name: 'metrics',
          protocol: 'TCP',
          port: 9090,
          targetPort: 'metrics'
        }
      ]
    }
  }

  const filePath = await addToRun(context.runDir, 'service.json', JSON.stringify(service))

  if (!dryRun) {
    await spawn('kubectl', [
      `--namespace=${namespace}`,
      'apply',
      `--filename=${filePath}`,
      '--wait'
    ])
  }

  return resourceName
}

export async function createHTTPRoute (name, namespace, dryRun, { context, hostname }) {
  const useHostname = !!hostname

  const rule = {
    matches: [{
      path: {
        type: 'PathPrefix',
        value: useHostname ? '/' : `/${name}`
      }
    }],
    backendRefs: [{
      kind: 'Service',
      name,
      port: 3042
    }]
  }

  // Only add URLRewrite filter for path-prefix routing (rewriting /app/ → /)
  // With hostname routing the path is already / so no rewrite is needed
  if (!useHostname) {
    rule.filters = [{
      type: 'URLRewrite',
      urlRewrite: {
        path: {
          type: 'ReplacePrefixMatch',
          replacePrefixMatch: '/'
        }
      }
    }]
  }

  const httpRoute = {
    apiVersion: 'gateway.networking.k8s.io/v1',
    kind: 'HTTPRoute',
    metadata: {
      name,
      namespace
    },
    spec: {
      parentRefs: [{
        group: 'gateway.networking.k8s.io',
        kind: 'Gateway',
        name: 'platformatic',
        namespace
      }],
      hostnames: [useHostname ? hostname : 'svcs.gw.plt'],
      rules: [rule]
    }
  }

  const filePath = await addToRun(context.runDir, 'httproute.json', JSON.stringify(httpRoute))

  if (!dryRun) {
    await spawn('kubectl', [
      `--namespace=${namespace}`,
      'apply',
      `--filename=${filePath}`,
      '--wait'
    ])
  }

  return name
}

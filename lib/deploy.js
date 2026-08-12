import { spawn } from './utils.js'
import { addToRun } from './run-directory.js'

// The Deployment/Service name must be unique per version so versions coexist for
// skew protection. Use the version when it is already a legal name segment;
// otherwise fall back to the image tag (unique per build), sanitized. This is
// only the resource name -- the routing version id is the plt.dev/version label,
// which keeps the original value.
//
// The guard is not optional: a `plt_`-shaped id (the shape ICC mints and desk
// generates) has an underscore and capitals, and the API server rejects it as a
// resource name. Same rule as ICC's own deployment-builder, so a workload desk
// creates is named exactly as one ICC would create for the same version.
export function resourceVersion (version, imageNameTag) {
  if (version && /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(version)) return version
  const nameAndTag = imageNameTag.slice(imageNameTag.lastIndexOf('/') + 1)
  const colon = nameAndTag.lastIndexOf(':')
  const tag = colon >= 0 ? nameAndTag.slice(colon + 1) : 'latest'
  return tag.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'latest'
}

export async function createDeployment (name, imageNameTag, namespace, envVars, dryRun, { context, version, isWorkflow, hostname, minReplicas, maxReplicas }) {
  const reservedEnv = new Set(['PLT_INSTANCE_ID', 'PLT_DEPLOYMENT_VERSION', 'PLT_WORLD_APP_ID', 'PLT_WORLD_DEPLOYMENT_VERSION'])
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

  const rv = resourceVersion(version, imageNameTag)
  const resourceName = `${name}-${rv}`
  const instanceLabel = `${name}-${rv}`
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

  if (minReplicas) {
    labels['icc.platformatic.dev/scaler-min'] = String(minReplicas)
  }
  if (maxReplicas) {
    labels['icc.platformatic.dev/scaler-max'] = String(maxReplicas)
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
      ...(minReplicas ? { replicas: minReplicas } : {}),
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
                ...Object.entries(envVars)
                  .filter(([name]) => !reservedEnv.has(name))
                  .map(([name, value]) => ({ name, value })),
                {
                  name: 'PLT_INSTANCE_ID',
                  valueFrom: { fieldRef: { fieldPath: 'metadata.name' } }
                },
                // Workflow apps need their deployment version for queue routing. Set it
                // only when an explicit version is given; desk never derives one -- ICC
                // is the single point that mints a version, and delivers it to the pod
                // via the registration response (watt-extra sets PLT_DEPLOYMENT_VERSION).
                ...(isWorkflow && version
                  ? [
                      { name: 'PLT_WORLD_APP_ID', value: nameLabel },
                      { name: 'PLT_WORLD_DEPLOYMENT_VERSION', value: version }
                    ]
                  : isWorkflow
                    ? [{ name: 'PLT_WORLD_APP_ID', value: nameLabel }]
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

export async function createService (name, imageNameTag, namespace, dryRun, { context, version, isWorkflow, headless }) {
  const rv = resourceVersion(version, imageNameTag)
  const resourceName = `${name}-${rv}`
  const instanceLabel = `${name}-${rv}`
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
      ...(headless ? { clusterIP: 'None' } : {}),
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

export async function createHTTPRoute (name, namespace, dryRun, { context, hostname, serviceName = name }) {
  const useHostname = !!hostname

  const rule = {
    matches: [{
      path: {
        type: 'PathPrefix',
        value: useHostname ? '/' : `/${name}`
      }
    }],
    // The route is named/matched by the app name, but its backend must be the
    // real Service, which createService names `${name}-${rv}` (version or image
    // tag). Passing the bare app name here points at a Service that does not
    // exist -> BackendNotFound -> the app is unreachable via the gateway.
    backendRefs: [{
      kind: 'Service',
      name: serviceName,
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

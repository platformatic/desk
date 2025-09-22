import { spawn } from './utils.js'
import { addToRun } from './run-directory.js'

export async function createDeployment (name, imageNameTag, namespace, envVars, dryRun, { context }) {
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

  const deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name,
      labels: {
        'app.kubernetes.io/name': 'wattpro',
        'app.kubernetes.io/instance': name
      }
    },
    spec: {
      selector: {
        matchLabels: { 'app.kubernetes.io/instance': name }
      },
      template: {
        metadata: {
          labels: {
            'app.kubernetes.io/name': 'wattpro',
            'app.kubernetes.io/instance': name,
            'platformatic.dev/monitor': 'prometheus'
          }
        },
        spec: {
          containers: [
            {
              name,
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
                initialDelaySeconds: 30,
                periodSeconds: 30,
                failureThreshold: 1
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

  return name
}

export async function createService (name, imageNameTag, namespace, dryRun, { context }) {
  const service = {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name,
      labels: {
        'app.kubernetes.io/name': 'wattpro',
        'app.kubernetes.io/instance': name
      }
    },
    spec: {
      type: 'ClusterIP',
      selector: {
        'app.kubernetes.io/instance': name
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

  return name
}

export async function addToIngress (serviceName, appPath, namespace, dryRun, { context }) {
  let existingIngress = await spawn('kubectl', [
    `--namespace=${namespace}`,
    'get',
    'ingressroutes.traefik.io/apps',
    '-ojson'
  ])
  existingIngress = JSON.parse(existingIngress.stdout)

  const updatedIngressRoutes = {
    ...existingIngress,
    metadata: {
      name: existingIngress.metadata.name
    },
    spec: {
      ...existingIngress.spec,
    }
  }

  const matchingRouteIdx = existingIngress.spec.routes.findIndex(route => route.match.includes(appPath))
  if (matchingRouteIdx > -1) {
    updatedIngressRoutes.spec.routes[matchingRouteIdx].services[0].name = serviceName
  } else {
    const newRule = {
      kind: 'Rule',
      match: `Host(\`svcs.gw.plt\`) && PathPrefix(\`/${appPath}\`)`,
      middlewares: [{ name: 'app-prefix-strip' }],
      services: [{
        kind: 'Service',
        name: serviceName,
        namespace,
        port: 3042,
        nativeLB: true
      }]
    }

    const patchedRoutes = [
      ...existingIngress.spec.routes,
      newRule
    ]

    updatedIngressRoutes.spec.routes = patchedRoutes
  }

  const filePath = await addToRun(context.runDir, 'ingressroutes.json', JSON.stringify(updatedIngressRoutes))

  if (!dryRun) {
    await spawn('kubectl', [
      `--namespace=${namespace}`,
      'apply',
      `--filename=${filePath}`,
      '--wait'
    ])
  }

  return serviceName
}

export async function updateTraefikMiddleware (prefix, namespace, dryRun, { context }) {
  let existingPrefixes = await spawn('kubectl', [
    `--namespace=${namespace}`,
    'get',
    'middleware.traefik.io/app-prefix-strip',
    '-ojson'
  ])
  existingPrefixes = JSON.parse(existingPrefixes.stdout)

  const routePrefix = `/${prefix}`
  const currentPrefixes = existingPrefixes.spec?.stripPrefix?.prefixes ?? []
  if (currentPrefixes.includes(routePrefix)) return routePrefix

  currentPrefixes.push(routePrefix)
  const updatedMiddleware = { ...existingPrefixes }
  updatedMiddleware.spec.stripPrefix.prefixes = currentPrefixes
  updatedMiddleware.metadata = { name: existingPrefixes.metadata.name }

  const filePath = await addToRun(context.runDir, 'stripPrefixMiddleware.json', JSON.stringify(updatedMiddleware))

  if (!dryRun) {
    await spawn('kubectl', [
      `--namespace=${namespace}`,
      'apply',
      `--filename=${filePath}`,
      '--wait'
    ])
  }

  return routePrefix
}

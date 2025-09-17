import { spawn } from './utils.js'
import { addToRun } from './run-directory.js'

function getName (image) {
  // remove tag, replace illegal characters
  return image.replace(/[^a-zA-Z0-9]/g, '-')
}

export async function createDeployment (imageNameTag, namespace, envVars, dryRun, { context }) {
  const name = getName(imageNameTag)

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

export async function createService (imageNameTag, namespace, dryRun, { context }) {
  const name = getName(imageNameTag)

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

import { join } from 'node:path'
import Deepmerge from '@fastify/deepmerge'
import { getClusterStatus } from './cluster/index.js'
import { loadYamlFile, spawn } from './utils.js'

const deepmerge = Deepmerge()

export const CHART_NAME = 'platformatic/helm'

export async function createChartConfig (values, { context }) {
  const clusterStatus = await getClusterStatus({ context })

  const { apps } = values

  const substitutions = {
    POSTGRES_CONNECTION_STRING: clusterStatus.postgres.connectionString,
    VALKEY_APPS_CONNECTION_STRING: clusterStatus.valkey.connectionString,
    VALKEY_ICC_CONNECTION_STRING: clusterStatus.valkey.connectionString,
    PROMETHEUS_URL: clusterStatus.prometheus.url,
    PUBLIC_URL: 'https://icc.plt',
    ICC_IMAGE_REPO: apps.icc.image?.repository || 'platformatic/intelligent-command-center',
    ICC_IMAGE_TAG: apps.icc.image?.tag || 'latest',
    MACHINIST_IMAGE_REPO: apps.machinist.image?.repository || 'platformatic/machinist',
    MACHINIST_IMAGE_TAG: apps.machinist.image?.tag || 'latest',
    PLT_NAMESPACES: context.cluster.namespaces
  }
  const overrideValues = await loadYamlFile(join(context.chartDir, CHART_NAME, 'overrides.yaml'), substitutions)
  const deskValues = { ...values }
  delete deskValues.chart

  const overrides = deepmerge(overrideValues, deskValues)

  if (apps.icc.hotReload && apps.icc.localRepo) {
    overrides.services.icc.image = {
      repository: 'node',
      tag: '22.20.0-alpine',
      pullPolicy: 'IfNotPresent'
    }
    overrides.services.icc.log_level = 'debug'
  }

  if (apps.machinist.hotReload && apps.machinist.localRepo) {
    overrides.services.machinist.image = {
      repository: 'node',
      tag: '22.20.0-alpine',
      pullPolicy: 'IfNotPresent'
    }
    overrides.services.machinist.log_level = 'debug'
  }

  const chartConfig = { ...values.chart, overrides }

  return { [CHART_NAME]: chartConfig }
}

export async function patchForDevMode (values, { context }) {
  const { apps } = values
  const namespace = 'platformatic'

  if (apps.icc.hotReload && apps.icc.localRepo) {
    await patchDeployment('icc', {
      volumes: [{
        name: 'icc-local-repo',
        hostPath: {
          path: '/data/local/icc',
          type: 'Directory'
        }
      }],
      volumeMounts: [{
        name: 'icc-local-repo',
        mountPath: '/app'
      }],
      command: ['sh', '-c', 'apk add --no-cache python3 make g++ gcompat && npm install -g pnpm@10 && rm -rf node_modules && find . -name ".env" -type f -delete && pnpm install && pnpm run dev']
    }, namespace, context)
  }

  if (apps.machinist.hotReload && apps.machinist.localRepo) {
    await patchDeployment('machinist', {
      volumes: [{
        name: 'machinist-local-repo',
        hostPath: {
          path: '/data/local/machinist',
          type: 'Directory'
        }
      }],
      volumeMounts: [{
        name: 'machinist-local-repo',
        mountPath: '/app'
      }],
      command: ['sh', '-c', 'apk add --no-cache python3 make g++ gcompat && npm install -g pnpm@10 && rm -rf node_modules && find . -name ".env" -type f -delete && pnpm install && pnpm run dev']
    }, namespace, context)
  }
}

async function patchDeployment (name, config, namespace, context) {
  const patch = {
    spec: {
      template: {
        spec: {
          volumes: config.volumes,
          containers: [{
            name,
            volumeMounts: config.volumeMounts,
            command: config.command,
            workingDir: '/app',
            env: [
              {
                name: 'DEV_K8S',
                value: 'true'
              }
            ]
          }]
        }
      }
    }
  }

  await spawn('kubectl', [
    '--context', context.kube.contextName,
    '--namespace', namespace,
    'patch',
    'deployment',
    name,
    '--type', 'strategic',
    '--patch', JSON.stringify(patch)
  ])
}

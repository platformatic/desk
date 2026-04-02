import { join } from 'node:path'
import Deepmerge from '@fastify/deepmerge'
import { getClusterStatus } from './cluster/index.js'
import { loadYamlFile } from './utils.js'

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
    PLT_NAMESPACES: context.cluster.namespaces
  }

  // Only add image values if they're defined
  if (apps.icc.image?.repository) {
    substitutions.ICC_IMAGE_REPO = apps.icc.image.repository
  }
  if (apps.icc.image?.tag) {
    substitutions.ICC_IMAGE_TAG = apps.icc.image.tag
  }
  if (apps.machinist.image?.repository) {
    substitutions.MACHINIST_IMAGE_REPO = apps.machinist.image.repository
  }
  if (apps.machinist.image?.tag) {
    substitutions.MACHINIST_IMAGE_TAG = apps.machinist.image.tag
  }
  const overrideValues = await loadYamlFile(join(context.chartDir, CHART_NAME, 'overrides.yaml'), substitutions)
  const deskValues = { ...values }
  delete deskValues.chart

  const overrides = deepmerge(overrideValues, deskValues)

  // Configure imagePullSecret from github settings
  if (values.github) {
    overrides.imagePullSecret = {
      registry: values.github.registry || 'ghcr.io',
      user: values.github.username,
      token: values.github.imagePullSecret
    }
  }

  if (apps.icc?.hotReload && apps.icc?.localRepo) {
    overrides.services.icc.image = {
      repository: 'platformatic/icc',
      tag: 'dev',
      pullPolicy: 'IfNotPresent'
    }
    overrides.services.icc.podSecurityContext = {
      runAsUser: 1000,
      runAsGroup: 1000,
      fsGroup: 1000
    }
    overrides.services.icc.securityContext = {
      runAsNonRoot: true,
      runAsUser: 1000
    }
    overrides.services.icc.volumes = [{
      name: 'icc-local-repo',
      hostPath: {
        path: '/data/local/icc',
        type: 'Directory'
      }
    }]
    overrides.services.icc.volumeMounts = [{
      name: 'icc-local-repo',
      mountPath: '/app'
    }]
    overrides.services.icc.features.dev_mode = {
      enable: true
    }
  }

  if (apps.machinist?.hotReload && apps.machinist?.localRepo) {
    overrides.services.machinist.image = {
      repository: 'platformatic/machinist',
      tag: 'dev',
      pullPolicy: 'IfNotPresent'
    }
    overrides.services.machinist.podSecurityContext = {
      runAsUser: 1000,
      runAsGroup: 1000,
      fsGroup: 1000
    }
    overrides.services.machinist.securityContext = {
      runAsNonRoot: true,
      runAsUser: 1000
    }
    overrides.services.machinist.volumes = [{
      name: 'machinist-local-repo',
      hostPath: {
        path: '/data/local/machinist',
        type: 'Directory'
      }
    }]
    overrides.services.machinist.volumeMounts = [{
      name: 'machinist-local-repo',
      mountPath: '/app'
    }]
    overrides.services.machinist.features.dev_mode = {
      enable: true
    }
  }

  if (apps.workflow) {
    overrides.services.workflow = overrides.services.workflow || {}
    overrides.services.workflow.deploy = true
    overrides.services.workflow.name = 'workflow'
  }

  if (apps.workflow?.hotReload && apps.workflow?.localRepo) {
    overrides.services.workflow.image = {
      repository: 'platformatic/workflow',
      tag: 'dev',
      pullPolicy: 'IfNotPresent'
    }
    overrides.services.workflow.podSecurityContext = {
      runAsUser: 1000,
      runAsGroup: 1000,
      fsGroup: 1000
    }
    overrides.services.workflow.securityContext = {
      runAsNonRoot: true,
      runAsUser: 1000
    }
    overrides.services.workflow.volumes = [{
      name: 'workflow-local-repo',
      hostPath: {
        path: '/data/local/workflow',
        type: 'Directory'
      }
    }]
    overrides.services.workflow.volumeMounts = [{
      name: 'workflow-local-repo',
      mountPath: '/app'
    }]
    if (apps.workflow.workingDir) {
      overrides.services.workflow.workingDir = apps.workflow.workingDir
    }
  }

  if (apps.ebpfSandbox) {
    overrides.services.ebpfSandbox = overrides.services.ebpfSandbox || {}
    overrides.services.ebpfSandbox.deploy = true
    overrides.services.ebpfSandbox.name = 'ebpf-sandbox'
  }

  if (apps.ebpfSandbox?.hotReload && apps.ebpfSandbox?.localRepo) {
    overrides.services.ebpfSandbox.image = {
      repository: 'platformatic/ebpf-sandbox-server',
      tag: 'dev',
      pullPolicy: 'IfNotPresent'
    }
    // Monorepo mounted at /app — entry point is packages/server/src/index.ts
    overrides.services.ebpfSandbox.entrypoint = 'packages/server/src/index.ts'
    overrides.services.ebpfSandbox.bpfDir = '/app/packages/server/bpf'
    overrides.services.ebpfSandbox.volumes = [{
      name: 'ebpf-sandbox-local-repo',
      hostPath: {
        path: '/data/local/ebpfSandbox',
        type: 'Directory'
      }
    }]
    overrides.services.ebpfSandbox.volumeMounts = [{
      name: 'ebpf-sandbox-local-repo',
      mountPath: '/app'
    }]
  }

  const chartConfig = { ...values.chart, overrides }

  return { [CHART_NAME]: chartConfig }
}

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
    ICC_IMAGE_REPO: apps.icc.image.repository,
    ICC_IMAGE_TAG: apps.icc.image.tag,
    MACHINIST_IMAGE_REPO: apps.machinist.image.repository,
    MACHINIST_IMAGE_TAG: apps.machinist.image.tag,
    PLT_NAMESPACES: context.cluster.namespaces
  }
  const overrideValues = await loadYamlFile(join(context.chartDir, CHART_NAME, 'overrides.yaml'), substitutions)
  const deskValues = { ...values }
  delete deskValues.chart

  const overrides = deepmerge(overrideValues, deskValues)
  const chartConfig = { ...values.chart, overrides }

  return { [CHART_NAME]: chartConfig }
}

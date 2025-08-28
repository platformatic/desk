import { join } from 'node:path'
import Deepmerge from '@fastify/deepmerge'
import { getClusterStatus } from './cluster/index.js'
import { loadYamlFile } from './utils.js'

const deepmerge = Deepmerge()
const CHART_NAME = 'platformatic/helm'

export async function createChartConfig (values, { context }) {
  const clusterStatus = await getClusterStatus({ context })

  // HACKS Should not be doing version specific things in code
  let services = {}
  if (context.version === 4) {
    services = context.platformatic.services
  } else if (context.version === 3) {
    services = context.platformatic.projects
  } else {
  }

  const substitutions = {
    POSTGRES_CONNECTION_STRING: clusterStatus.postgres.connectionString,
    VALKEY_APPS_CONNECTION_STRING: clusterStatus.valkey.connectionString,
    VALKEY_ICC_CONNECTION_STRING: clusterStatus.valkey.connectionString,
    PROMETHEUS_URL: clusterStatus.prometheus.url,
    PUBLIC_URL: 'https://icc.plt',
    ICC_IMAGE_REPO: services.icc.image.repository,
    ICC_IMAGE_TAG: services.icc.image.tag,
    MACHINIST_IMAGE_REPO: services.machinist.image.repository,
    MACHINIST_IMAGE_TAG: services.machinist.image.tag
  }
  const clusterValues = await loadYamlFile(join(context.chartDir, CHART_NAME, 'overrides.yaml'), substitutions)
  const deskValues = deepmerge(values, clusterValues)

  const contextConfig = context.loadConfig()
  const chartConfig = contextConfig.dependencies[CHART_NAME]
  chartConfig.overrides = deskValues

  return { CHART_NAME: chartConfig }
}

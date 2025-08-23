import Deepmerge from '@fastify/deepmerge'
import { getClusterStatus } from './cluster/index.js'

const deepmerge = Deepmerge()

export async function createChartConfig (values, { context }) {
  const clusterStatus = await getClusterStatus({ context })
  const clusterValues = {
    services: {
      icc: {
        database_url: clusterStatus.postgres.connectionString,
        valkey: {
          apps_url: clusterStatus.valkey.connectionString,
          icc_url: clusterStatus.valkey.connectionString,
        },
        prometheus: {
          url: clusterStatus.prometheus.url
        },
        public_url: 'https://icc.plt'
      }
    }
  }
  const deskValues = deepmerge(values, clusterValues)

  const contextConfig = context.loadConfig()
  const chartConfig = contextConfig.dependencies['platformatic/helm']
  chartConfig.overrides = deskValues

  return { 'platformatic/helm': chartConfig }
}

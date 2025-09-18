import { join } from 'node:path'
import minimist from 'minimist'
import { loadContext } from '../lib/context.js'
import { startCluster, stopCluster, getClusterStatus } from '../lib/cluster/index.js'
import { installInfra } from '../lib/infra.js'
import { debug, info, error } from '../lib/utils.js'
import * as platformatic from '../lib/platformatic.js'
import * as psql from '../lib/psql.js'
import * as kubectl from '../lib/kubectl.js'
import { setTimeout } from 'node:timers/promises'

export const options = { command: 'cluster', strict: true }

export default async function cli (argv) {
  const args = minimist(argv, {
    string: ['profile'],
    alias: {
      profile: 'p',
    }
  })
  const [cmd] = args._

  const context = await loadContext(args.profile)
  debug.extend('cluster')(context.cluster)

  if (cmd === 'up') {
    info('Starting cluster')
    await startCluster(context.cluster, { context })
    if (context.cluster.provider.config.gateway.enable) {
      const { checkResources } = await import(`../lib/cluster/${context.cluster.provider.config.gateway.name}.js`)
      await checkResources({ context })
    }

    if (Object.keys(context.dependencies || {}).length > 0) {
      await installInfra(context.dependencies, { context })
    }
    await kubectl.waitByName('pod', 'postgres-0', 'Ready', { context })

    if (!context.platformatic.skip) {
      // HACKS The problem is ownership of the sql
      info('Preparing database for Platformatic')
      const { postgres } = await getClusterStatus({ context })
      await setTimeout(3000) // wait a bit more to avoid "psql: error: could not connect to server: Connection refused"
      await psql.execute(postgres.connectionString, join(context.chartDir, 'platformatic/helm', 'docker-postgres-init.sql'))

      info(`Installing Platformatic "${context.name}" profile`)
      const infra = await platformatic.createChartConfig(context.platformatic, { context })
      await installInfra(infra, { context })

      info('Waiting for Platformatic to finish starting')
      const k8sContext = {
        namespace: infra[platformatic.CHART_NAME].namespace
      }
      await Promise.all([
        kubectl.waitBySelector('pod', { 'app.kubernetes.io/instance': 'icc' }, 'Ready', k8sContext)
          .then(() => info('ICC ready')),
        kubectl.waitBySelector('pod', { 'app.kubernetes.io/instance': 'machinist' }, 'Ready', k8sContext)
          .then(() => info('Machinist ready'))
      ])
    }

    if (context.platformatic.skip) {
      try {
        const status = await getClusterStatus({ context })
        if (status.install?.command) {
          info(`\nInstall command:\n${status.install.command}`)
        }
      } catch (err) {
        error(`Note: Could not generate install command: ${err.message}`)
      }
    }
  } else if (cmd === 'down') {
    // Do not need to remove charts, killing the cluster is enough
    await stopCluster({ context })
  } else if (cmd === 'status') {
    const status = await getClusterStatus({ context })

    if (status.error) {
      error(`Error: ${status.error}`)
      process.exit(1)
    }

    if (status.postgres?.connectionString) {
      info(`PostgreSQL: ${status.postgres.connectionString}`)
    }

    if (status.valkey?.connectionString) {
      info(`Valkey: ${status.valkey.connectionString}`)
    }

    if (status.prometheus?.url) {
      info(`Prometheus: ${status.prometheus.url}`)
    }

    if (status.install?.command) {
      info(`\nInstall command:\n${status.install.command}`)
    }
  } else {
    error(`Unknown command: ${cmd}`)
  }
}

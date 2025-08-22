import minimist from 'minimist'
import { loadContext } from '../lib/context.js'
import { startCluster, stopCluster, getClusterStatus } from '../lib/cluster/index.js'
import { installInfra } from '../lib/infra.js'
import { debug, info, warn, error } from '../lib/utils.js'

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
  debug.extend('cluster')(context)

  if (cmd === 'up') {
    await startCluster(context.cluster, { context })
    if (Object.keys(context.dependencies || {}).length > 0) {
      await installInfra(context.dependencies, { context })
    }

    try {
      const status = await getClusterStatus({ context })
      if (status.install?.command) {
        info(`\nInstall command:\n${status.install.command}`)
      }
    } catch (error) {
      warn(`Note: Could not generate install command: ${error.message}`)
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

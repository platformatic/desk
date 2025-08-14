import minimist from 'minimist'
import { loadContext } from '../lib/context.js'
import { startCluster, stopCluster } from '../lib/cluster.js'
import { installInfra } from '../lib/infra.js'
import { debug } from '../lib/utils.js'

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
  } else if (cmd === 'down') {
    // Do not need to remove charts, killing the cluster is enough
    await stopCluster({ context })
  } else if (cmd === 'status') {
    // TODO
  } else {
    console.error(`Unknown command: ${cmd}`)
  }
}

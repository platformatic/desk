import { resolve, sep, basename } from 'node:path'
import minimist from 'minimist'
import dotenv from 'dotenv'
import { loadContext } from '../lib/context.js'
import { error, info } from '../lib/utils.js'
import * as registry from '../lib/registry.js'
import * as deploy from '../lib/deploy.js'
import { getClusterStatus } from '../lib/cluster/index.js'

export const options = { command: 'deploy', strict: true }

export default async function cli (argv) {
  const args = minimist(argv, {
    bool: ['dry-run'],
    string: ['dir', 'image', 'namespace', 'envfile', 'profile', 'version'],
    alias: {
      dir: 'd',
      image: 'i',
      namespace: 'n',
      envfile: 'e',
      profile: 'p',
      version: 'v'
    },
    default: {
      namespace: 'platformatic'
    }
  })

  if (!args.profile) {
    error('Missing --profile flag. Please specify a profile (e.g. --profile skew-protection)')
    process.exit(1)
  }

  const context = await loadContext(args.profile)

  if (!args.dir && !args.image) {
    error('Missing --dir or --image flags. One must be passed')
    process.exit(1)
  }

  if (args.dir && args.image) {
    error('Cannot use both --dir and --image flags. One must be passed')
    process.exit(1)
  }

  let appImage = args.image
  let appName
  if (args.dir) {
    const directory = resolve(args.dir)
    appName = basename(directory).split(sep).pop()
    appImage = `plt.localreg/plt-local/${appName}:${Date.now()}`
    await registry.buildFromDirectory(directory, appImage)
  } else {
    appName = appImage.split(':')[0].split('/').pop()
  }

  const envVars = {}
  if (args.envfile) {
    dotenv.config({
      path: [resolve(args.envfile)],
      processEnv: envVars
    })
  }

  const clusterStatus = await getClusterStatus({ context })
  if (clusterStatus.kafka?.connectionString) {
    envVars.KAFKA_CONNECTION_STRING = clusterStatus.kafka.connectionString
  }

  const version = args.version

  await deploy.createDeployment(appName, appImage, args.namespace, envVars, args['dry-run'], { context, version })
  await deploy.createService(appName, appImage, args.namespace, args['dry-run'], { context, version })

  const gatewayConfig = context.cluster.provider.config.gateway
  const hasGatewayAPI = gatewayConfig?.enable === true && gatewayConfig?.name !== 'traefik'

  if (version) {
    // Versioned deploys route through Gateway API HTTPRoutes managed by ICC
    if (!args['dry-run']) {
      info('\nVersioned deployment creating. ICC will manage routing via Gateway API.')
      info(`App: ${appName}, Version: ${version}`)
    }
  } else if (hasGatewayAPI) {
    // Profile uses Gateway API — create a basic HTTPRoute for the non-versioned deploy.
    // ICC will replace this HTTPRoute when the first versioned deploy arrives.
    await deploy.createHTTPRoute(appName, args.namespace, args['dry-run'], { context })

    if (!args['dry-run']) {
      info('\nApplication deploying. It may take some time to see it available.')
      info(`Application URL: https://svcs.gw.plt/${appName}/`)
    }
  } else {
    // Profile uses Traefik — add to IngressRoute
    await deploy.addToIngress(appName, appName, args.namespace, args['dry-run'], { context })
    await deploy.updateTraefikMiddleware(appName, args.namespace, args['dry-run'], { context })

    if (!args['dry-run']) {
      info('\nApplication deploying. It may take some time to see it available.')
      info(`Application URL: https://svcs.gw.plt/${appName}/`)
    }
  }
}

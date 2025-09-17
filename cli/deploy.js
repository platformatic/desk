import { resolve, sep, basename } from 'node:path'
import minimist from 'minimist'
import dotenv from 'dotenv'
import { loadContext } from '../lib/context.js'
import { error } from '../lib/utils.js'
import * as registry from '../lib/registry.js'
import * as deploy from '../lib/deploy.js'

export const options = { command: 'deploy', strict: true }

export default async function cli (argv) {
  const args = minimist(argv, {
    bool: ['dry-run'],
    string: ['dir', 'image', 'namespace', 'envfile', 'profile'],
    alias: {
      dir: 'd',
      image: 'i',
      namespace: 'n',
      envfile: 'e',
      profile: 'p'
    },
    default: {
      namespace: 'platformatic'
    }
  })

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
  if (args.dir) {
    const directory = resolve(args.dir)
    appImage = `plt.localreg/plt-local/${basename(directory).split(sep).pop()}:${Date.now()}`
    await registry.buildFromDirectory(directory, appImage)
  }

  const envVars = {}
  if (args.envfile) {
    dotenv.config({
      path: [resolve(args.envfile)],
      processEnv: envVars
    })
  }

  await deploy.createDeployment(appImage, args.namespace, envVars, args['dry-run'], { context })
  await deploy.createService(appImage, args.namespace, args['dry-run'], { context })
}

import minimist from 'minimist'
import commist from 'commist'
import cluster from './cli/cluster.js'
import deploy from './cli/deploy.js'
import profile from './cli/profile.js'
import help from './cli/help.js'
import { info } from './lib/utils.js'

const program = commist()

async function main () {
  const argv = process.argv.splice(2)

  if (argv.length === 0) {
    info(help())
    process.exit(0)
  }

  const globalArgs = minimist(argv, {
    boolean: ['help'],
    string: ['profile'],
    alias: {
      help: 'h',
      profile: 'p'
    }
  })

  if (argv.length > 0 && globalArgs.help) {
    info(help(argv))
    process.exit(0)
  }

  const result = await program
    .register({ command: 'help', strict: true }, async function () {
      // line(help())
      process.exit(0)
    })
    .register({ command: 'cluster', strict: true }, cluster)
    .register({ command: 'deploy', strict: true }, deploy)
    .register({ command: 'profile', strict: true }, profile)
    .parseAsync(argv)

  return result
}

main().then(result => {
  if (result) {
    console.error(`Unable to find command '${result}'`)
    process.exit(1)
  }
})

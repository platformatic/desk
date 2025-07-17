import minimist from 'minimist'
import { error } from '../lib/utils.js'

export const options = { command: 'cluster', strict: true }

export default async function cli (argv) {
  const args = minimist(argv, {
    string: ['profile'],
    alias: {
      profile: 'p',
    }
  })
  const [cmd] = args._

  if (cmd === 'up') {
  } else if (cmd === 'down') {
  } else if (cmd === 'status') {
  } else {
    error(`Unknown subcommand: ${cmd}`)
    process.exit(1)
  }
}

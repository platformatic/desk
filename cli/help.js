import help from '../lib/help.js'
import { info } from '../lib/utils.js'

export const options = { command: 'help', strict: true }

export default async function cli (args) {
  info(await help(args))
  process.exit(0)
}

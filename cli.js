import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import minimist from 'minimist'
import commist from 'commist'
import { info, warn, error, section } from './lib/utils.js'
import help from './lib/help.js'

const program = commist()

async function main () {
  const argv = process.argv.splice(2)

  if (argv.length === 0) {
    info(await help())
    process.exit(0)
  }

  const globalArgs = minimist(argv, {
    boolean: ['help'],
    alias: {
      help: 'h',
    }
  })

  if (argv.length > 0 && globalArgs.help) {
    info(await help(argv))
    process.exit(0)
  }

  const commandsPath = join(import.meta.dirname, 'cli')
  for (const dirent of await readdir(commandsPath, { withFileTypes: true })) {
    if (!dirent.isFile()) continue
    const { default: cmd, options } = await import(join(commandsPath, dirent.name))

    if (!options || !cmd) throw new Error(`Command is not configured correctly: ${dirent.name}`)

    program.register(options, cmd)
  }

  program.register({ command: 'test', strict: true }, function () {
    section('Testing')
    info('info Without args')
    info('info With args', { lol: 'lollers' })

    warn('warn Without args')
    warn('warn With args', { lol: 'lollers' })

    error('error Without args')
    error('error With args', { lol: 'lollers' })
  })

  const result = await program.parseAsync(argv)

  return result
}

main().then(result => {
  if (result) {
    console.error(`Unable to find command '${result}'`)
    process.exit(1)
  }
})

#!/usr/bin/env node
/*
 * Copyright 2025 Platformatic
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import minimist from 'minimist'
import commist from 'commist'
import { info } from './lib/utils.js'
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

  const result = await program.parseAsync(argv)

  return result
}

main().then(result => {
  if (result) {
    console.error(`Unable to find command '${result}'`)
    process.exit(1)
  }
})

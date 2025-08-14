import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const HELP_DOCS_DIR = join(import.meta.dirname, '..', 'docs')

export default async function help (command = []) {
  command = command.filter(c => c.startsWith('-') === false)
  if (command.length === 0) command = ['help']

  command[command.length - 1] = `${command[command.length - 1]}.txt`

  const helpDoc = join(HELP_DOCS_DIR, ...command)
  return readFile(helpDoc, 'utf-8')
}

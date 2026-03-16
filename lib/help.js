import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const HELP_DOCS_DIR = join(import.meta.dirname, '..', 'docs')

export default async function help (argv = []) {
  const parsed = argv.filter(c => c.startsWith('-') === false)
  const command = parsed.length > 0 ? parsed[0] : 'help'

  const helpDoc = join(HELP_DOCS_DIR, `${command}.txt`)
  return readFile(helpDoc, 'utf-8')
}

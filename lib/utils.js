import { readFile } from 'node:fs/promises'
import yaml from 'yaml'
import pc from 'picocolors'
import nanospawn from 'nano-spawn'
import Debug from 'debug'

export const debug = Debug('plt-desk')

export function info (msg, ...args) {
  if (args.length > 0) {
    console.log(msg, args)
  } else {
    console.log(msg)
  }
}

export function section (msg) {
  console.log(pc.bold(`-- ${msg} --`))
}

export function warn (msg, ...args) {
  msg = pc.yellow(msg)
  if (args.length > 0) {
    console.log(msg, args)
  } else {
    console.log(msg)
  }
}

export function error (msg, ...args) {
  msg = pc.red(msg)
  if (args.length > 0) {
    console.log(msg, args)
  } else {
    console.log(msg)
  }
}

export function spawn (cmd, args = [], options = {}) {
  debug(`Executing CLI: ${cmd} ${args.join(' ')}`)
  return nanospawn(cmd, args, options)
}

export async function spawnWithOutput (cmd, args = []) {
  debug(`Executing CLI: ${cmd} ${args.join(' ')}`)
  const subprocess = nanospawn(cmd, args)

  // Stream output using async iterators
  for await (const line of subprocess) {
    console.log(line)
  }
}

export function clusterName (contextName) {
  return `plt-${contextName}`
}

/**
 * Reads a YAML file, replacing the `{{ NAME }}` placeholders with `templateValues`.
 *
 * A placeholder without a value is left as it is, unless `missing` is 'empty': then it is replaced with an empty
 * string, and `onMissing` receives the names of those placeholders. Profiles use it, so that an optional variable
 * absent from .env becomes an empty value instead of reaching a service as a literal `{{ NAME }}`.
 */
export async function loadYamlFile (filePath, templateValues = {}, { missing = 'keep', onMissing } = {}) {
  let fileContents = await readFile(filePath, 'utf8')

  for (const [key, val] of Object.entries(templateValues)) {
    const regex = new RegExp(`{{ ?${key} ?}}`, 'g')
    const finalVal = Array.isArray(val)
      ? `"${val.join('","')}"`
      : val
    fileContents = fileContents.replaceAll(regex, finalVal)
    debug.extend('yaml')({ key, finalVal, regex })
  }

  if (missing === 'empty') {
    const names = new Set()
    fileContents = fileContents.replaceAll(/{{ ?([A-Z][A-Z0-9_]*) ?}}/g, (_, name) => {
      names.add(name)
      return ''
    })
    if (names.size > 0) onMissing?.([...names])
  }

  return yaml.parse(fileContents)
}

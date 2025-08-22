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

export function spawn (cmd, args = []) {
  debug(`Executing CLI: ${cmd} ${args.join(' ')}`)
  return nanospawn(cmd, args)
}

export function clusterName (contextName) {
  return `plt-${contextName}`
}

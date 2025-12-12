import pc from 'picocolors'
import { spawn } from './utils.js'

const REQUIRED_TOOLS = [
  {
    name: 'docker',
    versionArgs: ['--version'],
    versionRegex: /Docker version ([\d.]+)/,
    installUrl: 'https://docs.docker.com/get-docker/'
  },
  {
    name: 'k3d',
    versionArgs: ['version'],
    versionRegex: /k3d version v?([\d.]+)/,
    installUrl: 'https://k3d.io/#installation'
  },
  {
    name: 'kubectl',
    versionArgs: ['version', '--client', '--output=yaml'],
    versionRegex: /gitVersion: v?([\d.]+)/,
    installUrl: 'https://kubernetes.io/docs/tasks/tools/'
  },
  {
    name: 'helm',
    versionArgs: ['version', '--short'],
    versionRegex: /v?([\d.]+)/,
    installUrl: 'https://helm.sh/docs/intro/install/'
  }
]

async function checkTool (tool) {
  try {
    const result = await spawn(tool.name, tool.versionArgs)
    const output = result.output
    const match = output.match(tool.versionRegex)
    const version = match ? match[1] : 'unknown'
    return { name: tool.name, installed: true, version }
  } catch {
    return { name: tool.name, installed: false, installUrl: tool.installUrl }
  }
}

export async function checkAllTools () {
  const results = await Promise.all(REQUIRED_TOOLS.map(checkTool))
  return results
}

export function formatResults (results) {
  const lines = []
  let allInstalled = true

  for (const result of results) {
    if (result.installed) {
      lines.push(`${pc.green('✓')} ${result.name} ${pc.dim(`(${result.version})`)}`)
    } else {
      allInstalled = false
      lines.push(`${pc.red('✗')} ${result.name} ${pc.dim(`- Install: ${result.installUrl}`)}`)
    }
  }

  return { output: lines.join('\n'), allInstalled }
}

export async function verifyTools () {
  const results = await checkAllTools()
  const { output, allInstalled } = formatResults(results)
  return { results, output, allInstalled }
}

export function getMissingTools (results) {
  return results.filter(r => !r.installed)
}

import { join } from 'node:path'
import { homedir } from 'node:os'
import { existsSync } from 'node:fs'
import { debug as Debug, info, spawn, spawnWithOutput } from './utils.js'

const debug = Debug.extend('registry')

export async function start (registryConfig) {
  debug({ registryConfig })
  try {
    await spawn('k3d', [
      'registry',
      'create',
      registryConfig.name,
      '--image=ligfx/k3d-registry-dockerd:v0.6',
      '--volume=/var/run/docker.sock:/var/run/docker.sock',
      '--proxy-remote-url=https://plt.localreg'
    ])
  } catch (err) {
    debug({ err })
    if (!err?.stderr?.includes('A registry node with that name already exists')) {
      throw err
    }
  }
}

export async function buildFromDirectory (directory, tag, includeNpmrc = true, buildArgs = {}) {
  const dockerfilePath = join(directory, 'Dockerfile')
  if (!existsSync(dockerfilePath)) throw new Error(`No Dockerfile found in ${directory}`)

  info(`Building ${tag} from ${directory}`)
  let args = [
    'build',
    `--tag=${tag}`,
    `--file=${dockerfilePath}`,
  ]

  if (includeNpmrc) args.push(`--secret=id=npmrc,src=${join(homedir(), '.npmrc')}`)

  args = args.concat(Object.entries(buildArgs).map(([key, value]) => {
    return `--build-arg=${key}=${value}`
  }))

  // context directory is set last
  args.push(directory)
  await spawnWithOutput('docker', args)
}

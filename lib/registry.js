import { debug as Debug, spawn } from './utils.js'

const debug = Debug.extend('registry')

export async function start (registryConfig) {
  debug({ registryConfig })
  try {
    await spawn('k3d', [
      'registry',
      'create',
      registryConfig.name,
      `--image=ligfx/k3d-registry-dockerd:v0.6`,
      `--volume=/var/run/docker.sock:/var/run/docker.sock`,
      '--proxy-remote-url=*'
    ])
  } catch (err) {
    debug({ err })
    if (!err?.stderr?.includes('A registry node with that name already exists')) {
      throw err
    }
  }
}

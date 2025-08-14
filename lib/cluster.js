import { join } from 'node:path'
import { spawn } from './utils.js'

export function clusterName (contextName) {
  return `plt-${contextName}`
}

export async function startCluster (cluster, { context }) {
  switch (cluster.provider.name) {
    case 'k3d':
      return startK3d({
        provider: cluster.provider,
        ...context
      })
    default:
      throw new Error('Incompatible cluster provider')
  }
}

export async function stopCluster ({ context }) {
  const { cluster, name } = context

  switch (cluster.provider.name) {
    case 'k3d':
      return stopK3d({ name })
    default:
      throw new Error('Incompatible cluster provider')
  }
}

async function startK3d ({ provider, chartDir, name, platformatic }) {
  const { config } = provider

  let args = [
    'cluster',
    'create',
    clusterName(name) || 'platformatic'
  ]

  args = [
    ...args,
    ...config.args,
    // TODO can't use ports that are already mapped
    // Not sure where to find this information at the moment
    // We could catch the error when there is a port conflict and keep retrying
    // but the process is slow and the error dense.
    // Alternatively, since this is docker we could probably look at running images
    ...config.ports.map(portNum => `--port=${portNum}:${portNum}@loadbalancer`),
    `--registry-use=${config.registry.address}`,
    `--registry-config=${join(chartDir, config.registry.configPath)}`,
    `--servers=${config.nodes}`
  ]

  const volumes = Object.entries(platformatic)
    .filter(([, config]) => config.hotReload && config.local?.path)
    .map(([name, config]) => `--volume=${config.local.path}:/data/local/${name}@server:0`)

  args = args.concat(volumes)

  await spawn('k3d', args)
}

async function stopK3d ({ name }) {
  await spawn('k3d', ['cluster', 'rm', clusterName(name)])
}

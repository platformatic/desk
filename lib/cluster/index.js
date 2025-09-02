import * as k3d from './k3d.js'
import * as registry from '../registry.js'
import { spawn } from '../utils.js'

export async function startCluster (cluster, { context }) {
  await registry.start(context.cluster.provider.config.registry)

  switch (cluster.provider.name) {
    case 'k3d':
      await k3d.startCluster({
        provider: cluster.provider,
        ...context
      })

      await Promise.all(cluster.namespaces.map(ns => {
        return spawn('kubectl', ['create', 'namespace', ns])
      }))

      return
    default:
      throw new Error('Incompatible cluster provider')
  }
}

export async function stopCluster ({ context }) {
  const { cluster, name } = context

  switch (cluster.provider.name) {
    case 'k3d':
      return k3d.stopCluster({ name })
    default:
      throw new Error('Incompatible cluster provider')
  }
}

export async function getClusterStatus ({ context }) {
  const { cluster, name } = context

  switch (cluster.provider.name) {
    case 'k3d':
      return k3d.getStatus({ name, context })
    default:
      throw new Error('Incompatible cluster provider')
  }
}

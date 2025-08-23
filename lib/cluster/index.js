import * as k3d from './k3d.js'

export async function startCluster (cluster, { context }) {
  switch (cluster.provider.name) {
    case 'k3d':
      return k3d.startCluster({
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

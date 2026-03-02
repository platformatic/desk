import { setTimeout } from 'node:timers/promises'
import * as k3d from './k3d.js'
import * as registry from '../registry.js'
import { spawn, debug } from '../utils.js'

async function waitForApiServer (maxAttempts = 30, intervalMs = 2000) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await spawn('kubectl', ['cluster-info'])
      return
    } catch {
      debug(`Waiting for K8s API server (attempt ${i}/${maxAttempts})`)
      if (i < maxAttempts) await setTimeout(intervalMs)
    }
  }
  throw new Error('K8s API server did not become ready in time')
}

export async function startCluster (cluster, { context }) {
  await registry.start(context.cluster.provider.config.registry)

  switch (cluster.provider.name) {
    case 'k3d':
      await k3d.startCluster({
        provider: cluster.provider,
        ...context
      })

      await waitForApiServer()

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

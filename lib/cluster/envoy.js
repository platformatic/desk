import { debug } from '../utils.js'

export async function checkResources () {
  // Envoy Gateway CRDs are installed via the envoyproxy/gateway-helm chart
  // during installInfra, not built-in to k3d like Traefik. Nothing to wait
  // for at this stage — the cluster is ready as-is.
  debug('Envoy Gateway — no built-in resources to wait for')
}

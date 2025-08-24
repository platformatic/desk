import { setTimeout } from 'node:timers/promises'
import * as kubectl from '../kubectl.js'
import { debug } from '../utils.js'

export async function checkResources ({ context }) {
  debug('Waiting for traefik')

  try {
    await kubectl.waitFor('crd', 'ingressroutes.traefik.io', 'established', { context })
  } catch (err) {
    if (err.stderr.includes('NotFound')) {
      await setTimeout(3000)
      return checkResources({ context })
    }
    throw err
  }
}

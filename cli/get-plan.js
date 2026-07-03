import minimist from 'minimist'
import { loadContext } from '../lib/context.js'
import { error, info } from '../lib/utils.js'
import { getDeployPlan, getActuationPlan, writeAndPrintPlan } from '../lib/icc.js'

export const options = { command: 'get-plan', strict: true }

// Fetch a skew-protection actuation plan from ICC and print how to apply it with
// kubectl. Read-only: ICC computes the plan and mutates nothing; you apply it.
//   --image given -> deploy plan for a NEW version (Deployment + Service + HTTPRoute)
//   --image absent -> plan for the EXISTING version's state (activate a
//                     pending-apply one, or expire a draining one)
export default async function cli (argv) {
  const args = minimist(argv, {
    string: [
      'profile', 'app-id', 'deploy-token', 'icc-url', 'version', 'image',
      'namespace', 'hostname', 'min-replicas', 'max-replicas'
    ],
    alias: { profile: 'p', version: 'v', image: 'i', namespace: 'n', hostname: 'h' },
    default: { namespace: 'platformatic', 'icc-url': 'https://icc.plt' }
  })

  if (!args.profile) {
    error('Missing --profile flag. Please specify a profile (e.g. --profile skew-protection)')
    process.exit(1)
  }

  const context = await loadContext(args.profile)

  // --app-id is optional: with a deploy token ICC resolves the application from
  // the token, so a CI needs only the token. Pass --app-id for the app-scoped
  // route (e.g. an admin cookie, or to be explicit).
  const appId = args['app-id']
  const token = args['deploy-token'] || process.env.PLT_DEPLOY_TOKEN
  const version = args.version
  if (!token) { error('get-plan requires --deploy-token <plt_deploy_...> or PLT_DEPLOY_TOKEN'); process.exit(1) }
  if (!version) { error('get-plan requires --version <label>'); process.exit(1) }

  const iccUrl = args['icc-url']
  const namespace = args.namespace

  let intent
  let steps
  if (args.image) {
    info(`\nFetching deploy plan for ${version} from ICC (${iccUrl})`)
    const result = await getDeployPlan({
      iccUrl,
      appId,
      token,
      image: args.image,
      version,
      hostname: args.hostname,
      namespace,
      minReplicas: args['min-replicas'] ? parseInt(args['min-replicas'], 10) : undefined,
      maxReplicas: args['max-replicas'] ? parseInt(args['max-replicas'], 10) : undefined
    })
    intent = result.intent
    steps = result.plan
    info(`ICC actuation mode: ${result.mode}`)
  } else {
    info(`\nFetching actuation plan for ${version} from ICC (${iccUrl})`)
    const result = await getActuationPlan({ iccUrl, appId, token, version })
    intent = result.intent
    steps = result.steps
  }

  if (intent === 'none' || !steps || steps.length === 0) {
    info(`No plan for ${version} (intent: ${intent ?? 'none'}). Nothing to apply.`)
    return
  }

  await writeAndPrintPlan(context, namespace, steps, { intent })
}

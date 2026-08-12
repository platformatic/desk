import { resolve, sep, basename, join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import minimist from 'minimist'
import dotenv from 'dotenv'
import { loadContext } from '../lib/context.js'
import { error, info } from '../lib/utils.js'
import * as registry from '../lib/registry.js'
import * as deploy from '../lib/deploy.js'
import { deployViaIcc, handleIccDeploy, writeAndPrintPlan } from '../lib/icc.js'
import { getClusterStatus } from '../lib/cluster/index.js'
import { detectWorkflow } from '../lib/workflow.js'

export const options = { command: 'deploy', strict: true }

// Docker build args for a deploy. Query-string skew protection needs ONE value
// in three places: baked into the client assets as `?dpl=<id>` at build time,
// set as plt.dev/version on the workload, and therefore used as the gateway's
// match key. --version is that value, so it has to reach the build as well as
// the deploy.
//
// Exported so this is covered by a test: the failure is silent. Without the
// build arg the image builds, the workload deploys, and the app runs, but its
// assets carry no ?dpl, so ICC sees a version that was not built with its own id
// and correctly refuses to route to it. Nothing errors.
//
// An app whose Dockerfile does not declare `ARG PLT_DEPLOYMENT_ID=` simply
// ignores it.
export function deployBuildArgs (version) {
  return version ? { PLT_DEPLOYMENT_ID: version } : {}
}

// Is this profile's ICC going to version what we deploy? Read from the profile
// rather than asked of the cluster: the version has to be decided before the
// image is built, which is before anything is deployed.
export function skewProtectionEnabled (context) {
  return context?.platformatic?.services?.icc?.features?.skew_protection?.enable === true
}

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

function base62 (buf) {
  let num = BigInt('0x' + buf.toString('hex'))
  let out = ''
  while (num > 0n) {
    out = BASE62[Number(num % 62n)] + out
    num /= 62n
  }
  return out
}

// A version label for a deploy that did not name one, in the same `plt_` + 24
// base62 shape ICC mints, derived the same way: sha256 of the image reference.
// Deriving rather than randomising means rebuilding the same tag names the same
// version, and desk's tag already carries a timestamp so each deploy differs.
//
// This is not the value ICC would derive for the same image -- ICC hashes
// `tag@sha256:digest`, and the digest does not exist until after the build that
// this id has to be baked into. It does not need to match: a declared
// plt.dev/version wins over derivation, so ICC never derives one here.
export function generateVersion (imageRef) {
  const hash = createHash('sha256').update(String(imageRef)).digest()
  return 'plt_' + base62(hash).slice(0, 24)
}

export function imageName (image) {
  return image.split('/').at(-1).split('@')[0].split(':')[0]
}

export default async function cli (argv) {
  const args = minimist(argv, {
    bool: ['dry-run', 'headless', 'via-icc'],
    string: [
      'dir',
      'image',
      'namespace',
      'envfile',
      'profile',
      'version',
      'hostname',
      'replicas',
      'min-replicas',
      'max-replicas',
      'npmrc',
      'app-id',
      'deploy-token',
      'icc-url'
    ],
    alias: {
      dir: 'd',
      image: 'i',
      namespace: 'n',
      envfile: 'e',
      profile: 'p',
      version: 'v',
      hostname: 'h'
    },
    default: { 'icc-url': 'https://icc.plt' }
  })

  if (!args.profile) {
    error('Missing --profile flag. Please specify a profile (e.g. --profile skew-protection)')
    process.exit(1)
  }

  const context = await loadContext(args.profile)

  if (!args.dir && !args.image) {
    error('Missing --dir or --image flags. One must be passed')
    process.exit(1)
  }

  if (args.dir && args.image) {
    error('Cannot use both --dir and --image flags. One must be passed')
    process.exit(1)
  }

  const envVars = {}
  if (args.envfile) {
    dotenv.config({
      path: [resolve(args.envfile)],
      processEnv: envVars
    })
  }

  let appImage = args.image
  let appName
  let directory
  let dockerfile = ''
  if (args.dir) {
    directory = resolve(args.dir)
    appName = basename(directory).split(sep).pop()
    appImage = `plt.localreg/plt-local/${appName}:${Date.now()}`

    try {
      dockerfile = await readFile(join(directory, 'Dockerfile'), 'utf8')
    } catch {
      // Dockerfile not found or unreadable; the env file can still declare a workflow.
    }
  } else {
    appName = imageName(appImage)
  }

  const isWorkflow = detectWorkflow(dockerfile, envVars)

  // Mint a version when skew protection is on and none was named. It has to be
  // decided here, before the build, because the id is baked into the client
  // assets -- a version assigned afterwards is one ICC cannot pin.
  //
  // Only when building from --dir. A prebuilt --image already carries whatever
  // id it was built with, and a label we invent here would contradict it: ICC
  // would see the mismatch and refuse to route by query anyway.
  const version = args.version ||
    (directory && skewProtectionEnabled(context) ? generateVersion(appImage) : undefined)
  if (version && !args.version) info(`No --version given; using generated version ${version}`)

  const buildArgs = deployBuildArgs(version)
  if (directory) await registry.buildFromDirectory(directory, appImage, { npmrc: args.npmrc, buildArgs })

  const clusterStatus = await getClusterStatus({ context })
  if (clusterStatus.kafka?.connectionString) {
    envVars.KAFKA_CONNECTION_STRING = clusterStatus.kafka.connectionString
  }

  if (clusterStatus.valkeyRegina?.connectionString) {
    envVars.REGINA_VALKEY_CONNECTION_STRING = clusterStatus.valkeyRegina.connectionString
  }

  const hostname = args.hostname

  let minReplicas
  let maxReplicas

  if (args.replicas) {
    const replicas = parseInt(args.replicas, 10)
    minReplicas = replicas
    maxReplicas = replicas
  } else {
    if (args['min-replicas']) {
      minReplicas = parseInt(args['min-replicas'], 10)
    }
    if (args['max-replicas']) {
      maxReplicas = parseInt(args['max-replicas'], 10)
    }
  }

  // ICC-driven deploy: hand the image to ICC's deploy API. ICC creates the
  // workload (Deployment + Service) itself and the pod registers back. This is
  // the CI path a customer uses -- the pipeline holds only a deploy token.
  if (args['via-icc']) {
    // --app-id is optional: with a deploy token ICC resolves the application from
    // the token (the CI needs only the token). Pass --app-id to force the
    // app-scoped route.
    const appId = args['app-id']
    const token = args['deploy-token'] || process.env.PLT_DEPLOY_TOKEN
    if (!token) { error('--via-icc requires --deploy-token <plt_deploy_...> or PLT_DEPLOY_TOKEN'); process.exit(1) }
    if (!version) { error('--via-icc requires --version <label>'); process.exit(1) }

    info(`\nDeploying ${appName}:${version} through ICC (${args['icc-url']}) with image ${appImage}`)
    const result = await deployViaIcc({
      iccUrl: args['icc-url'],
      appId,
      token,
      image: appImage,
      version,
      hostname,
      namespace: args.namespace,
      minReplicas,
      maxReplicas,
      env: Object.keys(envVars).length ? envVars : undefined,
      expirePolicy: isWorkflow ? 'workflow' : undefined
    })
    if (result.pendingApply && result.plan?.length) {
      const planNamespace = result.plan.find(step => step.manifest)?.manifest?.metadata?.namespace || args.namespace || 'platformatic'
      await writeAndPrintPlan(context, planNamespace, result.plan, { intent: 'deploy' })
      return
    }
    handleIccDeploy(result)
    return
  }

  const namespace = args.namespace || 'platformatic'
  await deploy.createDeployment(appName, appImage, namespace, envVars, args['dry-run'], { context, version, isWorkflow, hostname, minReplicas, maxReplicas })
  const serviceName = await deploy.createService(appName, appImage, namespace, args['dry-run'], { context, version, isWorkflow, headless: args.headless })

  if (args.headless) {
    if (!args['dry-run']) {
      info('\nHeadless service deploying. No gateway route will be created.')
      info(`DNS: ${appName}.${namespace}.svc.cluster.local`)
    }
  } else if (version) {
    // Versioned deploys route through Gateway API HTTPRoutes managed by ICC
    if (!args['dry-run']) {
      info('\nVersioned deployment creating. ICC will manage routing via Gateway API.')
      info(`App: ${appName}, Version: ${version}`)
      if (hostname) {
        info(`Application URL: https://${hostname}/`)
      }
    }
  } else {
    // Create a basic HTTPRoute for the non-versioned deploy.
    // ICC will replace this HTTPRoute when the first versioned deploy arrives.
    await deploy.createHTTPRoute(appName, namespace, args['dry-run'], { context, hostname, serviceName })

    if (!args['dry-run']) {
      info('\nApplication deploying. It may take some time to see it available.')
      if (hostname) {
        info(`Application URL: https://${hostname}/`)
      } else {
        info(`Application URL: https://svcs.gw.plt/${appName}/`)
      }
    }
  }
}

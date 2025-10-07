import { join, resolve, isAbsolute } from 'node:path'
import Deepmerge from '@fastify/deepmerge'
import dotenv from 'dotenv'
import { clusterName, debug, loadYamlFile, spawn, warn } from './utils.js'
import { createRunDir } from './run-directory.js'
import { parseProfile } from '../schemas/profile.js'
import { parseConfig } from '../schemas/config.js'
import { CHART_NAME as PLT_CHART_NAME } from './platformatic.js'

const deepmerge = Deepmerge()
const userSecrets = { ...process.env }
dotenv.config({ quiet: true, processEnv: userSecrets })

export async function loadContext (profileNameOrPath, options = {}) {
  let profilePath
  let profileName

  // Check if the input is a path (contains / or \ or ends with .yaml/.yml)
  if (profileNameOrPath.includes('/') || profileNameOrPath.includes('\\') ||
      profileNameOrPath.endsWith('.yaml') || profileNameOrPath.endsWith('.yml')) {
    // It's a path - resolve it to absolute
    profilePath = isAbsolute(profileNameOrPath)
      ? profileNameOrPath
      : resolve(process.cwd(), profileNameOrPath)
    // Extract profile name from filename (without extension)
    const filename = profilePath.split(/[/\\]/).pop()
    profileName = filename.replace(/\.(yaml|yml)$/, '')
  } else {
    // It's just a name - use the default directory
    const profileDir = process.env.DESK_PROFILE_DIR_PATH || join(import.meta.dirname, '..', 'profiles')
    profilePath = join(profileDir, `${profileNameOrPath}.yaml`)
    profileName = profileNameOrPath
  }

  debug({ profilePath, profileName })
  const profileYaml = await loadYamlFile(profilePath, userSecrets)
  const profile = await parseProfile(profileYaml)

  const { configDir, config } = await loadAndParseConfig(profile.version)

  const context = {
    name: profileName,
    schemaVersion: profile.version,
    chartDir: configDir,
    runDir: await createRunDir(),
    cluster: getClusterCtx(profile.cluster, config.cluster),
    dependencies: getDependencyCtx(profile.dependencies, config.dependencies),
    platformatic: getPlatformaticCtx(profile, config),
    secrets: { ...userSecrets },
    kube: {
      contextName: `k3d-${clusterName(profileName)}`
    }
  }

  debug({ context })

  // Validate hot reload configuration for development profile
  // Only validate when running 'cluster up' command, not 'cluster down' or 'cluster status'
  if (options.command === 'up' && profileName === 'development' && context.platformatic.services) {
    const requiredVars = []
    if (context.platformatic.services.icc?.hotReload) {
      if (!userSecrets.ICC_REPO) {
        requiredVars.push('ICC_REPO')
      }
    }
    if (context.platformatic.services.machinist?.hotReload) {
      if (!userSecrets.MACHINIST_REPO) {
        requiredVars.push('MACHINIST_REPO')
      }
    }

    if (requiredVars.length > 0) {
      throw new Error(
        `Development profile, but the following environment variable(s) are not set: ${requiredVars.join(', ')}\n` +
        'Please set them before running the cluster:\n' +
        requiredVars.map(v => `  export ${v}=/path/to/${v.toLowerCase().replace('_repo', '')}`).join('\n') + '\n' +
        `  desk cluster up --profile ${profileName}`
      )
    }

    // run if arch is not intel
    debug({ arch: process.arch })
    if (process.arch !== 'x64') {
      const iccRepo = userSecrets.ICC_REPO
      const pnpmInstallCommand = `NPM_CONFIG_PLATFORM=linux NPM_CONFIG_ARCH=arm64 pnpm install --force`
      // run it in iccRepo directory
      await spawn('bash', ['-c', pnpmInstallCommand], { cwd: iccRepo })
    }
  }

  return context
}

export async function loadAndParseConfig (version) {
  const configDir = process.env.DESK_CHART_DIR_PATH || join(import.meta.dirname, '..', 'charts', `v${version}`)
  const configYaml = await loadYamlFile(join(configDir, 'config.yaml'))
  return { configDir, config: await parseConfig(configYaml, version) }
}

function getClusterCtx (profileCluster, configCluster) {
  const provider = Object.keys(profileCluster).filter(key => !key.includes('namespaces'))[0]

  const cluster = {
    namespaces: Array.from(new Set([
      ...profileCluster.namespaces,
      ...configCluster.namespaces
    ])),

    provider: {
      name: provider,
      config: deepmerge(configCluster[provider], profileCluster[provider]),
    }
  }

  return cluster
}

function getDependencyCtx (profileDependencies, configDependencies) {
  const requestedDependencies = Object.keys(profileDependencies)

  return requestedDependencies.reduce((acc, chart) => {
    const defaults = configDependencies[chart]
    if (!defaults) {
      warn(`${chart} not configured in config.yaml. Skipping setup`)
      return acc
    }

    acc[chart] = deepmerge(defaults, profileDependencies[chart])
    return acc
  }, {})
}

function getPlatformaticCtx (profile, config) {
  const defaultChart = config.dependencies[PLT_CHART_NAME]
  const profileApps = profile.version === 4 ? profile.platformatic.services : profile.platformatic.projects

  return {
    ...profile.platformatic,
    chart: {
      ...defaultChart,
      version: profile.platformatic.chartVersion || defaultChart.version,
    },

    apps: { ...profileApps }
  }
}

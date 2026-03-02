import { info, spawn } from '../lib/utils.js'

const REQUIRED_SOFTWARE = [
  'kubectl',
  'helm',
  'k3d',
  'git',
  'docker',
  'pnpm',
  'psql'
]

async function hasRequiredSoftware () {
  const checkRequired = await Promise.allSettled(REQUIRED_SOFTWARE.map(async (app) => {
    try {
      await spawn('which', [app])
      return app
    } catch {
      const err = new Error('Missing software')
      err.app = app
      throw err
    }
  }))

  const { installed, missing } = checkRequired.reduce((groups, check) => {
    if (check.status === 'fulfilled') {
      groups.installed.push(check.value)
    } else {
      groups.missing.push(check.reason.app)
    }

    return groups
  }, { installed: [], missing: [] })

  if (installed.length > 0) {
    info('Required software installed:')
    for (const app of installed) {
      info(`  - ${app}`)
    }
  }

  if (missing.length > 0) {
    info('Missing:')
    for (const app of missing) {
      info(`  - ${app}`)
    }
  }

  return missing.length === 0
}

hasRequiredSoftware().then(requirementsMet => {
  if (!requirementsMet) {
    info('\nWarning: some required tools are missing. Install them before running desk.')
  }
  process.exit(0)
})

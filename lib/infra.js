import { join } from 'node:path'
import YAML from 'yaml'
import * as helm from './helm.js'
import { addToRun } from './run-directory.js'
import { info } from './utils.js'

export async function installInfra (charts, { context }) {
  const chartList = Object.entries(charts)

  info('Adding helm repositories')
  const chartRepos = chartList
    .filter(([, config]) => config.repo) // Only get charts that are from a repo
    .map(([chart, config]) => ({ name: chart.split('/')[0], url: config.repo }))
    .filter((repo, idx, arr) => {
      return arr.findIndex(r => r.url === repo.url) === idx
    })

  await Promise.all(chartRepos.map(({ name, url }) => {
    return helm.addRepo(name, url)
  }))

  info('Installing helm charts')
  const results = await Promise.all(chartList.map(async ([chart, config]) => {
    const valueFilePaths = []
    if (config.plt_defaults) {
      valueFilePaths.push(join(context.chartDir, ...chart.split('/'), 'overrides.yaml'))
    }

    if (config.overrides) {
      const relativePath = join(chart, 'overrides.yaml')
      const userOverridesPath = await addToRun(context.runDir, relativePath, YAML.stringify(config.overrides))
      valueFilePaths.push(userOverridesPath)
    }

    const k8s = { ...context.kube }
    if (config.namespace) {
      k8s.namespace = config.namespace
    }

    let chartName = chart
    if (config.location) {
      if (config.location.startsWith('./')) {
        chartName = join(context.chartDir, config.location)
      } else {
        chartName = config.location
      }
    }

    // define a name for the release
    const releaseName = config.releaseName || chart.split('/')[1]

    return helm.apply(releaseName, chartName, valueFilePaths, config.version, k8s)
  }))

  return results
}

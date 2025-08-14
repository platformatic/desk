import { join } from 'node:path'
import YAML from 'yaml'
import * as helm from './helm.js'
import { addToRun } from './run-directory.js'
import { info } from './utils.js'

export async function installInfra (charts, { context }) {
  const chartList = Object.entries(charts)

  info('Adding helm repositories')
  const chartRepos = chartList
    .filter(([, config]) => config.repo)
    .map(([chart, config]) => ({ name: chart.split('/')[0], url: config.repo }))
    .filter((repo, idx, arr) => {
      return arr.findIndex(r => r.url === repo.url) === idx
    })

  await Promise.all(chartRepos.map(({ name ,url }) => {
    return helm.addRepo(name, url)
  }))

  info('Installing helm charts')
  await Promise.all(chartList.map(async ([chart, config]) => {
    let valueFilePaths = []
    if (config.plt_defaults) {
      valueFilePaths.push(join(context.chartDir, ...chart.split('/'), 'overrides.yaml'))
    }

    if (config.overrides) {
      const relativePath = join(chart, 'overrides.yaml')
      const userOverridesPath = await addToRun(context.runDir, relativePath, YAML.stringify(config.overrides))
      valueFilePaths.push(userOverridesPath)
    }

    // define a name for the release
    const releaseName = config.releaseName || chart.split('/')[1]

    const chartName = config.location || chart

    return helm.apply(releaseName, chart, valueFilePaths, config.version, context.kube)
  }))
}

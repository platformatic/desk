import { join } from 'node:path'
import { spawn, clusterName } from '../utils.js'
import * as kubectl from '../kubectl.js'

export async function startCluster ({ provider, chartDir, name, platformatic }) {
  const { config } = provider

  let args = [
    'cluster',
    'create',
    clusterName(name) || 'platformatic'
  ]

  args = [
    ...args,
    ...config.args,
    // TODO can't use ports that are already mapped
    // Not sure where to find this information at the moment
    // We could catch the error when there is a port conflict and keep retrying
    // but the process is slow and the error dense.
    // Alternatively, since this is docker we could probably look at running images
    ...config.ports.map(portNum => `--port=${portNum}:${portNum}@loadbalancer`),
    `--registry-use=${config.registry.address}`,
    `--registry-config=${join(chartDir, config.registry.configPath)}`,
    `--servers=${config.nodes}`,
    '--wait'
  ]

  const volumes = []
  let needsNodeImage = false
  if (platformatic.services) {
    Object.entries(platformatic.services)
      .filter(([, config]) => config.hotReload && config.localRepo)
      .forEach(([name, config]) => {
        volumes.push(`--volume=${config.localRepo}:/data/local/${name}@server:0`)
        needsNodeImage = true
      })
  }

  args = args.concat(volumes)

  await spawn('k3d', args)

  if (needsNodeImage) {
    try {
      await spawn('docker', ['pull', 'node:22.20.0-alpine'])
      await spawn('k3d', ['image', 'import', 'node:22.20.0-alpine', '-c', clusterName(name)])
    } catch (err) {
      // Image might already be imported, continue
    }
  }
}

export async function stopCluster ({ name }) {
  await spawn('k3d', ['cluster', 'rm', clusterName(name)])
}

export async function getStatus ({ name, context }) {
  try {
    const postgresConnectionString = await getPostgresConnectionString(name)
    const valkeyConnectionString = await getValkeyConnectionString(name, context)
    const prometheusUrl = await getPrometheusUrl()
    const kubeContext = `k3d-${clusterName(name)}`
    const installCommand = formatInstallCommand({
      postgresConnectionString,
      valkeyConnectionString,
      prometheusUrl,
      kubeContext,
      imagePullToken: context.secrets.PULL_SECRET_TOKEN
    })

    return {
      postgres: {
        connectionString: postgresConnectionString
      },
      valkey: {
        connectionString: valkeyConnectionString
      },
      prometheus: {
        url: prometheusUrl
      },
      install: {
        command: installCommand
      }
    }
  } catch (error) {
    return {
      error: error.message
    }
  }
}

async function getPostgresConnectionString (profileName) {
  try {
    const services = await kubectl.search('svc', ['app.kubernetes.io/name=postgres'])

    if (!services.items || services.items.length === 0) {
      throw new Error('PostgreSQL service not found')
    }

    const postgresService = services.items[0]
    const nodePort = postgresService.spec.ports.find(port => port.name === 'postgresql')?.nodePort

    if (!nodePort) {
      throw new Error('PostgreSQL NodePort not found')
    }

    const dockerListResult = await spawn('docker', [
      'ps',
      '--filter', `name=k3d-${clusterName(profileName)}-server-`,
      '--format', '{{.Names}}'
    ])

    const containerNames = dockerListResult.stdout.trim().split('\n').filter(name => name)

    if (containerNames.length === 0) {
      throw new Error('k3d cluster server container not found')
    }

    const serverContainer = containerNames[0]

    const dockerInspectResult = await spawn('docker', [
      'inspect',
      serverContainer,
      '--format', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
    ])

    const clusterIP = dockerInspectResult.stdout.trim()

    if (!clusterIP) {
      throw new Error('k3d cluster IP not found')
    }

    return `postgresql://postgres:postgres@${clusterIP}:${nodePort}`
  } catch (error) {
    throw new Error(`Failed to get PostgreSQL connection string: ${error.message}`)
  }
}

async function getValkeyConnectionString (profileName, context) {
  try {
    const services = await kubectl.search('svc', ['app.kubernetes.io/name=valkey'])

    if (!services.items || services.items.length === 0) {
      throw new Error('Valkey service not found')
    }

    const valkeyService = services.items.find(service =>
      service.metadata.name.includes('valkey') &&
      !service.metadata.name.includes('headless')
    ) || services.items[0]

    const serviceName = valkeyService.metadata.name
    const port = valkeyService.spec.ports.find(port => port.name === 'valkey')?.port || 6379

    const valkeyConfig = context.dependencies['cloudpirates/valkey']
    const username = valkeyConfig?.auth?.username || 'default'
    const password = valkeyConfig?.auth?.password || 'default'

    return `redis://${username}:${password}@${serviceName}.default.svc.cluster.local:${port}`
  } catch (error) {
    throw new Error(`Failed to get Valkey connection string: ${error.message}`)
  }
}

async function getPrometheusUrl () {
  try {
    const services = await kubectl.search('svc', ['app=kube-prometheus-stack-prometheus'])

    if (!services.items || services.items.length === 0) {
      throw new Error('Prometheus service not found')
    }

    const prometheusService = services.items[0]
    const serviceName = prometheusService.metadata.name
    const port = prometheusService.spec.ports.find(port => port.name === 'http-web')?.port || 9090

    return `http://${serviceName}.default.svc.cluster.local:${port}`
  } catch (error) {
    throw new Error(`Failed to get Prometheus URL: ${error.message}`)
  }
}

function formatInstallCommand ({
  postgresConnectionString,
  valkeyConnectionString,
  prometheusUrl,
  kubeContext,
  imagePullToken
}) {
  return `./scripts/install.sh \\
    --pg-superuser "${postgresConnectionString}" \\
    --valkey-icc "${valkeyConnectionString}" \\
    --valkey-apps "${valkeyConnectionString}" \\
    --prometheus "${prometheusUrl}" \\
    --kube-context "${kubeContext}" \\
    --public-url "https://icc.plt" \\
    --docker-token "${imagePullToken}" \\
    --disable-icc-oauth`
}

import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, clusterName } from '../utils.js'
import * as kubectl from '../kubectl.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

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

  try {
    await spawn('k3d', args)
  } catch (err) {
    if (err.stderr?.includes('already exists')) {
      const profile = name
      throw new Error(
        `Cluster "${clusterName(name)}" already exists.\n` +
        `To remove it and start fresh:\n` +
        `  desk cluster down --profile ${profile}\n` +
        `  desk cluster up --profile ${profile}`
      )
    }

    if (err.stderr?.includes('port is already allocated')) {
      const portMatch = err.stderr.match(/Bind for [\d.:]+:(\d+) failed/)
      const port = portMatch ? portMatch[1] : 'unknown'
      let message = `Port ${port} is already in use. Another k3d cluster may be running.`

      try {
        const result = await spawn('k3d', ['cluster', 'list', '-o', 'json'])
        const clusters = JSON.parse(result.stdout)
        const running = clusters
          .filter(c => c.name !== clusterName(name))
          .map(c => c.name)

        if (running.length > 0) {
          message += `\n\nRunning clusters: ${running.join(', ')}`
          message += `\nStop a conflicting cluster first, e.g.:`
          for (const c of running) {
            const profile = c.replace(/^plt-/, '')
            message += `\n  desk cluster down --profile ${profile}`
          }
        }
      } catch {
        // ignore, best-effort
      }

      throw new Error(message)
    }
    throw err
  }

  if (needsNodeImage) {
    const dockerDir = join(__dirname, '..', '..', 'docker')
    const devDockerfile = join(dockerDir, 'Dockerfile.dev')

    // Build and import dev images for services with hot reload
    if (platformatic.services?.icc?.hotReload) {
      await spawn('docker', ['build', '-t', 'platformatic/icc:dev', '-f', devDockerfile, dockerDir])
      await spawn('k3d', ['image', 'import', 'platformatic/icc:dev', '-c', clusterName(name)])
    }

    if (platformatic.services?.machinist?.hotReload) {
      try {
        await spawn('docker', ['build', '-t', 'platformatic/machinist:dev', '-f', devDockerfile, dockerDir])
        await spawn('k3d', ['image', 'import', 'platformatic/machinist:dev', '-c', clusterName(name)])
      } catch (err) {
        // Image might already exist, continue
      }
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
    const kafkaConnectionString = await getKafkaConnectionString()
    const kubeContext = `k3d-${clusterName(name)}`
    const installCommand = formatInstallCommand({
      postgresConnectionString,
      valkeyConnectionString,
      prometheusUrl,
      kubeContext,
      imagePullToken: context.secrets.PULL_SECRET_TOKEN
    })

    const status = {
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

    if (kafkaConnectionString) {
      status.kafka = {
        connectionString: kafkaConnectionString
      }
    }

    return status
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

async function getKafkaConnectionString () {
  try {
    const services = await kubectl.search('svc', ['app.kubernetes.io/name=kafka'])

    if (!services.items || services.items.length === 0) {
      return null // Kafka is optional, return null if not found
    }

    const kafkaService = services.items.find(service =>
      service.metadata.name.includes('kafka') &&
      !service.metadata.name.includes('headless')
    ) || services.items[0]

    const serviceName = kafkaService.metadata.name
    const port = kafkaService.spec.ports.find(port => port.name === 'tcp-client')?.port || 9092

    return `kafka://${serviceName}.default.svc.cluster.local:${port}`
  } catch (error) {
    // Kafka is optional, return null on error
    return null
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

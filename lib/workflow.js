function unquote (value) {
  const quote = value[0]
  if ((quote === '"' || quote === "'") && value.at(-1) === quote) {
    return value.slice(1, -1)
  }
  return value
}

function parseBoolean (value, source) {
  const normalized = unquote(String(value).trim())
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  throw new Error(`Invalid PLT_WORKFLOW value in ${source}: expected "true" or "false", received "${normalized}"`)
}

function dockerfileEnv (dockerfile) {
  let env = {}
  const stages = new Map()
  const logicalLines = dockerfile.replace(/\\\r?\n/g, ' ').split(/\r?\n/)

  for (const line of logicalLines) {
    const from = /^\s*FROM(?:\s+--\S+)?\s+(\S+)(?:\s+AS\s+(\S+))?\s*$/i.exec(line)
    if (from) {
      env = { ...(stages.get(from[1].toLowerCase()) || {}) }
      if (from[2]) stages.set(from[2].toLowerCase(), env)
      continue
    }

    const instruction = /^\s*ENV\s+(.+)$/i.exec(line)
    if (!instruction) continue

    const args = instruction[1].trim()
    const keyValue = /(?:^|\s)([A-Za-z_][A-Za-z0-9_]*)=("[^"]*"|'[^']*'|[^\s]*)/g
    let match
    let foundKeyValue = false
    while ((match = keyValue.exec(args)) !== null) {
      foundKeyValue = true
      env[match[1]] = unquote(match[2])
    }

    if (!foundKeyValue) {
      const keySpaceValue = /^([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/.exec(args)
      if (keySpaceValue) env[keySpaceValue[1]] = unquote(keySpaceValue[2].trim())
    }
  }

  return env
}

export function detectWorkflow (dockerfile = '', env = {}) {
  if (Object.hasOwn(env, 'PLT_WORKFLOW')) {
    return parseBoolean(env.PLT_WORKFLOW, 'environment file')
  }

  const dockerEnv = dockerfileEnv(dockerfile)
  if (Object.hasOwn(dockerEnv, 'PLT_WORKFLOW')) {
    return parseBoolean(dockerEnv.PLT_WORKFLOW, 'Dockerfile ENV')
  }

  return dockerEnv.WORKFLOW_TARGET_WORLD === '@platformatic/world'
}

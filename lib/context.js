import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

const BASE_CONFIG_PATH = '_charts/config.yaml';

export async function loadContext(profileName) {
  const profilePath = path.join('.profiles', `${profileName}.yaml`);
  const baseConfig = await loadYamlFile(BASE_CONFIG_PATH);
  const profileConfig = await loadYamlFile(profilePath);

  // Combine base configuration with profile configuration
  const context = { ...baseConfig, ...profileConfig };

  // Load the correct configuration from _charts/v<version>/config.yaml_
  const version = profileConfig.version;
  const versionedConfigPath = path.join('_charts', `v${version}`, 'config.yaml');
  const versionedConfig = await loadYamlFile(versionedConfigPath);

  return { ...context, ...versionedConfig };
}

async function loadYamlFile(filePath) {
  try {
    const fileContents = await fs.readFile(filePath, 'utf8');
    return yaml.load(fileContents);
  } catch (error) {
    console.error(`Error loading YAML file ${filePath}:`, error);
    throw error;
  }
}

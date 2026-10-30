import os from 'node:os';
import path from 'node:path';
import { APPS } from '../config/applications.mjs';

export const PRODUCT = 'adobe-mcp-suite';
export const REPOSITORY = 'salehghotbani/adobe-mcp-suite';
export const BADGES = {
  'premiere-pro': 'Pr',
  photoshop: 'Ps',
  'media-encoder': 'Me',
  illustrator: 'Ai',
  indesign: 'Id',
  'after-effects': 'Ae',
  audition: 'Au'
};
const aliases = {
  premiere: 'premiere-pro',
  pr: 'premiere-pro',
  ps: 'photoshop',
  encoder: 'media-encoder',
  me: 'media-encoder',
  ai: 'illustrator',
  id: 'indesign',
  ae: 'after-effects',
  aftereffects: 'after-effects',
  au: 'audition'
};

export function applications(values) {
  const tokens = values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!tokens.length) throw new Error('Choose at least one application with --apps.');
  for (const token of tokens)
    if (token !== 'all' && !Object.hasOwn(APPS, aliases[token] || token))
      throw new Error(`Unknown application: ${token}`);
  const ids = tokens.includes('all')
    ? Object.keys(APPS)
    : tokens.map((value) => aliases[value] || value);
  for (const id of ids) if (!Object.hasOwn(APPS, id)) throw new Error(`Unknown application: ${id}`);
  return Object.keys(APPS).filter((id) => ids.includes(id));
}

export function installHome({
  platform = process.platform,
  env = process.env,
  home = os.homedir()
} = {}) {
  if (env.ADOBE_MCP_HOME) return path.resolve(env.ADOBE_MCP_HOME);
  if (platform === 'win32')
    return path.join(env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'AdobeMCPSuite');
  if (platform === 'darwin')
    return path.join(home, 'Library', 'Application Support', 'AdobeMCPSuite');
  return path.join(env.XDG_DATA_HOME || path.join(home, '.local', 'share'), PRODUCT);
}

export function extensionsHome({
  platform = process.platform,
  env = process.env,
  home = os.homedir()
} = {}) {
  if (platform === 'win32')
    return path.join(
      env.APPDATA || path.join(home, 'AppData', 'Roaming'),
      'Adobe',
      'CEP',
      'extensions'
    );
  if (platform === 'darwin')
    return path.join(home, 'Library', 'Application Support', 'Adobe', 'CEP', 'extensions');
  throw new Error(
    'Native Adobe CEP installation is supported on Windows and macOS. Use --server-only on Linux.'
  );
}

export function assetName(version, platform = process.platform, arch = process.arch) {
  const label = { win32: 'windows', darwin: 'macos', linux: 'linux' }[platform];
  if (!label || !['x64', 'arm64'].includes(arch) || (platform === 'win32' && arch !== 'x64'))
    throw new Error('No portable bundle is available for this platform and architecture.');
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid stable version.');
  return `${PRODUCT}-v${version}-${label}-${arch}.zip`;
}

export function compareVersions(a, b) {
  if (!/^\d+\.\d+\.\d+$/.test(a) || !/^\d+\.\d+\.\d+$/.test(b))
    throw new Error('Invalid stable version.');
  const left = a.split('.').map(Number),
    right = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return 0;
}

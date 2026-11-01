import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { stdin } from 'node:process';
import path from 'node:path';
import { APPS } from '../config/applications.mjs';
import { VERSION } from '../config/project.mjs';
import { applications, BADGES, installHome } from '../installer/platform.mjs';
import { readState, atomicWrite, withLock } from '../installer/storage.mjs';
import {
  clientConfiguration,
  diagnoseInstallation,
  enableUnsigned,
  installApplications,
  rollbackInstallation,
  repairInstallation,
  sourceInstallation,
  uninstallApplications
} from '../installer/manager.mjs';
import { checkForUpdates, startUpdateMonitor, updateInstallation } from '../installer/updates.mjs';

const HELP = `Adobe MCP Suite ${VERSION}

Usage: adobe-mcp <command> [options]

  list                         List all seven Adobe tool sets
  install --apps ps,premiere    Install or add selected tools (interactive if omitted)
  uninstall --apps ps           Remove selected tools; retain the manager and credentials
  uninstall --all               Remove all selected tool sets
  status                       Show installation and platform information
  doctor                       Verify installed files, configuration and panel ownership
  doctor --live                Also check selected running bridges and panel connections
  repair                       Rebuild generated launchers, configuration and owned panels
  config                       Print MCP client JSON for the selected tools
  update                       Download, verify and install the latest stable release
  rollback                     Restore the previous installed version
  updates check                Check for a newer stable release now
  updates on | off             Enable or disable automatic checks
  updates interval --hours 24  Set the check interval (1–168 hours)
  run photoshop                Start one installed MCP server on stdio

Options:
  --apps <IDs>                 Comma-separated IDs/aliases or all; may be repeated
  --root <directory>           Dedicated installation home
  --extensions-dir <directory> Override the Windows/macOS CEP directory
  --server-only                Install servers without native Adobe CEP panels
  --with-panels                Install CEP panels on Windows/macOS
  --live                       Probe running bridges with doctor (read only)
  --enable-unsigned            Explicitly enable unsigned CEP development panels
  --replace-existing           Back up and replace an unmanaged project panel
  --json                       Machine-readable management output
  --help | --version

Windows and macOS support CEP installation. Linux provides server-only mode.
Automatic checks notify only; updates are installed only by the update command.
`;

const commandOptions = {
  list: [],
  install: [
    'apps',
    'extensions-dir',
    'server-only',
    'with-panels',
    'enable-unsigned',
    'replace-existing'
  ],
  uninstall: ['apps', 'all'],
  status: [],
  doctor: ['live'],
  repair: ['replace-existing'],
  config: [],
  update: [],
  rollback: [],
  updates: ['hours'],
  run: []
};

function selectAvailable(values, available) {
  const ids = applications(values);
  const all = values.some((value) =>
    value.split(',').some((token) => token.trim().toLowerCase() === 'all')
  );
  if (!all)
    for (const id of ids)
      if (!available.includes(id)) throw new Error(`Application is not installed: ${id}`);
  const selected = ids.filter((id) => available.includes(id));
  if (!selected.length)
    throw new Error('No installed applications are available for this selection.');
  return selected;
}

async function choose(values, available = Object.keys(APPS)) {
  if (values?.length) return selectAvailable(values, available);
  if (!available.length) throw new Error('No applications are installed.');
  if (!stdin.isTTY) throw new Error('Use --apps in a non-interactive terminal.');
  console.error(
    available.map((id, i) => `${i + 1}. [${BADGES[id]}] ${APPS[id].title} (${id})`).join('\n')
  );
  const input = createInterface({ input: stdin, output: process.stderr });
  try {
    const answer = await input.question('Choose comma-separated numbers, IDs, or all: ');
    if (!answer.trim()) throw new Error('No applications selected.');
    const choices = answer.split(',').map((value) => {
      const token = value.trim();
      return /^\d+$/.test(token) ? available[Number(token) - 1] || 'invalid-selection' : token;
    });
    return selectAvailable(choices, available);
  } finally {
    input.close();
  }
}

export async function main(argv = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      apps: { type: 'string', multiple: true },
      root: { type: 'string' },
      'extensions-dir': { type: 'string' },
      'server-only': { type: 'boolean' },
      'with-panels': { type: 'boolean' },
      live: { type: 'boolean' },
      'enable-unsigned': { type: 'boolean' },
      'replace-existing': { type: 'boolean' },
      all: { type: 'boolean' },
      json: { type: 'boolean' },
      hours: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' }
    }
  });
  if (values.version) {
    console.log(VERSION);
    return;
  }
  if (values.help || !positionals.length) {
    console.log(HELP);
    return;
  }
  const [command, subcommand, ...extra] = positionals;
  if (!Object.hasOwn(commandOptions, command))
    throw new Error(`Unknown command: ${command}. Use --help.`);
  if (extra.length) throw new Error('Too many command arguments.');
  if (subcommand && !['run', 'updates'].includes(command))
    throw new Error('Unexpected positional argument. Use --apps to select applications.');
  const allowed = new Set([
    'root',
    ...commandOptions[command],
    ...(command === 'run' ? [] : ['json'])
  ]);
  for (const option of Object.keys(values))
    if (!allowed.has(option)) throw new Error(`Option --${option} is not supported by ${command}.`);
  if (values.all && values.apps) throw new Error('Use either --all or --apps for removal.');
  if (values['server-only'] && values['with-panels'])
    throw new Error('Choose either --server-only or --with-panels.');
  if (command === 'updates') {
    if (!['check', 'on', 'off', 'interval'].includes(subcommand))
      throw new Error('Use updates check, on, off, or interval --hours N.');
    if (values.hours !== undefined && subcommand !== 'interval')
      throw new Error('--hours is only supported by updates interval.');
  }
  const home = path.resolve(values.root || installHome());
  const emit = (value) => console.log(JSON.stringify(value, null, 2));
  if (command === 'list') {
    const state = await readState(home, { optional: true });
    const rows = Object.entries(APPS).map(([id, info]) => ({
      id,
      badge: BADGES[id],
      name: info.title,
      installed: state?.selectedApps.includes(id) || false
    }));
    if (values.json) emit(rows);
    else
      console.log(
        rows
          .map(
            (row) =>
              `[${row.badge}] ${row.name.padEnd(14)} ${row.id.padEnd(16)} ${row.installed ? 'installed' : ''}`
          )
          .join('\n')
      );
    return;
  }
  if (command === 'install') {
    const saved = await readState(home, { optional: true });
    const serverOnly = values['with-panels']
      ? false
      : (values['server-only'] ?? saved?.serverOnly ?? process.platform === 'linux');
    if (!serverOnly && process.platform === 'linux')
      throw new Error('Native Adobe panels are unavailable on Linux. Use --server-only.');
    if (values['enable-unsigned'] && serverOnly)
      throw new Error('Unsigned CEP settings require a Windows/macOS panel installation.');
    const apps = await choose(values.apps);
    const source = await sourceInstallation();
    const state = await installApplications({
      home,
      apps,
      source,
      serverOnly,
      extensionsRoot: values['extensions-dir'],
      replaceExisting: values['replace-existing']
    });
    if (values['enable-unsigned']) {
      if (state.serverOnly)
        throw new Error(
          'Tools were installed in server-only mode; unsigned CEP settings were not changed.'
        );
      await enableUnsigned();
    }
    emit({
      installedVersion: state.currentVersion,
      applications: state.selectedApps,
      serverOnly: state.serverOnly,
      home,
      launcher: path.join(
        home,
        'bin',
        process.platform === 'win32' ? 'adobe-mcp.cmd' : 'adobe-mcp'
      ),
      clientConfiguration: path.join(home, 'mcp-servers.json'),
      next: state.serverOnly
        ? 'Add the bin directory to PATH, import the MCP client configuration and reconnect the client. Native Adobe panels are not installed in server-only mode.'
        : 'Add the bin directory to PATH, import the MCP client configuration, then restart Adobe and open the matching CEP panels.'
    });
    return;
  }
  const state = await readState(home);
  if (command === 'config') {
    emit(clientConfiguration(home, state.selectedApps));
    return;
  }
  if (command === 'doctor') {
    const result = await diagnoseInstallation(home, { live: values.live });
    emit(result);
    if (!result.healthy) process.exitCode = 1;
    return;
  }
  if (command === 'repair') {
    const result = await repairInstallation(home, { replaceExisting: values['replace-existing'] });
    emit({
      repaired: true,
      version: result.currentVersion,
      applications: result.selectedApps,
      restartRequired: true
    });
    return;
  }
  if (command === 'status') {
    emit({
      home,
      version: state.currentVersion,
      previousVersion: state.previousVersion,
      applications: state.selectedApps.map((id) => ({
        id,
        badge: BADGES[id],
        name: APPS[id].title
      })),
      platform: process.platform,
      architecture: process.arch,
      serverOnly: state.serverOnly,
      extensionsRoot: state.extensionsRoot,
      updates: state.updates,
      nativeAdobeVerified: false
    });
    return;
  }
  if (command === 'uninstall') {
    const apps = values.all ? state.selectedApps : await choose(values.apps, state.selectedApps);
    const result = await uninstallApplications(home, apps);
    emit({ removed: apps, remaining: result.selectedApps, credentialsRetained: true });
    return;
  }
  if (command === 'update') {
    emit(await updateInstallation(home));
    return;
  }
  if (command === 'rollback') {
    const result = await rollbackInstallation(home);
    emit({
      version: result.currentVersion,
      previousVersion: result.previousVersion,
      restartRequired: true
    });
    return;
  }
  if (command === 'updates') {
    if (subcommand === 'check') {
      const result = await checkForUpdates(home, { force: true });
      emit(result);
      if (result.status === 'unavailable') process.exitCode = 1;
      return;
    }
    await withLock(home, '.install.lock', async () => {
      const fresh = await readState(home);
      if (subcommand === 'on' || subcommand === 'off') fresh.updates.enabled = subcommand === 'on';
      else if (subcommand === 'interval') {
        const hours = Number(values.hours);
        if (!Number.isInteger(hours) || hours < 1 || hours > 168)
          throw new Error('Use --hours with an integer from 1 through 168.');
        fresh.updates.intervalHours = hours;
      } else throw new Error('Use updates check, on, off, or interval --hours N.');
      await atomicWrite(path.join(home, 'state.json'), fresh);
      emit(fresh.updates);
    });
    return;
  }
  if (command === 'run') {
    const selected = applications([subcommand || '']);
    if (selected.length !== 1 || !state.selectedApps.includes(selected[0]))
      throw new Error('This application is not installed. Use install --apps first.');
    process.env.ADOBE_MCP_CONFIG = path.join(home, 'connections.json');
    let stop = () => {};
    if (process.env.ADOBE_MCP_NO_UPDATE_CHECK !== '1') stop = startUpdateMonitor(home);
    process.stdin.once('end', stop);
    process.once('SIGTERM', stop);
    process.once('SIGINT', stop);
    const [{ start }, { catalogs }] = await Promise.all([
      import('../mcp/server.mjs'),
      import('../apps/index.mjs')
    ]);
    await start(selected[0], catalogs[selected[0]]);
    return;
  }
  throw new Error(`Unknown command: ${command}. Use --help.`);
}

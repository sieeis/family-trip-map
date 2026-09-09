import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
if (process.argv.includes('--help')) {
  console.log('Usage: node preflight.mjs PROJECT_FOLDER\nRead-only local checks. Exit 0: basic checks pass; 1: missing/invalid prerequisite. Warnings require review. No secrets printed.');
  process.exit(0);
}
let failed = false;
const report = (level, text) => { console.log(`[${level}] ${text}`); if(level === 'FAIL') failed = true; };
try {
  const root = path.resolve(process.argv[2] || '.');
  const exists = name => fs.existsSync(path.join(root,name));
  if (Number(process.versions.node.split('.')[0]) < 22) report('FAIL','Node.js 22+ required by helpers');
  else report('OK',`Node.js ${process.versions.node}`);
  const git = spawnSync('git',['rev-parse','--is-inside-work-tree'],{cwd:root,encoding:'utf8',windowsHide:true});
  report(git.status === 0 ? 'OK':'WARN','Git repository detection: ' + (git.status === 0 ? 'yes':'no'));
  if (!exists('package.json')) report('FAIL','package.json missing');
  else {
    const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
    report('OK','package.json parsed');
    report(pkg.scripts?.test ? 'OK':'WARN','Test script ' + (pkg.scripts?.test ? 'present':'missing'));
    report(exists('package-lock.json') || exists('pnpm-lock.yaml') || exists('yarn.lock') ? 'OK':'WARN','Dependency lockfile check');
  }
  if (exists('vercel.json')) {
    const config = JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
    report('OK','vercel.json parsed');
    if (config.outputDirectory && !exists(config.outputDirectory)) report('WARN','Configured output directory absent; may require build');
  } else report('WARN','No vercel.json; framework auto-detection may be intentional');
  report(exists('.vercel/project.json') ? 'WARN':'OK',exists('.vercel/project.json') ? 'Existing Vercel link: verify target before deployment':'No inherited Vercel project link');
  if (git.status === 0) {
    for (const name of ['.env.local','.vercel/project.json','node_modules/probe']) {
      const result = spawnSync('git',['check-ignore','--no-index','--',name],{cwd:root,encoding:'utf8',windowsHide:true});
      report(result.status === 0 ? 'OK':'WARN',`Ignore rule for ${name}: ${result.status === 0 ? 'present':'missing'}`);
    }
    const tracked = spawnSync('git',['ls-files','--','.env*'],{cwd:root,encoding:'utf8',windowsHide:true});
    if (tracked.stdout?.split(/\r?\n/).some(name => name && !name.endsWith('.example'))) report('FAIL','Environment files are tracked; inspect locally without sharing contents');
  }
  const example = path.join(root,'.env.example');
  if (fs.existsSync(example)) {
    const keys = [...fs.readFileSync(example,'utf8').matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(m=>m[1]);
    for (const key of keys) report('INFO',`${key}: ${Object.hasOwn(process.env,key) ? 'set in current process':'not in current process (dotenv/provider may supply it)'}`);
  } else report('WARN','No .env.example; document required variable names without values');
} catch (error) { report('FAIL',error.code || 'Invalid configuration or project path'); }
process.exitCode = failed ? 1 : 0;

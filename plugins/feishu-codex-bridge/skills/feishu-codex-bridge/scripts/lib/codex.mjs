import { resolveNodeEntry, runOnce } from './cli.mjs';

// 两个入口的沙箱口径只有这一处。
const SANDBOX_BY_MODE = { ask: 'read-only', run: 'workspace-write' };

export function codexEntry() {
  return resolveNodeEntry({
    command: 'codex',
    packageEntry: '@openai/codex/bin/codex.js',
    overrideEnv: 'FEISHU_BRIDGE_CODEX',
  });
}

// 无人应答审批，固定 approval_policy=never：需要审批的命令直接失败，不会把任务挂住。
export function runTask({ mode, prompt, workdir, timeoutMs, outputFile }) {
  return runOnce({
    entry: codexEntry(),
    cwd: workdir,
    timeoutMs,
    args: [
      'exec',
      '--sandbox',
      SANDBOX_BY_MODE[mode],
      '-c',
      'approval_policy="never"',
      '--skip-git-repo-check',
      '-C',
      workdir,
      '-o',
      outputFile,
      prompt,
    ],
  });
}

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const PATH_SEPARATOR = process.platform === 'win32' ? ';' : ':';

// 全局命令 → 可直接交给 node 执行的入口文件。调用方用数组传参，不经过 shell，避免引号与 % 展开。
export function resolveNodeEntry({ command, packageEntry, overrideEnv }) {
  const override = overrideEnv ? process.env[overrideEnv] : '';
  if (override) {
    if (!existsSync(override)) throw new Error(`${overrideEnv}=${override} 不是已存在的文件`);
    return override;
  }

  const segments = packageEntry.split('/');
  const searchRoots = [dirname(process.execPath), ...(process.env.PATH ?? '').split(PATH_SEPARATOR)];
  for (const root of searchRoots) {
    if (!root) continue;
    const candidate = join(root, 'node_modules', ...segments);
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(`找不到 ${command} 的入口 ${packageEntry}：确认它已全局安装，或用 ${overrideEnv} 指定入口文件`);
}

// 跑一次命令并收完输出；超时则结束该进程。长住监听不走这里。
export function runOnce({ entry, args, cwd, timeoutMs }) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(process.execPath, [entry, ...args], {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (error) {
      resolve({ code: null, stdout: '', stderr: String(error), timedOut: false });
      return;
    }

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    const finish = (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    };
    child.on('exit', finish);
    child.on('error', (error) => finish(String(error)));
  });
}

#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { codexEntry } from './lib/codex.mjs';
import { CONFIG_PATH, readConfig } from './lib/config.mjs';
import { MESSAGE_EVENT_KEY, larkEntry, runLark } from './lib/lark.mjs';
import { runOnce } from './lib/cli.mjs';

const TASK_SCRIPT = join(import.meta.dirname, 'Register-FeishuBridgeTask.ps1');
const results = [];

function report(level, title, detail) {
  results.push({ level, title });
  const suffix = detail ? ` — ${detail}` : '';
  console.log(`[${level}] ${title}${suffix}`);
}

function runPwsh(args, timeoutMs) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn('pwsh', ['-NoProfile', ...args], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    } catch (error) {
      resolve({ code: null, stdout: '', stderr: String(error) });
      return;
    }
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    const timer = setTimeout(() => child.kill(), timeoutMs);
    const finish = (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    };
    child.on('exit', finish);
    child.on('error', (error) => finish(String(error)));
  });
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

async function checkNode() {
  report('OK', `node ${process.version}`);
}

async function checkLark() {
  let entry;
  try {
    entry = larkEntry();
  } catch (error) {
    report('FAIL', 'lark-cli 入口', error.message);
    return;
  }
  const result = await runLark(['--version'], 30_000);
  const version = `${result.stdout}${result.stderr}`.trim().split('\n')[0];
  if (result.code === 0) report('OK', `lark-cli：${version}`, entry);
  else report('FAIL', 'lark-cli 跑不起来', version || `退出码 ${result.code}`);
}

async function checkIdentity() {
  const result = await runLark(['auth', 'status'], 30_000);
  const status = parseJson(result.stdout);
  if (!status) {
    report('FAIL', '机器人身份', `读不出 auth status（退出码 ${result.code}）`);
    return;
  }
  const bot = status.identities?.bot;
  if (bot?.status === 'ready') report('OK', '机器人身份 ready', status.appId);
  else report('FAIL', '机器人身份不可用', `${bot?.status ?? '未知'}：先跑 lark-cli auth login`);

  const openId = status.identities?.user?.openId;
  if (openId) report('INFO', `选白名单可用你本人的 open_id：${openId}`);
}

async function checkCodex() {
  let entry;
  try {
    entry = codexEntry();
  } catch (error) {
    report('FAIL', 'codex 入口', error.message);
    return;
  }
  const result = await runOnce({ entry, args: ['--version'], timeoutMs: 30_000 });
  const version = `${result.stdout}${result.stderr}`.trim().split('\n')[0];
  if (result.code === 0) report('OK', version, entry);
  else report('FAIL', 'codex 跑不起来', version || `退出码 ${result.code}`);
}

function checkConfig() {
  if (!existsSync(CONFIG_PATH)) {
    report('INFO', '还没有配置', '第 2 步写配置');
    return;
  }
  const { config, problems } = readConfig();
  if (!config || problems.length > 0) {
    report('FAIL', `配置不合法：${CONFIG_PATH}`, problems.join('；'));
    return;
  }
  report(
    'OK',
    `配置：工作目录 ${config.workdir}`,
    `入口 ${config.modes.join('/')}（默认 ${config.defaultMode}），白名单 ${config.allowOpenIds.length} 用户 / ${config.allowChatIds.length} 会话`,
  );
}

async function checkService() {
  if (!existsSync(TASK_SCRIPT)) {
    report('FAIL', '计划任务脚本缺失', TASK_SCRIPT);
    return;
  }
  const result = await runPwsh(['-File', TASK_SCRIPT, '-Action', 'status'], 60_000);
  const output = `${result.stdout}${result.stderr}`.trim().split('\n').join(' ').trim();
  if (result.code !== 0) {
    report('INFO', '常驻状态读不到', output || `退出码 ${result.code}`);
    return;
  }
  if (output.includes('absent')) {
    report('INFO', '常驻：未注册计划任务 FeishuCodexBridge');
    return;
  }
  const state = /state=(\S+)/.exec(output)?.[1] ?? '未知';
  const lastRun = /lastRun=(\S+)/.exec(output)?.[1] ?? '未知';
  report('INFO', `常驻：已注册（状态 ${state}，上次运行 ${lastRun}）`);
}

async function checkEventChannel() {
  const result = await runLark(
    ['event', 'consume', MESSAGE_EVENT_KEY, '--max-events', '1', '--timeout', '6s', '--as', 'bot'],
    30_000,
  );
  if (result.stderr.includes('ready')) report('OK', '飞书事件通道可用', MESSAGE_EVENT_KEY);
  else {
    const tail = result.stderr.trim().split('\n').slice(-2).join(' ');
    report('FAIL', '飞书事件通道不可用', tail || `退出码 ${result.code}`);
  }
}

async function main() {
  console.log('飞书桥接体检（只读）');
  await checkNode();
  await checkLark();
  await checkIdentity();
  await checkCodex();
  checkConfig();
  await checkService();
  await checkEventChannel();

  const failed = results.filter((item) => item.level === 'FAIL');
  console.log(failed.length === 0 ? '\n结论：无阻断项。' : `\n结论：${failed.length} 项阻断，先修完再继续。`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main();

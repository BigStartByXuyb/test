import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

export const MODES = ['ask', 'run'];

// 配置根目录固定在用户主目录下：登录自启的计划任务读的就是这个位置，不做可改写的覆盖。
export const BRIDGE_HOME = join(homedir(), '.feishu-codex-bridge');
export const CONFIG_PATH = join(BRIDGE_HOME, 'config.json');
export const LOG_DIR = join(BRIDGE_HOME, 'logs');
export const BRIDGE_LOG_PATH = join(LOG_DIR, 'bridge.log');
export const TASK_LOG_DIR = join(LOG_DIR, 'tasks');
export const STATE_DIR = join(BRIDGE_HOME, 'state');
export const LOCK_PATH = join(STATE_DIR, 'bridge.lock');
export const SEEN_PATH = join(STATE_DIR, 'seen-messages.json');

// 配置判据只有这一处：写入前和读取时都走这里。
export function validateConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return ['配置不是 JSON 对象'];

  const problems = [];

  if (typeof config.workdir !== 'string' || config.workdir === '') {
    problems.push('workdir 必须是非空字符串');
  } else if (!isAbsolute(config.workdir)) {
    problems.push(`workdir 必须是绝对路径：${config.workdir}`);
  } else if (!existsSync(config.workdir)) {
    problems.push(`workdir 不存在：${config.workdir}`);
  }

  if (!Array.isArray(config.modes) || config.modes.length === 0) {
    problems.push('modes 必须是非空数组');
  } else {
    const unknown = config.modes.filter((mode) => !MODES.includes(mode));
    if (unknown.length > 0) problems.push(`modes 含未知入口：${unknown.join(', ')}`);
  }

  if (!MODES.includes(config.defaultMode)) {
    problems.push(`defaultMode 必须是 ${MODES.join(' 或 ')}`);
  } else if (Array.isArray(config.modes) && !config.modes.includes(config.defaultMode)) {
    problems.push('defaultMode 必须在 modes 内');
  }

  const openIds = config.allowOpenIds;
  const chatIds = config.allowChatIds;
  if (!Array.isArray(openIds) || !Array.isArray(chatIds)) {
    problems.push('allowOpenIds 与 allowChatIds 必须是数组');
  } else if (openIds.length === 0 && chatIds.length === 0) {
    problems.push('白名单为空：至少要有一个 allowOpenIds 或 allowChatIds 条目');
  } else if ([...openIds, ...chatIds].some((id) => typeof id !== 'string' || id === '')) {
    problems.push('白名单条目必须是非空字符串');
  }

  for (const field of ['taskTimeoutMinutes', 'queueLimit']) {
    if (!Number.isInteger(config[field]) || config[field] <= 0) {
      problems.push(`${field} 必须是正整数`);
    }
  }

  return problems;
}

export function readConfig() {
  if (!existsSync(CONFIG_PATH)) {
    return { config: null, problems: [`还没有配置文件：${CONFIG_PATH}`] };
  }
  let config;
  try {
    config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  } catch (error) {
    return { config: null, problems: [`配置文件不是合法 JSON：${error.message}`] };
  }
  return { config, problems: validateConfig(config) };
}

export function writeConfig(config) {
  mkdirSync(BRIDGE_HOME, { recursive: true });
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

export function ensureRuntimeDirs() {
  for (const dir of [LOG_DIR, TASK_LOG_DIR, STATE_DIR]) mkdirSync(dir, { recursive: true });
}

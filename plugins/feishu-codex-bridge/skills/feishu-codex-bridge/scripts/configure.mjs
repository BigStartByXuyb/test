#!/usr/bin/env node
import { CONFIG_PATH, readConfig, validateConfig, writeConfig } from './lib/config.mjs';

const USAGE = [
  '用法：node configure.mjs --workdir <绝对路径> [--allow-open-id <ou_xxx>]... [--allow-chat-id <oc_xxx>]...',
  '                       [--modes ask,run] [--default-mode ask] [--timeout-minutes 30] [--queue-limit 5]',
  '',
  '本次传了任一白名单参数，就整体替换旧名单；没传则沿用旧名单。',
].join('\n');

function parseArgs(argv) {
  const flags = {};
  const openIds = [];
  const chatIds = [];

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const takeValue = () => {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`${key} 缺少值`);
      index += 1;
      return value;
    };

    switch (key) {
      case '--workdir':
        flags.workdir = takeValue();
        break;
      case '--allow-open-id':
        openIds.push(takeValue());
        break;
      case '--allow-chat-id':
        chatIds.push(takeValue());
        break;
      case '--modes':
        flags.modes = takeValue().split(',').map((item) => item.trim()).filter((item) => item !== '');
        break;
      case '--default-mode':
        flags.defaultMode = takeValue();
        break;
      case '--timeout-minutes':
        flags.taskTimeoutMinutes = Number(takeValue());
        break;
      case '--queue-limit':
        flags.queueLimit = Number(takeValue());
        break;
      case '--help':
        flags.help = true;
        break;
      default:
        throw new Error(`未知参数 ${key}`);
    }
  }

  return { flags, openIds, chatIds };
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(USAGE);
    process.exit(2);
  }
  if (parsed.flags.help) {
    console.log(USAGE);
    return;
  }

  const { config: existing } = readConfig();
  const base = existing ?? {};
  // 传了任一白名单参数就整体替换两条名单：收紧权限时不能留下上一轮的旧条目。
  const whitelistTouched = parsed.openIds.length > 0 || parsed.chatIds.length > 0;
  const next = {
    workdir: parsed.flags.workdir ?? base.workdir ?? '',
    modes: parsed.flags.modes ?? base.modes ?? ['ask', 'run'],
    defaultMode: parsed.flags.defaultMode ?? base.defaultMode ?? 'ask',
    allowOpenIds: whitelistTouched ? parsed.openIds : base.allowOpenIds ?? [],
    allowChatIds: whitelistTouched ? parsed.chatIds : base.allowChatIds ?? [],
    taskTimeoutMinutes: parsed.flags.taskTimeoutMinutes ?? base.taskTimeoutMinutes ?? 30,
    queueLimit: parsed.flags.queueLimit ?? base.queueLimit ?? 5,
  };

  const problems = validateConfig(next);
  if (problems.length > 0) {
    console.error('配置不合法，未写入：');
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(1);
  }

  writeConfig(next);
  console.log(`已写入 ${CONFIG_PATH}`);
  console.log(JSON.stringify(next, null, 2));
}

main();

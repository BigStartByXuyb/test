#!/usr/bin/env node
import { appendFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { BRIDGE_LOG_PATH, LOCK_PATH, SEEN_PATH, TASK_LOG_DIR, ensureRuntimeDirs, readConfig } from './lib/config.mjs';
import { runTask } from './lib/codex.mjs';
import { listenMessages, replyText } from './lib/lark.mjs';

const MAX_REPLY_CHARS = 3000;
const SEEN_LIMIT = 500;
const HELP_TEXT = [
  '可用命令：',
  '/status — 桥接状态（本地即时回答）',
  '/ask <文本> — 只读问答，不改文件',
  '/run <文本> — 在工作目录内执行，可改文件',
  '/help — 本说明',
  '裸文本按默认入口处理；群聊里只认 / 开头的命令。',
].join('\n');

let config = null;
let listener = null;
const state = {
  startedAt: Date.now(),
  queue: [],
  running: false,
  recent: [],
  seen: new Set(),
  shuttingDown: false,
};

function log(level, message) {
  const line = `[${new Date().toISOString()}] ${level} ${message}`;
  console.log(line);
  appendFileSync(BRIDGE_LOG_PATH, `${line}\n`, 'utf8');
}

async function reply(messageId, text, tag) {
  const result = await replyText({ messageId, tag, text });
  if (!result || result.code !== 0) {
    log('error', `回贴失败 ${messageId}：${(result?.stderr ?? '').trim()}`);
  }
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function acquireLock() {
  if (existsSync(LOCK_PATH)) {
    const pid = Number.parseInt(readFileSync(LOCK_PATH, 'utf8').trim().split(/\s+/)[0], 10);
    if (Number.isInteger(pid) && processAlive(pid)) {
      log('error', `已有桥接进程在跑（pid ${pid}），本次退出`);
      process.exit(1);
    }
  }
  writeFileSync(LOCK_PATH, `${process.pid} ${new Date().toISOString()}\n`, 'utf8');
}

function releaseLock() {
  if (existsSync(LOCK_PATH)) unlinkSync(LOCK_PATH);
}

function loadSeen() {
  if (!existsSync(SEEN_PATH)) return;
  try {
    const raw = JSON.parse(readFileSync(SEEN_PATH, 'utf8'));
    if (Array.isArray(raw)) state.seen = new Set(raw);
  } catch (error) {
    log('warn', `去重记录读不出来，按空处理：${error.message}`);
  }
}

function markSeen(messageId) {
  state.seen.add(messageId);
  const kept = [...state.seen].slice(-SEEN_LIMIT);
  state.seen = new Set(kept);
  writeFileSync(SEEN_PATH, `${JSON.stringify(kept)}\n`, 'utf8');
}

function isAllowed(event) {
  return config.allowOpenIds.includes(event.sender_id) || config.allowChatIds.includes(event.chat_id);
}

function parseCommand(text) {
  if (!text.startsWith('/')) return { name: config.defaultMode, prompt: text, explicit: false };
  const head = text.split(/\s+/)[0];
  return { name: head.slice(1).toLowerCase(), prompt: text.slice(head.length).trim(), explicit: true };
}

function statusText() {
  const lines = [
    `运行中：${Math.round((Date.now() - state.startedAt) / 1000)}s`,
    `入口：${config.modes.join(' / ')}（默认 ${config.defaultMode}）`,
    `工作目录：${config.workdir}`,
    `队列：${state.queue.length} 排队 / ${state.running ? '1 执行中' : '空闲'}`,
    `白名单：${config.allowOpenIds.length} 个用户 / ${config.allowChatIds.length} 个会话`,
    '最近任务：',
    ...(state.recent.length > 0 ? state.recent.map((item) => `- ${item}`) : ['- 无']),
  ];
  return lines.join('\n');
}

function composeReply({ headline, body, stderr, outputFile }) {
  const parts = [headline];
  if (body !== '') parts.push('', body);
  else if (stderr.trim() !== '') parts.push('', stderr.trim().slice(0, 1500));
  const text = parts.join('\n');
  if (text.length > MAX_REPLY_CHARS) {
    return `${text.slice(0, MAX_REPLY_CHARS)}\n…（已截断，完整输出：${outputFile}）`;
  }
  return text;
}

async function execute(job) {
  const outputFile = join(TASK_LOG_DIR, `${job.messageId}.md`);
  const startedAt = Date.now();
  log('info', `开始 ${job.messageId} mode=${job.mode}`);
  await reply(job.messageId, `已受理（${job.mode}）：${job.prompt}`, 'accepted');

  const result = await runTask({
    mode: job.mode,
    prompt: job.prompt,
    workdir: config.workdir,
    timeoutMs: config.taskTimeoutMinutes * 60_000,
    outputFile,
  });

  const seconds = Math.round((Date.now() - startedAt) / 1000);
  const body = existsSync(outputFile) ? readFileSync(outputFile, 'utf8').trim() : '';
  const headline = result.timedOut
    ? `超时结束（上限 ${config.taskTimeoutMinutes} 分钟）`
    : result.code !== 0
      ? `失败（退出码 ${result.code}）`
      : body === ''
        ? `完成（${seconds}s，无输出）`
        : `完成（${seconds}s）`;

  log('info', `结束 ${job.messageId} ${headline}`);
  state.recent.unshift(`${new Date().toISOString()} ${job.mode} ${headline} ${job.prompt.slice(0, 40)}`);
  state.recent = state.recent.slice(0, 5);
  await reply(job.messageId, composeReply({ headline, body, stderr: result.stderr, outputFile }), 'result');
}

function schedule() {
  if (state.running || state.shuttingDown || state.queue.length === 0) return;
  state.running = true;
  const job = state.queue.shift();
  execute(job)
    .catch((error) => log('error', `任务异常 ${job.messageId}：${error.message}`))
    .finally(() => {
      state.running = false;
      schedule();
    });
}

function enqueue(job) {
  if (state.queue.length >= config.queueLimit) {
    log('warn', `队列已满，丢弃 ${job.messageId}`);
    void reply(job.messageId, `队列已满（上限 ${config.queueLimit}），稍后再发。`, 'notice');
    return;
  }
  state.queue.push(job);
  log('info', `入队 ${job.messageId} mode=${job.mode} 排队=${state.queue.length}`);
  schedule();
}

function dispatch(event) {
  const messageId = event.message_id;
  if (event.sender_type !== 'user') {
    log('info', `忽略非用户消息 ${messageId}`);
    return;
  }
  if (!isAllowed(event)) {
    log('warn', `白名单外消息：sender=${event.sender_id} chat=${event.chat_id}，已忽略`);
    return;
  }
  if (state.seen.has(messageId)) {
    log('info', `重复投递，已忽略 ${messageId}`);
    return;
  }
  markSeen(messageId);

  const command = parseCommand(String(event.content ?? '').trim());
  if (event.chat_type === 'group' && !command.explicit) {
    log('info', `群聊里不带命令的消息，已忽略 ${messageId}`);
    return;
  }

  if (event.message_type !== 'text') {
    void reply(messageId, `只处理文本消息（收到 ${event.message_type}）。发 /help 看用法。`, 'notice');
    return;
  }

  if (command.name === 'status') {
    void reply(messageId, statusText(), 'notice');
    return;
  }
  if (command.name === 'help') {
    void reply(messageId, HELP_TEXT, 'notice');
    return;
  }
  if (command.name === 'ask' || command.name === 'run') {
    if (!config.modes.includes(command.name)) {
      void reply(messageId, `入口 ${command.name} 未开放，当前开放：${config.modes.join(' / ')}`, 'notice');
      return;
    }
    if (command.prompt === '') {
      void reply(messageId, `/${command.name} 后面要跟内容。`, 'notice');
      return;
    }
    enqueue({ messageId, mode: command.name, prompt: command.prompt });
    return;
  }

  void reply(messageId, `未知命令。发 /help 看用法。`, 'notice');
}

function shutdown(reason) {
  if (state.shuttingDown) return;
  state.shuttingDown = true;
  log('info', `退出（${reason}）`);
  if (listener) listener.kill();
  releaseLock();
  setTimeout(() => process.exit(0), 300);
}

function main() {
  ensureRuntimeDirs();
  const loaded = readConfig();
  if (!loaded.config || loaded.problems.length > 0) {
    for (const problem of loaded.problems) log('error', problem);
    log('error', '先按 SKILL.md 第 2 步写配置');
    process.exit(1);
  }
  config = loaded.config;

  acquireLock();
  loadSeen();
  log('info', `桥接启动 pid=${process.pid} 入口=${config.modes.join('/')} 工作目录=${config.workdir}`);

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  listener = listenMessages({
    onEvent: dispatch,
    onStderrLine: (line) => log('lark', line),
    onExit: ({ code, error }) => {
      if (state.shuttingDown) return;
      log('error', `监听进程结束（退出码 ${code}${error ? ` ${error.message}` : ''}）`);
      releaseLock();
      process.exit(code ?? 1);
    },
  });
  if (!listener) {
    releaseLock();
    process.exit(1);
  }
}

main();

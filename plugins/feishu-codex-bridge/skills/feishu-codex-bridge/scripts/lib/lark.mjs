import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolveNodeEntry, runOnce } from './cli.mjs';

export const MESSAGE_EVENT_KEY = 'im.message.receive_v1';

export function larkEntry() {
  return resolveNodeEntry({
    command: 'lark-cli',
    packageEntry: '@larksuite/cli/scripts/run.js',
    overrideEnv: 'FEISHU_BRIDGE_LARK_CLI',
  });
}

// 长住监听：每条事件回调 onEvent，每条 stderr 行回调 onStderrLine，进程结束回调 onExit。
export function listenMessages({ onEvent, onStderrLine, onExit }) {
  let child;
  try {
    // stdin 必须是保持打开的空管道：lark-cli 把 stdin 结束当作停机信号，长住监听一旦 EOF 就退出。
    child = spawn(process.execPath, [larkEntry(), 'event', 'consume', MESSAGE_EVENT_KEY, '--as', 'bot'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch (error) {
    onExit({ code: null, error });
    return null;
  }

  createInterface({ input: child.stdout }).on('line', (line) => {
    const text = line.trim();
    if (text === '') return;
    try {
      onEvent(JSON.parse(text));
    } catch {
      onStderrLine(`事件行不是合法 JSON：${text}`);
    }
  });
  createInterface({ input: child.stderr }).on('line', onStderrLine);
  child.on('exit', (code) => onExit({ code }));
  child.on('error', (error) => onExit({ code: null, error }));
  return child;
}

// 回贴到原消息。同一条消息会有多条回贴（受理 / 结果 / 提示），幂等键必须按回贴种类区分：
// 用同一个键发第二条，飞书会当成重复请求丢掉。重投递时同一种回贴仍然只发一次。
// 截的是消息 ID 那一段，tag 永远保留，否则长短不一的消息 ID 会把不同种类压成同一个键。
export function replyText({ messageId, tag, text }) {
  return runOnce({
    entry: larkEntry(),
    timeoutMs: 60_000,
    args: [
      'im',
      '+messages-reply',
      '--as',
      'bot',
      '--message-id',
      messageId,
      '--text',
      text,
      '--idempotency-key',
      `${messageId.slice(0, 50 - tag.length - 1)}#${tag}`,
    ],
  });
}

// 事件通道连通性探测。有界运行（带 --max-events / --timeout）时 lark-cli 忽略 stdin 结束，
// 所以这里不要求保持 stdin 打开；只有 listenMessages 那种长住监听才需要。
export function probeEventChannel() {
  return runOnce({
    entry: larkEntry(),
    timeoutMs: 30_000,
    args: ['event', 'consume', MESSAGE_EVENT_KEY, '--max-events', '1', '--timeout', '6s', '--as', 'bot'],
  });
}

export function runLark(args, timeoutMs) {
  return runOnce({ entry: larkEntry(), args, timeoutMs });
}

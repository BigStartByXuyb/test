const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const findMarketplaceRoot = (start) => {
  let directory = start;
  while (directory !== path.dirname(directory)) {
    const manifest = path.join(directory, ".claude-plugin/marketplace.json");
    const publisher = path.join(directory, "plugins/agent-plugin-publisher/.claude-plugin/plugin.json");
    if (fs.existsSync(manifest) && fs.existsSync(publisher)) return directory;
    directory = path.dirname(directory);
  }
  return null;
};

const repositoryRoot = findMarketplaceRoot(__dirname);
const workflowPath = repositoryRoot && path.join(repositoryRoot, ".github/workflows/plugin-release.yml");

test("release tags must point to commits already merged to GitHub main", { skip: !workflowPath || !fs.existsSync(workflowPath) }, () => {
  const workflow = fs.readFileSync(workflowPath, "utf8");
  assert.match(workflow, /git fetch --no-tags origin main:refs\/remotes\/origin\/main/);
  assert.match(workflow, /git merge-base --is-ancestor "\$GITHUB_SHA" refs\/remotes\/origin\/main/);
});

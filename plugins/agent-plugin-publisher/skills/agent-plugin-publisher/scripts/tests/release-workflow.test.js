const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "../../../../../../");
const workflow = fs.readFileSync(path.join(repositoryRoot, ".github/workflows/plugin-release.yml"), "utf8");

test("release tags must point to commits already merged to GitHub main", () => {
  assert.match(workflow, /git fetch --no-tags origin main:refs\/remotes\/origin\/main/);
  assert.match(workflow, /git merge-base --is-ancestor "\$GITHUB_SHA" refs\/remotes\/origin\/main/);
});

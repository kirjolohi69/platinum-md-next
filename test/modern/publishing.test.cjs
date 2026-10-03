const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

async function fixture(callback) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'platinum-publish-'));
  try {
    await fs.mkdir(path.join(root, 'scripts'));
    await fs.copyFile(path.join(__dirname, '../../scripts/prepare-github.py'), path.join(root, 'scripts/prepare-github.py'));
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({version:'1.0.1',debianEpoch:1}));
    await fs.writeFile(path.join(root, 'README.md'), '**AI disclosure**\n<!-- download-start -->\nPreview\n<!-- download-end -->\nCredits\n');
    await callback(root, url => spawnSync('python3', [path.join(root, 'scripts/prepare-github.py'),url], {encoding:'utf8'}));
  } finally { await fs.rm(root, {recursive:true,force:true}); }
}

test('public project links point at the owner\'s GitHub repository', async () => {
  await fixture(async (root, run) => {
    const result = run('example-owner'); assert.equal(result.status, 0, result.stderr);
    const url = 'https://github.com/example-owner/platinum-md-next';
    const meta = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
    assert.equal(meta.musicbrainzContact, url); assert.equal(meta.homepage, url);
    assert.equal(meta.repository.url, 'git+' + url + '.git'); assert.equal(meta.bugs.url, url + '/issues');
    assert.equal(meta.version, '1.0.1'); assert.equal(meta.debianEpoch, 1);
    const readme = await fs.readFile(path.join(root, 'README.md'), 'utf8');
    assert.ok(readme.startsWith('**AI disclosure**')); assert.ok(readme.includes(url + '/releases')); assert.ok(readme.endsWith('Credits\n'));
  });
});

test('invalid owners or README markers stop before changing metadata', async () => {
  await fixture(async (root, run) => {
    const file = path.join(root, 'package.json'), original = await fs.readFile(file, 'utf8');
    for (const owner of ['https://github.com/owner', 'owner/repo', '-owner', 'owner name', '']) {
      assert.notEqual(run(owner).status, 0); assert.equal(await fs.readFile(file, 'utf8'), original);
    }
    await fs.writeFile(path.join(root, 'README.md'), 'No markers');
    assert.notEqual(run('example-owner').status, 0);
    assert.equal(await fs.readFile(file, 'utf8'), original);
  });
});

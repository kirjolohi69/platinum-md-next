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
    await fs.copyFile(path.join(__dirname, '../../scripts/prepare-forge.py'), path.join(root, 'scripts/prepare-forge.py'));
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({version:'1.0.1',debianEpoch:1}));
    await fs.writeFile(path.join(root, 'README.md'), '**AI disclosure**\n<!-- download-start -->\nPreview\n<!-- download-end -->\nCredits\n');
    await callback(root, url => spawnSync('python3', [path.join(root, 'scripts/prepare-forge.py'),url], {encoding:'utf8'}));
  } finally { await fs.rm(root, {recursive:true,force:true}); }
}

test('public project links support Codeberg and independent Forgejo hosts', async () => {
  await fixture(async (root, run) => {
    for (const input of ['https://codeberg.org/owner/platinum-md-next', 'https://forge.example.org/team/platinum-md-next.git/']) {
      const result=run(input); assert.equal(result.status,0,result.stderr);
      const url=input.replace(/\/$/,'').replace(/\.git$/,'');
      const meta=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
      assert.equal(meta.musicbrainzContact,url); assert.equal(meta.homepage,url);
      assert.equal(meta.repository.url,'git+'+url+'.git'); assert.equal(meta.bugs.url,url+'/issues');
      assert.equal(meta.version,'1.0.1'); assert.equal(meta.debianEpoch,1);
      const readme=await fs.readFile(path.join(root,'README.md'),'utf8');
      assert.ok(readme.startsWith('**AI disclosure**')); assert.ok(readme.includes(url+'/releases')); assert.ok(readme.endsWith('Credits\n'));
    }
  });
});

test('invalid public URLs or README markers stop before changing metadata', async () => {
  await fixture(async (root, run) => {
    const file=path.join(root,'package.json'), original=await fs.readFile(file,'utf8');
    for (const url of ['http://forge.example.org/u/r','https://token@forge.example.org/u/r','https://forge.example.org/u','https://forge.example.org/u/r?token=secret','https://forge.example.org/u/r#fragment','https://forge.example.org/u/r)bad']) {
      assert.notEqual(run(url).status,0); assert.equal(await fs.readFile(file,'utf8'),original);
    }
    await fs.writeFile(path.join(root,'README.md'),'No markers');
    assert.notEqual(run('https://forge.example.org/u/r').status,0);
    assert.equal(await fs.readFile(file,'utf8'),original);
  });
});

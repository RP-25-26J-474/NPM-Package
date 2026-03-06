const { spawn } = require('child_process');
const fs = require('fs');

const child = spawn('npx', ['rollup', '-c'], { shell: true });

let out = '';
child.stdout.on('data', d => { out += d.toString(); });
child.stderr.on('data', d => { out += d.toString(); });

child.on('close', code => {
  fs.writeFileSync('build_result.txt', out);
  console.log('done, code ' + code);
});

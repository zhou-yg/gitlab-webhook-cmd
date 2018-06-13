const pkg = require('./package.json');
const koa = require('koa');
const fs = require('fs');
const path = require('path');
const app = new koa();
const commander = require('commander');
const args = process.argv;
const koaBody = require('koa-body');
const spawn = require('child_process').spawn;

const gwcConfigFile = path.join(process.cwd(), './gwcrc.json');
var fileConfig = {};
if (fs.existsSync(gwcConfigFile)) {
  fileConfig = require(gwcConfigFile);
} else {
  console.log(`gwcrc.json not found in cwd:${process.cwd()}`);
}

commander
  .version(pkg.version)
  .option('--port <port>', 'web http port')
  .option('--path <path>', 'webhook http path')
  .option('--token <token>', 'webhook http path')
  .parse(args);

const config = Object.assign(fileConfig, {
  path: String(commander.path || '').replace(/^[\/]*/, ''),
  port: commander.port,
  token: commander.token,
});

if (!config.port) {
  config.port = 12345;
}
if (!config.path) {
  config.path = '/webhook';
}

console.log(config);

var message = '@sh:test.sh develop';
console.log(/@sh\:[\s\S]+$/.test(message));
if (/@sh\:[\S\s]+$/.test(message)) {
  const shCmd = message.match(/@sh\:([\S\s]+)$/);
  console.log(shCmd);
}


app.use(koaBody());

app.use((ctx, next) => {
  var m;
  var code;
  if (ctx.request.path === config.path && ctx.request.method === 'POST') {
    const token = ctx.get('x-gitlab-token');
    if (token === config.token) {
      var gitlabJson;

      try {
        gitlabJson = JSON.parse(Object.keys(ctx.request.body)[0]);
      } catch (e) {
        m = ('gitlab-webhooker: Post data are not GitLab JSON');
      }

      if (gitlabJson) {
        const branch = (gitlabJson.object_kind === 'push') ? gitlabJson.ref.split('/').pop() : '';
        const message = gitlabJson.message;

        // shell
        if (/@sh\:[\w\s]+$/.test(message)) {
          const shCmd = message.match(/@sh\:([\S\s]+)$/);
          spawn('sh', shCmd[1].split(' '), {
            cwd: process.cwd(),
          });
        }
      }
    } else {
      m = 'invalid token';
      code = 401;
    }
  } else {
    m = 'invalid path or http method';
    code = 400;
  }
  if (m) {
    ctx.body = m;
    ctx.statusCode = code;
  }
});

app.use((ctx) => {
  ctx.statusCode = 404;
  ctx.body = 'not found';
});


// app.listen(defaultConfig.port);

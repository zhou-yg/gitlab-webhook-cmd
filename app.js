#!/usr/bin/node

const pkg = require('./package.json');
const koa = require('koa');
const fs = require('fs');
const path = require('path');
const app = new koa();
const commander = require('commander');
const args = process.argv;
const koaBody = require('koa-body');
const spawn = require('child_process').spawn;
const net = require('net')

const CWD = process.cwd();
const gwcConfigFile = path.join(CWD, './gwcrc.json');
var fileConfig = {};
if (fs.existsSync(gwcConfigFile)) {
  fileConfig = require(gwcConfigFile);
} else {
  console.log(`gwcrc.json not found in cwd:${CWD}`);
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
if (!config.token) {
  config.token = 'gwc';
}

console.log(config);

// var message = '@sh:test.sh develop';
// console.log(/@sh\:[\s\S]+$/.test(message));
// if (/@sh\:[\S\s]+$/.test(message)) {
//   const shCmd = message.match(/@sh\:([\S\s]+)$/);
//   console.log(shCmd);
// }


app.use(koaBody());

var preProcess = null;

app.use((ctx, next) => {
  var m;
  var code;
  if (ctx.request.path === config.path && ctx.request.method === 'POST') {
    const token = ctx.get('x-gitlab-token');
    if (token === config.token) {
      var gitlabJson = ctx.request.body;

      if (gitlabJson) {
        const branch = (gitlabJson.object_kind === 'push') ? gitlabJson.ref.replace(/refs\/heads\//, '') : '';
        const message = (gitlabJson.commits[gitlabJson.commits.length - 1] || {}).message;

        console.log('commit message:', message);
        // shell
        if (/@sh\:[\S\s]+$/.test(message)) {
          const shCmd = message.match(/@sh\:([\S\s]+)$/);
          console.log(`sh ${shCmd[1]}`, ',' ,shCmd[1], ',', shCmd[1].split(' '), branch);

          if (preProcess) {
            preProcess.kill('SIGHUP');
            console.log('kill pre');
          }

          var shCmdArr = shCmd[1].split(' ').map(s => s.replace(/[\s\n]/g, '')).filter(_ => _);
          if (shCmdArr.length === 1) {
            shCmdArr = shCmdArr.concat(branch);
          }
          if (!fs.existsSync(shCmdArr[0])) {
            console.log(`${shCmdArr[0]} not found in ${CWD}`);
            return;
          }

          preProcess = spawn('sh', [...shCmdArr], {
            cwd: CWD,
          });
          preProcess.stderr.on('data', (data) => {
            console.log(`p1:${data}`);
            preProcess = null;
          });
          preProcess.on('error', (err) => {
            console.log(`p2: `, err);
            preProcess = null;
          });
        } else {
        }
        ctx.body = 'success';
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

var port = config.port;
// 检测端口是否被占用
function portIsOccupied (port) {
 // 创建服务并监听该端口
 var server = net.createServer().listen(port)

 server.on('listening', function () {
   server.close() // 关闭服务
   console.log('listen on: ', port);
   app.listen(port);
 });

 server.on('error', function (err) {
   if (err.code === 'EADDRINUSE') { // 端口已经被使用
     portIsOccupied(port + 1);
   }
 })
}

// 执行
portIsOccupied(port)

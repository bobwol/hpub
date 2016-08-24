var express = require('express');
var router = express.Router();
var sh = require("child_process");
var home = require("os").homedir();
var path = require("path");
var Liner = require("linerstream");

// config配置说明
var cfg = require("../cfg/config.json");
//workpath 工作目录，该目录下至少有一个maindir配置的文件夹，
var workpath = path.resolve(cfg.workpath);
//shell 本地脚本文件，网页上的query命令都会交给这个脚本执行，避免直接执行query时招至攻击
var shellpath = path.join(process.cwd(), "bin/build");
//maindir egret项目路径，需位于workpath目录下
var maindir = path.join(workpath, cfg.maindir);
//apidir api和data所在路径
var apidir = path.join(workpath, cfg.apidir);
//apigen 生成api的工具路径
var apigen = path.join(workpath, cfg.apigen);
//取本地的ip加上配置的nginx端口
var ipstr = sh.execSync('ifconfig').toString();
var weburl = "http://" + ipstr.match(/192\.[0-9]+\.[0-9]+\.[0-9]+/)[0] + (cfg.nginxPort ? (":" + cfg.nginxPort) : '') + "/";


//允许的query命令
var validcmds = ["listbranch", "log", "logcode", "pub", "create", "clean", "distversion", "dist"];
/* GET home page. */
router.get('/', function(req, res, next) {
    if (!req.query.cmd) {
        res.render("index", { ver: "1.5" });
        return;
    }

    if (validcmds.indexOf(req.query.cmd.split(/\s+/)[0]) == -1) {
        res.send("非法请求！");
        return;
    }

    var cmdParas = [maindir, apidir, apigen, weburl].concat(req.query.cmd.split(/\s+/));
    var opName = cmdParas[4];
    var branch = cmdParas[5];//分支名
    if (opName == "log") {
        sh.exec(`cat bin/execlog | grep ${branch}`, (err, stdout, stderr) => {
            if (err) {
                res.send("暂无操作记录");
                console.log(err)
            } else {
                res.send(stdout.toString() + "<br><p class='label label-default'>以上是该分支的操作记录↑</p><br><br><button class='btn btn-small btn-info' onclick=codeLog()>获取代码提交日志</button>");
            }
        });
        return;
    }
    var cmdTag = cmdParas.join("_")
    if (opName == "pub" || opName == "dist") {
        //pub和dist操作标记合并
        cmdTag = [maindir, apidir, apigen, weburl].concat(["pub_dist",branch]);
    }
    //运行中的命令标记
    if (cmdTag.indexOf("listbranch") == -1 && router[cmdTag]) {
        res.send("有一个同分支的" + opName + "任务正在运行，请稍后再试");
        return;
    }


    router[cmdTag] = true;

    if (req.query.pipe) {
        var splitter = new Liner();
        var sp = sh.spawn(shellpath, cmdParas);
        sp.stdout.pipe(splitter) //.pipe(res);
        splitter.on("data", (data) => {
            var out = data.toString();
            console.log(out);
            res.write(out + "<br>");
        })
        splitter.on("end", (data) => {
            res.end('');
        })
    } else {
        sh.execFile(shellpath, cmdParas, (err, stdout, stderr) => {
            if (err) {
                res.send(err + err.toString());
                return;
            }
            res.send(stdout);
            console.log(stdout)
        })
    }
    res.on("finish", () => {
        console.log("finish");
        router[cmdTag] = false;

        var log = getExecName(getClientIp(req), opName, branch);
        if (log) {
            sh.exec(`echo '${log}' >> bin/execlog`, (err, stdout, stderr) => {
                if (err) {
                    console.log(`写入log失败>>${req.url}`, err);
                }
            })
        }
    })

});

function getClientIp(req) {
        var ipstr = req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;
        return ipstr.split(":").pop();
}


function getExecName(ip, op, branch) {
    var dt = new Date();
    var log = dt.getMonth() + 1;
    log += "月" + dt.getDate() + "日";
    log += dt.toTimeString().match(/[0-9]+\:[0-9]+\:[0-9]+/)[0]
    // body...
    var opName = '';
    switch (op) {
        case "pub":
            opName = "本地编译";
            break;
        case "create":
            opName = "检出分支";
            break;
        case "dist":
            opName = "编发行版";
            break;
        case "clean":
            opName = "清除分支";
            break;
        default:
            return '';

    }

    return log + "由" + ip + "对分支" + branch + "进行了" + opName;
}


module.exports = router;

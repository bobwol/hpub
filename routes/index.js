var express = require('express');
var router = express.Router();
var sh = require("child_process");
var home = require("os").homedir();
var path = require("path");
var Liner = require("linerstream");

var advKey = "888888";
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
//高级功能
var adCmds = ["cleanHistoryBranch", "resetExecLog", "updateSelf"];
/* GET home page. */
router.get('/', function(req, res, next) {
    if (!req.query.cmd) {
        res.render("index", { ver: "2.1" });
        return;
    }

    var opName = req.query.cmd.split(/\s+/)[0];

    //高级命令单独处理
    if (adCmds.indexOf(opName) != -1) {
        dealAdvCmd(opName, res, req.query.key);
        return;
    }

    if (validcmds.indexOf(opName) == -1) {
        res.send("非法请求！");
        return;
    }

    var cmdParas = [maindir, apidir, apigen, weburl].concat(req.query.cmd.split(/\s+/));
    var branch = cmdParas[5]; //分支名
    if (opName == "log") {
        sh.exec(`cat bin/execlog | grep ${branch}`, (err, stdout, stderr) => {
            if (err) {
                res.send("暂无操作记录");
                console.log(err)
            } else {
                res.send(stdout.toString().replace("\n", "<br>") +
                    "<br><p class='label label-default'>以上是该分支的操作记录↑</p><br><br><button class='btn btn-small btn-info' onclick=codeLog()>获取代码提交日志</button>");
            }
        });
        return;
    }
    var cmdTag = cmdParas.join("_")
    if (opName == "pub" || opName == "dist") {
        //pub和dist操作标记合并
        cmdTag = [maindir, apidir, apigen, weburl].concat(["pub_dist", branch]).join("_");
    }
    //运行中的命令标记
    if (cmdTag.indexOf("listbranch") == -1 && router[cmdTag]) {
        res.send("有一个同分支的编译任务正在运行，请稍后再试");
        return;
    }


    router[cmdTag] = true;
    res.opTag = cmdTag;
    res.opName = opName;
    res.opBranch = branch;

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
            console.log(stdout);
        })
    }
    //on finish response
    res.on("finish", (code) => {
        onOpFinish(req, res);
    })
});

function onOpFinish(req, res) {
    console.log("finish");
    router[res.opTag] = false;

    var log = getExecName(getClientIp(req), res.opName, res.opBranch);
    if (log) {
        sh.exec(`echo '${log}' >> bin/execlog`, (err, stdout, stderr) => {
            if (err) {
                console.log(`写入log失败>>${req.url}`, err);
            }
        })
    }
}

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

function dealAdvCmd(opName, res, sign) {
    if (sign != advKey) {
        res.send("密钥错误！");
        return;
    }
    // body...
    switch (opName) {
        case "cleanHistoryBranch":
            sh.exec("git branch -a", (err, stdout, stderr) => {
                if (err) {
                    res.send("出错了>>" + err);
                    return;
                }

                data = stdout.toString().replace("*", "")
                var lines = data.split("\n");
                var olds = [];
                for (var i in lines) {
                    var ln = lines[i];
                    ln = ln.trim();
                    if (ln == '') {
                        continue;
                    }
                    if (ln.indexOf("remotes") == -1) {
                        if (data.indexOf("origin/" + ln) == -1) {
                            olds.push(ln);
                        }
                    }
                }
                //clear
                var out = "";
                while (olds.length) {
                    var br = olds.pop();
                    out += sh.execSync(`cd ${maindir} && rm -rf ${br}`);
                }
                res.send(out + "<br>操作完成");
            })
            break;
        case "resetExecLog":
            sh.execSync("git checkout bin/execlog");
            res.send("重置完成");
            break;
        case "updateSelf":
            var str = sh.execSync("git pull")
            res.send(str + "<br>更新完成");
            break;
    }
}


module.exports = router;

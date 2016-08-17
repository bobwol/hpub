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
var weburl = "http://" + ipstr.match(/192\.[0-9]+\.[0-9]+\.[0-9]+/)[0] + ":" + cfg.nginxPort + "/";


//允许的query命令
var validcmds = ["listbranch", "pub", "create", "clean", "distversion", "dist"];
/* GET home page. */
router.get('/', function(req, res, next) {

    if (!req.query.cmd) {
        res.render("index", { ver: "beta 1" });
        return;
    }

    if (validcmds.indexOf(req.query.cmd.split(/\s+/)[0]) == -1) {
        res.send("非法请求！");
        return;
    }

    var cmdParas = [maindir, apidir, apigen].concat(req.query.cmd.split(/\s+/));
    var cmdTag = cmdParas.join("_")
        //运行中的命令标记
    if (cmdTag.indexOf("listbranch") == -1 && router[cmdTag]) {
        res.send("有一个同分支同类型的任务正在运行，请稍后再试");
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
        	if (cmdTag.indexOf("pub") != -1) {
        		var br = cmdParas[4];//第5个参数是分支名
            	res.end(`<a href="${weburl}${br}">点我去测试</a>`);
        	}
        	else {
        		res.end('');
        	}
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
        console.log("finish")
        router[cmdTag] = false;
    })

});


module.exports = router;

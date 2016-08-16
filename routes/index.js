var express = require('express');
var router = express.Router();
var sh = require("child_process");
var home = require("os").homedir();
var path = require("path");
var Liner = require("linerstream");

// config配置说明
var cfg = require("../cfg/config.json");
//workpath 工作目录，该目录下至少有一个maindir配置的文件夹，
var workpath = path.join(home, cfg.workpath);
//shell 本地脚本文件，网页上的query命令都会交给这个脚本执行，避免直接执行query时招至攻击
var shellpath = path.join(process.cwd(), "bin/build");
//maindir egret项目路径，需位于workpath目录下
var maindir = path.resolve(workpath, cfg.maindir);
//apidir api和data所在路径
var apidir = path.resolve(workpath, cfg.apidir);
//apigen 生成api的工具路径
var apigen = path.resolve(workpath, cfg.apigen);


//允许的query命令
var validcmds = ["listbranch", "pub", "create", "clean", "distversion"];
/* GET home page. */
router.get('/', function(req, res, next) {

	if (!req.query.cmd) {
		res.render("index", {ver: "alpha", pubing: false});
		return;
	}

	if (validcmds.indexOf( req.query.cmd.split(/\s+/)[0]) == -1) {
		res.send("非法请求！");
		return;
	}

	var cmdParas = [maindir, apidir, apigen].concat(req.query.cmd.split(/\s+/));
	var cmdTag = cmdParas.join("_")
	//运行中的命令标记
	if (cmdTag.indexOf("listbranch") == -1 && router[cmdTag]) {
		res.send("有一个同分支同类型的任务正在运行，请稍后再试");
		console.log("conflict")
		return;
	}

	router[cmdTag] = true;
	if (req.query.pipe) {
		var sp = sh.spawn(shellpath, cmdParas);
		var splitter = new Liner();
		sp.stdout.pipe(splitter).pipe(res);
		splitter.on("data", (data)=>{
			console.log(data.toString());
		})
	}
	else{
		sh.execFile(shellpath, cmdParas, (err, stdout, stderr)=>{
			res.send(stdout);
			console.log(stdout)
		})
	}
	res.on("finish",()=>{
		console.log("done!")
		router[cmdTag] = false;
	})

	
	
});


module.exports = router;

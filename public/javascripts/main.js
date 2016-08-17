var selectedBranch = "";
// var jqOk
$(() => {
    initWeb();
});

function initWeb(argument) {
    // bind ok btn
    $("#pubLocal").click(pubBranch);
    $("#pubDist").click(distVer);
    $("#cleanBr").click(cleanBranch);
    // get branch info
    getBranchInfo();

}

//使用原生xhr，因为jq的get方法未对响应文件做chunk处理
function fetch(query, cb) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        console.log(xhr.readyState);
        if (xhr.readyState > 2) {
            cb(xhr.responseText, xhr.readyState);
        }
    }
    xhr.open("GET", query, true);
    xhr.send(null);
}

function getBranchInfo() {

    fetch("/?cmd=listbranch", (data, status) => {
        if (status != 4) {
            return;
        }
        data = data.replace("*", "")
        var lines = data.split("\n");
        var locals = [];
        var remotes = [];
        for (var i in lines) {
            var ln = lines[i];
            ln = ln.trim();
            if (ln == '') {
                continue;
            }
            if (ln.indexOf("remotes") == -1) {
                //本地已有的分支
                locals.push(ln);
                $("#branchs").append(`<button class='btn btn-small btn-info' label='${ln}' onclick='chooseBranch("${ln}")'>${ln}</button>`);
            } else {
                remotes.push(ln);
            }
        }

        $("#branchs").append("<hr>");
        //筛选未checkout 到本地的分支
        remotes.forEach((r) => {
            var slashId = r.lastIndexOf("/") + 1;
            var lb = r.substring(slashId);
            if (locals.indexOf(lb) == -1) {
                $("#branchs").append(`<button class='btn btn-warning btn-small' label='${r}' onclick='chooseBranch("${r}")'>${lb}</button>`);
            }

        })
    });
}


function chooseBranch(branch) {
    if (branch.indexOf("remotes") == -1) { //选中了本地分支
        selectedBranch = branch;
        $("#selectInfo").html(`你选中了本地分支->${branch}`);
        $("#btns").css("visibility", "visible");
    } else {
    	$("#mBody").html("您选中的是一个远程分支，该分支目前不存在于版本系统目录下，只有检出到版本目录后，才可以编译相应的分支版本。是否检出到版本系统目录下？");
        $("#myModal").modal("show");
        var slashId = branch.lastIndexOf("/") + 1;
        var lb = branch.substring(slashId);
        $("#btnCreateBr").data("branch", lb);
    }
}

function createBranch() {
	var branch = $("#btnCreateBr").data("branch");
	$("#mBody").html("后台执行中，请勿做任何操作，完成后会自动刷新页面。正在检出...")
    fetch(`/?cmd=create ${branch}&pipe=true`, (data, status) => {
        window.location.reload(); //回到主页
    })
}

function pubBranch() {
    if (!selectedBranch) {
        alert("请先选择一个分支，再点‘打版本’按钮！");
        return;
    }
    $("#btns").css("visibility", "hidden");
    $("#selectInfo").html(`开始编译本地分支->${selectedBranch}，请稍等...`);
    $("#dash").html("正在等待后台响应...");

    fetch(`/?cmd=pub ${selectedBranch}&pipe=true`, (data, status) => {
        dash(data);
        if (status == 4) {
            $("#selectInfo").html(`本地分支->${selectedBranch}，编译完成`);
        }
    })
}

function distVer() {
    if (!selectedBranch) {
        alert("请先选择一个分支，再点‘打版本’按钮！");
        return;
    }
    fetch(`/?cmd=distversion`, (data, status) => {
    	$("#curVer").html(data);
    	$("#inputVer").attr("placeholder", data);
    	$("#verModal").modal("show");
    })
}

function distBranch() {
	ver = $("#inputVer").text();
	if (!ver) {
		ver = $("#curVer").html();
	}
	ver = ver.trim();
	$("#verModal").modal("hide");
    $("#btns").css("visibility", "hidden");

    $("#selectInfo").html(`开始编译分支的发行版->${selectedBranch}，使用版本号${ver},请稍等...`);
    $("#dash").html("正在等待后台响应...");
    fetch(`/?cmd=dist ${selectedBranch} ${ver}&pipe=true`, (data, status) => {
        dash(data);
        if (status == 4) {
            $("#selectInfo").html(`本地分支->${selectedBranch}发行版，更新完成`);
        }
    })
}

function cleanBranch() {
    if (!selectedBranch) {
        alert("请先选择一个分支，再点‘清除’按钮！");
        return;
    }
    $("#dash").html("正在等待后台响应...");
    fetch(`/?cmd=clean ${selectedBranch}`, (data, status) => {
        if (status != 4) {
            return;
        }
        dash(data);
        window.location.reload();
    })
}

function dash(data) {
    console.log(1)
    $("#dash").html(data);
    var div = document.getElementById("dash");
    div.scrollTop = div.scrollHeight
}

var selectedBranch = "";
// var jqOk
$(function() {
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
    xhr.timeout = 1000 * 60 * 20; //最长20min
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

    fetch("/?cmd=listbranch", function(data, status) {
        if (status != 4) {
            return;
        }
        $("#branchs").html('');
        data = data.replace("*", "")
        var lines = data.split("\n");
        var locals = [];
        var remotes = [];
        var outdates = [];
        for (var i in lines) {
            var ln = lines[i];
            ln = ln.trim();
            if (ln == '') {
                continue;
            }
            if (ln.indexOf("remotes") == -1) {
                //本地已有的分支
                var reg = new RegExp(ln , "g");
                if (data.match(reg).length <= 1) {
                    //些本地分支在远程已不存在
                    outdates.push(ln);
                } else {
                    locals.push(ln);
                    $("#branchs").append(`<button class='btn btn-small btn-info' label='${ln}' onclick='chooseBranch("${ln}")'>${ln}</button>`);
                }
            } else {
                remotes.push(ln);
            }
        }


        $("#branchs").append("<hr>");
        //筛选未checkout 到本地的分支
        remotes.forEach(function(r) {
            var slashId = r.lastIndexOf("/") + 1;
            var lb = r.substring(slashId);
            if (locals.indexOf(lb) == -1) {
                $("#branchs").append(`<button class='btn btn-warning btn-small' label='${r}' onclick='chooseBranch("${r}")'>${lb}</button>`);
            }

        });
        //dash回位
        backDash();
        //清除过时分支
        cleanOutDateBranchs(outdates);
    });
}

//批量清除过期分支
function cleanOutDateBranchs(outdates) {
    if (outdates.length) {
        var br = outdates.pop();
        fetch(`/?cmd=clean ${br}`, function(data, status) {
            if (status != 4) {
                return;
            }
            cleanOutDateBranchs(outdates);
        })
    }
}


function chooseBranch(branch) {
    if (branch.indexOf("remotes") == -1) { //选中了本地分支
        selectedBranch = branch;
        $("#selectInfo").html(`你选中了本地分支->${branch}`);
        $("#btns").css("visibility", "visible");
        fetch(`/?cmd=log ${branch}`, function(data, status) {
            $("#dash").html(data);
        });
    } else {
        $("#mBody").html("您选中的是一个远程分支，该分支目前不存在于版本系统目录下，只有检出到版本目录后，才可以编译相应的分支版本。是否检出到版本系统目录下？");
        $("#myModal").modal("show");
        var slashId = branch.lastIndexOf("/") + 1;
        var lb = branch.substring(slashId);
        $("#btnCreateBr").data("branch", lb);

    }
}

function codeLog() {
    if (!selectedBranch) {
        alert("请先选择一个分支!");
        return;
    }
    dash("<h3>拉取显示的是一天内的代码提交记录：</h3><hr>")
    fetch(`/?cmd=logcode ${selectedBranch}&pipe=true`, function(data, status) {
        dash(data, true, true);
    })
}

function createBranch() {
    $(".modal-footer").hide();
    var branch = $("#btnCreateBr").data("branch");
    $("#mBody").html("后台执行中，请勿做任何操作，完成后会自动刷新页面。正在检出...")
    fetch(`/?cmd=create ${branch}&pipe=true`, function(data, status) {
        window.location.reload(); //回到主页
    })
}

function pubBranch() {
    if (!selectedBranch) {
        alert("请先选择一个分支！");
        return;
    }
    $("#btns").css("visibility", "hidden");
    $("#selectInfo").html(`开始编译分支->${selectedBranch}的本地测试版，请稍等...`);
    popDash("命令已发送，请勿进行其他操作！正在等待后台响应...");

    fetch(`/?cmd=pub ${selectedBranch}&pipe=true`, function(data, status) {
        dash(data);
        if (status == 4) {
            $("#selectInfo").html(`本地分支->${selectedBranch}，操作完成`);
            backDash();
        }
    })
}

function distVer() {
    if (!selectedBranch) {
        alert("请先选择一个分支！");
        return;
    }
    $("#curVer").html("正在拉取该分支的版本号...");
    $("#inputVer").attr("placeholder", '');
    $("#verModal").modal("show");
    fetch(`/?cmd=distversion ${selectedBranch}`, function(data, status) {
        $("#curVer").html(data);
        $("#inputVer").attr("placeholder", data);
        $("#verModal").modal("show");
    })
}

function distBranch() {
    ver = $("#inputVer").val();
    if (!ver) {
        ver = $("#curVer").html();
    }
    ver = ver.trim();
    $("#verModal").modal("hide");
    $("#btns").css("visibility", "hidden");

    $("#selectInfo").html(`开始编译分支->${selectedBranch}的发行版，使用版本号${ver},请稍等...`);
    popDash("命令已发送，请勿进行其他操作！正在等待后台响应...");
    fetch(`/?cmd=dist ${selectedBranch} ${ver}&pipe=true`, function(data, status) {
        dash(data);
        if (status == 4) {
            $("#selectInfo").html(`本地分支->${selectedBranch}发行版，操作完成`);
            backDash();
        }
    })
}

function cleanBranch() {
    if (!selectedBranch) {
        alert("请先选择一个分支！");
        return;
    }
    popDash("命令已发送，请勿进行其他操作！正在等待后台响应...");
    fetch(`/?cmd=clean ${selectedBranch}`, function(data, status) {
        if (status != 4) {
            return;
        }
        dash(data);
        window.location.reload();
    })
}

function dash(data, append, cancelScroll) {
    if (append) {
        $("#dash").append(data);
    } else {
        $("#dash").html(data);
    }
    if (cancelScroll) {
        return;
    }
    var div = document.getElementById("dash");
    div.scrollTop = div.scrollHeight
}

function popDash(txt) {
    var ds = $("#dash");
    ds.html(txt);
    $("#poplayer").append(ds);
    $("#cover").fadeIn();
}

function backDash() {
    $("#btns").after($("#dash"));
    $("#cover").fadeOut();
}

//---------advance------
// 清理过时分支
function cleanHistoryBranch() {
    var key = prompt("请输入高级功能的密钥：");
    popDash("命令已发送，请勿进行其他操作！正在等待后台响应...")
    fetch("/?cmd=cleanHistoryBranch&key=" + key, function(data, status) {
        if (status == 4) {
            dash(data);
            dash("<br>操作完成，即将刷新页面...", true);
            setTimeout(window.location.reload(), 3000);
        }
    })
}
// 清除操作日志
function resetExecLog() {
    var key = prompt("请输入高级功能的密钥：");
    popDash("命令已发送，请勿进行其他操作！正在等待后台响应...")
    fetch("/?cmd=resetExecLog&key=" + key, function(data, status) {
        if (status == 4) {
            dash(data);
            dash("<br>操作完成，即将刷新页面...", true);
            setTimeout(window.location.reload(), 3000);
        }
    })
}
// 更新此发版系统 
function updateSelf() {
    var key = prompt("请输入高级功能的密钥：");
    popDash("命令已发送，请勿进行其他操作！正在等待后台响应...")
    fetch("/?cmd=updateSelf&key=" + key, function(data, status) {
        if (status == 4) {
            dash(data);
            dash("<br>操作完成，即将刷新页面...", true);
            setTimeout(window.location.reload(), 3000);
        }
    })
}

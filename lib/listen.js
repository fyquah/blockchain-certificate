var events = require("events");
var exec = require("child_process").exec;
var q = require("q");
var bitcoin = require("bitcoinjs-lib");

var report_error = function(err, stdout, stderr){
    console.log("An error occured");
    console.log("err : ", err);
    console.log("stdout : ", stdout);
    console.log("stderr : ", stderr);
};

setInterval((function(){
    var system_block_count = 0;

    return function(){
        q.fcall(function(){
            exec("bitcoind getblockcount", function(err, stdout, stderr){
                if (err !== null) {
                    report_error(err, stdout, stderr);
                    return;
                }

                var current_block_count = Number(stdout);
                
            });    
        }).then(function(){
            exec("bitcoind getbestblockhash", function(err, stdout, stderr){
                var current_block_hash = stdout;

            });
        }).then(function(current_block_hash){
            exec("bitcoind getblock " + current_block_hash, function(err, stdout, stderr){
                var block = JSON.parse(stdout);
                block["tx"].forEach(function(){
                    // somehow manage to get all the transactions in JSON format
                });
            });
        })
        
    }
})(), 10000);
// listen every 10000 seconds?
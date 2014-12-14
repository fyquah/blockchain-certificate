var events = require("events");
var exec = require("child_process").exec;
var Q = require("q");
var bitcoin = require("bitcoinjs-lib");
var fs = require("fs");
var parser = require("./parser.js");

var report_error = function(err, stdout, stderr){
    console.log("An error occured");
    console.log("err : ", err);
    console.log("stdout : ", stdout);
    console.log("stderr : ", stderr);
};

// listen to updates from bitcoind
setInterval((function(){
    var running_process = false,
        config_file_path = process.env["HOME"] + "/.blockchain-certificate/status.json",
        current_config_json;
    fs.readFile(config_file_path,
    "utf-8", "r", function(err, data){
        if (err) {
            console.log(err);
        } else {
            try {
                current_config_json = JSON.parse(data);
                system_block_count = current_config_json["block_count"] || 0;
            } catch(e) {
                console.log("an error occured in parsing data");
            }
        }
    });
    var update_block_count = function(cb){
        current_config_json["block_count"] += 1;
        fs.writeFile(config_file_path, JSON.stringify(current_config_js), "utf-8", "w" ,cb);
    };


    return function(){
        if(system_block_count === null || running_process === true) {
            return;
        }
        // if system block count not null or running process not undefined, then only work
        exec("bitcoind getblockcount", function(err, stdout, stderr){
            if (err !== null) {
                report_error(err, stdout, stderr);
                return;
            }

            running_process = true;
            var current_block_count = parseInt(stdout);
            process.nexttick(function obtainBlock(){
                Q.promise(function(resolve, reject, notify){
                    exec("bitcoind getblockcount", function(err, res){
                        if (err !== null) {
                            reject(err);
                        }
                        resolve(parseInt(res));
                    });
                }).then(function(res){
                    return Q.promise(function(resolve, reject, notify){
                        current_block_count = res;
                        if(current_block_count === system_block_count) {
                            return; // terminate recursion when system block count in sync with current block count
                        } else {
                            exec("bitcoind getblockhash " + (system_block_count + 1), function(err, res){
                                if (err !== null) {
                                    reject(err);
                                    return;
                                }
                                resolve(res.replace(/^\s+|\s+$/g, ""));
                            });
                        }
                    });
                }).then(function(block_hash){
                    // now that we got the latest hash
                    return Q.promise(function(resolve, reject, notify){
                        exec("bitcoind getblock " + block_hash, function(err, res){
                            if (err !== null) {
                                reject(err);
                                return;
                            }
                            resolve(JSON.parse(res)["tx"])
                        });
                    });
                }).then(function(all_txids){ // with the arry of txids
                    // this is some horrible recursion
                    return Q.promise(function(resolve, reject, notify){
                        var txids = all_txids.concat();
                        process.nexttick(function process_txid(){
                            if(txids.length === 0) {
                                resolve();
                                return;
                            }
                            var txid = txids.shift();
                            // carry out operation
                            exec("bitcoind getrawtransaction " + txid + " 1", function(err, msg){
                                if (err !== null) {
                                    reject(err);
                                    return;
                                }
                                // pass this piece of work to parser
                                parser.process_transaction(JSON.parse(msg));
                                process.nexttick(process_txid);
                            });
                        });
                    });
                }).then(function(){ // updated the block count in system
                    return Q.promise(function(resolve, reject, notify){
                        update_block_count(function(err, msg){
                            if (err !=== null) {
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    });
                }).finally(function(){
                    running_process = false;
                    process.nexttock(obtainBlock); // recursively call the function
                }).catch(function(err){
                    reportError(err);
                }).done();
            });
        });
    }
})(), 10000);
// listen every 10000 seconds?

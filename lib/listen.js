var Q = require("q");
var fs = require("fs");
var bitcoind = require("./bitcoind.js");
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

    var update_block_count = function(cb){
        current_config_json["block_count"] += 1;
        console.log("config file is now " + JSON.stringify(current_config_json));
        fs.writeFile(config_file_path, JSON.stringify(current_config_json), "utf-8", "w" ,cb);
    };

    // initialize the system block count first
    fs.readFile(config_file_path, "utf-8", "r", function(err, data){
        if (err) {
            report_error(err);
            return;
        }
        console.log(data);
        current_config_json = JSON.parse(data);
        console.log("system block count is " + current_config_json["block_count"]);
    });

    return function(){
        if(current_config_json === null || running_process === true) {
            return;
        }
        // if system block count not null or running process not undefined, then only work
        running_process = true;

        process.nextTick(function obtainBlock(){
            Q.promise(function(resolve, reject, notify){
                bitcoind("getblockcount", function(err, res){
                    if (err !== null) {
                        reject(err);
                    }
                    resolve(parseInt(res));
                });
            }).then(function(res){
                console.log("current block count is " + res);
                return Q.promise(function(resolve, reject, notify){
                    current_block_count = res;
                    if(current_config_json["block_count"] > current_block_count) {
                        running_process = false;
                        return; // terminate recursion when system block count in sync with current block count
                    } else {
                        console.log("bitcoind getblockhash " + current_config_json["block_count"]);
                        bitcoind("getblockhash " + current_config_json["block_count"], function(err, res){
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
                    bitcoind("getblock " + block_hash, function(err, stdout){
                        if (err !== null) {
                            reject(err);
                            return;
                        }
                        resolve(JSON.parse(stdout)["tx"])
                    });
                });
            }).then(function(all_txids){ // with the arry of txids
                return Q.promise(function(resolve, reject, notify){
                    var txids = all_txids.concat();
                    process.nextTick(function process_txid(){
                        if(txids.length === 0) {
                            resolve();
                            return;
                        }
                        var txid = txids.shift();
                        // carry out operation
                        console.log("bitcoind getrawtransaction " + txid + " 1");
                        bitcoind("getrawtransaction " + txid + " 1", function(err, stdout, stderr){
                            if (err !== null) {
                                if(stderr.indexOf("\"code\":-5") === -1) { // ignores error occuring to coinbase transctions
                                    reject(err);
                                    return;
                                } else {
                                    // wait till the next function call
                                }
                            } else {
                                // pass this piece of work to parser
                                parser.process_transaction(JSON.parse(stdout));
                            }
                            process.nextTick(process_txid);
                        });
                    });
                });
            }).then(function(){ // updated the block count in system
                return Q.promise(function(resolve, reject, notify){
                    update_block_count(function(err, msg){
                        if (err !== null) {
                            reject(err);
                        } else {
                            resolve();
                            process.nextTick(obtainBlock);
                        }
                    });
                });
            }).finally(function(){
                 // recursively call the function
            }).catch(function(err){
                report_error(err);
            }).done();
        });
    }
})(), 2000);
// listen every 10 seconds?

// would be great if this thing can work out, but for the moment, it will be put on hold
// listener will be the killer to allow us to listen to events from the the blockchain network

var Q = require("q");
var fs = require("fs");
var bitcoind = require(__dirname + "/bitcoind.js");
var parser = require(__dirname + "/parser.js");
var files = require(__dirname + "/files.js");

var report_error = function(err, stdout, stderr){
    console.log("An error occured");
    console.log("err : ", err);
    console.log("stdout : ", stdout);
    console.log("stderr : ", stderr);
};

var periodic_fnc = (function(){
    var running_process = false;

    var update_block_count = function(cb){
        if (bitcoind.is_test_net()) {
            files.status.read()["testnet"]["block_count"] += 1;
        } else {
            files.status.read()["mainnet"]["block_count"] += 1;
        }
        files.config.update(cb);
    };

    // initialize the system block count first

    return function(){
        if(running_process) {
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
                return Q.promise(function(resolve, reject, notify){
                    var system_block_count, current_block_count;
                    current_block_count = res;
                    system_block_count = files.status.read()[(bitcoind.is_test_net() ? "testnet" : "mainnet")]["block_count"];

                    if(system_block_count > current_block_count) {
                        running_process = false;
                        return; // terminate recursion when system block count in sync with current block count
                    } else {
                        bitcoind("getblockhash " + system_block_count, function(err, res){
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
                        resolve(stdout["tx"])
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
                        bitcoind("getrawtransaction " + txid + " 1", function(err, stdout, stderr){
                            if (err !== null) {

                            } else {
                                parser.process_transaction(stdout);
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
            }).catch(function(err){
                report_error(err);
                running_process = false;
            }).done();
        });
    }
})()

// listen to updates from bitcoind
module.exports.start = function(t){
    console.log("Listening to bitcoind at an interval of " + (t || 5000) / 1000 + " seconds");
    setInterval(periodic_fnc, t || 5000);
};
// listen every 10 seconds?

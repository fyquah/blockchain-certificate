var exec = require("child_process").exec;
var fs = require("fs");
var constants = require("./constants.js");
var files = require("./files.js");

var is_test_net = (function(){
    var _is_test_net = files.config.read()["testnet"];
    return function(){
        return _is_test_net;
    }
})();

var bitcoind_error = function(err){
    return {
        "code": constants.ERR_BITCOIND_ERROR,
        "message": err
    };
}

module.exports = function(method_name, cb){
    exec("bitcoind " + (is_test_net() ? "--testnet" : "") + " " + method_name, { "maxBuffer": NaN }, function(err, stdout){
        var res;
        if(err) {
            cb(bitcoind_error(err));
            return;
        }

        try {
            res = JSON.parse(stdout);
        } catch(e) {
            res = stdout.replace(/^\s+|\s+$/g, "");
        }
        cb(null, res);
    });
}

module.exports.is_test_net = is_test_net;
module.exports.bitcoind_error = bitcoind_error;

var exec = require("child_process").exec;
var fs = require("fs");
var files = require("./files.js");

var is_test_net = (function(){
    var _is_test_net = files.config.read()["testnet"];
    return function(){
        return _is_test_net;
    }
})();

module.exports = function(method_name, cb){
    exec("bitcoind " + (is_test_net() ? "--testnet" : "") + " " + method_name, { "maxBuffer": NaN }, function(err, stdout){
        var res;
        try {
            res = JSON.parse(stdout);
        } catch(e) {
            res = stdout.replace(/^\s+|\s+$/g, "");
        }
        cb(err, res);
    });
}

module.exports.is_test_net = is_test_net;

var exec = require("child_process").exec;
var fs = require("fs");

var is_test_net = (function(){
    var config_file_path = process.env["HOME"] + "/.blockchain-certificate/config.json";
    var _is_test_net = false;
    fs.readFile(config_file_path, "utf-8", "r" ,function(err, stdout){
        try {
            _is_test_net = JSON.parse(stdout)["testnet"] ? true : false;
        } catch(e) {
            _is_test_net = false;
        }
    });

    return function(){
        return _is_test_net;
    }
})();

module.exports = function(method_name, cb){
    exec("bitcoind " + (is_test_net() ? "--testnet" : "") + " " + method_name, function(err, stdout){
        var res;
        try {
            res = JSON.parse(stdout);
        } catch(e) {
            res = stdout.replace(/^\s+|\s+$/g, "");
        }
        cb(err, res);
    });
}

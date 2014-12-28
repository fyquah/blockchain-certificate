process.env["NODE_ENV"] = "test";
var jayson = require('jayson');
var fs = require("fs");
var controller = require(__dirname + "/controllers");
var constants = require(__dirname + "/constants.js");
var files = require(__dirname + "/files.js");
var EventEmitter = require('events').EventEmitter;

var inspect_parameters_count  = function(count, params){
    var last = params[params.length - 1];

    if(typeof last === "function" && params.length === count + 1) {
        return null;
    } else if(typeof last !== "function" && params.length === count) {
        return null;
    } else {
        return {
            "code": -1,
            "message": "expected " + count + " parameter(s), but " + (params.length - 1) + " was given"
        };
    }
};
var query_methods = {
    "listrights": ["auth_token"],
    "listnodes": ["auth_token"],
    "listusers": ["auth_token", "metadata"],
    "verifysignature": ["auth_token", "metadata", "address", "document", "signature_r", "signature_s"]
};
var broadcast_methods = {
    "initialize": ["auth_token", "metadata"],
    "terminate": ["auth_token", "metadata"],
    "terminatechild": ["auth_token"],
    "broadcastsignature": ["auth_token", "metadata", "address", "document", "signature_r", "signature_s"],
    "registeruser": ["auth_token", "metadata", "address", "public_key"]
};
var append_method = (function(){
    var _auth_token = files.config.read()["auth_token"];

    return function(obj, type, method_name, arr){
        obj[method_name] = function(){
            var args = {}, i, cb = arguments[arguments.length - 1];
            var error = inspect_parameters_count(arr.length, arguments);
            if(error !== null) {
                cb(error, null);
                return;
            }

            args["method"] = method_name;
            for (i = 0 ; i < arr.length ; i++) {
                args[arr[i]] = arguments[i];
            }

            console.log("valid request to run " + method_name + " is recevied. This is a " + type + " method for the controller");
            console.log("arguments : ");
            console.log(args);

            if(args.auth_token === _auth_token) {
                controller[type](args, function(err, res){
                    if (typeof cb === "function") {
                        cb(err, res);
                    }
                });
            } else {
                cb({
                    "code": constants.ERR_INVALID_AUTH_TOKEN,
                    "error": "auth token not authorized!"
                })
            }
        };
    };
})();

var server_map = {}, prop;

for (prop in query_methods) {
    append_method(server_map, "query", prop, query_methods[prop]);
}

for (prop in broadcast_methods) {
    append_method(server_map, "broadcast", prop, broadcast_methods[prop]);
}

console.log(server_map);

module.exports.start = function(port){
    console.log("JSON-RPC server listening at port " + (port || 9339));
    jayson.server(server_map).http().listen(port || 9339);
};

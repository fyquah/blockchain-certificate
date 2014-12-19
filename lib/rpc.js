var jayson = require('jayson');
var controller = require("./controller.js");
var constants = require("./constants.js");
var fs = require("fs");

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
    var _auth_token;
    fs.readFile(process.env["HOME"] + "/.blockchain-certificate/config.json", function(err, stdout){
        if(err !== null) {
            console.log("an unkown error occured");
            console.log(err);
            throw err;
        }

        var config_file = JSON.parse(stdout);
        _auth_token = config_file["rpc_auth_token"];
    });
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
                        console.log('est');
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
jayson.server(server_map).http().listen(9339);

// List of Things
// create the $HOME/.blockchain-certificate where necessary
// - create the files within the folder where necessary
//    - status.json (initialize with empty json)
//    - config.json (initialize with empty json)
// - kick up the rpc server
// - kick up the event listner

var fs = require("fs");
var securerandom = require("securerandom");
var listener = require(__dirname + "/listener.js");
var file = require(__dirname + "/files.js");
var rpc = require(__dirname + "/jsonrpc.js");

var directory_path = process.env["HOME"] + "/.blockchain-certificate"

module.exports.start = function(options){
    if (!fs.existsSync(directory_path)) {
        fs.mkdirSync(directory_path);
        console.log("I cannot find a $HOME/.blockchain-certificate directory, hence I am creating one");
        console.log("All the database / config / status files will be stored in this directory");
    }

    if (!fs.existsSync(directory_path + "/status.json")) {
        fs.writeFileSync(directory_path + "/status.json", "{}", { "encoding": "utf-8" });
    }

    if (!fs.existsSync(directory_path + "/config.json")) {
        console.log("I cannot find a config file, I will be creating one for you");
        console.log("A random auth token has been created for you (Don't worry, you don't need to remember it)");
        fs.writeFileSync(directory_path + "/config.json", JSON.stringify({
            "auth_token": securerandom.hex(20)
        }), { "encoding": "utf-8" });
    }

    listener.start(options.interval);
    rpc.start(options.port);
};

// List of Things
// create the $HOME/.blockchain-certificate where necessary
// - create the files within the folder where necessary
//    - database.json (initialiaze with object below)
//    - status.json (initialize with empty json)
//    - config.json (initialize with empty json)
// - kick up the rpc server
// - kick up the event listner

var fs = require("fs");
var securerandom = require("secure-random");
var exec = require("child_process").exec;
var directory_path = process.env["HOME"] + "/.blockchain-certificate"

module.exports.start = function(options){
    options = options || {};
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
            "auth_token": securerandom.randomBuffer(20).toString("hex")
        }), { "encoding": "utf-8" });
    }

    if (!fs.existsSync(directory_path + "/database.json")) {
        console.log("I cannot find a database config file, I will be creating one for you");
        fs.writeFileSync(directory_path + "/database.json", JSON.stringify({
          "development": {
            "storage": directory_path + "/development.sqlite3",
            "database": "blockchain-certificate",
            "dialect": "sqlite"
          },
          "test": {
            "storage": directory_path + "/test.sqlite3",
            "database": "test",
            "dialect": "sqlite"
          },
          "production": {
            "storage": directory_path + "/production.sqlite3",
            "database": "test",
            "dialect": "sqlite"
          }
        }), { "encoding": "utf-8" });
    }

    if(["development", "production", "test"].some(function(env){
            return process.env["NODE_ENV"] === env;
        })) {
        console.log("Running in " + process.env["NODE_ENV"] + " mode");
    } else {
        console.log("No mode specified. Going to run in development mode");
        process.env["NODE_ENV"] = "development";
    }

    if (require(__dirname + "/files.js").config.read()["testnet"]) {
        console.log("You are currently running in the testnet");
    }


    exec(__dirname + "/../node_modules/.bin/sequelize db:migrate --config $HOME/.blockchain-certificate/database.json --migrations-path " + __dirname + "/migrations --models-path " + __dirname + "/models --env " + process.env["NODE_ENV"], function(err){
        if(err) throw err;

        require(__dirname + "/bitcoind.js").is_running(function(running){
            if(running) {
                require(__dirname + "/jsonrpc.js").start(options.port);
            } else {
                console.log("error in checking bitcoind running. Is bitcoind running or its path properly configured?");
            }            
        });
    });
};

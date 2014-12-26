var files = require(__dirname + "/files.js");
var constants = require(__dirname + "/constants.js");
var Sequelize = require("sequelize");

var db_configuration = {};
if(files.config.db && files.config.db.dialect === "psql") { // psql configuration

} else { // sqlite (the default configuration)
    if (files.config.db && files.config.db.dialect !== "sqlite") {
        console.log("invalid db dialect provided in config file. Assuming sqlite");
    }

    db_configuration.dialect = "sqlite";
    db_configuration.storage = process.env["HOME"] + "/.blockchain-certificate/" + 
        (process.env["NODE_ENV"] || "development") + ".sqlite3";
}

var sequelize = new Sequelize("database_name", "username", "password", db_configuration);
sequelize.
    authenticate().
    complete(function(err){
        if(err) {
            console.log("failed");
        } else {
            console.log("established connection with database");
        }
    });
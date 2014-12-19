var sqlite = require("sqlite3").verbose();
var path = process.env["HOME"] + "/.blockchain-certificate/" + process.env["NODE_ENV"] + ".sqlite3";

var db = new sqlite.Database(path);
module.exports = db;

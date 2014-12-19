var sqlite = require("sqlite3").verbose();
var db = new sqlite.Database(process.env["HOME"] + "/.blockchain-certificate/db.sqlite3");
module.exports = db;

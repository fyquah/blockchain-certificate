var sqlite = require("sqlite3").verbose();
var db = new sqlite.Database("./hello.sqlite3");
module.exports = db;
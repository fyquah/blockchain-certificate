var sqlite = require("sqlite3").verbose();
var db = new sqlite.Database("./testnet.sqlite3");
module.exports = db;

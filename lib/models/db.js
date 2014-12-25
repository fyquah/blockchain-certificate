var sqlite = require("sqlite3").verbose();
var fs = require("fs");
var path = process.env["HOME"] + "/.blockchain-certificate/" + (process.env["NODE_ENV"] || "development") + ".sqlite3";
var db = new sqlite.Database(path);
module.exports = db;

module.exports.clear = function(cb){
    if(fs.existsSync(path)) {
        var arr = ["users", "nodes", "rights_outputs", "signatures"];
        var returned = false;
        db.serialize(function(){
            arr.forEach(function(table_name, i){
                db.run("DELETE FROM " + table_name, function(err){
                    if(!returned) {
                        if (err || i === arr.length - 1) {
                            returned = true;
                            cb(err || null);
                        }
                    }
                });
            })

        });
    }
};

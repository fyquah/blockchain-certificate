var sqlite = require("sqlite3").verbose();
var db = new sqlite.Database("./hello.sqlite3");

db.serialize(function(){
    for (var i =0 ; i < 10 ; i++) {
        db.run("INSERT INTO lorem VALUES (1)");
    }
    db.each("SELECT * FROM lorem", function(err, row){
        console.log(row);
    });
});

exports.run = function(statement, callback) {
    // for running a raw sql statement
    db.serialize(function(){
        db.run(statement, callback);
    });
}
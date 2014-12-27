var query_controller = require(__dirname + "/query_controller.js");
var execute_controller = require(__dirname + "/execute_controller.js");
var broadcast_controller = require(__dirname + "/broadcast_controller.js");
var generate_new_rights_controller = require(__dirname + "/generate_new_rights_controller.js");

var query = function(instruction, cb){
    // when user query somethings
    query_controller[instruction.method](instruction, function(err, results){
        if(typeof cb === "function") {
            cb(err, results);
        }
    });
};

var broadcast = function(instruction, cb){
    broadcast_controller[instruction.method](instruction, function(err, res){
        if(typeof cb === "function") {
            cb(err, res);
        }
    });
};

var execute = function(instruction, cb){
    execute_controller(instruction, function(err, res){
        if(typeof cb === "function") {
            cb(err, res);
        }
    });
};

var generate_new_rights = function(instruction, cb) {
    generate_new_rights_controller(instruction, function(err, res){
        if (typeof cb === "function") {
            cb(err, res);
        }
    })
};

module.exports.execute = execute;
module.exports.query = query;
module.exports.broadcast = broadcast;
module.exports.generate_new_rights = generate_new_rights;

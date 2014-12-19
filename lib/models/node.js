var Model = require(__dirname + "/model.js");
var db = require(__dirname + "/db.js");
var helper = require(__dirname + "/../helper.js");
var Node = function(obj){
    obj = obj || {};
    var that = this;
    this.constructor.attributes.forEach(function(attr){
        that[attr] = obj[attr];
    });
};
Node.inherit(Model);

Node.initialize("nodes", {
    "metadata": "string",
    "destroyed": "boolean"
}); // initialize table name and attributes

Node.prototype.destroy = function(cb){
    var that = this;
    this.update_attributes({ "destroyed": true}, function(err, results){
        cb(err);
    });
};

module.exports = Node;

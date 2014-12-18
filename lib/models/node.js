var Model = require(__dirname + "/model.js");
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

module.exports = Node;

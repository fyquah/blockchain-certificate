var Model = require(__dirname + "/model.js");
var Node = function(obj){
    var that = this;
    this.constructor.attributes.forEach(function(attr){
        this[attr] = obj[attr];
    });
};
Node.prototype = Object.create(Model); // inherit
(function(){
    for (var prop in Model) {
        Node[prop] = Model[prop];
    }
})();

Node.initialize("nodes", {
    "txid": "string" // because all Nodes are registered with a txid
}); // initialize table name and attributes

module.exports = Node;
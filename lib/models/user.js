var Model = require(__dirname + "/model.js");
var User = function(obj){
    obj = obj || {};
    var that = this;
    this.constructor.attributes.forEach(function(attr){
        that[attr] = obj[attr];
    });
};
User.inherit(Model);

User.initialize("users", {
    "public_key": "string", // the compressed 33 byte public key
    "address": "string", // the certification address of this user
    "node_id": "integer", // node_id internally
    "txid": "string" // all users are registered via a txid, keep this in case it becomes useful
}); // initialize table name and attributes

module.exports = User;

var Model = require(__dirname + "/model.js");
var Signature = function(obj){
    var that = this;
    this.constructor.attributes.forEach(function(attr){
        this[attr] = obj[attr];
    });
};
Signature.prototype = Object.create(Model); // inherit
(function(){
    for (var prop in Model) {
        Signature[prop] = Model[prop];
    }
})();

Signature.initialize("signatures", {
    "txid": "string", // because all Signatures are registered with a txid
    "user_id": "integer",
    "digest": "string"
}); // initialize table name and attributes

module.exports = Signature;
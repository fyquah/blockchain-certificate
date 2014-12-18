var Model = require(__dirname + "/model.js");
var Signature = function(obj){
    obj = obj || {};
    var that = this;
    this.constructor.attributes.forEach(function(attr){
        that[attr] = obj[attr];
    });
};
Signature.inherit(Model);

Signature.initialize("signatures", {
    "txid": "string", // because all Signatures are registered with a txid
    "user_id": "integer", // the signer
    "type": "string", // either r or s
    "metadata": "string" // metadata of the signature
}); // initialize table name and attributes

module.exports = Signature;

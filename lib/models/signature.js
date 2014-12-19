var Model = require(__dirname + "/model.js");
var crypto = require("crypto");
var ecdsa = require('ecdsa');
var ecurve = require('ecurve');
var BigInteger = require("bigi");

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
    "node_id": "integer",
    "metadata": "string" ,// metadata of the signature
}); // initialize table name and attributes

Signature.verify = function(msg, compressed_public_key, signature_r, signature_s){
    var hashed_msg = crypto.createHash('sha256').update(msg).digest(),
        signature = {};
    signature.r = BigInteger.fromHex(signature_r);
    signature.s = BigInteger.fromHex(signature_s);

    return ecdsa.verify(hashed_msg, signature, new Buffer(compressed_public_key, "hex"));
};

module.exports = Signature;

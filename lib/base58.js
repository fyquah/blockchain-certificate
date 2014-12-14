var sha256 = require("crypto").createHash("sha256");
var NAMESPACE = 0x34;
var VERSION = 0x00;
var CODE_STRING = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

var encode = function(payload){
    var buf = new Buffer(payload, "hex");
    buf.writeUInt8(NAMESPACE, 0);
    buf.writeUInt8(VERSION, 1)
    payload.copy(buf, 2);

};

var decode = function(){

}

module.exports.encode = encode;
module.exports.decode = decode;

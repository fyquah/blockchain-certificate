var bs58check = require('bs58check');
var NAMESPACE = 0x27; // my high school school number :) (decimal 39 -> hex 27)

var convert_to_bitcoin_address = function (certificate_addr) {
    var payload = (new Buffer(bs58check.decode(certificate_addr))).
        slice(1, certificate_addr.length);
    return bs58check.encode(payload);
};

var convert_to_certificate_address = function (btc_addr) {
    var payload = new Buffer(bs58check.decode(btc_addr));
    var buffer = Buffer.concat([
        new Buffer(NAMESPACE.toString(16), "hex"),
        payload
    ])
    return bs58check.encode(buffer);
};

module.exports.convert_to_bitcoin_address = convert_to_bitcoin_address;
module.exports.convert_to_certificate_address = convert_to_certificate_address;

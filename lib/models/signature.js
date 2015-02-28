"use strict";
var BigInteger = require("bigi");
var crypto = require("crypto");
var ecdsa = require("ecdsa");

module.exports = function(sequelize, DataTypes) {
  var Signature = sequelize.define("Signature", {
    "txid": {
        type: DataTypes.STRING
    },
    "type": {
        type: DataTypes.STRING,
        allowNull: false
    },
    "metadata": {
        type: DataTypes.STRING,
        allowNull: false
    }
  }, {
    classMethods: {
      associate: function(models) {
        Signature.belongsTo(models.User, { foreignKey: "user_id" });
      },
      verify: function(msg, compressed_public_key, signature_r, signature_s){
        var hashed_msg = crypto.createHash('sha256').update(msg).digest(),
            signature = {};
        signature.r = BigInteger.fromHex(signature_r);
        signature.s = BigInteger.fromHex(signature_s);
        console.log(msg);
        console.log(compressed_public_key);
        console.log(signature_r);
        console.log(signature_s);
	console.log(signature);
	console.log(hashed_msg);
        try {
          ecdsa.verify(hashed_msg, signature, new Buffer(compressed_public_key, "hex"));
        } catch(e) {
	  console.log("here");
          console.log(e);
        }
	console.log(ecdsa.verify(hashed_msg, signature, new Buffer(compressed_public_key, "hex")));
        return ecdsa.verify(hashed_msg, signature, new Buffer(compressed_public_key, "hex"));
      }
    },
    timestamps: false
  });
  return Signature;
};

var Q = require("q");
var async = require("async");
var bitcoin = require("bitcoinjs-lib");
var constants = require(__dirname + "/../constants.js");
var models = require(__dirname + "/../models");
var bitcoind = require(__dirname + "/../bitcoind.js");
var helper = require(__dirname + "/../helper.js");

var append_signature = function(type, instruction, node, cb){
    models.User.findOne({ "where":{
        "address": instruction.address,
        "node_id": node.id
    }}).complete(function(err, results){
        if(err) return cb(err);

        var user = results;
        if(user !== null) {
            var signature = models.Signature.create({
                "user_id": user.id,
                "type": type,
                "metadata": instruction.metadata.toString("hex")
            }).complete(function(err){
                if(err) return cb(err);
                cb(null, signature);
            })
        } else {
            cb({
                "code": constants.ERR_USER_NOT_FOUND,
                "message" : "User with the given address cannot be found!"
            });
        }
    });
};


var execute = function(instruction, cb) {
    // execute based on what is seen in the blockchain
    // this is the only method which can write stuff into the database
    // must make sure the entry is not in the database yet
    Q.promise(function(resolve, reject){
        if(instruction.op_code === constants.OP_INITIALIZE) {
            resolve({});
        } else {
            models.RightsOutput.findOne({ where: {
                "spent": false,
                "vout": instruction.rights_input.vout,
                "txid": instruction.rights_input.txid
            }}).complete(function(err, res){
                if(err) return reject(err);

                if (!res || !res.node_id) {
                    reject({
                        "code": constants.ERR_NO_SUCH_RIGHTS,
                        "message": "Rights not found or invalidated!"
                    })
                } else {
                    res.getNode().complete(function(err, node){
                        if(err) reject(err);

                        resolve({
                            "node": node,
                            "rights": instruction.rights_input
                        })
                    });
                }
            });
        }
    }).then(function(x){
        var node = x.node,
            rights = x.rights;
        return Q.promise(function(resolve, reject){
            // carry out validation steps first
            // 1. the metadata length is correct
            var metadata_len;
            if (instruction.op_code === constants.OP_INITIALIZE) {
                metadata_len = 35;
            } else if (instruction.op_code === constants.OP_REGISTER) {
                metadata_len = 33;
            } else if (instruction.op_code === constants.OP_SIGNATURE_R) {
                metadata_len = 32;
            } else if (instruction.op_code === constants.OP_SIGNATURE_S) {
                metadata_len = 32;
            } else if (instruction.op_code === constants.OP_TERMINATE_NODE) {
                metadata_len = 35;
            }

            if (metadata_len !== undefined) {

                if (instruction.metadata.length !== metadata_len) {
                    reject({
                        "code": constants.ERR_INVALID_TRANSACTION,
                        "message": "Invalid length of metadata"
                    });
                    return;
                }
            }
            if (instruction.op_code === constants.OP_INITIALIZE) {
                // verify that the metadata is not used by anyone else
                models.Node.findOne({ where: {
                    "metadata": instruction.metadata.toString("hex")
                }}).complete(function(err, results){
                    if(err) return reject(err);

                    if (results === null) {
                        var node = models.Node.build({
                            "destroyed": false,
                            "metadata": instruction.metadata.toString("hex"),
                            "txid": instruction.txid
                        });
                        node.save().complete(function(err, results){
                            if(err) return reject(helper.unknown_error(err));
                            resolve({ "node": results });
                        });
                    } else {
                        reject({
                            "code": constants.ERR_NODE_NOT_UNIQUE,
                            "message": "metadata has already been used by some other node"
                        });
                    }
                });
            } else if (instruction.op_code === constants.OP_REGISTER) {
                // verify that such user is not registered yet
                node.getUsers({ where: {
                    "address": instruction.address
                }}).complete(function(err, results){
                    if(err) return reject(err);

                    if(results.length === 0) {
                        var user = models.User.build({
                            "public_key": instruction.metadata.toString("hex"),
                            "address": instruction.address,
                            "txid": instruction.txid
                        });


                        node.addUser(user).complete(function(err, results){
                            if(err) return reject(err);
                            resolve({ "user": user });
                        });

                    } else {
                        reject({
                            "code": constants.ERR_USER_NOT_UNIQUE,
                            "message" : "user address exists liao"
                        });
                    }
                });
            } else if (instruction.op_code === constants.OP_SIGNATURE_R) {
                // blindly append the signature
                append_signature("r", instruction, node, function(err, res){
                    err !== null ? reject(err) : resolve({ "signature_r": res });
                });
            } else if (instruction.op_code === constants.OP_SIGNATURE_S) {
                // similiar to above
                append_signature("s", instruction, node, function(err, res){
                    err !== null ? reject(err) : resolve({ "signature_s": res });
                })
            } else if (instruction.op_code === constants.OP_NOTHING) {
                // do nothing
                resolve(null);
            } else if (instruction.op_code === constants.OP_DESTROY_CHILD) {
                // work this out later on
            } else if (instruction.op_code === constants.OP_TERMINATE_NODE) {
                node.updateAttributes({ "destroyed": true }).complete(function(err){
                    if(err) return reject(err);
                    resolve({ "node": node });
                });
            }
        });
    }).then(function(msg){
        cb(null, msg);
    }).catch(function(err){
        cb(err);
    }).done();
};

module.exports = execute;

var Q = require("q");
var async = require("async");
var bitcoin = require("bitcoinjs-lib");
var constants = require(__dirname + "/../constants.js");
var models = require(__dirname + "/../models");
var bitcoind = require(__dirname + "/../bitcoind.js");

var query_methods = {
    listusers: function(instruction, cb){
    console.log(arguments);
        var metadata = instruction.metadata;
        models.Node.findOne({ where: {
            "metadata": metadata,
            "destroyed": false
        }}).complete(function(err, node){
            if(err) return cb(err);
            if(!node) return cb({ "code" : constants.ERR_NODE_NOT_FOUND, "message": "Node with given metadata could not be found" })
            node.getUsers().complete(function(err, users){
                if(err) return cb(err);
                cb(null, users);
            })
        });
    },
    listnodes: function(instruction, cb){
        models.Node.findAll({ where: {
            "destroyed": false
        }}).complete(function(err, res){
            if(err) return cb(err);
            cb(null, res);
        });
    },
    verifysignature: function(instruction, cb){
        Q.promise(function(resolve, reject, notify){
            models.Node.findOne({ where: {
                "metadata": instruction.metadata
            }}).complete(function(err, res){
                if(err) return reject(err);

                if(res === null) {
                    reject({
                        "message": "node with given metadata cannot be found",
                        "code": consants.ERR_NODE_NOT_FOUND
                    })
                } else {
                    resolve(res);
                }
            });
        }).then(function(node){
            return Q.promise(function(resolve, reject, notify){

                node.getUsers({ where: {
                    "address": instruction.address
                }}).complete(function(err, res){
                    if(err) return reject(err);

                    if(res.length === 0) {
                        reject({
                            "message": "user with given address not found!",
                            "code": constants.ERR_USER_NOT_FOUND
                        });
                    } else {
                        resolve({
                            user: res[0],
                            node: node
                        });
                    }
                })
            });
        }).then(function(obj){
            var user = obj.user,
                node = obj.node;
            // validate_signature_against_document
            return Q.promise(function(resolve, reject, notify){
                if (models.Signature.verify(instruction.document, user.public_key, instruction.signature_r, instruction.signature_s)) {
                    resolve({
                        "user": user,
                        "node": node,
                        "signature": {
                            "r": instruction.signature_r,
                            "s": instruction.signature_s
                        }
                    });
                } else {
                    reject({
                        'code': constants.ERR_INVALID_SIGNATURE,
                        "message": "unable to validate signature"
                    });
                }
            });
        }).then(function(obj){

            var signature_not_found_err = {
                "code": constants.ERR_SIGNATURE_NOT_FOUND_BLOCKCHAIN,
                "message": "signature not found in blockchain"
            };
            var user = obj.user;
            return Q.promise(function(resolve, reject, notify){
                user.getSignatures({ where: {
                    "type": "r",
                    "metadata": obj.signature.r
                }}).complete(function(err, r_res){
                    if(err) return reject(err);
                    if(r_res.length === 0) return reject(signature_not_found_err);

                    user.getSignatures({ where: {
                        "type": "s",
                        "metadata": obj.signature.s
                    }}).complete(function(err, s_res){
                        if(err) return reject(err);
                        if(s_res.length === 0) return reject(signature_not_found_err);

                        resolve({
                            "r": r_res[0],
                            "s": s_res[0]
                        });
                    })
                });
            });
        }).then(function(signature){
            // signature is found!
            cb(null, {
                "verified": true,
                "r_txid": signature.r.txid,
                "s_txid": signature.s.txid
            });
        }).catch(function(e){
            cb(e);
        }).done();
    },
    listrights: function(instruction, cb){

        bitcoind("listunspent 0", function(err, arr, stderr){
            if(err) return cb(err);
            async.filter(arr, function(tx, inner_cb){
                models.RightsOutput.findOne({ where: {
                    "txid": tx.txid,
                    "vout": tx.vout
                }}).complete(function(err, results){
                    if(!results || err) {
                        inner_cb(false);
                    } else {
                        tx.node_id = results.node_id;
                        inner_cb(true);
                    }
                });
            } , function(results){
                results.forEach(function(rights, index){
                    models.Node.findOne(rights.node_id).complete(function(err, node){
                        if(err) return cb(err);

                        if(node) {
                            rights.node = node.metadata;
                        }
                        delete rights.node_id;

                        if(index === results.length - 1) {
                            cb(null, results);
                        }
                    });
                });
            });
        });
    }
};

module.exports = query_methods;
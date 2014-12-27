// this file interacts with the model
var Q = require("q");
var async = require("async");
var bitcoin = require("bitcoinjs-lib");
var constants = require(__dirname + "/constants.js");
var models = require(__dirname + "/models");
var logger = require(__dirname + "/logger");
var bitcoind = require(__dirname + "/bitcoind.js");
var helper = require(__dirname + "/helper.js");

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

var generate_new_rights = function(instruction, cb){
    // verify that the rights input exists first
    // if it is a genesis transaction, find the node and create rights output based on the node
    // if it is not a genesis transaction, carry just carry forward then node id

    Q.promise(function(resolve, reject){
        if (instruction.genesis) {
            models.Node.findOne({ "where": { 
                "metadata": instruction.genesis.toString("hex") 
            }}).complete(function(err, res){
                if(err) return reject(err);
                resolve(res.id);
            });        
        } else {
            models.RightsOutput.findOne({ 
                where: {
                    "txid": instruction.rights_input.txid,
                    "vout": instruction.rights_input.vout,
                    "spent": false
                } 
            }).complete(function(err, rights_input){
                if(err) return reject(err);

                rights_input.updateAttributes({
                    "spent": true
                }).complete(function(err, results){
                    if(err) return reject(err);
                    resolve(results.node_id);
                })
            });
        }
    }).then(function(node_id){
        return Q.promise(function(resolve, reject){
            var all_outputs = [];
            for (var i = 0 ; i < instruction.count ; i++) {
                var rights_output = models.RightsOutput.build({
                    "txid": instruction.txid,
                    "vout": i,
                    "node_id": node_id,
                    "spent": false
                });
                rights_output.save().complete(function(err, output){
                    if(err) return reject(err);
                    all_outputs.push(output);

                    if(output.vout == instruction.count - 1) {
                        resolve(all_outputs);
                    }
                });
            }
        });
    }).then(function(all_outputs){
        cb(null, all_outputs);
    }).catch(function(err){
        cb(err);
    }).done();
};

var execute = function(instruction, cb) {
    // execute based on what is seen in the blockchain
    // this is the only method which can write stuff into the database
    // must make sure the entry is not in the database yet
    Q.promise(function(resolve, reject){
        if(instruction.op_code === constants.OP_INITIALIZE) {
            resolve({});
        } else {
            models.Node.findOne({ "where": 
                "destroyed='false' AND id in (SELECT node_id FROM RightsOutputs WHERE " + 
                "txid = '" + instruction.rights_input.txid + "' AND " + 
                "vout = " + instruction.rights_input.vout + " AND " +
                "spent = 'false')" 
            }).complete(function(err, res){
                if(err) return reject(err);

                if (!res) {
                    reject({
                        "code": constants.ERR_NO_SUCH_RIGHTS,
                        "message": "Rights not found or invalidated!"                        
                    })
                } else {
                    resolve({
                        "node": node,
                        "rights": instruction.rights_input
                    })
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
                console.log('metadata length : ');
                console.log(instruction.metadata.length);
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
                models.Node.findOne({
                    "metadata": instruction.metadata.toString("hex")
                }).complete(function(err, results){
                    if(err) return reject(err);

                    if (results === null) {
                        var node = models.Node.build({
                            "destroyed": false,
                            "metadata": instruction.metadata.toString("hex")
                        });
                        node.save().complete(function(err, results){
                            if(err) return reject(helper.unknown_error(err));
                            console.log("Created new node");
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
                }}, function(err, results){
                    if(err) return reject(err);

                    if(results.length === 0) {
                        var user = models.User.build({
                            "public_key": instruction.metadata.toString("hex"),
                            "address": instruction.address,
                            "txid"; instruction.txid
                        });


                        node.addUser(user).complete(function(err, results){
                            if(err) return reject(err);
                            resolve({ "user": user });
                        });

                    } else {
                        reject({
                            "code": constants.ERR_USER_NOT_UNIQUE,
                            "message" : "user address exists"
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

var query = function(instruction, cb){
    // when user query somethings
    query_methods[instruction.method](instruction, function(err, results){
        if(typeof cb === "function") {
            cb(err, results);
        }
    });
};

var broadcast = function(instruction, cb){
    broadcast_methods[instruction.method](instruction, function(err, res){
        if(typeof cb === "function") {
            cb(err, res);
        }
    });
    // broadcast transactions methods, but does not hav rights to write stuff into database
};

var query_methods = {
    listusers: function(instruction, cb){
    console.log(arguments);
        var metadata = instruction.metadata;
        models.Node.findOne({ where: {
            "metadata": metadata,
            "destroyed": false
        }}).complete(function(err, node){
            if(err) return cb(err);
            node.getUsers().compelte(function(err, users){
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
            }}, function(err, res){
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
                }}, function(err, res){
                    if(err) return reject(err);

                    if(res.length === 0) {
                        reject({
                            "message": "user with given address not found!",
                            "code": constants.ERR_USER_NOT_FOUND
                        });
                    } else {
                        resolve({
                            user: res,
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
        }).then(function(){
            // signature is found!
            cb(null, {
                "verified": true,
                "r_txid": r_res.txid,
                "s_txid": s_res.txid
            });
        }).catch(function(e){
            cb(e);
        }).done();
    },
    listrights: function(instruction, cb){
        bitcoind("listunspent 0", function(err, arr, stderr){
            async.filter(arr, function(tx, inner_cb){
                models.RightsOutput.findOne({ where: {
                    "txid": tx.txid,
                    "vout": tx.vout
                }}, function(err, results){
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

// othter than initialize, need to check if
// - node exists
// - possess output rights for the node

var broadcast_wrapper = function(metadata, cb){
    // this will execute check_if_node_exists and check_if_posess_rightss_output
    // if half way through either returns false, the callback is never executed
    var _node, _output, _addr;
    Q.promise(function(resolve, reject, notify){
        models.Node.findOne({ where: {
            "metadata": metadata,
            "destroyed": false
        }}).complete(function(err, res){
            if(err) return reject(err);

            if(res === null) {
                reject({ "message": "node with the given metadata not found", "code": constants.ERR_NODE_NOT_FOUND });
            } else {
                resolve(res);
            }
        });
    }).then(function(node){
        _node = node;
        return Q.promise(function(resolve, reject, notify){
            bitcoind("listunspent 0", function(err, all_inputs, stderr){
                if(err) return reject(err);
                var found = false;

                all_inputs.forEach(function(input, index){

                    models.RightsOutput.findOne({ where: {
                        "spent": false,
                        "txid": input.txid,
                        "vout": input.vout
                    }}).complete(function(err, results){
                        if(err) return reject(err);

                        if(!found) {
                            if(results !== null) {
                                results.amount = input.amount
                                resolve(results);
                            } else if(index === all_inputs.length - 1) {
                                reject({
                                    "message": "suitable rights output not found!",
                                    "code": constants.ERR_NO_SUCH_RIGHTS
                                });
                            }
                        }
                    });
                });
            });
        });
    }).then(function(output){ // get a new address to provide rights to
        _output = output;
        return Q.promise(function(resolve, reject){
            bitcoind("getnewaddress", function(err, stdout){
                if(err) return reject(err);

                resolve(stdout);
            });
        });
    }).then(function(addr){
        // execute the callback code
        cb(null, _node, _output, addr);
    }).catch(function(e){
        cb(e);
    }).done();
};

var generate_op_return = function(op_code, metadata){
    var buffer = new Buffer(metadata.length / 2 + 3 + 1);
    buffer[0] = 0x62;
    buffer[1] = 0x63;
    buffer[2] = 0x63;
    buffer[3] = op_code;
    (new Buffer(metadata, "hex")).copy(buffer, 4, 0);
    return buffer; // finally some syncrhonous code .__.
}

var outputs_equal = function(o1, o2){
    if(!o1 || !o2) { // if o1 or o2 is undefined or null or false
        return o1 === o2;
    } else {
        return (o1.vout == o2.vout) &&
        (o1.txid == o2.txid);
    }
}

var create_bitcoin_transaction = function(rights_output, receipients, values, cb){
    bitcoind("getnewaddress", function(err, change_address){
        if (err) {
            cb(err, null);
            return;
        }

        bitcoind("listunspent 0", function(err, unspent_inputs){
            if (err) {
                cb(err, null);
                return;
            }

            var required_amount = values.reduce(function(memo, x, i){
                return (receipients[i] === "OP_RETURN" ? memo : memo + x);
            }, constants.TRANSACTION_FEE);
            var possessed_amount = (rights_output ? rights_output.amount : 0);
            var required_inputs = (rights_output ? [rights_output] : []);
            var tx = new bitcoin.Transaction();
            var data, i;
            for(i = 0 ; i < unspent_inputs.length ; i++) {
                if (possessed_amount >= required_amount) {
                    break;
                }

                if(!(outputs_equal(unspent_inputs[i], rights_output))) {
                    required_inputs.push(unspent_inputs[i]);
                    possessed_amount += unspent_inputs[i].amount;
                }
            }

            if(possessed_amount < required_amount) {
                // code to handle insufficient funds situations
                cb({
                    "code": constants.ERR_INSUFFICIENT_FUNDS,
                    "message": "insufficient funds to create transaction!"
                }, null);
                return;
            }

            for(i = 0 ; i < required_inputs.length ; i++) {
                tx.addInput(required_inputs[i].txid, required_inputs[i].vout);
            }

            for(i = 0 ; i < receipients.length ; i++) {
                if(receipients[i] === "OP_RETURN") {
                    tx.addOutput(bitcoin.scripts.nullDataOutput(values[i]), 0);
                } else {
                    tx.addOutput(receipients[i], Math.ceil(values[i] * 1e8));
                }
            }

            if (possessed_amount !== required_amount) {
                tx.addOutput(change_address, Math.ceil((possessed_amount - required_amount) * 1e8));
            }

            bitcoind("signrawtransaction " + tx.toHex(), function(err, obj){
                if(err || !obj.complete) {
                    cb(err || helper.unknown_error(obj));
                    return;
                }

                bitcoind("sendrawtransaction " + obj.hex, function(err, stdout){
                    cb(null, stdout);
                });
            });
        });
    });
};

var broadcast_methods = {
    initialize: function(instruction, cb){
        // check if the node is unique
        // then create!
        Q.promise(function(resolve, reject, notify){
            models.Node.findOne({ where: {
                "metadata": instruction.metadata
            }}).complete(function(err, results){
                if(err) return reject(err);

                if(results === null) {
                    resolve();
                } else {
                    reject({
                        "message": "The metadata has already been used by a node!",
                        "code": constants.ERR_NODE_NOT_UNIQUE
                    });
                }
            });
        }).then(function(){
            return Q.promise(function(resolve, reject){
                bitcoind("getnewaddress", function(err, addr){
                    var op_return = generate_op_return(constants.OP_INITIALIZE, instruction.metadata);
                    console.log(op_return);
                    create_bitcoin_transaction(null, [
                        addr, "OP_RETURN"
                    ], [
                        constants.TRANSACTION_AMOUNT, op_return
                    ], function(err, res){
                        if(err !== null) {
                            reject(err);
                        } else {
                            resolve({ "txid" : res });
                        }
                    });
                });
            });
        }).then(function(results){
            if (typeof cb === "function") {
                cb(null, results);
            }
        }).catch(function(err){
            if (typeof cb === "function") {
                cb(err);
            }
        }).done();
    },
    registeruser: function(instruction, cb){
        broadcast_wrapper(instruction.metadata, function(err, node, rights_output, addr){
            if (err !== null) {
                cb(err);
                console.log(err);
                return;
            }
            var op_return = generate_op_return(constants.OP_REGISTER, instruction.public_key);
            create_bitcoin_transaction(rights_output,
                [addr, "OP_RETURN", instruction.address],
                [constants.TRANSACTION_AMOUNT, op_return, constants.TRANSACTION_AMOUNT],
                function(err, res){
                if(err === null) {
                    res = { "txid": res };
                }
                cb(err, res);
                console.log(res);
            });
        });
    },
    broadcastsignature: function(instruction, cb){
        broadcast_wrapper(instruction.metadata, function(err, node, rights_output, addr){

            Q.promise(function(resolve, reject){ // search for the user to get the public key
                models.User.findOne({ where: {
                    "address": instruction.address,
                    "node_id": node.id
                }}).complete(function(err, results){
                    if(err) return reject(err);

                    if(results === null) {
                        reject({
                            "code": constants.ERR_USER_NOT_FOUND,
                            "message": "User with given address not found"
                        })
                    } else {
                        resolve(results);                    
                    }
                })
            }).then(function(user){ // carry out verification
                return Q.promise(function(resolve, reject){
                    if(models.Signature.verify(instruction.document, user.public_key, instruction.signature_r, instruction.signature_s)){
                        resolve(user);
                    } else {
                        reject({
                            "code": constants.ERR_INVALID_SIGNATURE,
                            "message": "unable to validate given signature"
                        })
                    }
                });
            }).then(function(user){ // craft the bitcoin transaction
                return Q.promise(function(resolve, reject){
                    var op_return = generate_op_return(constants.OP_SIGNATURE_R, instruction.signature_r),
                    r_txid, s_txid,
                    receipient_address = instruction.address;

                    create_bitcoin_transaction(rights_output,
                        [addr, "OP_RETURN", receipient_address],
                        [constants.TRANSACTION_AMOUNT, op_return, constants.TRANSACTION_AMOUNT],
                        function(err, txid){
                        r_txid = txid;
                        if(err !== null) {
                            cb(err);
                            return;
                        }
                        bitcoind("getrawtransaction " + txid + " 1", function(err, transaction){
                            // the first input of the second transction is the first output of the first transaction
                            if(err !== null) {
                                cb(err);
                                return;
                            }
                            var op_return = generate_op_return(constants.OP_SIGNATURE_S, instruction.signature_s),
                            rights_output = {
                                "amount" : transaction["vout"][0].value,
                                "value": transaction["vout"][0].value,
                                "txid": transaction["txid"],
                                "vout": transaction["vout"][0].n
                            };
                            create_bitcoin_transaction(rights_output,
                                [addr, "OP_RETURN", receipient_address],
                                [constants.TRANSACTION_AMOUNT, op_return , constants.TRANSACTION_AMOUNT],
                                function(err, txid){
                                s_txid = txid;
                                if(err !== null) {
                                    cb(err);
                                    return;
                                }

                                cb(null, {
                                    "r_txid": r_txid,
                                    "s_txid": s_txid
                                });
                            });
                        });
                    });
                });
            }).catch(function(err){
                logger.error(err);
                cb(err);
            }).done();

        });

    },
    terminate: function(instruction, cb){
        // create the registeruser transcation with thte given output
        var op_return = generate_op_return(constants.OP_TERMINATE_NODE, instruction.metadata);
        create_bitcoin_transaction(null, [ "OP_RETURN" ], [ op_return ], function(err, res){
            if(err === null) {
                res = { "txid": res };
            }
            cb(err, res);
        });
    }
};

module.exports.execute = execute;
module.exports.query = query;
module.exports.broadcast = broadcast;
module.exports.generate_new_rights = generate_new_rights;

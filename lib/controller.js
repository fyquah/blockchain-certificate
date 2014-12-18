// this file interacts with the model
var Q = require("q");
var async = require("async");
var bitcoin = require("bitcoinjs-lib");
var constants = require("./constants.js");
var models = require("./model.js");
var logger = require("./logger");
var bitcoind = require("./bitcoind.js");
var helper = require("./helper.js");

var append_signature = function(type, instruction, node, cb){
    models.User.find_by({
        "address": instruction.address,
        "node_id": node.id
    }, function(err, results){
        if(err !== null) {
            cb(helper.unknown_error(err));
            return;
        }

        var user = results;
        if(user !== null) {
            var signature = new models.Signature({
                "user_id": user.id,
                "node_id": node.id,
                "type": type,
                "metadata": instruction.metadata.toString("hex")
            });
            signature.create(function(){ cb.apply(signature, [null, signature]) });
        } else {
            cb({
                "code": ERR_USER_NOT_FOUND,
                "message" : "User with the given address cannot be found!"
            });
        }
    });
}

var execute = function(instruction, cb) {
    // execute based on what is seen in the blockchain
    // this is the only method which can write stuff into the database
    // must make sure the entry is not in the database yet
    Q.promise(function(resolve, reject){
        console.log("sini");
        console.log(instruction);
        if(instruction.op_code === constants.OP_INITIALIZE) {
            resolve(null, null);
        } else {
            models.Node.query("SELECT * FROM nodes WHERE destroyed='false' AND " +
                "id in (SELECT node_id FROM rights_outputs " +
                "WHERE txid='" + instruction.rights_input.txid + "' AND " +
                "vout='" + instruction.rights_input.vout + "' AND " +
                "spent = 'false')",
                function(err, res){
                if(err) {
                    reject(helper.unknown_error(err));
                    return;
                }

                if(res.length === 0) {
                    reject({
                        "code": constants.ERR_NO_SUCH_RIGHTS,
                        "message": "Rights not found or invalidated!"
                    });
                    return;
                }

                var node = res[0];
                resolve(node, instruction.rights_input);
            });
        }
    }).then(function(node, rights){
        return Q.promise(function(resolve, reject){
            var obj;

            if(instruction.op_code === constants.OP_INITIALIZE) {
                // verify that the metadata is not used by anyone else
                models.Node.find_by({
                    "metadata": instruction.metadata.toString("hex")
                }, function(err, results){
                    if (err !== null) {
                        reject(helper.unknown_error(err));
                        return;
                    }

                    if(results === null) {
                        var node = new models.Node();
                        node.destroyed = false;
                        node.metadata = instruction.metadata.toString("hex");
                        node.create(function(err, results){
                            if(err !== null) {
                                reject(helper.unknown_error(err));
                                return;
                            }
                            console.log("created new node");
                            resolve(results);
                        });
                    } else {
                        reject({
                            "code": constants.ERR_NODE_NOT_UNIQUE,
                            "message": "metadata has already been used by some other node"
                        })
                    }
                });
            } else if (instruction.op_code === constants.OP_REGISTER) {
                // verify that such user is not registered yet
                models.User.find_by({
                    "address": instruction.address
                }, function(err, results){
                    if (err) {
                        reject(helper.unknown_error(err));
                        return;
                    }

                    if(results === null) {
                        var user = new models.User({
                            "public_key": instruction.metadata.toString("hex"),
                            "address": instruction.address,
                            "txid": instruction.txid,
                            "node_id": node.id
                        });
                        console.log("the user is :");
                        console.log(user);
                        user.create(function(err, results){
                            if(err) {
                                reject(helper.unknown_error(err));
                                return;
                            }

                            resolve(results);
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
                    err !== null ? reject(err) : resolve();
                });
            } else if (instruction.op_code === constants.OP_SIGNATURE_S) {
                // similiar to above
                append_signature("s", instruction, node, function(err, res){
                    err !== null ? reject(err) : resolve();
                })
            } else if (instruction.op_code === constants.OP_NOTHING) {
                // do nothing
                resolve();
            } else if (instruction.op_code === constants.OP_DESTROY_CHILD) {
                // work this out later on
            } else if (instruction.op_code === constants.OP_TERMINATE_NODE) {
                node.destroy(function(err, res){
                    if(err !== null) {
                        reject(err);
                    } else {
                        resolve(res);
                    }
                });
            }
        });
    }).then(function(msg){
        console.log("msg : ");
        console.log(msg);
        cb(null, msg);
    }).catch(function(err){
        cb(err);
    }).done();
};

var destroy_node_rights = function(node, cb) {
    // to be called after a destroy instruction

};

var generate_new_rights = function(instruction, cb){
    // verify that the rights input exists first
    // if it is a genesis transaction, find the node and create rights output based on the node
    // if it is not a genesis transaction, carry just carry forward then node id

    Q.promise(function(resolve, reject){
        if (instruction.genesis) {
            models.Node.find_by({
                "metadata": instruction.genesis.toString("hex")
            }, function(err, res){
                if (err) {
                    reject(err);
                    return;
                }
                resolve(res.id)
            })
        } else {
            models.RightsOutput.find_by(instruction.rights_input, function(err, rights_input){
                if (err) {
                    cb(err);
                    return;
                }

                rights_input.update_attributes({
                    "spent": true
                }, function(err, results){
                    if(err) {
                        reject(err);
                        return;
                    }

                    resolve(results.node_id);
                })
            })
        }
    }).then(function(node_id){
        return Q.promise(function(resolve, reject){
            var all_outputs = [];
            for (var i = 0 ; i < instruction.count ; i++) {
                var rights_output = new models.RightsOutput({
                    "txid": instruction.txid,
                    "vout": i,
                    "node_id": node_id,
                    "spent" : false
                });
                rights_output.create(function(err, output){
                    if (err) {
                        reject(err);
                    } else {
                        all_outputs.push(output);
                        if(output.vout == instruction.count - 1) {
                            resolve(all_outputs);
                        }
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

var query = function(instruction, cb){
    // when user query somethings
    query_methods[instruction.method](instruction, function(err, results){
        cb(err, results);
    });
};

var broadcast = function(instruction, cb){
    broadcast_methods[instruction.method](instruction, function(err, res){
        cb(err, res);
    });
    // broadcast transactions methods, but does not hav rights to write stuff into database
};

var query_methods = {
    listusers: function(instruction, cb){
    console.log(arguments);
        var metadata = instruction.metadata;
        models.User.query("SELECT * FROM users WHERE node_id in (SELECT id FROM nodes WHERE metadata='" + metadata + "')",
            function(err, res){
            console.log(res);
            cb(err, res);
        });
    },
    listnodes: function(instruction, cb){
        models.Node.all(function(err, res){
            var nodes = null;
            if(err === null) {
                nodes = res.map(function(entry){
                    return entry.metadata;
                });
            }
            cb(err, nodes);
        })
    },
    verifysignature: function(instruction, cb){
        Q.promise(function(resolve, reject, notify){
            models.Node.find_by({
                "metadata": instruction.metadata
            }, function(err, res){
                if (err !== null) {
                    reject(err);
                } else if (res === null) {
                    reject({ "message": "node with given metadata not found not found! This is another way of saying false", "code": constants.ERR_NODE_NOT_FOUND });
                } else {
                    resolve(res);
                }
            })
        }).then(function(node){
            return Q.promise(function(resolve, reject, notify){
                models.User.find_by({
                    "address": instruction.address,
                    "node_id": node.id
                }, function(err, res){
                    if(err !== null) {
                        reject(err);
                    } else if (res === null) {
                        reject({ "message": "user with given address not found! This is another way of saying false", "code": constants.ERR_USER_NOT_FOUND })
                    } else {
                        resolve(node, res);
                    }
                });
            });
        }).then(function(node, user){
            // validate_signature_against_document
            // to be carried out by some other signer module
        }).then(function(node, user){
            return Q.promise(function(resolve, reject, notify){
                models.Signature.find_by({
                    "type": "r",
                    "metadata": instruction.signature_r,
                    "user_id": user.id
                }, function(err, results){
                    if (err !== null) {
                        reject(err);
                    } else if(res === null) {
                        reject({ "message": "signature not found! This is another way of saying false", "code": constants.ERR_SIGNATURE_NOT_FOUND })
                    } else {
                        resolve();
                    }
                });
            })
        }).then(function(node, user){
            return Q.promise(function(resolve, reject, notify){
                models.Signature.find_by({
                    "type": "s",
                    "metadata": instruction.signature_s
                }, function(err, results){
                    if (err !== null) {
                        reject(err);
                    } else if(res === null) {
                        reject({
                            "message": "signature not found! This is another way of saying false",
                            "code": constants.ERR_SIGNATURE_NOT_FOUND
                        })
                    } else {
                        resolve();
                    }
                });
            });
        }).then(function(node, user){
            // signature is found!
            cb(null, true);
        }).catch(function(e){
            if(typeof e === "object") {
                cb(e, false);
            } else {
                cb(e, undefined);
            }
        }).done();
    },
    listrights: function(instruction, cb){
        bitcoind("listunspent", function(err, res, stderr){
            var arr = res.map(function(input){
                return {
                    "txid": input.txid,
                    "vout": input.vout,
                    "amount": input.amount
                };
            });
            try {
                async.filter(arr, function(tx, inner_cb){
                    models.RightsOutput.find_by({
                        "txid": tx.txid,
                        "vout": tx.vout
                    }, function(err, results){
                        if(err !== null) {
                            logger.error(err);
                            throw err;
                        }
                        inner_cb(err === null && results === null);
                    })
                } , function(results){
                    console.log(results);
                    cb(null, arr);
                });
            } catch(e) {
                cb(e, []);
            }
        });
    }
};

// othter than initialize, need to check if
// - node exists
// - possess output rights for the node

var broadcast_wrapper = function(metadata, cb){
    // this will execute check_if_node_exists and check_if_posess_rightss_output
    // if half way through either returns false, the callback is never executed
    Q.promise(function(resolve, reject, notify){
        Node.find_by({
            "metadata": metadata
        }, function(err, res){
            if(err !== null) {
                logger.error(err);
                reject(err);
            }

            cb(err, res === null);
            if(res === null) {
                reject({ "message": "node with the given metadata not found", "code": constants.ERR_NODE_NOT_FOUND });
            } else {
                resolve(res);
            }
        })
    }).then(function(node){
        return Q.promise(function(resolve, reject, notify){
            bitcoind("listunspent", function(err, stdout, stderr){
                var i;
                var all_inputs = JSON.parse(stdout).map(function(entry){
                    return {
                        "txid": entry.txid,
                        "vout": entry.vout,
                        "amount": entry.amount
                    };
                });
                var found = false;
                all_inputs.forEach(function(input, index){
                    RightOutput.find_by({
                        "spent": false,
                        "txid": input.txid,
                        "vout": input.vout
                    }, function(err, results){
                        if (err !== null) {
                            logger.error(err);
                            reject(err);
                            return;
                        }
                        results.amount = input.amount;

                        if (!found) {
                            if (results === null) {
                                resolve(node, results);
                                found = true;
                            } else if (index === all_inputs.length - 1) {
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
    }).then(function(node, output){
        bitcoind("getnewaddress", function(err, stdout){
            if(err) {
                reject(err);
                return;
            }

            resolve(node, output, stdout);
        });
    }).then(function(node, output, addr){
        // execute the callback code
        cb(null, node, output, addr);
    }).catch(function(e){
        cb(e);
    }).done();
};

var generate_op_return = function(op_code, metadata){
    var buffer = new Buffer(metadata.length / 2 + 3 + 1);
    buffer[0] = 0x62;
    buffer[1] = 0x62;
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

        bitcoind("listunspent", function(err, unspent_inputs){
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
            console.log(tx);
            bitcoind("signrawtransaction " + tx.toHex(), function(err, obj){
                if(err || !obj.complete) {
                    cb({
                        "code": -99,
                        "message": err
                    });
                    return;
                }

                bitcoind("sendrawtransaction " + obj.hex, function(err, stdout){
                    console.log(stdout);
                    cb(null, stdout);
                });
            });
        });
    });
};

var broadcast_methods = {
    registeruser: function(instruction, cb){
        broadcast_wrapper(instruction.metadata, function(err, node, output, addr){
            if(err !== null) {
                cb(err);
                return;
            }

            // create the registeruser transcation with thte given output
            var op_return = generate_op_return(constants.OP_REGISTER, instruction.public_key);
            create_bitcoin_transaction(null, [
                addr, "OP_RETURN", instruction.address
            ], [
                constants.TRANSACTION_AMOUNT, op_return, constants.TRANSACTION_AMOUNT
            ], function(err, res){
                if(err === null) {
                    res = { "txid": res };
                }
                cb(err, res);
            });
        });
    },
    broadcastsignature: function(instruction){
        // first verify if the user's public key actually spans that signature
        // at the same time, the user's presence can be verified
        broadcast_wrapper(instruction.metadata, function(err, node, output, addr){
            // create the signature transaction with the given output
            var op_return = generate_op_return(constants.OP_SIGNATURE_R, instruction.signature_r);
            create_bitcoin_transaction(rights_output, [
                new_rights_output_addr, "OP_RETURN", instruction.address
            ], [
                constants.TRANSACTION_AMOUNT, op_return, constants.TRANSACTION_AMOUNT
            ], function(){
                // now create the S bit of it, but how to trace the two transactions?
                // maybe I should just use the output of the previous transaction as the input of this transaction?

            });
        });
    },
    terminatechild: function(instruction){

    },
    terminate: function(instruction, cb){
        broadcast_wrapper(instruction.metadata, function(err, node, rights_output){
            // Terminate the node
            if(err !== null) {
                cb(err);
                return;
            }

            // create the registeruser transcation with thte given output
            var op_return = generate_op_return(constants.OP_TERMINATE, instruction.metadata);
            create_bitcoin_transaction(null, [ "OP_RETURN" ], [ op_return ], function(err, res){
                if(err === null) {
                    res = { "txid": res };
                }
                cb(err, res);
            });
        });
    },
    initialize: function(instruction, cb){
        // check if the node is unique
        // then create!
        Q.promise(function(resolve, reject, notify){
            models.Node.find_by({
                "metadata": instruction.metadata
            }, function(err, results){
                if(err !== null) {
                    logger.error(err);
                    reject(err);
                    return;
                }

                if(results === null) {
                    resolve();
                } else {
                    reject({ "message": "The metadata has already been used!", "code": constants.ERR_NODE_NOT_UNIQUE });
                }
            });
        }).then(function(node){
            bitcoind("getnewaddress", function(err, addr){
                var op_return = generate_op_return(constants.OP_INITIALIZE, instruction.metadata);
                console.log(op_return);
                create_bitcoin_transaction(null, [
                    addr, "OP_RETURN"
                ], [
                    constants.TRANSACTION_AMOUNT, op_return
                ], function(err, res){
                    if(err === null) {
                        res = { "txid": res };
                    }

                    cb(err, res);
                })
            });
        }).catch(function(err){
            cb(err, null);
        }).done();
    }
};

module.exports.execute = execute;
module.exports.query = query;
module.exports.broadcast = broadcast;
module.exports.generate_new_rights = generate_new_rights;

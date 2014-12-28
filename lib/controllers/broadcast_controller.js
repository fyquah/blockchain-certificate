var Q = require("q");
var async = require("async");
var bitcoin = require("bitcoinjs-lib");
var constants = require(__dirname + "/../constants.js");
var models = require(__dirname + "/../models");
var bitcoind = require(__dirname + "/../bitcoind.js");
var helper = require(__dirname + "/../helper.js");
var generate_new_rights_controller = require(__dirname + "/generate_new_rights_controller.js");
var execute_controller = require(__dirname + "/execute_controller.js");

var generate_op_return = function(op_code, metadata){
    var buffer = new Buffer(metadata.length / 2 + 3 + 1);
    buffer[0] = 0x42;
    buffer[1] = 0x43;
    buffer[2] = 0x50;
    buffer[3] = op_code;
    (new Buffer(metadata, "hex")).copy(buffer, 4, 0);
    return buffer; // finally some syncrhonous code .__.
};

var outputs_equal = function(o1, o2){
    if(!o1 || !o2) { // if o1 or o2 is undefined or null or false
        return o1 === o2;
    } else {
        return (o1.vout == o2.vout) &&
        (o1.txid == o2.txid);
    }
};

var broadcast_wrapper = function(metadata, cb){
    // this will execute check_if_node_exists and check_if_posess_rightss_output
    // if half way through either returns false, the callback is never executed
    var _node, _output, _addr;
    Q.promise(function(resolve, reject, notify){
        models.Node.findOne({ where: {
            "metadata": metadata,
            "destroyed": false
        }}).complete(function(err, res){
            console.log(err);
            if(err) return reject(err);

            if(res === null) {
                reject({ "message": "node with the given metadata not found", "code": constants.ERR_NODE_NOT_FOUND });
            } else {
                resolve(res);
            }
        });
    }).then(function(node){
        _node = node;
        console.log("invoking listunspent");
        return Q.promise(function(resolve, reject, notify){
            bitcoind("listunspent 0", function(err, all_inputs, stderr){
                if(err) return reject(err);
                var found = false;
                var stack = [];

                async.each(all_inputs, function(input, inner_cb){
                    models.RightsOutput.findOne({ where: {
                        "spent": false,
                        "txid": input.txid,
                        "vout": input.vout,
                        "node_id": node.id
                    }}).complete(function(err, results){
                        if(err) return reject(err);

                        if(results !== null){
                            results.amount = input.amount;
                            stack.push(results);
                        }

                        inner_cb(null);
                    });
                }, function(err){
                    if(err) return reject(err);

                    if(stack.length === 0) {
                        reject({
                            "message": "suitable rights output not found!",
                            "code": constants.ERR_NO_SUCH_RIGHTS
                        });
                    } else {
                        resolve(stack[0]);
                    }
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
            var data;

            var looping_function = function(i){
                if(possessed_amount >= required_amount || i == unspent_inputs.length) {
                    return post_loop_fnc();
                }

                models.RightsOutput.findOne({ where: {
                    txid: unspent_inputs[i].txid,
                    vout: unspent_inputs[i].vout
                }}).complete(function(err, results){
                    if(err) return cb(err);

                    if(!(outputs_equal(unspent_inputs[i], rights_output)) && results === null) {
                        required_inputs.push(unspent_inputs[i]);
                        possessed_amount += unspent_inputs[i].amount;    
                    }

                    looping_function(++i);
                });
            };

            var post_loop_fnc = function() {
                var i;

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
                        console.log("@@@@@@@@@@@@@@@@@@");
                        console.log("STDOUT IS ");
                        console.log(stdout);
                        console.log("ERR IS ");
                        console.log(err);
                        console.log("hex");
                        console.log(obj.hex);
                        console.log("@@@@@@@@@@@@@@@@@@");
                        cb(null, stdout);
                    });
                });
            }

            looping_function(0);
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
                console.log("i was here");
                console.log(err);
                if(err) return reject(err);
                if(results === null) {
                    console.log("baik");
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
        }).then(function(response){
            return Q.promise(function(resolve, reject){
                execute_controller({
                    "op_code": constants.OP_INITIALIZE,
                    "metadata": new Buffer(instruction.metadata, "hex"),
                    "txid": response.txid
                }, function(err, _){
                    if(err) return reject(err);
                    resolve(response);
                });
            });
        }).then(function(response){
            return Q.promise(function(resolve, reject){
                generate_new_rights_controller({
                    "rights_input": null,
                    "count": 1,
                    "txid": response.txid,
                    "genesis": new Buffer(instruction.metadata, "hex")
                }, function(err, _){
                    if(err) return reject(err);
                    resolve(response);
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

            node.getUsers({ where: {
                "address": instruction.address
            }}).complete(function(err, results){
                if(err) return cb(err);

                if(results.length !== 0) {
                    process.exit(1);
                    return cb({
                        "code": constants.ERR_USER_NOT_UNIQUE,
                        "message" : "user address exists lah"
                    });
                }

                var op_return = generate_op_return(constants.OP_REGISTER, instruction.public_key);
                create_bitcoin_transaction(rights_output,
                    [addr, "OP_RETURN", instruction.address],
                    [constants.TRANSACTION_AMOUNT, op_return, constants.TRANSACTION_AMOUNT],
                    function(err, txid){
                        if(err) return cb(err);

                        execute_controller({
                            "op_code": constants.OP_REGISTER,
                            "metadata": new Buffer(instruction.public_key, "hex"),
                            "address": instruction.address,
                            "txid": txid,
                            "rights_input": rights_output
                        }, function(err){
                            if(err) return cb(err);
                            generate_new_rights_controller({
                                "rights_input": rights_output,
                                "count": 1,
                                "txid": txid
                            }, function(err){
                                if(err) return cb(err);
                                cb(null, { "txid": txid });
                            });
                        });
                    });
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
                        });
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
                        });
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
                        if(err) return reject(err);
                        bitcoind("getrawtransaction " + txid + " 1", function(err, transaction){
                            // the first input of the second transction is the first output of the first transaction
                            if(err) return reject(err);
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
                                if(err) return reject(err);

                                resolve({
                                    "r_txid": r_txid,
                                    "s_txid": s_txid,
                                    "user": user
                                });
                            });
                        });
                    });
                });
            }).then(function(obj){ // create the entries into the database
                return Q.promise(function(resolve, reject){
                    var signature_r = models.Signature.build({
                        txid: obj.r_txid,
                        type: "r",
                        metadata: instruction.signature_r
                    });
                    var signature_s = models.Signature.build({
                        txid: obj.s_txid,
                        type: "s",
                        metadata: instruction.signature_s
                    });
                    obj.user.addSignature(signature_r).complete(function(err){
                        if(err) reject(err);
                        obj.user.addSignature(signature_s).complete(function(err){
                            if(err) reject(err);
                            resolve(obj);
                        });
                    })
                });
            }).then(function(obj){
                return Q.promise(function(resolve, reject){
                    generate_new_rights_controller({
                        "rights_input": rights_output,
                        "count": 1,
                        "txid": obj.r_txid
                    }, function(err){
                        if(err) return reject(err);
                        generate_new_rights_controller({
                            "rights_input": {
                                "txid": obj.r_txid,
                                "vout": 0
                            },
                            "count": 1,
                            "txid": obj.s_txid
                        }, function(err){
                            if(err) return reject(err);
                            resolve(obj);
                        })
                    })
                });
            }).then(function(obj){
                cb(null, {
                    "r_txid": obj.r_txid,
                    "s_txid": obj.s_txid
                });
            }).catch(function(err){
                cb(err);
            }).done();

        });

    },
    terminate: function(instruction, cb){

        broadcast_wrapper(instruction.metadata, function(err, node, rights_output, addr){
            if(err) return cb(err);

            var op_return = generate_op_return(constants.OP_TERMINATE_NODE, instruction.metadata);
            create_bitcoin_transaction(null, [ "OP_RETURN" ], [ op_return ], function(err, txid){
                if(err) return cb(err);

                node.updateAttributes({ destroyed: true }).complete(function(err){
                    if(err) return cb(err);
                    rights_output.updateAttributes({ spent: true }).complete(function(err){
                        if(err) return cb(err);
                        cb(null, { "txid": txid });
                    })
                });
            });
        });

    }
};

module.exports = broadcast_methods;

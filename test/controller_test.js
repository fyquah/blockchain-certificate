process.env["NODE_ENV"] = "test";
var assert = require("assert");
var fs = require("fs");
var crypto = require("crypto");
var async = require("async");
var ecdsa = require("ecdsa");
var ecurve = require('ecurve');
var BigInteger = require('bigi');
var sr = require("secure-random");
var bitcoind = require(__dirname + "/../lib/bitcoind.js");
var constants = require(__dirname + "/../lib/constants.js");
var controller = require(__dirname + "/../lib/controller.js");
var models = require(__dirname + "/../lib/models");
var db = require(__dirname + "/../lib/models/db.js");

var initializer = {
    "node_metadata": "bbbbbba948904f2f0f479b8f8197694b30184b0d2ed1c1cd2a1ec0fb85d299a192a447",
    "output_txid": "a948904f2f0f479b8f8197694b30184b0d2ed1c1cd2a1ec0fb85d299a192a447",
    "create_node_and_rights": function(done){
        var n = new models.Node({
            "metadata": initializer.node_metadata,
            "destroyed": false
        });
        n.create(function(err, results){
            if(err) return done(err)
            var rights = new models.RightsOutput({
                "spent": false,
                "txid": initializer.output_txid,
                "vout": 0,
                "node_id": results.id
            });
            rights.create(function(err, results){
                if(err) return done(err);
                done();
            });
        });
    },
    "clear_db": function(done){
        db.clear(function(){
            done();
        });
    },
    "color_unspent": function(done){
        bitcoind("listunspent 0", function(err, res){
            if (res.length == 0) { // there is nothing to color
                done();
                return;
            }

            var end_pos = res.length / 3 || 1;
            var colored_inputs = res.slice(0, end_pos);

            models.Node.find_by({
                "metadata": initializer.node_metadata,
                "destroyed": false
            }, function(err, node){
                if(err) return done(err);
                async.each(colored_inputs, function(item, cb){
                    var output = new models.RightsOutput({
                        "txid": item.txid,
                        "vout": item.vout,
                        "node_id": node.id,
                        "spent": false
                    });
                    output.create(function(err){
                        cb(err);
                    });
                }, function(err){
                    return err ? done(err) : done();
                });
            });
        });
    }
};

describe("Controller", function(){
    before(initializer.clear_db);

    describe("#query", function(){
        
        // "listrights": ["auth_token"],
        describe("listrights", function(){
            before(initializer.clear_db);
            before(initializer.create_node_and_rights);
            before(initializer.color_unspent);

            it("should list all the colored unspent inputs", function(done){
                controller.query({
                    "method": "listrights"
                }, function(err, colored){
                    assert.equal(err, null);
                    bitcoind("listunspent 0", function(err, all){
                        assert.equal(err, null);
                        colored.forEach(function(item){
                            assert(all.some(function(x){
                                return item.txid === x.txid && item.vout === x.vout;
                            }));
                        });
                        done();
                    });
                });                
            });
        });

        // "listnodes": ["auth_token"],
        describe("listnodes", function(done){
            var hexstrings = [];

            before(initializer.clear_db);
            before(function(done){
                var i, node;
                for (i = 0 ; i < 100 ; i += 10) {
                    hexstrings.push(crypto.createHash("sha256").update(i.toString()).digest().toString("hex") + "ababab");
                }

                for (i = 0  ; i < hexstrings.length ; i++) {
                    node = new models.Node({
                        "destroyed": false,
                        "metadata": hexstrings[i]
                    });
                    node.create();

                    if(i == hexstrings.length - 1) {
                        done();
                    }
                }

            });

            it("should list all available nodes in the network", function(done){
                controller.query({
                    "method": "listnodes"
                }, function(err, nodes){
                    var i;
                    for (i = 0 ; i < nodes.length ; i++) {
                        var node = nodes[i];
                        // check if the node is inside
                        assert.equal(hexstrings.some(function(hexstring){
                            return hexstring === node.metadata;
                        }), true);
                    }
                    done();
                })
            });
        });

        // "listusers": ["auth_token", "metadata"],
        describe("listusers", function(){
            var addresses = [
                "mtHPApo7dHwCdXmkn3D2ENKQAzENYPDpsk",
                "muETzXRwNfZNNhRcJ17novohr9dCjGEkAJ",
                "mrSSTWZKy8he8dSnxbvrHFJrKao7axyqmj"
            ];

            before(initializer.clear_db);
            before(function(done){
                var n = new models.Node({
                    "metadata": initializer.node_metadata,
                    "destroyed": false
                });
                n.create(function(err, node){
                    assert.equal(err, null);
                    assert.notEqual(addresses, null);
                    async.each(addresses, function(addr, cb){
                        var user = new models.User({
                            "address": addr,
                            "node_id": node.id,
                            "public_key": "ef1ea5a5e38af57572c4e757f2c5ac51dee7796ec5ab076da3d61c990b43ba5fab"
                        });
                        user.create(function(err){
                            cb(err);
                        });
                    }, function(err){
                        assert.equal(err, null);
                        done();
                    });
                });
            });

            it("should list users of a given node", function(done){
                controller.query({
                    "method": "listusers",
                    "metadata": initializer.node_metadata
                }, function(err, users){
                    addresses.forEach(function(addr){
                        assert.equal(users.some(function(user){
                            return user.address === addr;
                        }), true);
                    });
                    done();
                });
            });
        });

        // "verifysignature": ["auth_token", "metadata", "address", "document", "signature_r", "signature_s"]
        describe("verifysignature", function(){
            var user_address = "mhMmtUf7928pEi52EhxrqeQGWuQEoHPtW7";
            var msg = "hello world";
            var private_key = sr.randomBuffer(32);
            var public_key = ecurve.getCurveByName('secp256k1').G.
                multiply(BigInteger.fromBuffer(private_key)).
                getEncoded(true).toString("hex");
            var signature = ecdsa.sign(crypto.createHash('sha256').update(msg).digest(), private_key);

            before(initializer.clear_db);
            before(initializer.create_node_and_rights);
            before(function(done){
                models.Node.find_by({
                    "metadata": initializer.node_metadata,
                    "destroyed": false
                }, function(err, node){
                    if(err) return done(err);
                    var u = new models.User({
                        "address": user_address,
                        "public_key": public_key,
                        "node_id": node.id
                    });
                    u.create(function(err, user){
                        var r = new models.Signature({
                            "user_id": user.id,
                            "type": "r",
                            "node_id": node.id,
                            "metadata": signature.r.toHex()
                        });
                        var s = new models.Signature({
                            "user_id": user.id,
                            "type": "s",
                            "node_id": node.id,
                            "metadata": signature.s.toHex()
                        });
                        r.create(function(err){
                            if(err) return done(err);
                            s.create(function(err){
                                if(err) return done(err);
                                done();
                            });
                        });
                    })
                });
            });

            it("should be able to verify document against some signature", function(done){
                controller.query({
                    "method": "verifysignature",
                    "metadata": initializer.node_metadata,
                    "address": user_address,
                    "document": msg,
                    "signature_r": signature.r.toHex(),
                    "signature_s": signature.s.toHex()
                }, function(err, obj){
                    assert.equal(err, null);
                    assert.notEqual(obj, undefined);
                    assert.equal(obj.verified, true);
                    done();
                });
            });
        });
    });

    describe("#broadcast" , function(){

    });

    describe("#execute", function(){
        describe("op_initialize", function(){
            before(initializer.clear_db);

            it("should create a new node in the database", function(done){
                var metadata = "bbbbbba948904f2f0f479b8f8197694b30184b0d2ed1c1cd2a1ec0fb85d299a192a447";
                controller.execute({
                    "op_code": constants.OP_INITIALIZE,
                    "metadata": new Buffer(metadata, "hex")
                }, function(err){
                    assert.equal(err, null);
                    models.Node.find_by({
                        "metadata": metadata,
                        "destroyed": false
                    }, function(err, results){
                        assert.equal(err, null);
                        assert.notEqual(results, null);
                        assert.equal(results.metadata, metadata);
                        done();
                    });
                });
            });
        });

        describe("op_register", function(){
            var public_key = "aab948904f2f0f479b8f8197694b30184b0d2ed1c1cd2a1ec0fb85d299a192a447";

            before(initializer.clear_db);
            before(initializer.create_node_and_rights);

            it("should create a new user in the database", function(done){
                controller.execute({
                    "op_code": constants.OP_REGISTER,
                    "metadata": new Buffer(public_key, "hex"),
                    "address": "n1Ggjhc9XSgJ446yMQUdzk8UJ9won5uGer",
                    "rights_input": {
                        "txid": initializer.output_txid,
                        "vout": 0
                    }
                }, function(err, results){
                    models.Node.find_by({
                        "metadata": initializer.node_metadata,
                        "destroyed": false
                    }, function(err, node){
                        assert.equal(err, null);
                        assert.notEqual(node, null);
                        models.User.find_by({
                            "public_key": public_key,
                            "node_id": node.id
                        }, function(err, user){
                            assert.equal(err, null);
                            assert.notEqual(user, null);
                            assert.equal(user.public_key, public_key);
                            done();
                        });
                    });
                });
            });
        });

        describe("op_signature_r", function(){
            var signature_metadata = "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";
            var user_address = "n1Ggjhc9XSgJ446yMQUdzk8UJ9won5uGer";

            before(initializer.clear_db);
            before(initializer.create_node_and_rights);
            before(function(done){
                models.Node.find_by({
                    "metadata": initializer.node_metadata,
                    "destroyed": false
                }, function(err, node){
                    if(err) return done(err);
                    var user = new models.User({
                        "public_key": "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9ac",
                        "address": user_address,
                        "node_id": node.id
                    });
                    user.create(function(err, results){
                        if(err) return done(err);
                        done();
                    });
                })
            });

            it("should create a 'r' signature in the database", function(done){
                controller.execute({
                    "op_code": constants.OP_SIGNATURE_R,
                    "metadata": new Buffer(signature_metadata, "hex"),
                    "address": user_address,
                    "rights_input": {
                        "txid": initializer.output_txid,
                        "vout": 0
                    }
                }, function(err){
                    assert.equal(err, null);
                    models.Node.find_by({
                        "metadata": initializer.node_metadata,
                        "destroyed": false
                    }, function(err, node){
                        assert.equal(err, null);
                        assert.equal(node.metadata, initializer.node_metadata);
                        models.User.find_by({
                            "node_id": node.id,
                            "address": user_address
                        }, function(err, user){
                            assert.equal(err, null);
                            assert.equal(user.address, user_address);
                            models.Signature.find_by({
                                "user_id": user.id,
                                "node_id": node.id,
                                "type": "r",
                                "metadata": signature_metadata
                            }, function(err, signature){
                                assert.equal(err, null);
                                assert.equal(signature.metadata, signature_metadata);
                                assert.equal(signature.type, "r");
                                done();
                            });
                        });
                    })
                });
            });
        });

        describe("op_signature_s", function(){
            var signature_metadata = "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";
            var user_address = "n1Ggjhc9XSgJ446yMQUdzk8UJ9won5uGer";

            before(initializer.clear_db);
            before(initializer.create_node_and_rights);
            before(function(done){
                models.Node.find_by({
                    "metadata": initializer.node_metadata,
                    "destroyed": false
                }, function(err, node){
                    if(err) return done(err);
                    var user = new models.User({
                        "public_key": "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9ac",
                        "address": user_address,
                        "node_id": node.id
                    });
                    user.create(function(err, results){
                        if(err) return done(err);
                        done();
                    });
                })
            });

            it("should create a 's' signature in the database", function(done){
                controller.execute({
                    "op_code": constants.OP_SIGNATURE_S,
                    "metadata": new Buffer(signature_metadata, "hex"),
                    "address": user_address,
                    "rights_input": {
                        "txid": initializer.output_txid,
                        "vout": 0
                    }
                }, function(err){
                    assert.equal(err, null);
                    models.Node.find_by({
                        "metadata": initializer.node_metadata,
                        "destroyed": false
                    }, function(err, node){
                        assert.equal(err, null);
                        assert.equal(node.metadata, initializer.node_metadata);
                        models.User.find_by({
                            "node_id": node.id,
                            "address": user_address
                        }, function(err, user){
                            assert.equal(err, null);
                            assert.equal(user.address, user_address);
                            models.Signature.find_by({
                                "user_id": user.id,
                                "node_id": node.id,
                                "type": "s",
                                "metadata": signature_metadata
                            }, function(err, signature){
                                assert.equal(err, null);
                                assert.equal(signature.metadata, signature_metadata);
                                assert.equal(signature.type, "s");
                                done();
                            });
                        });
                    })
                });
            });
        });

        describe("op_terminate_node", function(){
            before(initializer.clear_db);
            before(initializer.create_node_and_rights);

            it("should terminate the node", function(done){
                controller.execute({
                    "op_code": constants.OP_TERMINATE_NODE,
                    "metadata": new Buffer(initializer.node_metadata, "hex"),
                    "rights_input": {
                        "txid": initializer.output_txid,
                        "vout": 0
                    }
                }, function(err, results){
                    console.log(err);
                    models.Node.find_by({
                        "metadata": initializer.node_metadata,
                        "destroyed": false
                    }, function(err, results){
                        assert.equal(err, null);
                        assert.equal(results, null);
                        done();
                    });
                });
            });
        });
    });
});

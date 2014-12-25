process.env["NODE_ENV"] = "test";
var assert = require("assert");
var fs = require("fs");
var constants = require(__dirname + "/../lib/constants.js");
var controller = require(__dirname + "/../lib/controller.js");
var models = require(__dirname + "/../lib/model.js");
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
    }
};

describe("Controller", function(){
    before(function(){
        db.clear();
    });

    afterEach(function(){
        console.log("clearing up database..");
        db.clear();
    });

    describe("#query", function(){

    });

    describe("#broadcast" , function(){

    });

    describe("#execute", function(){
        describe("op_initialize", function(){
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

            beforeEach(initializer.create_node_and_rights);

            afterEach(function(){
                db.clear();
            });

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

            beforeEach(initializer.create_node_and_rights);
            beforeEach(function(done){
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

            beforeEach(initializer.create_node_and_rights);
            beforeEach(function(done){
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
            beforeEach(initializer.create_node_and_rights);

            afterEach(function(){
                db.clear();
            });

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

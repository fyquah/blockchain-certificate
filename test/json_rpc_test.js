process.env["NODE_ENV"] = "test";
var jayson = require("jayson");
var async = require("async");
var sr = require("secure-random");
var BigInteger = require("bigi");
var ecdsa = require("ecdsa");
var ecurve = require('ecurve');
var assert = require("assert");
var crypto = require("crypto");
var models = require("../lib/models");

var client = jayson.client.http({
    port: 9339,
    hostname: 'localhost'
});
var auth_token = "cceaace8f0ff80afe34aa2caada7f1d939992a88";

var clear_db =  function(done){
    async.each(["User", "RightsOutput", "Node", "Signature"], function(name, inner_cb){
        models[name].destroy().complete(function(err){
            inner_cb(err || null);
        });
    }, function(err){
        done(err || undefined);
    });
};

describe("JSON-RPC", function(){
    describe("single node-user world", function(){
        var node_metadata = "f99934ea8995dfe1fbd745ed5ed4e001f73fe6f2b82bac11848740adb029fa6a111111";
        var user_address = "mkv8UXvSG3wRCFi7aQTQgfSSBwFf7ouuyW";

        var msg = "hello world";
        var private_key = "81861971e60a016e736ef8ee69dfa5691568058435bee6c14eb79a0be2613ff1";
        var public_key = "0380afc0aaee118c79e5fa8cf7503cd36d66722d8466f456841d0a1ce40152ca47";
        var signature = {
            r: "77101264faec78e25a21cd821948eb359f1c55e7ee257bc5ab31effe6f5597f9",
            s: "4f806cebe3fcdab845558681fda285cb1ac0a01b88053803cabe9d41b155c562"
        };
        var stack = [];
        before(clear_db);
        before(function(done){
            this.timeout(0);
            client.request("initialize", [auth_token, node_metadata], function(err, error, response){
                if(err) return done(err);
                stack.push(response);

                client.request("registeruser", [auth_token, node_metadata, user_address, public_key], function(err, _, response){
                    if(err) return done(err);
                    stack.push(response);

                    client.request("broadcastsignature", [auth_token, node_metadata, user_address, msg, signature.r, signature.s], function(err, _, response){
                        if(err) return done(err);
                        stack.push(response);
                        done();

                        console.log("the stack now looks like");
                        console.log(stack);
                    });
                });
            });
        });

        it("should be able to create single user history", function(){
            assert(stack.length == 3);
        });
    });

    describe("multiple nodes execution", function(){
        var hexstrings = [];
        var user_addresses = ["mkgK1RwAs2wQKSQsfXjhAXcyHy4Wrj6Wys", "mvm7JjdkMAqYt2b8VrJifnveHo3XWfLRBR", "mg1RhF3FjAv45m2chuJCwTXoYLniZdKWSU"] ;
        var stack = [];
        // create 10 nodes
        // create 10 users per node, all same address as other nodes (should not raise any errors)
        // create 1 signature per user (hence total 1000 signatures)
        // each user-node has different public-private key pair

        before(clear_db);
        before(function(){
            for(var i = 0 ; i < 2 ; i++) {
                hexstrings.push("111111" + crypto.createHash("sha256").update(i.toString()).digest().toString("hex"));
            }
        });
        before(function(done){
            this.timeout(0);
            var i = 0;
            async.forEach(hexstrings, function(node_metadata, cb){
                console.log(node_metadata);
                client.request("initialize", [auth_token, node_metadata], function(err, error, response){
                    if(err || error) return done(err || error);
                    stack.push(response);
                    console.log(response);

                    async.forEach(user_addresses, function(user_address, inner_cb){

                        var msg = "hello world";
                        var private_key = sr.randomBuffer(32);
                        var public_key = ecurve.getCurveByName('secp256k1').G.
                            multiply(BigInteger.fromBuffer(private_key)).
                            getEncoded(true).toString("hex");
                        var sig = ecdsa.sign(crypto.createHash('sha256').update(msg).digest(), private_key);
                        var signature = {
                            r: sig.r.toHex(),
                            s: sig.s.toHex()
                        };

                        client.request("registeruser", [auth_token, node_metadata, user_address, public_key], function(err, error, response){
                            if(err || error) return done(err || error);
                            stack.push(response);
                            console.log(response);

                            client.request("broadcastsignature", [auth_token, node_metadata, user_address, msg, signature.r, signature.s], function(err, error, response){
                                if(err || error) return done(err || error);
                                stack.push(response);
                                console.log(response);
 
                                inner_cb();
                            });
                        });

                    }, function(e){
                        cb()
                    });
                });
            }, function(){
                done();
            })
        });
        
        it('should be fine', function(){
            console.log("the stack looks like");
            console.log(stack);
            for(var i = 0 ; i < stack.length ; i++) {
                if (stack.txid || (stack.r_txid && stack.s_txid)) {
                    assert(true);                
                }
            }
            assert(stack.length, 14);
        });
    })
})
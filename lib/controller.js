// this file interacts with the model
var constants = require("./constants.js");
var models = require("./model.js");
var Q = require("q");
var bitcoind = require("bitcoinjs-lib");

var verify_rights_input = function(input, cb){ // returns node if successful
    model.RightsOutput.find_by({
        "txid": rights_input.txid,
        "vout": rights_input.vout,
        "spent": false
    }, function(){
        if(this === null) {
            cb.apply(null, [false]);
        } else {
            models.Node.find_by({
                "id": this.id,
                "destroyed": false
            }, function(){
                cb.apply(this, [true]);
            })
        }
    });
};

var append_signature = function(type, instruction, node, cb){
    models.User.find_by({
        "address": instruction.address,
        "node": node.id
    }, function(){
        var user = this;
        if(this !== null) {
            var signature = new Signature({
                "user_id": user.id,
                "node_id": node.id,
                "type": type,
                "data": instruction.metdata.toString("hex")
            })
            signature.create(function(){ cb.apply(this, null, true) })
        } else {
            cb.apply({"error": "the given user address could not be found!"});
        }
    });
}

var query = function(instruction, cb){
    // when user query somethings
    Q.promise(function(resolve, reject){
        query_methods[instruction.method](instruction);
    }).then(function(){

    }).done();
};

var broadcast = function(instruction, cb){
    // broadcast transactions methods, but does not hav rights to write stuff into database
};

var execute = function(instruction, cb) {
    // execute based on what is seen in the blockchain
    // this is the only method which can write stuff intot he database
    Q.promise(function(resolve, reject){
        verify_rights_input(instruction.rights_input, function(){
            resolve(this);
        });
    }).then(function(node){
        return Q.promise(function(resolve, reject){
            var obj;
            if(instruction.op_code !== constants.OP_INITIALIZE && !node) {
                reject({ "error" : "Error verifying rights input" });
            }

            if(instruction.op_code === constants.OP_INITIALIZE) {
                // verify that the metadata is not used by anyone else
                models.Node.find_by({
                    "metadata": instruction.metadata.toString("hex")
                }, function(){
                    if(this == null) {
                        var node = new Node();
                        node.metadata = instruction.metadata.toString("hex");
                        node.create(function(){ resolve(); });
                    } else {
                        reject({ "error": "metadata has already been used" })
                    }
                });
            } else if (instruction.op_code === constants.OP_REGISTER) {
                // verify that such user is not registered yet
                models.User.find_by({
                    "address": instruction.address
                }, function(){
                    if(this === null) {
                        var user = new User({
                            "public_key": instruction.metadata.toString("hex"),
                            "address": instruction.address,
                            "node_id": node.id
                        });
                    } else {
                        reject({ "error" : "user address exists"} );
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
                node.destroyed = true;
                node.update_attributes({ "destroyed": true }, function(){
                    resolve();
                });
            }
        });
    }).catch(function(err){
        console.log("An error occured");
        console.log("error : " + err.error);
    }).done();
};

var generate_new_rights = function(instruction, cb){
    // verify that the rights input exists first
    verify_rights_input(instruction.rights_input, function(){
        var node = this
        if(this === null) {
            reject({ "error": "Error verifying input rights"})
        } else {
            Q.promise(function(resolve, reject){ // delete old rights unless genesis
                if(instruction.genesis) {
                    resolve();
                } else {
                    RightsOutput.find_by(instruction.rights_input).
                    update_attribute({ "spent": true })
                    .then(function(){
                        resolve();
                    });
                }
            }).then(function(){ // create new rights
                for(var i = 0 ; i < instruction.count ; i++) {
                    var output_right = new models.OutputRight({
                        "txid": instruction.txid,
                        "vout": i
                    });
                    output_right.create(function(){
                        if(this.vout == instruction.count - 1) {
                            resolve();
                        }
                    });
                }
            }).done();
        }
    });
};

var query_methods = {
    listusers: function(instruction, cb){
        var metadata = instruction.metadata;
        models.Node.find_by({
            metadata: "metadata"
        }, function(){
            var that = this;
            models.User.where({
                node_id: that.id
            }, function(err, res){
                cb(err, res);
            })
        });
    },
    listnodes: function(instruction, cb){
        models.Node.all(function(err, res){
            if(!err) {
                var res = this.map(function(entry){
                    return entry.metadata;
                });                
            }
            cb(err, res);
        })
    },
    verifysignature: function(){
        models.Node.all(function(err, res){
            
        })
    },
    listrights: function(instruction, cb){
        var res_or_rej = function(err, res){
            if(err) {
                reject(err);
            } else {
                resolve(res);
            }
        };
        var compare = function(obj1, obj2) {

        };

        var binary_search = function(arr, entry) {
            var lo = 0, hi = arr.length - 1, mid;
            while (lo < hi) {
                mid = Math.floor((lo+hi)/2);
                if (arr[mid] == entry) {

                } else if ()
            }
        };

        Q.promise(function(resolve, reject){
            models.Node.find_by({
                metadata: "metadata"
            }, res_or_rej)
        }).then(function(node){
            models.RightOutput.where({
                "node_id": node.id
            }, res_or_rej)
        }).then(function(output_rights){
            output_rights.map(function(){
                return this.txid
            })
        }).catch(function(){

        }).done();
        , function(err, res){
            OutputRight.where({
                "node_id": res.id
            }, function(err, res){

            })
        })
    }
}

module.exports.execute = execute;
module.exports.generate_new_rights = generate_new_rights;

var Q = require("q");
var async = require("async");
var bitcoin = require("bitcoinjs-lib");
var constants = require(__dirname + "/../constants.js");
var models = require(__dirname + "/../models");
var bitcoind = require(__dirname + "/../bitcoind.js");
var helper = require(__dirname + "/../helper.js");

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

module.exports = generate_new_rights;
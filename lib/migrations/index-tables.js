"use strict";

module.exports = {
  up: function(migration, DataTypes, done) {
    // indexing the tables

    migration.addIndex("Nodes", ["metadata"]);
    migration.addIndex("Nodes", ["txid"]);

    migration.addIndex("Users", ["address"]);
    migration.addIndex("Users", ["public_key"]);
    migration.addIndex("Users", ["txid"]);
    migration.addIndex("Users", ["node_id"]);

    migration.addIndex("Signatures", ["txid"]);
    migration.addIndex("Signatures", ["type"]);
    migration.addIndex("Signatures", ["metadata"]);
    migration.addIndex("Signatures", ["user_id"]);
    migration.addIndex("Signatures", ["type", "metadata", "user_id"])

    migration.addIndex("RightsOutputs", ["txid"]);
    migration.addIndex("RightsOutputs", ["vout"]);
    migration.addIndex("RightsOutputs", ["node_id"]);
    migration.addIndex("RightsOutputs", ["txid", "vout", "node_id"]);

    done();
  },

  down: function(migration, DataTypes, done) {
    // removes the index from the tables
    
    migration.removeIndex("Nodes", ["metadata"]);
    migration.removeIndex("Nodes", ["txid"]);

    migration.removeIndex("Users", ["address"]);
    migration.removeIndex("Users", ["public_key"]);
    migration.removeIndex("Users", ["txid"]);
    migration.removeIndex("Users", ["node_id"]);

    migration.removeIndex("Signatures", ["txid"]);
    migration.removeIndex("Signatures", ["type"]);
    migration.removeIndex("Signatures", ["metadata"]);
    migration.removeIndex("Signatures", ["user_id"]);
    migration.removeIndex("Signatures", ["type", "metadata", "user_id"])

    migration.removeIndex("RightsOutputs", ["txid"]);
    migration.removeIndex("RightsOutputs", ["vout"]);
    migration.removeIndex("RightsOutputs", ["node_id"]);
    migration.removeIndex("RightsOutputs", ["txid", "vout", "node_id"]);
   
    done();
  }
};

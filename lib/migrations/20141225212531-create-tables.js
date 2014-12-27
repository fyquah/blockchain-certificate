"use strict";

module.exports = {
  up: function(migration, DataTypes, done) {
    var id_properties = {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    };
    // add altering commands here, calling 'done' when finished

    migration.createTable("Nodes", {
        "id": id_properties,
        "metadata": DataTypes.STRING,
        "destroyed": DataTypes.STRING,
        "txid": DataTypes.STRING
    });
    migration.createTable("Users", {
        "id": id_properties,
        "address": DataTypes.STRING,
        "public_key": DataTypes.STRING,
        "txid": DataTypes.STRING,
        "node_id": DataTypes.INTEGER
    });
    migration.createTable("Signatures", {
        "id": id_properties,
        "txid": DataTypes.STRING,
        "type": DataTypes.STRING,
        "metadata": DataTypes.STRING,
        "node_id": DataTypes.INTEGER,
        "user_id": DataTypes.INTEGER
    });
    migration.createTable("RightsOutputs", {
        "id": id_properties,
        "txid": DataTypes.STRING,
        "vout": DataTypes.INTEGER,
        "spent": DataTypes.BOOLEAN,
        "node_id": DataTypes.INTEGER
    });
    done();
  },

  down: function(migration, DataTypes, done) {
    // add reverting commands here, calling 'done' when finished
    migration.dropTable("users");
    migration.dropTable("rights_outputs");
    migration.dropTable("nodes");
    migration.dropTable("signatures");    
    done();
  }
};

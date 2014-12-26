"use strict";
module.exports = function(sequelize, DataTypes) {
  var RightsOutput = sequelize.define("RightsOutput", {
    "txid": {
        type: DataTypes.STRING,
        allowNull: false
    },
    "vout": {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    "spent": {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
        RightsOutput.belongsTo(models.Node, { foreignKey: "node_id" });
      }
    },
    timestamps: false
  });
  return RightsOutput;
};
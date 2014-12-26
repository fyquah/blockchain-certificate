"use strict";
module.exports = function(sequelize, DataTypes) {
  var Signature = sequelize.define("Signature", {
    "txid": {
        type: DataTypes.STRING,
        allowNull: false
    },
    "type": {
        type: DataTypes.STRING,
        allowNull: false
    },
    "metadata": {
        type: DataTypes.STRING,
        allowNull: false
    }
  }, {
    classMethods: {
      associate: function(models) {
        Signature.belongsTo(models.User, { foreignKey: "user_id" });
        Signature.belongsTo(models.Node, { foreignKey: "node_id" });
      }
    },
    timestamps: false
  });
  return Signature;
};
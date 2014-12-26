"use strict";
module.exports = function(sequelize, DataTypes) {
  var User = sequelize.define("User", {
    "address": {
      type: DataTypes.STRING,
      allowNull: false
    },
    "public_key": {
      type: DataTypes.STRING,
      allowNull: false
    },
    "txid": {
      type: DataTypes.STRING,
      allowNull: false
    }
  }, {
    classMethods: {
      associate: function(models) {
        // associations can be defined here
        User.belongsTo(models.Node, { foreignKey: "node_id" });
      }
    },
    timestamps: false
  });
  return User;
};
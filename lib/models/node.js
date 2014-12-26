"use strict";
module.exports = function(sequelize, DataTypes) {
    var Node = sequelize.define("Node", {
        "txid": {
            type: DataTypes.STRING,
            allowNull: false
        },
        "metadata": {
            type: DataTypes.STRING,
            allowNull: false
        },
        "destroyed": {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        } 
    }, {
        "classMethods": {
          associate: function(models) {
            // associations can be defined here
            Node.hasMany(models.User, { foreignKey: "node_id" });
          }
        },
        "timestamps": false
    });
    return Node;
};
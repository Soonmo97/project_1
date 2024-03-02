const Suggestions = function (Sequelize, DataTypes) {
    const Suggestions = Sequelize.define(
        "Suggestions",
        {
            sug_index: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            title: { type: DataTypes.STRING, allowNull: false },
            content: { type: DataTypes.STRING, allowNull: false },
            // created_at: { type: DataTypes.DATE, allowNull: false },
            // updated_at: { type: DataTypes.DATE, allowNull: false },
        },
        { freezeTableName: true, timestamps: true, underscored: true }
    );
    return Suggestions;
};

module.exports = Suggestions;
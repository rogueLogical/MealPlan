const mongoose = require('mongoose');

const PortionStorageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe', required: true },
    recipeTitle: { type: String, required: true },
    portionsInStorage: { type: Number, required: true, default: 0, min: 0 }
  },
  { timestamps: true }
);

// Ensures a user has exactly one storage tracker entry per recipe
PortionStorageSchema.index({ userId: 1, recipeId: 1 }, { unique: true });

module.exports = mongoose.model('PortionStorage', PortionStorageSchema);

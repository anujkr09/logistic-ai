const mongoose = require('mongoose');

const WorkspaceItemSchema = new mongoose.Schema(
  {
    entity: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
      index: true,
    },
    sessionKey: {
      type: String,
      default: 'public-demo',
      trim: true,
      index: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

WorkspaceItemSchema.index({ entity: 1, companyId: 1, sessionKey: 1, 'data.id': 1 });

module.exports = mongoose.model('WorkspaceItem', WorkspaceItemSchema);

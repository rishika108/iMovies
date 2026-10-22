const mongoose = require('mongoose');

const webhookEventSchema = new mongoose.Schema({
  event: {
    type: String,
    required: true,
    enum: [
      'delivered',
      'hard_bounce',
      'soft_bounce',
      'spam',
      'blocked',
      'opened',
      'click',
      'invalid_email',
      'deferred',
      'unsubscribed',
      'request',
      'error',
      'unknown'
    ],
    index: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  messageId: {
    type: String,
    default: null,
    index: true
  },
  subject: {
    type: String,
    default: null
  },
  reason: {
    type: String,
    default: null
  },
  tags: {
    type: [String],
    default: []
  },
  rawPayload: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ip: {
    type: String,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('WebhookEvent', webhookEventSchema);

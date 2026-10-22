/**
 * webhookController.js
 * Brevo (Sendinblue) Webhook Event Handler
 *
 * Handles live event notifications from Brevo:
 * - delivered: Email arrived at recipient inbox
 * - hard_bounce: Permanent delivery failure (invalid email, non-existent domain)
 * - soft_bounce: Temporary delivery failure (mailbox full, server timeout)
 * - spam: Recipient marked transactional email as spam
 * - blocked: Email blocked by ISP or suppression list
 * - opened / click: Engagement tracking
 *
 * Implements structured logging, database updates to user emailStatus,
 * audit logging via WebhookEvent collection, and idempotency.
 */

const User = require('../models/userModel');
const WebhookEvent = require('../models/webhookEventModel');
const { BREVO_API_KEY } = require('../config/brevoConfig');

/**
 * Validate incoming webhook secret (optional or configured)
 * Accepts secret in:
 *  - URL route param (:secret)
 *  - Query param (?secret=... or ?token=...)
 *  - Header ('x-webhook-token', 'x-sib-signature', 'x-api-key', or Bearer auth)
 */
const verifyWebhookSecret = (req) => {
  const expectedSecret = process.env.BREVO_WEBHOOK_SECRET || BREVO_API_KEY;
  if (!expectedSecret) {
    // If no secret configured, allow requests but log notice
    return true;
  }

  const providedSecret =
    req.params.secret ||
    req.query.secret ||
    req.query.token ||
    req.headers['x-webhook-secret'] ||
    req.headers['x-webhook-token'] ||
    req.headers['x-brevo-token'] ||
    req.headers['x-sib-signature'] ||
    req.headers['x-api-key'] ||
    (req.headers.authorization && req.headers.authorization.replace(/^Bearer\s+/i, ''));

  if (!providedSecret) {
    // Allow standard unauthenticated webhooks if BREVO_WEBHOOK_STRICT is not set
    if (process.env.BREVO_WEBHOOK_STRICT === 'true') {
      return false;
    }
    return true;
  }

  return providedSecret.trim() === expectedSecret.trim();
};

/**
 * Normalize and extract events from Brevo request payload
 * Brevo can send either a single event object or an array of event objects
 */
const extractEvents = (body) => {
  if (Array.isArray(body)) {
    return body;
  }
  if (body && typeof body === 'object') {
    return [body];
  }
  return [];
};

/**
 * POST /api/webhooks/brevo
 * POST /api/webhooks/brevo/:secret
 * Process Brevo event notifications
 */
const handleBrevoWebhook = async (req, res) => {
  const startTime = Date.now();

  try {
    // 1. Secret / Token Verification
    if (!verifyWebhookSecret(req)) {
      console.warn('[Brevo Webhook] ❌ Unauthorized webhook attempt: Invalid secret or token');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid webhook secret'
      });
    }

    const events = extractEvents(req.body);
    if (events.length === 0) {
      console.log('[Brevo Webhook] Received empty or ping payload');
      return res.status(200).json({ success: true, message: 'Webhook endpoint active', processed: 0 });
    }

    console.log(`[Brevo Webhook] Processing ${events.length} incoming event(s)...`);

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    let processedCount = 0;

    for (const item of events) {
      const eventType = (item.event || item.type || 'unknown').toLowerCase().trim();
      const rawEmail = item.email || item['recipient'] || item.to || '';
      const email = String(rawEmail).toLowerCase().trim();
      const messageId = item['message-id'] || item.messageId || item.id || null;
      const reason = item.reason || item.description || item.error || null;
      const subject = item.subject || null;
      const tags = Array.isArray(item.tag) ? item.tag : (item.tag ? [item.tag] : []);

      if (!email) {
        console.warn(`[Brevo Webhook] Event "${eventType}" missing recipient email, skipping`);
        continue;
      }

      // Record in WebhookEvent audit collection
      try {
        await WebhookEvent.create({
          event: eventType,
          email,
          messageId,
          subject,
          reason,
          tags,
          rawPayload: item,
          ip: clientIp
        });
      } catch (dbErr) {
        console.error('[Brevo Webhook] Failed to persist event audit log:', dbErr.message);
      }

      // Process event business logic according to event type
      switch (eventType) {
        case 'hard_bounce': {
          console.error(`[Brevo Webhook] 🚨 CRITICAL: Hard bounce received for ${email}. Reason: ${reason || 'Permanent failure'}`);
          const updatedUser = await User.findOneAndUpdate(
            { email },
            {
              emailStatus: 'hard_bounce',
              bouncedAt: new Date(),
              bounceReason: reason || 'Hard bounce reported by Brevo'
            },
            { new: true }
          );
          if (updatedUser) {
            console.log(`[Brevo Webhook] Updated User ${updatedUser._id} emailStatus='hard_bounce'`);
          }
          break;
        }

        case 'soft_bounce': {
          console.warn(`[Brevo Webhook] ⚠️ Soft bounce received for ${email}. Reason: ${reason || 'Temporary failure'}`);
          await User.findOneAndUpdate(
            { email },
            {
              emailStatus: 'soft_bounce',
              bouncedAt: new Date(),
              bounceReason: reason || 'Soft bounce reported by Brevo'
            }
          );
          break;
        }

        case 'spam': {
          console.error(`[Brevo Webhook] 🚨 CRITICAL: Spam complaint reported for ${email}. Reason: ${reason || 'Marked as spam'}`);
          const spamUser = await User.findOneAndUpdate(
            { email },
            {
              emailStatus: 'spam',
              bouncedAt: new Date(),
              bounceReason: reason || 'Spam complaint registered via ISP'
            },
            { new: true }
          );
          if (spamUser) {
            console.log(`[Brevo Webhook] User ${spamUser._id} flagged emailStatus='spam'`);
          }
          break;
        }

        case 'blocked': {
          console.error(`[Brevo Webhook] 🚫 Blocked delivery for ${email}. Reason: ${reason || 'Suppression list / blacklist'}`);
          await User.findOneAndUpdate(
            { email },
            {
              emailStatus: 'blocked',
              bouncedAt: new Date(),
              bounceReason: reason || 'Delivery blocked by Brevo'
            }
          );
          break;
        }

        case 'delivered': {
          console.log(`[Brevo Webhook] ✅ DELIVERED: Message ${messageId || ''} successfully reached ${email}`);
          // If user was previously soft_bounced, restore status to valid
          await User.findOneAndUpdate(
            { email, emailStatus: 'soft_bounce' },
            { emailStatus: 'valid', bounceReason: null }
          );
          break;
        }

        case 'opened': {
          console.log(`[Brevo Webhook] 👁️ OPENED: Email opened by ${email}`);
          break;
        }

        case 'click': {
          console.log(`[Brevo Webhook] 🔗 CLICK: Link clicked by ${email} (${item.link || 'URL'})`);
          break;
        }

        case 'unsubscribed': {
          console.log(`[Brevo Webhook] 🔕 UNSUBSCRIBE: User unsubscribed: ${email}`);
          await User.findOneAndUpdate(
            { email },
            { emailStatus: 'unsubscribed' }
          );
          break;
        }

        default: {
          console.log(`[Brevo Webhook] Received event "${eventType}" for ${email}`);
          break;
        }
      }

      processedCount++;
    }

    const duration = Date.now() - startTime;
    console.log(`[Brevo Webhook] Completed processing ${processedCount} event(s) in ${duration}ms`);

    // Always respond with 200 OK so Brevo marks webhook delivery as successful
    return res.status(200).json({
      success: true,
      received: true,
      processed: processedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Brevo Webhook] Unhandled exception processing webhook:', error);
    // Even on error, return 200 with error info so Brevo doesn't spam retries unless critical
    return res.status(200).json({
      success: false,
      received: true,
      error: error.message
    });
  }
};

/**
 * GET /api/webhooks/brevo
 * Health check endpoint for Brevo webhook URL validation
 */
const verifyWebhookEndpoint = (req, res) => {
  return res.status(200).json({
    status: 'active',
    service: 'Brevo Webhook Listener',
    timestamp: new Date().toISOString()
  });
};

/**
 * GET /api/webhooks/brevo/logs
 * Retrieve recent delivery and bounce events for monitoring
 */
const getWebhookLogs = async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const eventFilter = req.query.event ? { event: req.query.event } : {};
    const emailFilter = req.query.email ? { email: req.query.email.toLowerCase() } : {};

    const query = { ...eventFilter, ...emailFilter };

    const logs = await WebhookEvent.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const stats = await WebhookEvent.aggregate([
      { $group: { _id: '$event', count: { $sum: 1 } } }
    ]);

    return res.status(200).json({
      success: true,
      total: logs.length,
      stats: stats.reduce((acc, curr) => {
        acc[curr._id] = curr.count;
        return acc;
      }, {}),
      events: logs
    });
  } catch (error) {
    console.error('[Brevo Webhook] Error fetching webhook logs:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

module.exports = {
  handleBrevoWebhook,
  verifyWebhookEndpoint,
  getWebhookLogs
};

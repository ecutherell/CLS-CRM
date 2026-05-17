import express from 'express';
import Stripe from 'stripe';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = join(__dirname, '../../stripe-cache.json');

function readCache() {
  try { return existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : null; }
  catch { return null; }
}
function writeCache(data) {
  try { writeFileSync(CACHE_FILE, JSON.stringify(data)); } catch {}
}

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function paginate(fn) {
  const items = [];
  let starting_after;
  while (true) {
    const params = { limit: 100 };
    if (starting_after) params.starting_after = starting_after;
    const page = await fn(params);
    items.push(...page.data);
    if (!page.has_more) break;
    starting_after = page.data[page.data.length - 1].id;
  }
  return items;
}

router.get('/customers', async (req, res) => {
  try {
    // Fetch customers and all subscriptions in parallel
    const [customers, allSubscriptions, allInvoices] = await Promise.all([
      paginate(p => stripe.customers.list({ ...p })),
      paginate(p => stripe.subscriptions.list({ ...p, status: 'all' })),
      paginate(p => stripe.invoices.list({ ...p, limit: 100 })),
    ]);

    // Build subscription map: customerId -> subscription (most recent)
    const subMap = {};
    for (const sub of allSubscriptions) {
      const cid = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
      if (!cid) continue;
      if (!subMap[cid] || sub.created > subMap[cid].created) subMap[cid] = sub;
    }

    // Build maps: customerId -> latest paid invoice, latest open/failed invoice
    const paidMap = {};
    const failedMap = {};
    for (const inv of allInvoices) {
      const cid = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id;
      if (!cid) continue;
      if (inv.status === 'paid') {
        if (!paidMap[cid] || inv.created > paidMap[cid].created) paidMap[cid] = inv;
      } else if (inv.status === 'open' || inv.status === 'uncollectible') {
        if (!failedMap[cid] || inv.created > failedMap[cid].created) failedMap[cid] = inv;
      }
    }

    const results = customers.map(c => {
      let lastPaymentDate = null, lastPaymentAmount = null;
      let nextPaymentDate = null, subscriptionStatus = null;
      let failedPaymentDate = null, nextRetryDate = null;
      let pausedResumesAt = null;

      const sub = subMap[c.id];
      if (sub) {
        subscriptionStatus = sub.status;
        // Detect paused: status stays "active" but pause_collection is set
        if (sub.status === 'active' && sub.pause_collection) {
          subscriptionStatus = 'paused';
          if (sub.pause_collection.resumes_at) {
            pausedResumesAt = new Date(sub.pause_collection.resumes_at * 1000).toISOString().slice(0, 10);
          }
        }
        if (sub.current_period_end) {
          nextPaymentDate = new Date(sub.current_period_end * 1000).toISOString().slice(0, 10);
        }
        if ((sub.status === 'past_due' || sub.status === 'unpaid') && sub.current_period_start) {
          failedPaymentDate = new Date(sub.current_period_start * 1000).toISOString().slice(0, 10);
        }
      }

      const paid = paidMap[c.id];
      if (paid) {
        lastPaymentDate = new Date(paid.created * 1000).toISOString().slice(0, 10);
        lastPaymentAmount = paid.amount_paid / 100;
      }

      let attemptCount = null;
      const failed = failedMap[c.id];
      if (failed) {
        if (!failedPaymentDate) failedPaymentDate = new Date(failed.created * 1000).toISOString().slice(0, 10);
        if (failed.next_payment_attempt) {
          nextRetryDate = new Date(failed.next_payment_attempt * 1000).toISOString().slice(0, 10);
        }
        if (failed.attempt_count) attemptCount = failed.attempt_count;
      }

      return {
        id: c.id,
        name: c.name || '',
        email: c.email || '',
        lastPaymentDate,
        lastPaymentAmount,
        nextPaymentDate,
        subscriptionStatus,
        failedPaymentDate,
        nextRetryDate,
        attemptCount,
        pausedResumesAt,
      };
    });

    // Build recent payments: top 5 paid + top 5 failed, merged and sorted by date
    const mapInvoice = (inv, status) => {
      const cid = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id;
      const cust = customers.find(c => c.id === cid);
      return {
        date: new Date(inv.created * 1000).toISOString().slice(0, 10),
        amount: (inv.amount_due || inv.amount_paid || 0) / 100,
        name: cust?.name || inv.customer_name || 'Unknown',
        customerId: cid,
        status,
      };
    };
    const recentPaid   = allInvoices.filter(inv => inv.status === 'paid' && inv.amount_paid > 0).sort((a,b)=>b.created-a.created).slice(0,5).map(inv=>mapInvoice(inv,'paid'));
    const recentFailed = allInvoices.filter(inv => (inv.status === 'open' || inv.status === 'uncollectible') && inv.attempt_count > 0).sort((a,b)=>b.created-a.created).slice(0,5).map(inv=>mapInvoice(inv,'failed'));
    const recentPayments = [...recentPaid, ...recentFailed].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);

    // Cache to disk so /cached can serve it instantly on next page load
    writeCache({ results, recentPayments, savedAt: new Date().toISOString() });
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve the last cached Stripe data instantly (no Stripe API call)
router.get('/cached', (req, res) => {
  const cache = readCache();
  if (cache) {
    res.json(cache);
  } else {
    res.json({ results: [], savedAt: null });
  }
});

export default router;

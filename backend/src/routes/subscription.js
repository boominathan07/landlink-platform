const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const auth = require('../middleware/auth');

const router = express.Router();

const PLANS = {
  pro: { amount: 79900, name: 'Pro', plan: 'pro' },
  agency: { amount: 249900, name: 'Agency', plan: 'agency' },
};

router.post('/create-order', auth, async (req, res) => {
  const { planKey } = req.body;
  const plan = PLANS[planKey];
  if (!plan) return res.status(400).json({ message: 'Invalid plan' });

  if (!process.env.RAZORPAY_KEY_ID) {
    return res.json({
      devMode: true,
      message: 'Razorpay not configured. Use dev upgrade.',
      plan: plan.plan,
    });
  }

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  const order = await razorpay.orders.create({
    amount: plan.amount,
    currency: 'INR',
    receipt: `landlink_${req.user._id}_${Date.now()}`,
    notes: { plan: plan.plan, userId: req.user._id.toString() },
  });

  res.json({ order, keyId: process.env.RAZORPAY_KEY_ID, plan: plan.plan });
});

router.post('/verify', auth, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;

  if (process.env.RAZORPAY_KEY_SECRET) {
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');
    if (expected !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid payment signature' });
    }
  }

  req.user.plan = plan || 'pro';
  req.user.planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await req.user.save();

  res.json({ user: req.user, message: 'Subscription activated' });
});

router.post('/dev-upgrade', auth, async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ message: 'Dev only' });
  }
  req.user.plan = req.body.plan || 'pro';
  req.user.planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await req.user.save();
  res.json({ user: req.user });
});

module.exports = router;

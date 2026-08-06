const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validate = require('../validators/validate');
const { registerSchema } = require('../validators/authValidator');
const User = require('../models/User');
const Organization = require('../models/Organization');
const OrganizationMember = require('../models/OrganizationMember');

const router = express.Router();

router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, message: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, passwordHash });

    const token = jwt.sign(
      { userId: user._id, email: user.email, role: user.role, organizationId: null },
      process.env.JWT_SECRET || 'dev-jwt-secret-change-me',
      { expiresIn: '8h' }
    );

    res.status(201).json({ success: true, token, user: { id: user._id, email: user.email, name: user.name } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const membership = await OrganizationMember.findOne({ userId: user._id, status: 'active' }).sort({ createdAt: 1 });
    const organizationId = membership ? membership.organizationId : null;
    const role = membership ? membership.role : user.role;

    const token = jwt.sign(
      { userId: user._id, email: user.email, role, organizationId },
      process.env.JWT_SECRET || 'dev-jwt-secret-change-me',
      { expiresIn: '8h' }
    );

    res.json({ success: true, token, user: { id: user._id, email: user.email, role, organizationId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/organizations', async (req, res) => {
  try {
    const { name, slug, ownerId } = req.body;
    const organization = await Organization.create({ name, slug, ownerId });
    await OrganizationMember.create({ organizationId: organization._id, userId: ownerId, role: 'owner', status: 'active' });
    res.status(201).json({ success: true, organization });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

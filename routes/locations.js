const express = require('express');
const router = express.Router();
const { all } = require('../db/database');

// Campus predefined zones & active collection points
router.get('/', async (req, res) => {
  try {
    const collectionPoints = await all(`
      SELECT * FROM collection_points 
      WHERE is_active = 1 
      ORDER BY zone ASC, name ASC
    `);

    const campusZones = [
      'Academic Blocks',
      'Central Library',
      'Hostels',
      'Mess',
      'Food Courts',
      'Sports Complex',
      'Unipolis',
      'Shopping Complex',
      'University Bus Area',
      'Parking',
      'Campus Entrance Perimeter',
      'Other'
    ];

    const itemCategories = [
      'ID Card',
      'Electronics',
      'Laptop',
      'Mobile Phone',
      'Water Bottle',
      'Wallet',
      'Documents',
      'Keys',
      'Books',
      'Bags',
      'Accessories',
      'Other'
    ];

    return res.json({
      success: true,
      collectionPoints,
      campusZones,
      itemCategories
    });
  } catch (err) {
    console.error('[GET LOCATIONS ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve location data.' });
  }
});

module.exports = router;

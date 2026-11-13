const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');

// Generate dynamic QR code as DataURL (PNG) or SVG
router.get('/generate', async (req, res) => {
  try {
    const { text, format = 'svg' } = req.query;
    const content = text || `${req.protocol}://${req.get('host')}/`;

    if (format === 'svg') {
      const svg = await QRCode.toString(content, {
        type: 'svg',
        color: {
          dark: '#142D26', // Forest Green
          light: '#F5F2E9' // Warm Ivory
        },
        margin: 2
      });
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(svg);
    } else {
      const dataUrl = await QRCode.toDataURL(content, {
        color: {
          dark: '#142D26',
          light: '#F5F2E9'
        },
        margin: 2,
        width: 400
      });
      return res.json({ success: true, dataUrl, content });
    }
  } catch (err) {
    console.error('[QR CODE ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate QR code.' });
  }
});

// GET /api/qr/campus-posters - Returns curated poster kits for LPU zones
router.get('/campus-posters', async (req, res) => {
  try {
    const host = `${req.protocol}://${req.get('host')}`;
    const zones = [
      {
        id: 'library',
        name: 'Central Library (3 Floors)',
        code: 'LPU-ZONE-LIB',
        description: 'Placed at Library Entry turnstiles, Quiet Study floors, & Digital Resource Hub.',
        targetUrl: `${host}/browse.html?location=Library`
      },
      {
        id: 'unimall',
        name: 'Uni-Mall & Food Court 2',
        code: 'LPU-ZONE-MALL',
        description: 'Placed at Food Court cashiers, Uni-Mall escalators, and SBI ATM kiosks.',
        targetUrl: `${host}/browse.html?location=Shopping+Complex`
      },
      {
        id: 'block34',
        name: 'Academic Block 34 (Computer Science)',
        code: 'LPU-ZONE-B34',
        description: 'Placed outside high-density Computing Labs 401-408 and Faculty Corridors.',
        targetUrl: `${host}/browse.html?location=Academic+Blocks`
      },
      {
        id: 'unipolis',
        name: 'Baldev Raj Mittal Unipolis',
        code: 'LPU-ZONE-UNIPOLIS',
        description: 'Placed across cultural amphitheatre entrances and open staging grounds.',
        targetUrl: `${host}/browse.html?location=Unipolis`
      },
      {
        id: 'hostels_bh',
        name: 'Boys Hostels (BH-1 to BH-8)',
        code: 'LPU-ZONE-BH',
        description: 'Placed in BH Reception lobbies, warden notice boards, and dining mess exits.',
        targetUrl: `${host}/browse.html?location=Hostels`
      },
      {
        id: 'hostels_gh',
        name: 'Girls Hostels (GH-1 to GH-6)',
        code: 'LPU-ZONE-GH',
        description: 'Placed in GH Turnstiles, common study rooms, and warden security counters.',
        targetUrl: `${host}/browse.html?location=Hostels`
      },
      {
        id: 'sports',
        name: 'Shanti Devi Mittal Indoor Stadium',
        code: 'LPU-ZONE-SPORTS',
        description: 'Placed at Gym entrance, Badminton courts, and Swimming Pool reception.',
        targetUrl: `${host}/browse.html?location=Sports+Complex`
      },
      {
        id: 'maingate',
        name: 'University Main Gate 1 Perimeter',
        code: 'LPU-ZONE-GATE1',
        description: 'Placed at Security Checkpoint 1, University Bus Terminus, and Visitor Desk.',
        targetUrl: `${host}/browse.html?location=University+Bus+Area`
      }
    ];

    const posters = await Promise.all(
      zones.map(async (zone) => {
        const qrSvg = await QRCode.toString(zone.targetUrl, {
          type: 'svg',
          color: {
            dark: '#142D26',
            light: '#F5F2E9'
          },
          margin: 1
        });
        return {
          ...zone,
          qrSvg
        };
      })
    );

    return res.json({ success: true, posters });
  } catch (err) {
    console.error('[QR POSTERS ERROR]:', err);
    return res.status(500).json({ success: false, error: 'Failed to generate campus poster data.' });
  }
});

module.exports = router;

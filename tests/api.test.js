// Automated Integration Test Suite for RETRIVO API & Core Workflows

const assert = require('assert');
const http = require('http');
const { initDb, run, get, all } = require('../db/database');
const seedData = require('../db/seed');
const app = require('../server');

const PORT = 3099;
let server;
let serverUrl;

// Helper to make HTTP requests with cookie support
const request = (method, path, body = null, cookie = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, serverUrl);
    const headers = {};
    if (cookie) headers['Cookie'] = cookie;
    let payload = null;

    if (body) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      url,
      {
        method,
        headers
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (e) {
            json = data;
          }
          const setCookie = res.headers['set-cookie'];
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: json,
            cookie: setCookie ? setCookie[0].split(';')[0] : null
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
};

const runTests = async () => {
  console.log('\n======================================================');
  console.log('  STARTING RETRIVO INTEGRATION & VERIFICATION TESTS');
  console.log('======================================================\n');

  // 1. Boot test server
  await seedData();
  server = app.listen(PORT);
  serverUrl = `http://localhost:${PORT}`;
  console.log(`[TEST] Test server listening on ${serverUrl}`);

  let studentCookie = null;
  let staffCookie = null;
  let adminCookie = null;

  try {
    // TEST 1: Public Live Statistics
    console.log('[TEST 1] Verifying Live Database Statistics API...');
    const statsRes = await request('GET', '/api/stats/public');
    assert.strictEqual(statsRes.status, 200);
    assert.strictEqual(statsRes.body.success, true);
    assert.ok(statsRes.body.stats.totalReported >= 9, 'Should have at least 9 reported items');
    assert.ok(statsRes.body.stats.returnedCount >= 1, 'Should have at least 1 returned item');
    assert.ok(statsRes.body.recentFound.length > 0, 'Should have recent found items');
    console.log('  ✓ Public stats calculate directly from database.');

    // TEST 2: Student Login
    console.log('[TEST 2] Verifying Student Authentication...');
    const loginRes = await request('POST', '/api/auth/login', {
      identifier: 'student@lpu.in',
      password: 'Student@123'
    });
    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.body.success, true);
    assert.strictEqual(loginRes.body.user.role, 'student');
    studentCookie = loginRes.cookie;
    assert.ok(studentCookie, 'Session cookie must be established');
    console.log('  ✓ Student login succeeds with session cookie established.');

    // TEST 3: Invalid Password Rejection
    console.log('[TEST 3] Verifying Invalid Password Rejection...');
    const badLogin = await request('POST', '/api/auth/login', {
      identifier: 'student@lpu.in',
      password: 'WrongPassword999'
    });
    assert.strictEqual(badLogin.status, 401);
    assert.strictEqual(badLogin.body.success, false);
    console.log('  ✓ Invalid passwords correctly rejected with 401.');

    // TEST 4: Staff and Admin Login
    console.log('[TEST 4] Verifying Staff and Admin Logins...');
    const staffLogin = await request('POST', '/api/auth/login', {
      identifier: 'staff.security@lpu.in',
      password: 'Staff@123'
    });
    assert.strictEqual(staffLogin.status, 200);
    assert.strictEqual(staffLogin.body.user.role, 'staff');
    staffCookie = staffLogin.cookie;

    const adminLogin = await request('POST', '/api/auth/login', {
      identifier: 'admin.recovery@lpu.in',
      password: 'Admin@123'
    });
    assert.strictEqual(adminLogin.status, 200);
    assert.strictEqual(adminLogin.body.user.role, 'admin');
    adminCookie = adminLogin.cookie;
    console.log('  ✓ Staff and Admin role credentials verified.');

    // TEST 5: Role-based Authorization Barrier
    console.log('[TEST 5] Verifying Role Guard Barrier (Student blocked from Admin endpoints)...');
    const blockedRes = await request('GET', '/api/admin/overview', null, studentCookie);
    assert.strictEqual(blockedRes.status, 403, 'Student must be blocked from admin endpoints');
    const allowedRes = await request('GET', '/api/admin/overview', null, adminCookie);
    assert.strictEqual(allowedRes.status, 200, 'Admin must be allowed on admin endpoints');
    console.log('  ✓ Role barrier correctly blocks unauthorized access.');

    // TEST 6: Student Registration & Duplicate Prevention
    console.log('[TEST 6] Verifying Registration and Duplicate Prevention...');
    const newReg = await request('POST', '/api/auth/register', {
      full_name: 'Karan Mehra',
      email: 'karan.mehra@lpu.in',
      reg_number: '12108877',
      password: 'KaranPassword@1',
      confirm_password: 'KaranPassword@1',
      department: 'Mechanical Engineering',
      hostel_block: 'BH-2'
    });
    assert.strictEqual(newReg.status, 201);
    assert.strictEqual(newReg.body.success, true);

    // Attempt duplicate email
    const dupRes = await request('POST', '/api/auth/register', {
      full_name: 'Karan Duplicate',
      email: 'karan.mehra@lpu.in',
      reg_number: '99999999',
      password: 'KaranPassword@1'
    });
    assert.strictEqual(dupRes.status, 400);
    assert.strictEqual(dupRes.body.success, false);
    console.log('  ✓ Registration and duplicate validation working as expected.');

    // TEST 7: Report a Lost Item & Reference Number Generation
    console.log('[TEST 7] Verifying Lost Item Reporting...');
    const lostRes = await request('POST', '/api/items', {
      type: 'lost',
      title: 'Logitech MX Master 3S Mouse',
      category: 'Electronics',
      description: 'Ergonomic grey mouse left in Block 36 lab 301.',
      secret_identifiers: 'Has a small scratch near the thumb rest wheel.',
      location: 'Academic Blocks',
      specific_spot: 'Block 36 Lab 301 station 5',
      date_occurred: '2026-11-12'
    }, studentCookie);

    assert.strictEqual(lostRes.status, 201);
    assert.strictEqual(lostRes.body.success, true);
    assert.ok(lostRes.body.item.reference_no.startsWith('LST-'), 'Must generate LST- reference ID');
    const newLostId = lostRes.body.item.id;
    console.log(`  ✓ Lost item reported with Reference: ${lostRes.body.item.reference_no}`);

    // TEST 8: Report a Found Item with Confidential ID Protection
    console.log('[TEST 8] Verifying Found Item Reporting with Privacy Shield...');
    const activeCp = await get('SELECT id FROM collection_points LIMIT 1');
    const cpId = activeCp ? activeCp.id : null;

    const foundRes = await request('POST', '/api/items', {
      type: 'found',
      title: 'Lost Student ID Card with Blue Lanyard',
      category: 'ID Card',
      description: 'Found on table in Library 2nd floor.',
      secret_identifiers: 'Registration number 12109944, Name: Amit Kumar',
      location: 'Library',
      specific_spot: '2nd Floor Reading Section Table 8',
      date_occurred: '2026-11-12',
      collection_point_id: cpId
    }, studentCookie);

    assert.strictEqual(foundRes.status, 201);
    assert.strictEqual(foundRes.body.success, true);
    assert.strictEqual(foundRes.body.item.is_sensitive, 1, 'ID Cards must be marked sensitive');
    const newFoundId = foundRes.body.item.id;
    console.log(`  ✓ Found item reported with Reference: ${foundRes.body.item.reference_no} (Sensitive Shield Active)`);

    // TEST 9: Privacy Masking on Public Retrieval
    console.log('[TEST 9] Verifying Public Privacy Sanitization...');
    const publicItemRes = await request('GET', `/api/items/${newFoundId}`);
    assert.strictEqual(publicItemRes.status, 200);
    assert.strictEqual(publicItemRes.body.item.secret_identifiers, undefined, 'Secret identifiers must NOT be visible to public');
    console.log('  ✓ Confidential details correctly stripped on public requests.');

    // TEST 10: Smart Matching Engine
    console.log('[TEST 10] Verifying Smart Matching Engine...');
    const matchRes = await request('GET', `/api/items/${newLostId}/matches`);
    assert.strictEqual(matchRes.status, 200);
    assert.strictEqual(matchRes.body.success, true);
    console.log(`  ✓ Smart matching calculated ${matchRes.body.matches.length} candidates.`);

    // TEST 11: Ownership Claim Workflow (Submit -> Review -> Handover)
    console.log('[TEST 11] Verifying End-to-End Ownership Claim & Handover Lifecycle...');
    // Create new student session for claimant
    const claimantLogin = await request('POST', '/api/auth/login', {
      identifier: 'priya.verma@lpu.in',
      password: 'Student@123'
    });
    const claimantCookie = claimantLogin.cookie;

    // 1. Submit Claim for found item (FND-26-1002 - Milton bottle)
    const bottleItem = await get('SELECT id FROM items WHERE reference_no = "FND-26-1002"');
    const claimRes = await request('POST', '/api/claims', {
      item_id: bottleItem.id,
      proof_description: 'I forgot my navy blue Milton bottle after having lunch at Food Court 2.',
      secret_answers: 'There is a yellow NASA vinyl star sticker on top of the screw cap.'
    }, claimantCookie);

    assert.strictEqual(claimRes.status, 201);
    assert.strictEqual(claimRes.body.success, true);
    const claimId = claimRes.body.claimId;
    console.log(`  ✓ Step 1: Claim submitted (${claimRes.body.reference_no}).`);

    // 2. Staff Reviews and Approves Claim
    const reviewRes = await request('PUT', `/api/claims/${claimId}/review`, {
      status: 'approved',
      staff_notes: 'Sticker description matches physical item verified in Uni-Mall security center.',
      collection_point_id: 2
    }, staffCookie);

    assert.strictEqual(reviewRes.status, 200);
    assert.strictEqual(reviewRes.body.success, true);
    console.log('  ✓ Step 2: Staff reviewed and approved claim.');

    // 3. Staff Records Physical Handover
    const handoverRes = await request('POST', `/api/claims/${claimId}/handover`, {
      verified_student_reg: '12215830',
      handover_notes: 'Physical student ID verified at Uni-Mall security desk. Bottle received in good condition.'
    }, staffCookie);

    assert.strictEqual(handoverRes.status, 200);
    assert.strictEqual(handoverRes.body.success, true);
    console.log('  ✓ Step 3: Physical handover verified and item marked as Returned.');

    // Verify item status in database is returned
    const checkItem = await get('SELECT status FROM items WHERE id = ?', [bottleItem.id]);
    assert.strictEqual(checkItem.status, 'returned');
    console.log('  ✓ Database item status verified as "returned".');

    // TEST 12: QR Code Generation API
    console.log('[TEST 12] Verifying QR Code Generation & Posters API...');
    const qrRes = await request('GET', '/api/qr/campus-posters');
    assert.strictEqual(qrRes.status, 200);
    assert.ok(qrRes.body.posters.length >= 8, 'Must provide posters for all campus zones');
    assert.ok(qrRes.body.posters[0].qrSvg.includes('<svg'), 'Must generate valid SVG vector QR code');
    console.log('  ✓ Vector QR codes generated for campus wayfinding posters.');

    console.log('\n======================================================');
    console.log('  ✅ ALL 12 INTEGRATION TESTS PASSED SUCCESSFULLY!    ');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  } finally {
    if (server) server.close();
  }
};

if (require.main === module) {
  runTests().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = runTests;

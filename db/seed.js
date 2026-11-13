const bcrypt = require('bcryptjs');
const { initDb, run, get, all } = require('./database');

const seedData = async () => {
  console.log('[SEED] Initializing database...');
  await initDb();

  // Check if already seeded
  const userCount = await get(`SELECT COUNT(*) as count FROM users`);
  if (userCount && userCount.count > 0) {
    console.log(`[SEED] Database already contains ${userCount.count} users. Cleaning tables for fresh realistic seed...`);
    await run(`DELETE FROM activity_logs`);
    await run(`DELETE FROM notifications`);
    await run(`DELETE FROM claims`);
    await run(`DELETE FROM items`);
    await run(`DELETE FROM collection_points`);
    await run(`DELETE FROM users`);
    try {
      await run(`DELETE FROM sqlite_sequence WHERE name IN ('users', 'items', 'claims', 'collection_points', 'notifications', 'activity_logs')`);
    } catch (e) {}
  }

  console.log('[SEED] Seeding users with hashed passwords...');
  const studentPw = await bcrypt.hash('Student@123', 10);
  const staffPw = await bcrypt.hash('Staff@123', 10);
  const adminPw = await bcrypt.hash('Admin@123', 10);

  // 1. Users
  const student1 = await run(
    `INSERT INTO users (full_name, email, reg_number, phone, password_hash, role, department, hostel_block)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Aarav Sharma', 'student@lpu.in', '12104598', '+91 98765 43210', studentPw, 'student', 'B.Tech Computer Science & Eng.', 'BH-4']
  );

  const student2 = await run(
    `INSERT INTO users (full_name, email, reg_number, phone, password_hash, role, department, hostel_block)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Priya Verma', 'priya.verma@lpu.in', '12215830', '+91 98765 43211', studentPw, 'student', 'B.Des Product Design', 'GH-2']
  );

  const student3 = await run(
    `INSERT INTO users (full_name, email, reg_number, phone, password_hash, role, department, hostel_block)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Rohit Kumar', 'rohit.kumar@lpu.in', '12009341', '+91 98765 43212', studentPw, 'student', 'MBA Finance & Logistics', 'BH-7']
  );

  const staffUser = await run(
    `INSERT INTO users (full_name, email, reg_number, phone, password_hash, role, department, hostel_block)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Officer Harpreet Singh', 'staff.security@lpu.in', 'SEC-4091', '+91 98765 43220', staffPw, 'staff', 'Campus Safety & Vigilance', 'Security HQ']
  );

  const adminUser = await run(
    `INSERT INTO users (full_name, email, reg_number, phone, password_hash, role, department, hostel_block)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['Dr. Vikram Sethi', 'admin.recovery@lpu.in', 'ADM-0012', '+91 98765 43230', adminPw, 'admin', 'Student Welfare Wing', 'Admin Block']
  );

  console.log('[SEED] Seeding campus collection points...');
  // 2. Collection Points across 600-acre campus
  const cp1 = await run(
    `INSERT INTO collection_points (name, zone, building, desk_incharge, contact_number, operating_hours)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['Central Library Ground Desk', 'Central Academic Zone', 'Central Library (3rd Floor Helpdesk)', 'Mr. Jagdish Chander', '+91 1824-517001', '08:00 AM - 10:00 PM']
  );

  const cp2 = await run(
    `INSERT INTO collection_points (name, zone, building, desk_incharge, contact_number, operating_hours)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['Uni-Mall Security Center', 'Commercial / Shopping Zone', 'Block 13 (Uni-Mall Level 1)', 'Officer Gurpreet Kaur', '+91 1824-517002', '09:00 AM - 09:00 PM']
  );

  const cp3 = await run(
    `INSERT INTO collection_points (name, zone, building, desk_incharge, contact_number, operating_hours)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['Block 34 CSE Helpdesk', 'Academic Block 34-38', 'Block 34 1st Floor Reception', 'Mr. Ramanuj Sharma', '+91 1824-517003', '08:30 AM - 05:30 PM']
  );

  const cp4 = await run(
    `INSERT INTO collection_points (name, zone, building, desk_incharge, contact_number, operating_hours)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['Unipolis Cultural Control Desk', 'Baldev Raj Mittal Unipolis', 'Unipolis Gate 2 Security Booth', 'Officer Sukhdev Singh', '+91 1824-517004', '07:00 AM - 11:00 PM']
  );

  const cp5 = await run(
    `INSERT INTO collection_points (name, zone, building, desk_incharge, contact_number, operating_hours)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['Sports Complex Control Room', 'Shanti Devi Mittal Indoor Stadium', 'Indoor Sports Complex Reception', 'Coach Rakesh Yadav', '+91 1824-517005', '06:00 AM - 09:00 PM']
  );

  const cp6 = await run(
    `INSERT INTO collection_points (name, zone, building, desk_incharge, contact_number, operating_hours)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['BH-4 Hostel Warden Office', 'North Residential Zone', 'BH-4 Ground Floor', 'Warden Manmohan Singh', '+91 1824-517006', '24 Hours (Resident Warden)']
  );

  const cp7 = await run(
    `INSERT INTO collection_points (name, zone, building, desk_incharge, contact_number, operating_hours)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['GH-2 Hostel Reception Desk', 'South Residential Zone', 'GH-2 Lobby', 'Matron Sunita Devi', '+91 1824-517007', '24 Hours (Front Desk)']
  );

  const cp8 = await run(
    `INSERT INTO collection_points (name, zone, building, desk_incharge, contact_number, operating_hours)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['University Main Gate 1 Kiosk', 'Campus Entrance Perimeter', 'Main Gate 1 Security Post', 'Chief Guard Balwinder', '+91 1824-517008', '24 Hours']
  );

  console.log('[SEED] Seeding realistic campus recovery items...');
  // 3. Realistic Items
  // Found ID Card (Sensitive)
  const item1 = await run(
    `INSERT INTO items (reference_no, type, title, category, description, secret_identifiers, location, specific_spot, date_occurred, photo_url, status, is_sensitive, reporter_id, collection_point_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'FND-26-1001',
      'found',
      'LPU Student RFID Smart ID Card',
      'ID Card',
      'Official LPU Student ID card found on a quiet study table in the library. Attached with blue LPU lanyard.',
      'Student Name starts with "S***", Registration No: 1211****, School of Electronics & Electrical Eng.',
      'Library',
      'Central Library 3rd Floor, Table 14 near journal racks',
      '2026-11-11',
      '/uploads/lpu-id-card.svg',
      'active',
      1,
      student2.id,
      cp1.id
    ]
  );

  // Found Water Bottle
  const item2 = await run(
    `INSERT INTO items (reference_no, type, title, category, description, secret_identifiers, location, specific_spot, date_occurred, photo_url, status, is_sensitive, reporter_id, collection_point_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'FND-26-1002',
      'found',
      'Milton Navy Blue 1000ml ThermoSteel Bottle',
      'Water Bottle',
      'Navy blue stainless steel vacuum insulated bottle with flip lid. Minor scratches near the bottom base.',
      'Small yellow NASA vinyl sticker on top of the screw cap.',
      'Food Courts',
      'Food Court 2, outer seating bench near beverage counter',
      '2026-11-12',
      '/uploads/realistic-bottle.jpg',
      'active',
      0,
      student3.id,
      cp2.id
    ]
  );

  // Lost Laptop Charger
  const item3 = await run(
    `INSERT INTO items (reference_no, type, title, category, description, secret_identifiers, location, specific_spot, date_occurred, photo_url, status, is_sensitive, reporter_id, collection_point_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'LST-26-2001',
      'lost',
      'Apple 67W USB-C Power Adapter & Braided Cable',
      'Electronics',
      'Original Apple 67W white power brick with 2-meter braided USB-C charge cable. Left plugged in during distributed computing lab session.',
      'A small green dot marker on the side of the 3-pin adapter pin plug.',
      'Academic Blocks',
      'Block 34, 4th Floor Lab 402, row 3 station',
      '2026-11-11',
      '/uploads/realistic-charger.jpg',
      'active',
      0,
      student1.id,
      null
    ]
  );

  // Found Wireless Earbuds
  const item4 = await run(
    `INSERT INTO items (reference_no, type, title, category, description, secret_identifiers, location, specific_spot, date_occurred, photo_url, status, is_sensitive, reporter_id, collection_point_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'FND-26-1003',
      'found',
      'boAt Airdopes True Wireless Earbuds in Charging Case',
      'Electronics',
      'Charcoal grey charging case containing both left and right wireless earbuds.',
      'Custom initials "PK" etched faintly on bottom; left earbud silicone tip is translucent grey while right is black.',
      'Shopping Complex',
      'Uni-Mall Ground Floor near the SBI ATM kiosk',
      '2026-11-10',
      '/uploads/realistic-earbuds.jpg',
      'under_review',
      0,
      student2.id,
      cp2.id
    ]
  );

  // Lost Calculator
  const item5 = await run(
    `INSERT INTO items (reference_no, type, title, category, description, secret_identifiers, location, specific_spot, date_occurred, photo_url, status, is_sensitive, reporter_id, collection_point_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'LST-26-2002',
      'lost',
      'Casio FX-991EX ClassWiz Scientific Calculator',
      'Other',
      'Standard engineering calculator with black and white case. Left behind after Mathematics-III tutorial.',
      'Name "Priya V." inscribed with silver permanent marker inside the slide-on protective hard cover.',
      'Academic Blocks',
      'Block 36, Lecture Room 204',
      '2026-11-09',
      '/uploads/realistic-calculator.jpg',
      'active',
      0,
      student2.id,
      null
    ]
  );

  // Found Backpack - Ready for Collection
  const item6 = await run(
    `INSERT INTO items (reference_no, type, title, category, description, secret_identifiers, location, specific_spot, date_occurred, photo_url, status, is_sensitive, reporter_id, collection_point_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'FND-26-1004',
      'found',
      'Wildcraft Black & Graphite 3-Compartment Backpack',
      'Bags',
      'Large black student backpack with padded straps. Found on amphitheatre bench.',
      'Inside front pocket has an engineering drawing mini-drafter and a Spiral notebook with Aarav Sharma reg: 12104598.',
      'Unipolis',
      'Baldev Raj Mittal Unipolis, Central Amphitheatre Row G',
      '2026-11-08',
      '/uploads/realistic-backpack.jpg',
      'ready_for_collection',
      0,
      student3.id,
      cp4.id
    ]
  );

  // Returned Leather Wallet (Sensitive)
  const item7 = await run(
    `INSERT INTO items (reference_no, type, title, category, description, secret_identifiers, location, specific_spot, date_occurred, photo_url, status, is_sensitive, reporter_id, collection_point_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'FND-26-1005',
      'found',
      'Woodland Men’s Tan Brown Bi-fold Leather Wallet',
      'Wallet',
      'Tan brown leather wallet found after mess dinner hour. Kept in BH-4 warden custody and safely returned to owner.',
      'Contains Delhi Metro Smart Card and campus dispensary card.',
      'Mess',
      'BH-4 Dining Mess Table 9',
      '2026-11-06',
      '/uploads/realistic-wallet.jpg',
      'returned',
      1,
      student1.id,
      cp6.id
    ]
  );

  // Lost Room Keys
  const item8 = await run(
    `INSERT INTO items (reference_no, type, title, category, description, secret_identifiers, location, specific_spot, date_occurred, photo_url, status, is_sensitive, reporter_id, collection_point_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'LST-26-2003',
      'lost',
      'Pair of Dormitory Keys with Red LPU Keychain',
      'Keys',
      'Two silver brass keys on a ring with a red rubber rectangular tag marked BH-7.',
      'Key ring has a small brass bottle opener miniature attached.',
      'Hostels',
      'Walkway pathway between BH-6 and BH-7 near badminton court',
      '2026-11-12',
      '/uploads/realistic-keys.jpg',
      'active',
      0,
      student3.id,
      null
    ]
  );

  // Found Wireless Mouse
  const item9 = await run(
    `INSERT INTO items (reference_no, type, title, category, description, secret_identifiers, location, specific_spot, date_occurred, photo_url, status, is_sensitive, reporter_id, collection_point_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'FND-26-1006',
      'found',
      'HP 240 Bluetooth & 2.4G Dual Mode Optical Mouse',
      'Electronics',
      'Matte cobalt blue wireless ergonomic mouse found near digital library computer desks.',
      'Battery compartment holds an AmazonBasics AA rechargeable battery; power switch is set to BT position.',
      'Library',
      'Central Library 2nd Floor, Digital Resource Terminal #18',
      '2026-11-12',
      '/uploads/realistic-mouse.jpg',
      'active',
      0,
      student1.id,
      cp1.id
    ]
  );

  console.log('[SEED] Seeding realistic claims and verification workflows...');
  // 4. Claims
  // Claim 1: Approved and ready for collection for Wildcraft Backpack
  const claim1 = await run(
    `INSERT INTO claims (reference_no, item_id, claimant_id, proof_description, secret_answers, status, staff_notes, reviewed_by, reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'CLM-26-3001',
      item6.id,
      student1.id,
      'This is my drawing backpack that I forgot while practicing for the cultural fest rehearsal at Unipolis.',
      'The front pocket contains an Omega brand mini-drafter, Staedtler clutch pencils, and my Engineering Drawing notebook with my name Aarav Sharma (12104598).',
      'approved',
      'Ownership validated via matching student name and registration number on internal drawing notebook.',
      staffUser.id,
      '2026-11-09 14:30:00'
    ]
  );

  // Claim 2: Pending review for boAt Earbuds
  const claim2 = await run(
    `INSERT INTO claims (reference_no, item_id, claimant_id, proof_description, secret_answers, status, staff_notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      'CLM-26-3002',
      item4.id,
      student3.id,
      'Lost my boAt earbuds while withdrawing cash at the SBI ATM at Uni-Mall.',
      'The charging case has faint PK etched on bottom, left earbud has translucent grey rubber tip and right has black.',
      'under_review',
      'Claim submitted. Awaiting verification of physical case marking at Uni-Mall security desk.'
    ]
  );

  // Claim 3: Handed over for Wallet
  const claim3 = await run(
    `INSERT INTO claims (reference_no, item_id, claimant_id, proof_description, secret_answers, status, staff_notes, reviewed_by, reviewed_at, handed_over_at, handover_notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'CLM-26-3003',
      item7.id,
      student3.id,
      'Dropped my Woodland wallet after dinner at BH-4 mess while visiting my friend.',
      'Inside card slots: Delhi Metro smart card with balance, LPU health dispensary card ending in 9341, and two 500-rupee notes.',
      'handed_over',
      'Verified in-person by Warden Manmohan Singh. Student physical ID and signature taken in handover register.',
      staffUser.id,
      '2026-11-07 10:15:00',
      '2026-11-07 11:00:00',
      'Physical item handed over to Rohit Kumar (Reg: 12009341). Handover entry #402 logged.'
    ]
  );

  console.log('[SEED] Seeding notifications...');
  // 5. Notifications
  await run(
    `INSERT INTO notifications (user_id, title, message, link, type, is_read)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      student1.id,
      'Claim Approved – Item Ready for Collection',
      'Your claim for Wildcraft Backpack (FND-26-1004) has been approved! Collect it from Unipolis Cultural Control Desk (Gate 2) between 07:00 AM - 11:00 PM.',
      '/item-detail.html?id=' + item6.id,
      'success',
      0
    ]
  );

  await run(
    `INSERT INTO notifications (user_id, title, message, link, type, is_read)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      student1.id,
      'Potential Match Found for Your Lost Charger',
      'A found item matching "Apple Charger" was reported near Block 34. Review the details to verify.',
      '/browse.html?search=Apple',
      'info',
      0
    ]
  );

  await run(
    `INSERT INTO notifications (user_id, title, message, link, type, is_read)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      student3.id,
      'Claim Under Review',
      'Your claim CLM-26-3002 for boAt Earbuds is currently being reviewed by Campus Security.',
      '/my-claims.html',
      'info',
      1
    ]
  );

  await run(
    `INSERT INTO notifications (user_id, title, message, link, type, is_read)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      student3.id,
      'Item Handover Complete',
      'Your Woodland Wallet (FND-26-1005) has been officially recorded as handed over. Thank you for using Retrivo!',
      '/item-detail.html?id=' + item7.id,
      'success',
      1
    ]
  );

  console.log('[SEED] Seeding activity logs...');
  // 6. Activity Logs
  await run(
    `INSERT INTO activity_logs (user_id, action, target_type, target_id, details)
     VALUES (?, ?, ?, ?, ?)`,
    [student2.id, 'REPORT_CREATED', 'item', item1.id, 'Reported Found ID Card at Central Library (FND-26-1001)']
  );

  await run(
    `INSERT INTO activity_logs (user_id, action, target_type, target_id, details)
     VALUES (?, ?, ?, ?, ?)`,
    [student1.id, 'REPORT_CREATED', 'item', item3.id, 'Reported Lost Apple Charger at Block 34 (LST-26-2001)']
  );

  await run(
    `INSERT INTO activity_logs (user_id, action, target_type, target_id, details)
     VALUES (?, ?, ?, ?, ?)`,
    [staffUser.id, 'CLAIM_APPROVED', 'claim', claim1.id, 'Approved claim CLM-26-3001 for Wildcraft Backpack']
  );

  await run(
    `INSERT INTO activity_logs (user_id, action, target_type, target_id, details)
     VALUES (?, ?, ?, ?, ?)`,
    [staffUser.id, 'ITEM_HANDOVER', 'item', item7.id, 'Completed physical handover for Woodland Leather Wallet to Rohit Kumar']
  );

  console.log('✅ [SEED] Database seeded successfully with realistic LPU Campus data!');
};

if (require.main === module) {
  seedData()
    .then(() => {
      console.log('[SEED] Process finished.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[SEED] Error:', err);
      process.exit(1);
    });
}

module.exports = seedData;

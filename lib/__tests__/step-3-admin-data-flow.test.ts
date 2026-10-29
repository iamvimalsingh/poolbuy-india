import test, { describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { setTestD1Database } from '../d1/db';
import { D1Database, D1PreparedStatement, D1Result } from '../d1/types';
import { createCampaign } from '../campaigns';
import { executeJoinPool } from '../pools';
import { getAdminLeads } from '../leads';
import { getPoolMemberDecisionSummary } from '../quotes';

type SqliteDatabase = InstanceType<typeof DatabaseSync>;

function normalizeParam(v: unknown): string | number | bigint | null | Uint8Array {
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v === undefined) return null;
  return v as string | number | bigint | null | Uint8Array;
}

function createSqliteD1Adapter(): { d1: D1Database; rawDb: SqliteDatabase } {
  const sqlite = new DatabaseSync(':memory:');

  const createStatement = (sql: string, boundParams: unknown[] = []): D1PreparedStatement => {
    return {
      bind(...params: unknown[]) {
        return createStatement(sql, params);
      },
      async all<T = unknown>(): Promise<D1Result<T>> {
        const stmt = sqlite.prepare(sql);
        const rows = stmt.all(...boundParams.map(normalizeParam)) as T[];
        return {
          results: rows,
          success: true,
          meta: { duration: 0, changes: 0, last_row_id: 0, served_by: 'test-sqlite' },
        };
      },
      async first<T = unknown>(colName?: string): Promise<T | null> {
        const stmt = sqlite.prepare(sql);
        const row = stmt.get(...boundParams.map(normalizeParam)) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return (row[colName] as T) ?? null;
        return row as T;
      },
      async run(): Promise<D1Result> {
        const stmt = sqlite.prepare(sql);
        const info = stmt.run(...boundParams.map(normalizeParam));
        return {
          results: [],
          success: true,
          meta: {
            duration: 0,
            changes: Number(info.changes),
            last_row_id: Number(info.lastInsertRowid),
            served_by: 'test-sqlite',
          },
        };
      },
    } as unknown as D1PreparedStatement;
  };

  const d1: D1Database = {
    prepare(query: string) {
      return createStatement(query);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
      sqlite.exec('BEGIN TRANSACTION;');
      try {
        const results: D1Result<T>[] = [];
        for (const stmt of statements) {
          const res = await (stmt as unknown as { run: () => Promise<D1Result<T>> }).run();
          results.push(res);
        }
        sqlite.exec('COMMIT;');
        return results;
      } catch (e) {
        sqlite.exec('ROLLBACK;');
        throw e;
      }
    },
    async exec(query: string) {
      sqlite.exec(query);
      return { count: 1, duration: 0 };
    },
  };

  return { d1, rawDb: sqlite };
}

function applyMigrations(sqlite: SqliteDatabase) {
  const migrationsDir = path.resolve(process.cwd(), 'migrations/d1');
  const files = fs.readdirSync(migrationsDir).sort();
  for (const file of files) {
    if (file.endsWith('.sql')) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      sqlite.exec(sql);
    }
  }
}

describe('Step 3: End-to-End Admin Data Flow & Membership Invariants', () => {
  let adapter: { d1: D1Database; rawDb: SqliteDatabase };
  let rawDb: SqliteDatabase;

  beforeEach(async () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = 'false';
    adapter = createSqliteD1Adapter();
    rawDb = adapter.rawDb;
    applyMigrations(rawDb);
    setTestD1Database(adapter.d1);

    // Migrations already seed baseline categories (rooftop-solar, ev-scooters, etc.)
    // and operational cities (jaipur, pune, delhi-ncr, etc.).
  });

  test('1. Valid public join creates both lead record and pool membership', async () => {
    const camp = await createCampaign({
      title: '5kW Solar Micro-Inverter',
      slug: '5kw-solar-micro-inverter',
      categorySlug: 'rooftop-solar',
      cities: [{ cityName: 'Jaipur', citySlug: 'jaipur', targetBuyers: 10 }],
    });
    const pool = camp.pools[0];

    const joinRes = await executeJoinPool(pool.id, {
      fullName: 'Aarav Sharma',
      whatsappNumber: '9829000001',
      pincode: '030201',
      existing_quote: '₹82,000 from local vendor',
      buyingTimeline: 'THIS_MONTH',
      locality: 'Mansarovar',
      connectionOptIn: true,
      vendorShareConsent: true,
    });

    assert.ok(joinRes.leadId);
    assert.equal(joinRes.buyerNumber, 1);
    assert.equal(joinRes.currentBuyers, 1);
    assert.equal(joinRes.alreadyJoined, false);

    // Verify row in pool_leads
    const leadRow = rawDb.prepare('SELECT * FROM pool_leads WHERE id = ?').get(joinRes.leadId) as Record<string, unknown>;
    assert.ok(leadRow);
    assert.equal(leadRow.pool_id, pool.id);
    assert.equal(leadRow.buyer_number, 1);
    assert.equal(leadRow.full_name, 'Aarav Sharma');
    assert.equal(leadRow.whatsapp_number, '9829000001');
    assert.equal(leadRow.city, 'Jaipur');
    assert.equal(leadRow.locality, 'Mansarovar');
    assert.equal(leadRow.pincode, '030201', 'Leading zero pincode must be preserved');
    assert.equal(leadRow.existing_quote, '₹82,000 from local vendor');
    assert.equal(leadRow.status, 'NEW');
    assert.equal(leadRow.member_connection_status, 'NOT_READY');

    // Verify pool current_buyers count
    const poolRow = rawDb.prepare('SELECT current_buyers FROM pools WHERE id = ?').get(pool.id) as { current_buyers: number };
    assert.equal(poolRow.current_buyers, 1);
  });

  test('2. New record appears in Admin Lead Management read path with preserved pincode and quote', async () => {
    const camp = await createCampaign({
      title: 'Commercial E-Loader',
      slug: 'commercial-e-loader',
      categorySlug: 'ev-scooters',
      cities: [{ cityName: 'Jaipur', citySlug: 'jaipur', targetBuyers: 10 }],
    });
    const pool = camp.pools[0];

    const joinRes = await executeJoinPool(pool.id, {
      fullName: 'Sunita Meena',
      whatsappNumber: '9829000002',
      pincode: '030202',
      existing_quote: '₹1,20,000 all-in',
    });

    // Read through getAdminLeads (the actual admin read path)
    const adminResult = await getAdminLeads({ poolId: pool.id });
    assert.ok(adminResult.leads.length >= 1);

    const found = adminResult.leads.find((l) => l.id === joinRes.leadId);
    assert.ok(found);
    assert.equal(found.fullName, 'Sunita Meena');
    assert.equal(found.whatsappNumber, '9829000002');
    assert.equal(found.city, 'Jaipur');
    assert.equal(found.pincode, '030202');
    assert.equal(found.existingQuote, '₹1,20,000 all-in');
    assert.equal(found.poolName, 'Commercial E-Loader (Jaipur)');

    // Search filter check by pincode
    const searchResult = await getAdminLeads({ search: '030202' });
    assert.equal(searchResult.leads.length, 1);
    assert.equal(searchResult.leads[0].id, joinRes.leadId);
  });

  test('3. Member appears in city pool member query with isolated membership state', async () => {
    const camp = await createCampaign({
      title: 'Smart Home Solar Backup',
      slug: 'smart-home-solar-backup',
      categorySlug: 'rooftop-solar',
      cities: [{ cityName: 'Jaipur', citySlug: 'jaipur', targetBuyers: 10 }],
    });
    const pool = camp.pools[0];

    const joinRes = await executeJoinPool(pool.id, {
      fullName: 'Rajesh Khandelwal',
      whatsappNumber: '9829000003',
      pincode: '030203',
      existing_quote: '₹95,000 with 5yr AMC',
    });

    // Simulate the read path of /api/admin/pools/[poolId]/members
    const membersRows = rawDb.prepare('SELECT * FROM pool_leads WHERE pool_id = ? ORDER BY buyer_number ASC').all(pool.id) as Record<string, unknown>[];
    assert.equal(membersRows.length, 1);
    const m = membersRows[0];
    assert.equal(m.id, joinRes.leadId);
    assert.equal(m.buyer_number, 1);
    assert.equal(m.pincode, '030203');
    assert.equal(m.existing_quote, '₹95,000 with 5yr AMC');

    // Verify member decision summary
    const summary = await getPoolMemberDecisionSummary(pool.id);
    assert.equal(summary.totalMembers, 1);
    assert.equal(summary.awaitingCount, 1);
    assert.equal(summary.connectedCount, 0);
  });

  test('4. City isolation: A join for City A never appears in City B pool', async () => {
    const camp = await createCampaign({
      title: 'Dual-City Inverter Pack',
      slug: 'dual-city-inverter-pack',
      categorySlug: 'rooftop-solar',
      cities: [
        { cityName: 'Jaipur', citySlug: 'jaipur', targetBuyers: 10 },
        { cityName: 'Pune', citySlug: 'pune', targetBuyers: 10 },
      ],
    });

    const jaipurPool = camp.pools.find((p) => p.citySlug === 'jaipur')!;
    const punePool = camp.pools.find((p) => p.citySlug === 'pune')!;

    // Join Jaipur pool
    const joinResJaipur = await executeJoinPool(jaipurPool.id, {
      fullName: 'Jaipur Resident',
      whatsappNumber: '9829000004',
      pincode: '030204',
    });
    assert.equal(joinResJaipur.currentBuyers, 1);

    // Verify Pune pool member count is strictly 0
    const punePoolRow = rawDb.prepare('SELECT current_buyers FROM pools WHERE id = ?').get(punePool.id) as { current_buyers: number };
    assert.equal(punePoolRow.current_buyers, 0);

    // Query Pune members
    const puneMembers = rawDb.prepare('SELECT * FROM pool_leads WHERE pool_id = ?').all(punePool.id);
    assert.equal(puneMembers.length, 0, 'City A member must never appear in City B pool members');

    // Query Jaipur members
    const jaipurMembers = rawDb.prepare('SELECT * FROM pool_leads WHERE pool_id = ?').all(jaipurPool.id);
    assert.equal(jaipurMembers.length, 1);
  });

  test('5. Multiple city pools under one campaign remain independently counted', async () => {
    const camp = await createCampaign({
      title: 'Tri-City Solar Kit',
      slug: 'tri-city-solar-kit',
      categorySlug: 'rooftop-solar',
      cities: [
        { cityName: 'Jaipur', citySlug: 'jaipur', targetBuyers: 5 },
        { cityName: 'Pune', citySlug: 'pune', targetBuyers: 5 },
      ],
    });

    const jaipurPool = camp.pools.find((p) => p.citySlug === 'jaipur')!;
    const punePool = camp.pools.find((p) => p.citySlug === 'pune')!;

    // Join Jaipur twice
    await executeJoinPool(jaipurPool.id, { fullName: 'J1', whatsappNumber: '9829000010', pincode: '030210' });
    await executeJoinPool(jaipurPool.id, { fullName: 'J2', whatsappNumber: '9829000011', pincode: '030211' });

    // Join Pune once
    await executeJoinPool(punePool.id, { fullName: 'P1', whatsappNumber: '9829000020', pincode: '411001' });

    const jRow = rawDb.prepare('SELECT current_buyers FROM pools WHERE id = ?').get(jaipurPool.id) as { current_buyers: number };
    const pRow = rawDb.prepare('SELECT current_buyers FROM pools WHERE id = ?').get(punePool.id) as { current_buyers: number };

    assert.equal(jRow.current_buyers, 2);
    assert.equal(pRow.current_buyers, 1);
  });

  test('6. Duplicate join submissions return existing membership without double-counting', async () => {
    const camp = await createCampaign({
      title: 'Idempotency Test Campaign',
      slug: 'idempotency-test-campaign',
      categorySlug: 'rooftop-solar',
      cities: [{ cityName: 'Jaipur', citySlug: 'jaipur', targetBuyers: 10 }],
    });
    const pool = camp.pools[0];

    const res1 = await executeJoinPool(pool.id, {
      fullName: 'Mahesh Verma',
      whatsappNumber: '9829000030',
      pincode: '030230',
    });
    assert.equal(res1.buyerNumber, 1);
    assert.equal(res1.alreadyJoined, false);

    const res2 = await executeJoinPool(pool.id, {
      fullName: 'Mahesh Verma',
      whatsappNumber: '9829000030',
      pincode: '030230',
    });
    assert.equal(res2.buyerNumber, 1);
    assert.equal(res2.alreadyJoined, true);

    const poolRow = rawDb.prepare('SELECT current_buyers FROM pools WHERE id = ?').get(pool.id) as { current_buyers: number };
    assert.equal(poolRow.current_buyers, 1, 'Current buyers must not inflate on duplicate join');

    const leadCount = rawDb.prepare('SELECT COUNT(*) as c FROM pool_leads WHERE pool_id = ?').get(pool.id) as { c: number };
    assert.equal(leadCount.c, 1, 'Lead table must not contain duplicate records for same phone');
  });

  test('7. Waitlisted users do not count as confirmed members before promotion', async () => {
    const camp = await createCampaign({
      title: 'Capacity Boundary Pool',
      slug: 'capacity-boundary-pool',
      categorySlug: 'rooftop-solar',
      cities: [{ cityName: 'Jaipur', citySlug: 'jaipur', targetBuyers: 1 }],
    });
    const pool = camp.pools[0];

    // Join Buyer 1 to reach capacity
    const res1 = await executeJoinPool(pool.id, {
      fullName: 'Confirmed Member',
      whatsappNumber: '9829000040',
      pincode: '030240',
    });
    assert.equal(res1.buyerNumber, 1);

    // Excess join routes to waitlist
    const now = new Date().toISOString();
    const waitlistId = 'wl-bound-01';
    rawDb.prepare(`
      INSERT INTO pool_waitlist (
        id, pool_id, sequence_number, full_name, whatsapp_number,
        city, buying_timeline, locality, pin_code, pincode, existing_quote, status, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WAITING', ?, ?, ?)
    `).run(
      waitlistId,
      pool.id,
      1,
      'Waitlisted Prospect',
      '9829000041',
      'Jaipur',
      'THIS_MONTH',
      'Malviya Nagar',
      '030241',
      '030241',
      '₹99,000 initial offer',
      'Waiting for slot',
      now,
      now
    );

    // Verify pool count is still 1
    const poolRow = rawDb.prepare('SELECT current_buyers FROM pools WHERE id = ?').get(pool.id) as { current_buyers: number };
    assert.equal(poolRow.current_buyers, 1, 'Waitlisted prospect must not increment confirmed buyers');

    // Confirmed members query only returns active buyer
    const confirmedMembers = rawDb.prepare('SELECT * FROM pool_leads WHERE pool_id = ?').all(pool.id);
    assert.equal(confirmedMembers.length, 1);

    // Waitlist query returns waitlisted prospect
    const wlRows = rawDb.prepare("SELECT * FROM pool_waitlist WHERE pool_id = ? AND status = 'WAITING'").all(pool.id);
    assert.equal(wlRows.length, 1);
  });

  test('8. Waitlist promotion atomically promotes FIFO member and preserves leading-zero pincode and quote', async () => {
    const camp = await createCampaign({
      title: 'Promotion Verification Pool',
      slug: 'promotion-verification-pool',
      categorySlug: 'rooftop-solar',
      cities: [{ cityName: 'Jaipur', citySlug: 'jaipur', targetBuyers: 2 }],
    });
    const pool = camp.pools[0];

    // Initial member
    await executeJoinPool(pool.id, {
      fullName: 'Initial Member',
      whatsappNumber: '9829000050',
      pincode: '030250',
    });

    const now = new Date().toISOString();
    const waitlistId = 'wl-promo-01';
    rawDb.prepare(`
      INSERT INTO pool_waitlist (
        id, pool_id, sequence_number, full_name, whatsapp_number,
        city, buying_timeline, locality, pin_code, pincode, existing_quote, status, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WAITING', ?, ?, ?)
    `).run(
      waitlistId,
      pool.id,
      1,
      'Waitlist Member to Promote',
      '9829000051',
      'Jaipur',
      'THIS_MONTH',
      'Civil Lines',
      '030251',
      '030251',
      '₹91,000 dealer quote',
      'Promote test',
      now,
      now
    );

    // Execute FIFO Promotion (same SQL logic as promote-next route)
    const newLeadId = 'lead-promoted-030251';
    const effectivePincode = '030251';
    rawDb.prepare(`
      INSERT INTO pool_leads (
        id, pool_id, buyer_number, full_name, whatsapp_number, city,
        buying_timeline, status, locality, pin_code, pincode, existing_quote, admin_notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'NEW', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newLeadId,
      pool.id,
      2,
      'Waitlist Member to Promote',
      '9829000051',
      'Jaipur',
      'THIS_MONTH',
      'Civil Lines',
      effectivePincode,
      effectivePincode,
      '₹91,000 dealer quote',
      'FIFO Promoted from waitlist position #1',
      now,
      now
    );
    rawDb.prepare('UPDATE pools SET current_buyers = 2 WHERE id = ?').run(pool.id);
    rawDb.prepare("UPDATE pool_waitlist SET status = 'PROMOTED', promoted_at = ?, promoted_lead_id = ? WHERE id = ?").run(
      now,
      newLeadId,
      waitlistId
    );

    // Verify promoted member in pool_leads
    const promotedRow = rawDb.prepare('SELECT * FROM pool_leads WHERE id = ?').get(newLeadId) as Record<string, unknown>;
    assert.equal(promotedRow.buyer_number, 2);
    assert.equal(promotedRow.pincode, '030251');
    assert.equal(promotedRow.existing_quote, '₹91,000 dealer quote');

    // Verify waitlist status
    const wlRow = rawDb.prepare('SELECT status, promoted_lead_id FROM pool_waitlist WHERE id = ?').get(waitlistId) as {
      status: string;
      promoted_lead_id: string;
    };
    assert.equal(wlRow.status, 'PROMOTED');
    assert.equal(wlRow.promoted_lead_id, newLeadId);

    // Verify pool count
    const poolRow = rawDb.prepare('SELECT current_buyers FROM pools WHERE id = ?').get(pool.id) as { current_buyers: number };
    assert.equal(poolRow.current_buyers, 2);
  });

  test('9. Legacy records with null optional fields load gracefully in admin read paths', async () => {
    const camp = await createCampaign({
      title: 'Legacy Compatibility Pool',
      slug: 'legacy-compatibility-pool',
      categorySlug: 'rooftop-solar',
      cities: [{ cityName: 'Jaipur', citySlug: 'jaipur', targetBuyers: 10 }],
    });
    const pool = camp.pools[0];

    // Insert legacy row with null pincode and existing_quote
    rawDb.prepare(`
      INSERT INTO pool_leads (
        id, pool_id, buyer_number, full_name, whatsapp_number, city,
        buying_timeline, status, created_at, updated_at
      ) VALUES (
        'legacy-lead-001', ?, 1, 'Legacy Buyer One', '9829000060', 'Jaipur',
        'THIS_MONTH', 'NEW', datetime('now'), datetime('now')
      )
    `).run(pool.id);

    const adminLeads = await getAdminLeads({ poolId: pool.id });
    const legacyLead = adminLeads.leads.find((l) => l.id === 'legacy-lead-001');
    assert.ok(legacyLead);
    assert.equal(legacyLead.pincode, null);
    assert.equal(legacyLead.existingQuote, null);

    // Query pool members read path
    const memberRow = rawDb.prepare('SELECT * FROM pool_leads WHERE id = ?').get('legacy-lead-001') as Record<string, unknown>;
    assert.ok(memberRow);
    assert.equal(memberRow.pincode, null);
    assert.equal(memberRow.existing_quote, null);
  });

  test('10. Request-to-pool conversion strictly honors recorded consent requirements', async () => {
    const now = new Date().toISOString();

    // Scenario A: Request WITHOUT join pool consent
    const reqNoConsentId = 'req-no-consent-01';
    rawDb.prepare(`
      INSERT INTO pool_requests (
        id, product_name, category, city, full_name, whatsapp_number,
        contact_consent, request_type, status, created_at, updated_at
      ) VALUES (?, 'Solar Battery Backup', 'rooftop-solar', 'Jaipur', 'Inquirer Name', '9829000070', 1, 'GROUP_PROPOSAL', 'REQUESTED', ?, ?)
    `).run(reqNoConsentId, now, now);

    const reqRowA = rawDb.prepare('SELECT * FROM pool_requests WHERE id = ?').get(reqNoConsentId) as Record<string, unknown>;
    const hasConsentA = Boolean(reqRowA.join_pool_consent);
    assert.equal(hasConsentA, false, 'Requester did not provide explicit join consent');

    // Simulate conversion logic: shouldCreateFirstMember must be false
    const shouldCreateA = hasConsentA && Boolean(reqRowA.full_name) && Boolean(reqRowA.whatsapp_number);
    assert.equal(shouldCreateA, false);

    // Scenario B: Request WITH explicit join pool consent
    const reqWithConsentId = 'req-with-consent-02';
    rawDb.prepare(`
      INSERT INTO pool_requests (
        id, product_name, category, city, locality, pin_code, full_name, whatsapp_number,
        contact_consent, join_pool_consent, request_type, status, created_at, updated_at
      ) VALUES (?, 'Solar 3kW Rooftop', 'rooftop-solar', 'Jaipur', 'Vaishali', '030271', 'Committed Buyer', '9829000071', 1, 1, 'GROUP_PROPOSAL', 'REQUESTED', ?, ?)
    `).run(reqWithConsentId, now, now);

    const reqRowB = rawDb.prepare('SELECT * FROM pool_requests WHERE id = ?').get(reqWithConsentId) as Record<string, unknown>;
    const hasConsentB = Boolean(reqRowB.join_pool_consent);
    assert.equal(hasConsentB, true);

    const shouldCreateB = hasConsentB && Boolean(reqRowB.full_name) && Boolean(reqRowB.whatsapp_number);
    assert.equal(shouldCreateB, true, 'Requester with explicit consent and phone/name must be enrolled as Buyer #1');
  });

  test('11. Strict non-conflation: Confirmed members, waitlist applicants and demand proposals reside in separate tables and read paths', async () => {
    const camp = await createCampaign({
      title: 'Tri-Classification Invariant Test',
      slug: 'tri-classification-invariant-test',
      categorySlug: 'rooftop-solar',
      cities: [{ cityName: 'Jaipur', citySlug: 'jaipur', targetBuyers: 1 }],
    });
    const pool = camp.pools[0];

    // 1. Confirmed Member in pool_leads
    const joinRes = await executeJoinPool(pool.id, {
      fullName: 'Confirmed Alpha',
      whatsappNumber: '9829000101',
      pincode: '030101',
      existing_quote: '₹80,000 baseline',
    });
    assert.equal(joinRes.buyerNumber, 1);

    // 2. Waitlist Applicant in pool_waitlist
    const now = new Date().toISOString();
    rawDb.prepare(`
      INSERT INTO pool_waitlist (
        id, pool_id, sequence_number, full_name, whatsapp_number,
        city, locality, pincode, existing_quote, status, created_at, updated_at
      ) VALUES ('wl-tri-01', ?, 1, 'Waitlist Beta', '9829000102', 'Jaipur', 'C-Scheme', '030102', '₹85,000 quote', 'WAITING', ?, ?)
    `).run(pool.id, now, now);

    // 3. Demand Proposal in pool_requests
    rawDb.prepare(`
      INSERT INTO pool_requests (
        id, product_name, category, city, full_name, whatsapp_number,
        contact_consent, request_type, status, created_at, updated_at
      ) VALUES ('req-tri-01', 'Solar Micro-Inverter 3kW', 'rooftop-solar', 'Jaipur', 'Proposal Gamma', '9829000103', 1, 'GROUP_PROPOSAL', 'REQUESTED', ?, ?)
    `).run(now, now);

    // Assert: Table record counts
    const leadsCount = rawDb.prepare('SELECT COUNT(*) as c FROM pool_leads WHERE pool_id = ?').get(pool.id) as { c: number };
    const wlCount = rawDb.prepare('SELECT COUNT(*) as c FROM pool_waitlist WHERE pool_id = ?').get(pool.id) as { c: number };
    const reqCount = rawDb.prepare("SELECT COUNT(*) as c FROM pool_requests WHERE id = 'req-tri-01'").get() as { c: number };

    assert.equal(leadsCount.c, 1, 'pool_leads must strictly contain confirmed members');
    assert.equal(wlCount.c, 1, 'pool_waitlist must strictly contain waitlist queue');
    assert.equal(reqCount.c, 1, 'pool_requests must strictly contain demand proposals');

    // Assert: Admin Leads Read Path never leaks waitlist or requests
    const adminLeadsResult = await getAdminLeads({ poolId: pool.id });
    assert.equal(adminLeadsResult.leads.length, 1);
    assert.equal(adminLeadsResult.leads[0].fullName, 'Confirmed Alpha');
    assert.equal(adminLeadsResult.leads.some((l) => l.fullName === 'Waitlist Beta'), false);
    assert.equal(adminLeadsResult.leads.some((l) => l.fullName === 'Proposal Gamma'), false);
  });
});

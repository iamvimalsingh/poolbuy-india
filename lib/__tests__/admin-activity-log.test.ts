import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { recordAdminAudit, getAuditLogs } from '../audit';

describe('Admin Activity Log & Audit Trail Invariants', () => {
  test('1. Admin audit entry records truthfully and is retrieved by getAuditLogs', async () => {
    const action = 'UPDATE_PRICING';
    const targetType = 'CAMPAIGN';
    const targetId = 'camp-solar-pm-surya-ghar';
    const changesSummary = 'Updated default market price to ₹2,10,000 and indicative group price to ₹1,65,000.';
    const details = {
      previousGroupPrice: 155000,
      newGroupPrice: 165000,
      childPoolsSynchronized: 28,
    };

    await recordAdminAudit({
      action,
      targetType,
      targetId,
      adminIdentifier: 'operator_test_session',
      changesSummary,
      details,
    });

    const logs = await getAuditLogs(50);
    assert.ok(logs.length > 0, 'Must return at least one audit log entry');

    const entry = logs.find((l) => l.action === action && l.targetId === targetId);
    assert.ok(entry, 'Recorded entry must exist in audit log results');
    assert.equal(entry.targetType, 'CAMPAIGN');
    assert.equal(entry.adminIdentifier, 'operator_test_session');
    assert.equal(entry.changesSummary, changesSummary);
    assert.deepEqual(entry.details, details);
  });

  test('2. Multiple target types are correctly categorized', async () => {
    const targetTypes: Array<'POOL' | 'LEAD' | 'REQUEST' | 'CITY' | 'CATEGORY' | 'QUOTE' | 'LOCATION_REQUEST'> = [
      'POOL',
      'LEAD',
      'REQUEST',
      'CITY',
      'CATEGORY',
      'QUOTE',
      'LOCATION_REQUEST',
    ];

    for (const tt of targetTypes) {
      await recordAdminAudit({
        action: `TEST_ACTION_${tt}`,
        targetType: tt,
        targetId: `test-id-${tt.toLowerCase()}`,
        changesSummary: `Verified ${tt} audit recording`,
      });
    }

    const logs = await getAuditLogs(100);
    for (const tt of targetTypes) {
      const found = logs.some((l) => l.targetType === tt && l.action === `TEST_ACTION_${tt}`);
      assert.ok(found, `Must find audit entry for target type ${tt}`);
    }
  });

  test('3. Audit entries never expose raw password hashes, secrets, or auth tokens', async () => {
    const logs = await getAuditLogs(100);
    for (const log of logs) {
      const serialized = JSON.stringify(log);
      assert.ok(!serialized.toLowerCase().includes('admin_session_secret'), 'Must not leak session secrets');
      assert.ok(!serialized.toLowerCase().includes('passkey_hash'), 'Must not leak credentials');
      assert.ok(!serialized.toLowerCase().includes('password_hash'), 'Must not leak passwords');
    }
  });
});

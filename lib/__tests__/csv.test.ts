import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { escapeCsvCell, buildLeadsCsv } from '../csv';
import { PoolLead } from '@/types';

describe('CSV Security & Formatting Tests', () => {
  describe('Spreadsheet Formula Injection Neutralization', () => {
    test('neutralizes leading equals sign (=)', () => {
      assert.equal(escapeCsvCell('=CMD|"/C calc"!A0'), '"\'=CMD|""/C calc""!A0"');
      assert.equal(escapeCsvCell('=SUM(A1:A10)'), "'=SUM(A1:A10)");
    });

    test('neutralizes leading plus sign (+)', () => {
      assert.equal(escapeCsvCell('+12345'), "'+12345");
    });

    test('neutralizes leading minus sign (-)', () => {
      assert.equal(escapeCsvCell('-500'), "'-500");
    });

    test('neutralizes leading @ sign', () => {
      assert.equal(escapeCsvCell('@SUM(A1:A10)'), "'@SUM(A1:A10)");
    });

    test('neutralizes leading tab and carriage return characters', () => {
      assert.equal(escapeCsvCell('\ttab_inject'), "'\ttab_inject");
      assert.equal(escapeCsvCell('\rinject'), '"\'\rinject"');
    });
  });

  describe('RFC 4180 Escaping', () => {
    test('wraps cells with commas in double quotes', () => {
      assert.equal(escapeCsvCell('Bhopal, Madhya Pradesh'), '"Bhopal, Madhya Pradesh"');
    });

    test('escapes internal double quotes by doubling them', () => {
      assert.equal(escapeCsvCell('Needs "matte" finish'), '"Needs ""matte"" finish"');
    });

    test('wraps multiline text in double quotes', () => {
      assert.equal(escapeCsvCell("Line 1\nLine 2"), '"Line 1\nLine 2"');
    });

    test('preserves plain safe alphanumeric values without quoting', () => {
      assert.equal(escapeCsvCell('Vikram Sharma'), 'Vikram Sharma');
      assert.equal(escapeCsvCell('9876543210'), '9876543210');
    });
  });

  describe('buildLeadsCsv', () => {
    test('generates valid RFC-4180 CSV with header row and neutralized data', () => {
      const mockLeads: PoolLead[] = [
        {
          id: 'lead-1',
          poolId: 'pool-1',
          poolSlug: 'tvs-iqube-s',
          poolName: 'TVS iQube S',
          poolCategory: 'EV_SCOOTERS',
          fullName: '=Malicious User',
          whatsappNumber: '9876543210',
          city: 'Bhopal',
          buyingTimeline: 'WITHIN_7_DAYS',
          hasExistingQuote: true,
          existingQuoteAmount: 145000,
          extraMessage: 'Need delivery in "Bhopal", ASAP\nUrgent',
          status: 'NEW',
          consentAt: '2026-10-26T10:00:00Z',
          privacyNoticeVersion: '2026-10-26-v1',
          createdAt: '2026-10-26T10:00:00Z',
          buyerNumber: 1,
        },
      ];

      const csv = buildLeadsCsv(mockLeads);

      // Check header row (prefixed by Excel UTF-8 BOM \uFEFF)
      assert.ok(csv.includes('Buyer #,Full Name,WhatsApp Number,City'));

      // Check formula neutralization in output
      assert.ok(csv.includes("'\=Malicious User"));

      // Check quote escaping in message
      assert.ok(csv.includes('""Bhopal""'));
    });
  });
});

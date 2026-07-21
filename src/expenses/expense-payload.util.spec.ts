import { BadRequestException } from '@nestjs/common';
import {
  expenseTextColumn,
  mergeExpenseRelationForNormalize,
  normalizeExpenseOptionalText,
  normalizeExpenseRelationFields,
  verificationScopeFromExpenseText,
} from './expense-payload.util';

describe('expense-payload.util', () => {
  describe('normalizeExpenseOptionalText', () => {
    it('trims and returns non-empty strings', () => {
      expect(normalizeExpenseOptionalText('  Taller AC  ')).toBe('Taller AC');
    });

    it('returns undefined for blank values', () => {
      expect(normalizeExpenseOptionalText('   ')).toBeUndefined();
      expect(normalizeExpenseOptionalText(null)).toBeUndefined();
    });
  });

  describe('expenseTextColumn', () => {
    it('maps blank to null', () => {
      expect(expenseTextColumn('')).toBeNull();
      expect(expenseTextColumn('  proveedor  ')).toBe('proveedor');
    });
  });

  describe('verificationScopeFromExpenseText', () => {
    it('parses canonical category', () => {
      expect(
        verificationScopeFromExpenseText('Verificación - físico-mecánica'),
      ).toBe('phys_mech');
      expect(verificationScopeFromExpenseText('Verificación - emisiones')).toBe(
        'emissions',
      );
      expect(
        verificationScopeFromExpenseText('Verificación - doble articulado'),
      ).toBe('double_articulated');
    });
  });

  describe('normalizeExpenseRelationFields', () => {
    it('accepts valid maintenance on unit', () => {
      expect(
        normalizeExpenseRelationFields({
          kind: 'maintenance',
          relatedUnitId: 3,
        }),
      ).toEqual({});
    });

    it('rejects maintenance without related asset', () => {
      expect(() =>
        normalizeExpenseRelationFields({
          kind: 'maintenance',
        }),
      ).toThrow(BadRequestException);
    });

    it('accepts valid insurance on equipment', () => {
      expect(
        normalizeExpenseRelationFields({
          kind: 'insurance',
          relatedEquipmentId: 9,
        }),
      ).toEqual({});
    });

    it('accepts valid verification and returns canonical category', () => {
      expect(
        normalizeExpenseRelationFields({
          kind: 'verification',
          verificationScope: 'phys_mech',
          relatedUnitId: 2,
        }),
      ).toEqual({
        category: 'Verificación - físico-mecánica',
        descriptionHint: 'Pago de verificación - físico-mecánica',
      });
    });

    it('ignores relation flags for other kinds', () => {
      expect(
        normalizeExpenseRelationFields({
          kind: 'fuel',
          relatedUnitId: 1,
        }),
      ).toEqual({});
    });
  });

  describe('mergeExpenseRelationForNormalize', () => {
    it('uses patch kind when kind changes to fuel', () => {
      const merged = mergeExpenseRelationForNormalize(
        {
          kind: 'maintenance',
          relatedUnitId: 5,
          category: 'Aceite',
        },
        { kind: 'fuel' },
        {
          relatedUnitId: 5,
          relatedUnitIdTouched: false,
          relatedEquipmentIdTouched: false,
        },
      );
      expect(normalizeExpenseRelationFields(merged)).toEqual({});
    });
  });
});

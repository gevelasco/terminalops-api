import { BadRequestException } from '@nestjs/common';
import {
  expenseTextColumn,
  mergeExpenseRelationForNormalize,
  normalizeExpenseOptionalText,
  normalizeExpenseRelationFields,
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

  describe('normalizeExpenseRelationFields', () => {
    it('accepts valid maintenance on unit', () => {
      expect(
        normalizeExpenseRelationFields({
          kind: 'maintenance',
          maintenanceTarget: 'unit',
          relatedUnitId: 3,
        }),
      ).toEqual({
        maintenanceTarget: 'unit',
        insuranceTarget: null,
        verificationScope: null,
      });
    });

    it('rejects maintenance without target', () => {
      expect(() =>
        normalizeExpenseRelationFields({
          kind: 'maintenance',
          relatedUnitId: 1,
        }),
      ).toThrow(BadRequestException);
    });

    it('accepts valid insurance on equipment', () => {
      expect(
        normalizeExpenseRelationFields({
          kind: 'insurance',
          insuranceTarget: 'equipment',
          relatedEquipmentId: 9,
        }),
      ).toEqual({
        maintenanceTarget: null,
        insuranceTarget: 'equipment',
        verificationScope: null,
      });
    });

    it('accepts valid verification', () => {
      expect(
        normalizeExpenseRelationFields({
          kind: 'verification',
          verificationScope: 'phys_mech',
          relatedUnitId: 2,
        }),
      ).toEqual({
        maintenanceTarget: null,
        insuranceTarget: null,
        verificationScope: 'phys_mech',
      });
    });

    it('clears targets for other kinds', () => {
      expect(
        normalizeExpenseRelationFields({
          kind: 'fuel',
          maintenanceTarget: 'unit',
          insuranceTarget: 'equipment',
          verificationScope: 'phys_mech',
        }),
      ).toEqual({
        maintenanceTarget: null,
        insuranceTarget: null,
        verificationScope: null,
      });
    });
  });

  describe('mergeExpenseRelationForNormalize', () => {
    it('uses patch kind and clears targets when kind changes to fuel', () => {
      const merged = mergeExpenseRelationForNormalize(
        {
          kind: 'maintenance',
          maintenanceTarget: 'unit',
          relatedUnitId: 5,
        },
        { kind: 'fuel' },
        {
          relatedUnitId: 5,
          relatedUnitIdTouched: false,
          relatedEquipmentIdTouched: false,
        },
      );
      expect(normalizeExpenseRelationFields(merged)).toEqual({
        maintenanceTarget: null,
        insuranceTarget: null,
        verificationScope: null,
      });
    });
  });
});

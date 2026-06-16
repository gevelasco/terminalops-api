import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { serializeOperator } from 'src/common/serializers/operator.serializer';
import { TripFleetStatusSyncService } from 'src/trips/lifecycle/trip-fleet-status-sync.service';
import { Operator } from 'src/operators/entities/operator.entity';
import { OperatorDocument } from 'src/operators/entities/operator-document.entity';
import { OperatorEmergencyContact } from 'src/operators/entities/operator-emergency-contact.entity';
import { OperatorPrivateInsurance } from 'src/operators/entities/operator-private-insurance.entity';
import { OperatorPublicInsurance } from 'src/operators/entities/operator-public-insurance.entity';
import { CreateOperatorDto } from './dto/create-operator.dto';
import { UpdateOperatorDto } from './dto/update-operator.dto';

const OPERATOR_RELATIONS = [
  'emergencyContact',
  'publicInsurance',
  'privateInsurance',
  'documents',
] as const;

type OperatorNestedPayload = Pick<
  CreateOperatorDto,
  'emergencyContact' | 'publicInsurance' | 'privateInsurance' | 'documents'
>;

@Injectable()
export class OperatorsService {
  constructor(
    @InjectRepository(Operator)
    private readonly repo: Repository<Operator>,
    @InjectRepository(OperatorEmergencyContact)
    private readonly emergencyRepo: Repository<OperatorEmergencyContact>,
    @InjectRepository(OperatorPublicInsurance)
    private readonly publicInsuranceRepo: Repository<OperatorPublicInsurance>,
    @InjectRepository(OperatorPrivateInsurance)
    private readonly privateInsuranceRepo: Repository<OperatorPrivateInsurance>,
    @InjectRepository(OperatorDocument)
    private readonly documentsRepo: Repository<OperatorDocument>,
    private readonly fleetStatusSync: TripFleetStatusSyncService,
  ) {}

  async create(companyId: number, dto: CreateOperatorDto) {
    const core = this.extractCoreFields(dto);
    const saved = await this.repo.save(
      this.repo.create({
        companyId,
        ...core,
      }),
    );
    await this.saveNested(saved.id, dto);
    return this.findOne(companyId, saved.id);
  }

  async findAll(companyId: number) {
    await this.fleetStatusSync.reconcileCompanyFleetOperationalStatus(companyId);

    const rows = await this.repo.find({
      where: { companyId },
      relations: [...OPERATOR_RELATIONS],
      order: { name: 'ASC' },
    });
    return rows.map((row) => serializeOperator(row));
  }

  async findOne(companyId: number, operatorId: number) {
    const row = await this.repo.findOne({
      where: { companyId, id: operatorId },
      relations: [...OPERATOR_RELATIONS],
    });
    if (!row) {
      throw new NotFoundException(`Operator ${operatorId} not found`);
    }
    return serializeOperator(row);
  }

  async update(companyId: number, operatorId: number, dto: UpdateOperatorDto) {
    await this.findOne(companyId, operatorId);
    const core = this.extractCoreFields(dto);
    if (Object.keys(core).length > 0) {
      await this.repo.update({ id: operatorId, companyId }, core);
    }
    await this.saveNested(operatorId, dto);
    return this.findOne(companyId, operatorId);
  }

  async remove(companyId: number, operatorId: number) {
    await this.findOne(companyId, operatorId);
    await this.repo.delete({ id: operatorId, companyId });
    return { id: operatorId, deleted: true };
  }

  private extractCoreFields(
    dto: CreateOperatorDto | UpdateOperatorDto,
  ): Partial<Operator> {
    const {
      emergencyContact: _ec,
      publicInsurance: _pub,
      privateInsurance: _priv,
      documents: _docs,
      ...core
    } = dto;
    return core;
  }

  private async saveNested(
    operatorId: number,
    dto: OperatorNestedPayload,
  ): Promise<void> {
    if (dto.emergencyContact) {
      await this.emergencyRepo.save(
        this.emergencyRepo.create({
          operatorId,
          name: dto.emergencyContact.name ?? '',
          relationship: dto.emergencyContact.relationship ?? '',
          phone: dto.emergencyContact.phone ?? '',
          email: dto.emergencyContact.email ?? '',
          authorizedMedicalInfo:
            dto.emergencyContact.authorizedMedicalInfo ?? false,
        }),
      );
    }

    if (dto.publicInsurance) {
      await this.publicInsuranceRepo.save(
        this.publicInsuranceRepo.create({
          operatorId,
          nss: dto.publicInsurance.nss ?? '',
          imssAltaDate: this.emptyDateToUndefined(dto.publicInsurance.imssAltaDate),
          infonavit: dto.publicInsurance.infonavit ?? false,
          infonavitCreditNumber: dto.publicInsurance.infonavitCreditNumber ?? '',
          fonacot: dto.publicInsurance.fonacot ?? false,
          fonacotCreditNumber: dto.publicInsurance.fonacotCreditNumber ?? '',
          notes: dto.publicInsurance.notes ?? '',
        }),
      );
    }

    if (dto.privateInsurance) {
      await this.privateInsuranceRepo.save(
        this.privateInsuranceRepo.create({
          operatorId,
          carrier: dto.privateInsurance.carrier ?? '',
          policyNumber: dto.privateInsurance.policyNumber ?? '',
          validFrom: this.emptyDateToUndefined(dto.privateInsurance.validFrom),
          validTo: this.emptyDateToUndefined(dto.privateInsurance.validTo),
          premiumAmount: dto.privateInsurance.premiumAmount ?? '',
          premiumPeriod: dto.privateInsurance.premiumPeriod ?? '',
          deductibleNotes: dto.privateInsurance.deductibleNotes ?? '',
          planSummary: dto.privateInsurance.planSummary ?? '',
        }),
      );
    }

    if (dto.documents !== undefined) {
      await this.documentsRepo.delete({ operatorId });
      if (dto.documents.length > 0) {
        await this.documentsRepo.save(
          await Promise.all(
            dto.documents.map(async (doc, index) => {
              const existingDocId = await this.resolveDocumentId(
                operatorId,
                doc.id,
              );
              return this.documentsRepo.create({
                ...(existingDocId ? { id: existingDocId } : {}),
                operatorId,
                fileName: doc.fileName,
                slot: doc.slot,
                addedAt: doc.addedAt ?? new Date().toISOString().slice(0, 10),
                sortOrder: index,
              });
            }),
          ),
        );
      }
    }
  }

  private async resolveDocumentId(
    operatorId: number,
    ref?: string | number,
  ): Promise<number | undefined> {
    if (ref == null || ref === '') {
      return undefined;
    }
    const id = typeof ref === 'number' ? ref : Number(ref);
    if (!Number.isInteger(id) || id < 1) {
      return undefined;
    }
    const row = await this.documentsRepo.findOne({
      where: { operatorId, id },
      select: ['id'],
    });
    return row?.id;
  }

  private emptyDateToUndefined(value?: string): string | undefined {
    const t = value?.trim();
    return t ? t : undefined;
  }
}

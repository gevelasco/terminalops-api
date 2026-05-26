import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { serializeOperator } from 'src/common/serializers/operator.serializer';
import { ResourcePublicIdService } from 'src/common/tenant/resource-public-id.service';
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
    private readonly publicIds: ResourcePublicIdService,
  ) {}

  async create(
    companyId: string,
    companyPublicId: number,
    dto: CreateOperatorDto,
  ) {
    const core = this.extractCoreFields(dto);
    const saved = await this.repo.save(
      this.repo.create({
        companyId,
        ...core,
      }),
    );
    await this.saveNested(saved.id, dto);
    return this.findOne(companyId, saved.publicId, companyPublicId);
  }

  async findAll(companyId: string, companyPublicId: number) {
    const rows = await this.repo.find({
      where: { companyId },
      relations: [...OPERATOR_RELATIONS],
      order: { name: 'ASC' },
    });
    return rows.map((row) => serializeOperator(row, companyPublicId));
  }

  async findOne(
    companyId: string,
    operatorPublicId: number,
    companyPublicId: number,
  ) {
    const row = await this.repo.findOne({
      where: { companyId, publicId: operatorPublicId },
      relations: [...OPERATOR_RELATIONS],
    });
    if (!row) {
      throw new NotFoundException(`Operator ${operatorPublicId} not found`);
    }
    return serializeOperator(row, companyPublicId);
  }

  async update(
    companyId: string,
    operatorPublicId: number,
    companyPublicId: number,
    dto: UpdateOperatorDto,
  ) {
    const internalId = await this.publicIds.resolveOperatorInternalId(
      companyId,
      operatorPublicId,
    );
    const core = this.extractCoreFields(dto);
    if (Object.keys(core).length > 0) {
      await this.repo.update({ id: internalId, companyId }, core);
    }
    await this.saveNested(internalId, dto);
    return this.findOne(companyId, operatorPublicId, companyPublicId);
  }

  async remove(
    companyId: string,
    operatorPublicId: number,
  ) {
    const internalId = await this.publicIds.resolveOperatorInternalId(
      companyId,
      operatorPublicId,
    );
    await this.repo.delete({ id: internalId, companyId });
    return { id: operatorPublicId, deleted: true };
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
    operatorId: string,
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
              const internalDocId = await this.resolveDocumentInternalId(
                operatorId,
                doc.id,
              );
              return this.documentsRepo.create({
                ...(internalDocId ? { id: internalDocId } : {}),
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

  private async resolveDocumentInternalId(
    operatorId: string,
    ref?: string | number,
  ): Promise<string | undefined> {
    if (ref == null || ref === '') {
      return undefined;
    }
    const raw = typeof ref === 'number' ? String(ref) : ref;
    if (/^\d+$/.test(raw)) {
      const row = await this.documentsRepo.findOne({
        where: { operatorId, publicId: Number(raw) },
        select: ['id'],
      });
      return row?.id;
    }
    const row = await this.documentsRepo.findOne({
      where: { operatorId, id: raw },
      select: ['id'],
    });
    return row?.id;
  }

  private emptyDateToUndefined(value?: string): string | undefined {
    const t = value?.trim();
    return t ? t : undefined;
  }
}

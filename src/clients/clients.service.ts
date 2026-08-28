import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FileService } from 'src/common/file/file.service';
import { serializeClient } from 'src/common/serializers/client.serializer';
import { Client } from 'src/clients/entities/client.entity';
import { ClientBilling } from 'src/clients/entities/client-billing.entity';
import { ClientContact } from 'src/clients/entities/client-contact.entity';
import { ClientDelivery } from 'src/clients/entities/client-delivery.entity';
import { ClientDocument } from 'src/clients/entities/client-document.entity';
import { ClientPaymentTerms } from 'src/clients/entities/client-payment-terms.entity';
import { DestinationRatesService } from 'src/destination-rates/destination-rates.service';
import { clientPatchActivity } from 'src/activity-events/activity-events.client.util';
import { ActivityEventsService } from 'src/activity-events/activity-events.service';
import { COMPANY_ACTIVITY_KIND } from 'src/activity-events/company-activity-event.kinds';
import type AuthUser from 'src/types/auth-user.type';
import {
  ListResourcePageQueryDto,
  normalizeResourceListLimit,
  normalizeResourceListPage,
  toResourceListResult,
  type ResourceListResult,
} from 'src/common/dto/list-resource-page-query.dto';
import {
  CLIENT_DOCUMENT_SLOTS,
  CLIENT_DOCUMENT_STORAGE_FOLDER,
  type ClientDocumentSlot,
} from './client-document.constants';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import type { ClientPickerOptionDto } from './dto/client-picker-option.dto';

const CLIENT_RELATIONS = [
  'billing',
  'paymentTerms',
  'delivery',
  'contacts',
  'documents',
] as const;

export type ClientsFindAllOptions = ListResourcePageQueryDto;

export type ClientsListResult = ResourceListResult<
  ReturnType<typeof serializeClient>
>;

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientsRepo: Repository<Client>,
    @InjectRepository(ClientBilling)
    private readonly billingRepo: Repository<ClientBilling>,
    @InjectRepository(ClientPaymentTerms)
    private readonly paymentRepo: Repository<ClientPaymentTerms>,
    @InjectRepository(ClientContact)
    private readonly contactsRepo: Repository<ClientContact>,
    @InjectRepository(ClientDelivery)
    private readonly deliveryRepo: Repository<ClientDelivery>,
    @InjectRepository(ClientDocument)
    private readonly documentsRepo: Repository<ClientDocument>,
    private readonly destinationRatesService: DestinationRatesService,
    private readonly activityEvents: ActivityEventsService,
    private readonly fileService: FileService,
  ) {}

  async create(companyId: number, dto: CreateClientDto, actor?: AuthUser) {
    const client = this.clientsRepo.create({
      companyId,
      name: dto.name,
      rfc: dto.rfc,
      relationshipStartedOn: dto.relationshipStartedOn,
      notes: dto.notes,
    });
    const saved = await this.clientsRepo.save(client);
    await this.saveNested(companyId, saved.id, dto);
    await this.activityEvents.record({
      companyId,
      kind: COMPANY_ACTIVITY_KIND.CLIENT_CREATED,
      entityType: 'client',
      entityId: saved.id,
      subjectLabel: saved.name?.trim() || `Cliente #${saved.id}`,
      title: 'Alta de cliente',
      actor,
    });
    return this.findOne(companyId, saved.id);
  }

  async findAll(
    companyId: number,
    options?: ClientsFindAllOptions,
  ): Promise<ClientsListResult> {
    const limit = normalizeResourceListLimit(options?.limit);
    const page = normalizeResourceListPage(options?.page);

    const total = await this.clientsRepo.count({ where: { companyId } });

    const qb = this.clientsRepo
      .createQueryBuilder('client')
      .leftJoinAndSelect('client.billing', 'billing')
      .leftJoinAndSelect('client.paymentTerms', 'paymentTerms')
      .leftJoinAndSelect('client.delivery', 'delivery')
      .leftJoinAndSelect('client.contacts', 'contacts')
      .leftJoinAndSelect('client.documents', 'documents')
      .where('client.companyId = :companyId', { companyId })
      .orderBy('client.name', 'ASC')
      .addOrderBy('contacts.sortOrder', 'ASC')
      .addOrderBy('documents.sortOrder', 'ASC');

    if (limit > 0) {
      qb.skip((page - 1) * limit).take(limit);
    }

    const rows = await qb.getMany();
    return toResourceListResult(
      rows.map((row) => serializeClient(row)),
      total,
      page,
      limit,
    );
  }

  async findPickerOptions(companyId: number): Promise<ClientPickerOptionDto[]> {
    const rows = await this.clientsRepo
      .createQueryBuilder('client')
      .select('client.id', 'id')
      .addSelect('client.name', 'name')
      .where('client.companyId = :companyId', { companyId })
      .orderBy('client.name', 'ASC')
      .getRawMany<{ id: string; name: string }>();

    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name?.trim() || 'Sin nombre',
    }));
  }

  async findOne(companyId: number, clientId: number) {
    const client = await this.clientsRepo.findOne({
      where: { companyId, id: clientId },
      relations: [...CLIENT_RELATIONS],
    });
    if (!client) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }
    return serializeClient(client);
  }

  async update(
    companyId: number,
    clientId: number,
    dto: UpdateClientDto,
    actor?: AuthUser,
  ) {
    const existing = await this.findOne(companyId, clientId);
    await this.clientsRepo.update({ id: clientId, companyId }, {
      name: dto.name,
      rfc: dto.rfc,
      relationshipStartedOn: dto.relationshipStartedOn,
      notes: dto.notes,
    });
    if (
      dto.billing ||
      dto.payment ||
      dto.contacts ||
      dto.delivery ||
      dto.documents !== undefined
    ) {
      await this.saveNested(companyId, clientId, dto);
    }
    const name =
      dto.name?.trim() ||
      (typeof existing['name'] === 'string' ? existing['name'] : '') ||
      `Cliente #${clientId}`;
    await this.activityEvents.record({
      companyId,
      kind: COMPANY_ACTIVITY_KIND.CLIENT_UPDATED,
      entityType: 'client',
      entityId: clientId,
      subjectLabel: name,
      title: clientPatchActivity(existing, dto).title,
      actor,
    });
    return this.findOne(companyId, clientId);
  }

  async remove(companyId: number, clientId: number) {
    await this.findOne(companyId, clientId);
    await this.clientsRepo.delete({ id: clientId, companyId });
    return { id: clientId, deleted: true };
  }

  private async saveNested(
    companyId: number,
    clientId: number,
    dto: Pick<
      CreateClientDto,
      'billing' | 'payment' | 'contacts' | 'delivery' | 'documents'
    >,
  ) {
    if (dto.billing) {
      await this.billingRepo.save(
        this.billingRepo.create({ clientId, ...dto.billing }),
      );
    }
    if (dto.payment) {
      await this.paymentRepo.save(
        this.paymentRepo.create({
          clientId,
          hasCredit: dto.payment.hasCredit ?? false,
          creditDays: dto.payment.creditDays,
          approximateCreditAmount: dto.payment.approximateCreditAmount,
          defaultPaymentMethod: dto.payment.defaultPaymentMethod,
        }),
      );
    }
    if (dto.contacts?.length) {
      await this.contactsRepo.delete({ clientId });
      await this.contactsRepo.save(
        dto.contacts.map((c, index) =>
          this.contactsRepo.create({
            clientId,
            ...c,
            sortOrder: index,
          }),
        ),
      );
    }
    if (dto.delivery) {
      const postalCode = dto.delivery.postalCode?.trim() || undefined;
      const locality = dto.delivery.locality?.trim() || undefined;
      const hasDestination = !!(postalCode && locality);
      const matchedRate = hasDestination
        ? await this.destinationRatesService.findRateForClientDelivery(companyId, {
            postalCode,
            locality,
          })
        : null;

      await this.deliveryRepo.save(
        this.deliveryRepo.create({
          clientId,
          postalCode,
          cityMunicipality: dto.delivery.cityMunicipality?.trim() || undefined,
          locality,
          settlementConsId: dto.delivery.settlementConsId?.trim() || undefined,
          latitude:
            dto.delivery.latitude != null && Number.isFinite(dto.delivery.latitude)
              ? String(dto.delivery.latitude)
              : undefined,
          longitude:
            dto.delivery.longitude != null && Number.isFinite(dto.delivery.longitude)
              ? String(dto.delivery.longitude)
              : undefined,
          destinationRateId: matchedRate?.id,
        }),
      );
    }
    if (dto.documents !== undefined) {
      // Prefer POST/DELETE /clients/:id/documents for binary files.
      // Nested documents[] remains for legacy metadata sync and preserves storage_key.
      const previous = await this.documentsRepo.find({ where: { clientId } });
      const previousById = new Map(previous.map((d) => [d.id, d]));
      const keptIds = new Set<number>();

      const nextRows = await Promise.all(
        dto.documents.map(async (doc, index) => {
          const existingDocId = await this.resolveDocumentId(clientId, doc.id);
          const previousRow = existingDocId
            ? previousById.get(existingDocId)
            : undefined;
          if (existingDocId) {
            keptIds.add(existingDocId);
          }
          return this.documentsRepo.create({
            ...(existingDocId ? { id: existingDocId } : {}),
            clientId,
            fileName: doc.fileName,
            slot: doc.slot,
            addedAt: doc.addedAt ?? new Date().toISOString().slice(0, 10),
            sortOrder: index,
            storageKey: previousRow?.storageKey ?? null,
            contentType: previousRow?.contentType ?? null,
            sizeBytes: previousRow?.sizeBytes ?? null,
          });
        }),
      );

      for (const row of previous) {
        if (keptIds.has(row.id)) {
          continue;
        }
        if (row.storageKey) {
          await this.fileService.remove(row.storageKey);
        }
      }

      await this.documentsRepo.delete({ clientId });
      if (nextRows.length > 0) {
        await this.documentsRepo.save(nextRows);
      }
    }
  }

  async uploadDocument(
    companyId: number,
    clientId: number,
    slot: ClientDocumentSlot,
    file: Express.Multer.File,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
    if (!(CLIENT_DOCUMENT_SLOTS as readonly string[]).includes(slot)) {
      throw new BadRequestException('Invalid slot');
    }
    await this.assertClientExists(companyId, clientId);

    const uploaded = await this.fileService.upload(
      CLIENT_DOCUMENT_STORAGE_FOLDER,
      file,
    );
    const maxSort = await this.documentsRepo
      .createQueryBuilder('d')
      .select('MAX(d.sort_order)', 'max')
      .where('d.client_id = :clientId', { clientId })
      .getRawOne<{ max: string | null }>();
    const sortOrder = Number(maxSort?.max ?? -1) + 1;

    const saved = await this.documentsRepo.save(
      this.documentsRepo.create({
        clientId,
        slot,
        fileName: uploaded.originalName,
        storageKey: uploaded.url,
        contentType: file.mimetype || null,
        sizeBytes: String(file.size),
        addedAt: new Date().toISOString().slice(0, 10),
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      }),
    );

    return {
      id: saved.id,
      clientId: saved.clientId,
      slot: saved.slot,
      fileName: saved.fileName,
      addedAt: saved.addedAt,
      sortOrder: saved.sortOrder,
      hasStoredFile: true,
    };
  }

  async downloadDocument(
    companyId: number,
    clientId: number,
    documentId: number,
  ) {
    const document = await this.findDocumentForClient(
      companyId,
      clientId,
      documentId,
    );
    if (!document.storageKey) {
      throw new NotFoundException(
        `Document ${documentId} has no stored file`,
      );
    }
    return this.fileService.presignedUrl(document.storageKey);
  }

  async removeDocument(
    companyId: number,
    clientId: number,
    documentId: number,
  ) {
    const document = await this.findDocumentForClient(
      companyId,
      clientId,
      documentId,
    );
    if (document.storageKey) {
      await this.fileService.remove(document.storageKey);
    }
    await this.documentsRepo.delete({ id: documentId, clientId });
    return { id: documentId, deleted: true };
  }

  private async assertClientExists(
    companyId: number,
    clientId: number,
  ): Promise<void> {
    const row = await this.clientsRepo.findOne({
      where: { companyId, id: clientId },
      select: ['id'],
    });
    if (!row) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }
  }

  private async findDocumentForClient(
    companyId: number,
    clientId: number,
    documentId: number,
  ): Promise<ClientDocument> {
    await this.assertClientExists(companyId, clientId);
    const document = await this.documentsRepo.findOne({
      where: { id: documentId, clientId },
    });
    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }
    return document;
  }

  private async resolveDocumentId(
    clientId: number,
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
      where: { clientId, id },
      select: ['id'],
    });
    return row?.id;
  }
}

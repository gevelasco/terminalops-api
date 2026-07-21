import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { serializeClient } from 'src/common/serializers/client.serializer';
import { Client } from 'src/clients/entities/client.entity';
import { ClientBilling } from 'src/clients/entities/client-billing.entity';
import { ClientContact } from 'src/clients/entities/client-contact.entity';
import { ClientDelivery } from 'src/clients/entities/client-delivery.entity';
import { ClientPaymentTerms } from 'src/clients/entities/client-payment-terms.entity';
import { DestinationRatesService } from 'src/destination-rates/destination-rates.service';
import { ActivityEventsService } from 'src/activity-events/activity-events.service';
import { COMPANY_ACTIVITY_KIND } from 'src/activity-events/company-activity-event.kinds';
import type AuthUser from 'src/types/auth-user.type';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import type { ClientPickerOptionDto } from './dto/client-picker-option.dto';

const CLIENT_RELATIONS = ['billing', 'paymentTerms', 'delivery', 'contacts'] as const;

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
    private readonly destinationRatesService: DestinationRatesService,
    private readonly activityEvents: ActivityEventsService,
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

  async findAll(companyId: number) {
    const rows = await this.clientsRepo
      .createQueryBuilder('client')
      .leftJoinAndSelect('client.billing', 'billing')
      .leftJoinAndSelect('client.paymentTerms', 'paymentTerms')
      .leftJoinAndSelect('client.delivery', 'delivery')
      .leftJoinAndSelect('client.contacts', 'contacts')
      .loadRelationCountAndMap('client.maneuverCount', 'client.trips', 'trip', (qb) =>
        qb.andWhere('trip.deleted_at IS NULL'),
      )
      .where('client.companyId = :companyId', { companyId })
      .orderBy('client.name', 'ASC')
      .addOrderBy('contacts.sortOrder', 'ASC')
      .getMany();

    const healthMap = await this.computeCommercialHealth(companyId);
    return rows.map((row) => {
      const health = healthMap.get(row.id);
      return { ...serializeClient(row), commercialHealth: health ?? 'not_evaluated' };
    });
  }

  /**
   * Mirrors the frontend's `deriveClientCommercialHealthFromCredit`:
   *
   *  - No trips → watch_list
   *  - Receivable ≤ 0 → good_standing
   *  - No next due date → watch_list
   *  - Next due < today → restricted
   *  - Next due ≤ today + 10d → due_soon
   *  - Otherwise → good_standing
   *
   * Billable = (completed OR cancelled+false_maneuver), has_client_billing ≠ false,
   *            client_charge > 0.
   * Due date  = COALESCE(return_at, planned_completion_at) + credit_days.
   */
  private async computeCommercialHealth(
    companyId: number,
    clientId?: number,
  ): Promise<Map<number, string>> {
    const DUE_SOON_DAYS = 10;

    const rows: Array<{
      client_id: number;
      has_trips: boolean;
      receivable: string;
      next_due: string | null;
    }> = await this.clientsRepo.query(
      `
      SELECT
        sub.client_id,
        TRUE AS has_trips,
        COALESCE(SUM(
          CASE WHEN sub.is_receivable THEN sub.charge ELSE 0 END
        ), 0) AS receivable,
        MIN(
          CASE WHEN sub.is_receivable THEN sub.due_date ELSE NULL END
        )::text AS next_due
      FROM (
        SELECT
          t.client_id,
          COALESCE(t.client_charge, 0)::numeric AS charge,
          (
            COALESCE(t.has_client_billing, TRUE) = TRUE
            AND COALESCE(t.client_charge, 0) > 0
            AND (
              t.status = 'completed'
              OR (t.status = 'cancelled' AND t.false_maneuver = TRUE)
            )
            AND t.client_collected_at IS NULL
          ) AS is_receivable,
          (
            COALESCE(t.return_at, t.planned_completion_at)::date
            + GREATEST(COALESCE(t.credit_days, 0), 0)
          ) AS due_date
        FROM terminalops.trips t
        WHERE t.company_id = $1
          AND t.deleted_at IS NULL
          AND t.client_id IS NOT NULL
          AND ($2::int IS NULL OR t.client_id = $2)
      ) sub
      GROUP BY sub.client_id
      `,
      [companyId, clientId ?? null],
    );

    const map = new Map<number, string>();
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const todayMs = today.getTime();
    const dueSoonMs = DUE_SOON_DAYS * 86_400_000;

    for (const row of rows) {
      const receivable = parseFloat(row.receivable) || 0;
      if (receivable <= 0) {
        map.set(row.client_id, 'good_standing');
        continue;
      }
      const due = row.next_due?.trim();
      if (!due) {
        map.set(row.client_id, 'watch_list');
        continue;
      }
      const dueMs = new Date(`${due}T12:00:00`).getTime();
      if (dueMs < todayMs) {
        map.set(row.client_id, 'restricted');
      } else if (dueMs <= todayMs + dueSoonMs) {
        map.set(row.client_id, 'due_soon');
      } else {
        map.set(row.client_id, 'good_standing');
      }
    }
    return map;
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
    const healthMap = await this.computeCommercialHealth(companyId, clientId);
    return {
      ...serializeClient(client),
      commercialHealth: healthMap.get(clientId) ?? 'not_evaluated',
    };
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
    if (dto.billing || dto.payment || dto.contacts || dto.delivery) {
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
      title: 'Cliente modificado',
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
    dto: Pick<CreateClientDto, 'billing' | 'payment' | 'contacts' | 'delivery'>,
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
  }
}

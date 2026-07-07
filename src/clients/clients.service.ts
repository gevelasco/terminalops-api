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
  ) {}

  async create(companyId: number, dto: CreateClientDto) {
    const client = this.clientsRepo.create({
      companyId,
      name: dto.name,
      rfc: dto.rfc,
      relationshipStartedOn: dto.relationshipStartedOn,
      notes: dto.notes,
    });
    const saved = await this.clientsRepo.save(client);
    await this.saveNested(companyId, saved.id, dto);
    return this.findOne(companyId, saved.id);
  }

  async findAll(companyId: number) {
    const rows = await this.clientsRepo
      .createQueryBuilder('client')
      .leftJoinAndSelect('client.billing', 'billing')
      .leftJoinAndSelect('client.paymentTerms', 'paymentTerms')
      .leftJoinAndSelect('client.delivery', 'delivery')
      .leftJoinAndSelect('client.contacts', 'contacts')
      .loadRelationCountAndMap('client.maneuverCount', 'client.trips', 'trip')
      .where('client.companyId = :companyId', { companyId })
      .orderBy('client.name', 'ASC')
      .addOrderBy('contacts.sortOrder', 'ASC')
      .getMany();
    return rows.map((row) => serializeClient(row));
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

  async update(companyId: number, clientId: number, dto: UpdateClientDto) {
    await this.findOne(companyId, clientId);
    await this.clientsRepo.update({ id: clientId, companyId }, {
      name: dto.name,
      rfc: dto.rfc,
      relationshipStartedOn: dto.relationshipStartedOn,
      notes: dto.notes,
    });
    if (dto.billing || dto.payment || dto.contacts || dto.delivery) {
      await this.saveNested(companyId, clientId, dto);
    }
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
        this.paymentRepo.create({ clientId, ...dto.payment }),
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
          isUnpricedRoute: hasDestination && !matchedRate,
        }),
      );
    }
  }
}

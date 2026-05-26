import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { serializeClient } from 'src/common/serializers/client.serializer';
import { ResourcePublicIdService } from 'src/common/tenant/resource-public-id.service';
import { Client } from 'src/clients/entities/client.entity';
import { ClientBilling } from 'src/clients/entities/client-billing.entity';
import { ClientContact } from 'src/clients/entities/client-contact.entity';
import { ClientPaymentTerms } from 'src/clients/entities/client-payment-terms.entity';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const CLIENT_RELATIONS = ['billing', 'paymentTerms', 'contacts'] as const;

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
    private readonly publicIds: ResourcePublicIdService,
  ) {}

  async create(
    companyId: string,
    companyPublicId: number,
    dto: CreateClientDto,
  ) {
    const client = this.clientsRepo.create({
      companyId,
      name: dto.name,
      rfc: dto.rfc,
      relationshipStartedOn: dto.relationshipStartedOn,
      notes: dto.notes,
    });
    const saved = await this.clientsRepo.save(client);
    await this.saveNested(saved.id, dto);
    return this.findOne(companyId, saved.publicId, companyPublicId);
  }

  async findAll(companyId: string, companyPublicId: number) {
    const rows = await this.clientsRepo
      .createQueryBuilder('client')
      .leftJoinAndSelect('client.billing', 'billing')
      .leftJoinAndSelect('client.paymentTerms', 'paymentTerms')
      .leftJoinAndSelect('client.contacts', 'contacts')
      .loadRelationCountAndMap('client.maneuverCount', 'client.trips', 'trip')
      .where('client.companyId = :companyId', { companyId })
      .orderBy('client.name', 'ASC')
      .addOrderBy('contacts.sortOrder', 'ASC')
      .getMany();
    return rows.map((row) => serializeClient(row, companyPublicId));
  }

  async findOne(
    companyId: string,
    clientPublicId: number,
    companyPublicId: number,
  ) {
    const client = await this.clientsRepo.findOne({
      where: { companyId, publicId: clientPublicId },
      relations: [...CLIENT_RELATIONS],
    });
    if (!client) {
      throw new NotFoundException(`Client ${clientPublicId} not found`);
    }
    return serializeClient(client, companyPublicId);
  }

  async update(
    companyId: string,
    clientPublicId: number,
    companyPublicId: number,
    dto: UpdateClientDto,
  ) {
    const internalId = await this.publicIds.resolveClientInternalId(
      companyId,
      clientPublicId,
    );
    await this.clientsRepo.update({ id: internalId, companyId }, {
      name: dto.name,
      rfc: dto.rfc,
      relationshipStartedOn: dto.relationshipStartedOn,
      notes: dto.notes,
    });
    if (dto.billing || dto.payment || dto.contacts) {
      await this.saveNested(internalId, dto);
    }
    return this.findOne(companyId, clientPublicId, companyPublicId);
  }

  async remove(companyId: string, clientPublicId: number) {
    const internalId = await this.publicIds.resolveClientInternalId(
      companyId,
      clientPublicId,
    );
    await this.clientsRepo.delete({ id: internalId, companyId });
    return { id: clientPublicId, deleted: true };
  }

  private async saveNested(
    clientId: string,
    dto: Pick<CreateClientDto, 'billing' | 'payment' | 'contacts'>,
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
  }
}

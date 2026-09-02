import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { serializeChecklistTodo } from './checklist.serializer';
import { CreateChecklistTodoDto } from './dto/create-checklist-todo.dto';
import { UpdateChecklistTodoDto } from './dto/update-checklist-todo.dto';
import { ChecklistTodo } from './entities/checklist-todo.entity';

@Injectable()
export class ChecklistService {
  constructor(
    @InjectRepository(ChecklistTodo)
    private readonly repo: Repository<ChecklistTodo>,
  ) {}

  async list(companyId: number, userId: number) {
    const rows = await this.repo.find({
      where: { companyId, userId },
      order: { createdAt: 'DESC' },
    });
    return rows.map(serializeChecklistTodo);
  }

  async create(
    companyId: number,
    userId: number,
    dto: CreateChecklistTodoDto,
  ) {
    const text = dto.text.trim();
    if (!text) {
      throw new BadRequestException('El texto de la tarea es obligatorio.');
    }
    const saved = await this.repo.save(
      this.repo.create({
        companyId,
        userId,
        text,
        completed: false,
      }),
    );
    return serializeChecklistTodo(saved);
  }

  async update(
    companyId: number,
    userId: number,
    todoId: number,
    dto: UpdateChecklistTodoDto,
  ) {
    const row = await this.findOwned(companyId, userId, todoId);
    if (dto.text !== undefined) {
      const text = dto.text.trim();
      if (!text) {
        throw new BadRequestException('El texto de la tarea es obligatorio.');
      }
      row.text = text;
    }
    if (dto.completed !== undefined) {
      row.completed = dto.completed;
    }
    const saved = await this.repo.save(row);
    return serializeChecklistTodo(saved);
  }

  async remove(companyId: number, userId: number, todoId: number) {
    const row = await this.findOwned(companyId, userId, todoId);
    await this.repo.remove(row);
    return { ok: true };
  }

  async countOpen(companyId: number, userId: number): Promise<number> {
    return this.repo.count({
      where: { companyId, userId, completed: false },
    });
  }

  private async findOwned(
    companyId: number,
    userId: number,
    todoId: number,
  ): Promise<ChecklistTodo> {
    const row = await this.repo.findOne({
      where: { id: todoId, companyId, userId },
    });
    if (!row) {
      throw new NotFoundException(`Tarea ${todoId} no encontrada`);
    }
    return row;
  }
}

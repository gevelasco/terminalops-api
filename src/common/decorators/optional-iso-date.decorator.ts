import { Transform } from 'class-transformer';
import { IsDateString, IsOptional } from 'class-validator';

/** Fecha ISO opcional: `""` y `null` se tratan como no enviado (evita 400 del front con campos vacíos). */
export function OptionalIsoDate(): PropertyDecorator {
  return function (target: object, propertyKey: string | symbol) {
    Transform(({ value }) => {
      if (value === '' || value === null || value === undefined) {
        return undefined;
      }
      return value;
    })(target, propertyKey);
    IsOptional()(target, propertyKey);
    IsDateString()(target, propertyKey);
  };
}

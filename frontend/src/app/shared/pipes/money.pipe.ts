import { Pipe, PipeTransform } from '@angular/core';
import { formatMoney } from '../../core/utils/format';

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined, compact = false): string {
    return formatMoney(value, compact);
  }
}

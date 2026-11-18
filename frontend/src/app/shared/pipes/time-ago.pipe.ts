import { Pipe, PipeTransform } from '@angular/core';
import { timeAgo } from '../../core/utils/format';

@Pipe({ name: 'timeAgo' })
export class TimeAgoPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return value ? timeAgo(value) : '';
  }
}

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kpi-card.component.html',
})
export class KpiCardComponent {
  @Input() title = 'KPI';
  @Input() value = '0';
  @Input() badge = '+0%';
  @Input() badgeUp = true;
  @Input() strongLine = 'Em alta este mês';
  @Input() subLine = '';
}

import { Component } from '@angular/core';
import { Input } from '@angular/core';

@Component({
  selector: 'app-kpi-card',
  imports: [],
  templateUrl: './kpi-card.component.html'
})
export class KpiCardComponent {
  @Input() descricao!: string;
  @Input() dados!: string;
  @Input() titulo!: string;
}

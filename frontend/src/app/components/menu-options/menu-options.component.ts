import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-menu-options',
  imports: [],
  templateUrl: './menu-options.component.html'
})
export class MenuOptionsComponent {
  @Input() imagePath!: string;
  @Input() title!: string;
}
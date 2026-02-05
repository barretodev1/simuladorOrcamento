import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-cards',
  imports: [],
  templateUrl: './cards.html'
  // styleUrl: './header.css'
})
export class Cards {
  @Input() titulo: string = '';
  @Input() desc: string = '';
  @Input() titulo_botao: string = '';
  @Input() rota: string = '';
}
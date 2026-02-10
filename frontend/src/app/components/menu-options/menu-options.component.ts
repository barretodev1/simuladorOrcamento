import { Component, Input, HostListener, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { NgIf } from '@angular/common'; // 👈 IMPORTAR

@Component({
  selector: 'app-menu-options',
  standalone: true,
  imports: [NgIf], // 👈 ADICIONAR AQUI
  templateUrl: './menu-options.component.html',
})
export class MenuOptionsComponent {
  @Input() imagePath!: string;
  @Input() title!: string;
  @Input() route!: string;
  @Input() isUser = false;

  showDropdown = false;

  constructor(
    private router: Router,
    private elRef: ElementRef
  ) { }

  go() {
    if (this.isUser) {
      this.showDropdown = !this.showDropdown;
      return;
    }

    if (!this.route) return;
    this.router.navigateByUrl(this.route);
  }

  logout() {
    localStorage.clear();
    sessionStorage.clear();
    this.router.navigateByUrl('/', { replaceUrl: true });
  }

  @HostListener('document:click', ['$event'])
  clickOutside(event: Event) {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.showDropdown = false;
    }
  }
}

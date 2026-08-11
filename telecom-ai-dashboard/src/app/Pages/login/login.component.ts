import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastService } from '../../shared/components/toast/toast.component';
import { AuthService } from '@app/services/Auth.service';

interface DemoAccount {
  username: string;
  password: string;
  role: string;
  label: string;
  color: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'})
export class LoginComponent implements OnInit {
  username = '';
  password = '';
  loading = false;
  showPass = false;
  error = '';
  returnUrl = '/overview';

  readonly demoAccounts: DemoAccount[] = [
    {
      username: 'noc_operator',
      password: 'noc123',
      role: 'noc',
      label: 'Opérateur NOC',
      color: 'red',
    },
    {
      username: 'manager_demo',
      password: 'mgr123',
      role: 'manager',
      label: 'Manager',
      color: 'green',
    },
    {
      username: 'engineer_demo',
      password: 'eng123',
      role: 'engineer',
      label: 'Ingénieur',
      color: 'blue',
    },
  ];

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.router.navigate([this.auth.getDefaultRoute()]);
      return;
    }
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/overview';
  }

  quickLogin(account: DemoAccount): void {
    // Protection contre les clics pendant le chargement
    if (this.loading) return;
    
    this.username = account.username;
    this.password = account.password;
    this.submit();
  }

  submit(): void {
    // 🔥 Protection contre les doubles clics
    if (this.loading) {
      console.log('Submit already in progress, ignoring...');
      return;
    }

    console.log('Submit clicked - Loading started');
    
    if (!this.username.trim() || !this.password) {
      this.error = 'Veuillez remplir tous les champs.';
      return;
    }
    
    this.loading = true;
    this.error = '';
    console.log('Loading state:', this.loading);

    this.auth.login(this.username.trim(), this.password).subscribe({
      next: (res) => {
        console.log('Login success');
        this.loading = false;
        this.toast.success(`Bienvenue, ${res.username}`, res.role_label);
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (err) => {
        console.log('Login error');
        this.loading = false;
        this.error = err?.message?.includes('401')
          ? 'Identifiants invalides. Vérifiez vos crédentiels.'
          : 'Erreur de connexion. L\'API est-elle démarrée ?';
      },
    });
  }
}
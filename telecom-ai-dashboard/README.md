# 🖥️ Telecom AI Dashboard — Frontend AIOps

[![Angular](https://img.shields.io/badge/Angular-20-DD0031?logo=angular)](https://angular.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Angular Material](https://img.shields.io/badge/Angular%20Material-20-3F51B5?logo=angular)](https://material.angular.dev)
[![ECharts](https://img.shields.io/badge/ECharts-6-AA344D)](https://echarts.apache.org)

> Dashboard de supervision intelligente pour les équipes télécoms : trois vues métier (**NOC**, **Manager**, **Ingénieur**), analyse des causes racines, simulateur What-If, recherche sémantique FAISS, copilote IA, suivi de dérive des modèles et boucle de feedback opérateur.

Frontend du projet **[Telecom AIOps](../README.md)** (PFE **Tunisie Télécom** × **SICAP**). Il consomme l'API FastAPI du [backend `telecom-log-intelligence`](../telecom-log-intelligence/README.md).

---

## 📋 Sommaire

- [Aperçu](#-aperçu)
- [Fonctionnalités](#-fonctionnalités)
- [Rôles et accès](#-rôles-et-accès)
- [Stack technique](#-stack-technique)
- [Installation et lancement](#-installation-et-lancement)
- [Configuration](#-configuration)
- [Architecture du code](#-architecture-du-code)
- [Scripts](#-scripts)
- [Limites connues](#-limites-connues)
- [Auteur](#-auteur)

---



## ✨ Fonctionnalités

- **Supervision temps réel** — indicateurs globaux (logs, anomalies, incidents, sévérité) en barre supérieure, alertes et file d'attente NOC.
- **Gestion des incidents** — liste, détail par incident, clôture manuelle, correction de cause (modale de feedback).
- **RCA topologique** — panneau d'analyse des causes racines et **timeline de cascade** entre plateformes (MMG, SMSC, SMPPS, SMPPC, DMC).
- **Simulateur What-If** — comparaison d'actions correctives avec gain de MTTR estimé, confiance et risque.
- **Recherche sémantique (FAISS)** — logs et incidents similaires à partir d'un texte ou d'un incident.
- **Copilote IA** — assistant d'aide à la décision branché sur le backend (LLM local via Ollama).
- **Vue Manager** — KPIs, tendances (calendrier) et **rapport de conformité SLA** par sévérité.
- **Vue Ingénieur** — métriques ML (modèles chargés, embeddings, index FAISS), **drift monitor**, **boucle de feedback** opérateur, logs bruts.
- **Analytics** — distribution des anomalies et analyses agrégées.
- **Interface** — thème clair / sombre, navigation latérale, composants réutilisables (badges de sévérité, puces de plateforme, toasts…).

## 🔐 Rôles et accès

Authentification par **jeton JWT** (`POST /auth/login`), intercepteur HTTP, **AuthGuard** (utilisateur connecté) et **RoleGuard** (contrôle par rôle).

| Route | Rôles autorisés |
|---|---|
| `/login` | public |
| `/overview`, `/incidents`, `/copilot` | tout utilisateur connecté |
| `/noc` (alertes, file d'attente, temps réel) | `noc`, `engineer` |
| `/manager` (KPIs, tendances, SLA) | `manager`, `engineer` |
| `/analytics` | `manager`, `engineer` |
| `/similarity` | `engineer`, `manager` |
| `/engineer` (ML métriques, détails, logs bruts) | `engineer` |

**Comptes de démonstration** (affichés sur la page de connexion) :

| Utilisateur | Mot de passe | Rôle |
|---|---|---|
| `noc_operator` | `noc123` | NOC |
| `manager_demo` | `mgr123` | Manager |
| `engineer_demo` | `eng123` | Ingénieur |

> ⚠️ Comptes de **démonstration uniquement**, définis côté backend. À remplacer pour tout usage réel.

## 🛠️ Stack technique

| Domaine | Technologies |
|---|---|
| Framework | Angular 20 (`@angular/*` ^20) · TypeScript 5.8 · RxJS 7.8 |
| UI | Angular Material + CDK · Tailwind CSS 4 |
| Visualisation | Chart.js 4 · Apache ECharts 6 (`ngx-echarts`) |
| Tests | Karma · Jasmine |
| Build | Angular CLI / `@angular/build` |

## ⚙️ Installation et lancement

### Prérequis
- Node.js 18+ et npm
- Le **backend** démarré sur `http://localhost:8000` (voir son [README](../telecom-log-intelligence/README.md))

### Démarrage

```bash
cd telecom-ai-dashboard
npm install
npm start          # équivaut à `ng serve`
# Application disponible sur http://localhost:4200
```

En développement, `proxy.conf.json` redirige automatiquement `/dashboard` et `/auth` vers `http://localhost:8000` : aucun réglage CORS n'est nécessaire côté navigateur.

### Build de production

```bash
npm run build
# Artefacts générés dans dist/
```

## 🔧 Configuration

| Fichier | Rôle |
|---|---|
| `src/environments/environment.ts` | Développement : `apiUrl: ''` (requêtes relatives, via le proxy) · `ollamaUrl: 'http://localhost:11434'` |
| `src/environments/environment.prod.ts` | Production : `apiUrl: '/api'` |
| `proxy.conf.json` | Proxy de développement vers l'API (`localhost:8000`) |

> En production, servir le build derrière un **reverse proxy** qui expose l'API sous `/api` (ou adapter `apiUrl`).

## 📁 Architecture du code

```
src/app/
├── Pages/                  # Pages routées
│   ├── login/ · home/
│   ├── incidents/          # list · detail · analytics
│   ├── noc/                # dashboard · alerts · queue
│   ├── manager/            # kpis · trends · sla
│   └── engineer/           # ml-metrics · incident-details · raw-logs
├── features/               # Modules fonctionnels réutilisables
│   ├── rca-panel/ · cascade-timeline/ · anomaly-table/
│   ├── what-if-simulator/ · similarity-search/ · ai-copilot/
│   ├── drift monitor/ · feedback-loop/
│   └── charts/
├── core/                   # guards (auth, rôle) · interceptors (auth, loading) · models · utils
├── services/               # Clients API : auth, incidents, NOC, manager, engineer,
│                           #   copilot, faiss, what-if, drift, feedback, alertes
├── layout/                 # auth-layout · main-layout · sidebar · topbar
└── shared/                 # Composants UI : badges, puces de plateforme, modales, toasts, stat-cards…
```

## 📜 Scripts

| Commande | Description |
|---|---|
| `npm start` | Serveur de développement (avec proxy API) |
| `npm run build` | Build de production |
| `npm run watch` | Build en continu (configuration développement) |
| `npm test` | Tests unitaires (Karma + Jasmine) |

## ⚠️ Limites connues

- Le frontend dépend du backend (API sur `:8000`) et, pour le copilote, d'un serveur Ollama accessible.
- Des dossiers portent des noms avec espace (`drift monitor/`, `Base api.service.ts`, `Auth.service.ts`) : à normaliser en `kebab-case` pour la portabilité.
- Les captures `docs/screenshots/` doivent être ajoutées au dépôt pour l'aperçu ci-dessus.

## 👤 Auteur

**Cherni Mohamed Amine** — Projet de Fin d'Études, Génie Informatique (soutenu le 30/06/2026)
Réalisé avec **Tunisie Télécom** et **SICAP**

- 💻 [GitHub](https://github.com/cherniamine) · 🔗 [LinkedIn](https://www.linkedin.com/in/cherni-mohamed-amine-40158b2b1/)
- 📧 chernimohamedamine551@gmail.com

Projet académique — tous droits réservés (voir le [README racine](../README.md)).

# Telecom Log Intelligence

**Supervision Intelligente et Proactive des Logs Applicatifs par Analyse Avancée et Détection d'Anomalies**

## 📋 Description du Projet

Dans le cadre de mon Projet de Fin d'Études (PFE) en collaboration avec **Tunisie Télécom** et **SICAP**, ce projet vise à transformer les logs applicatifs massifs en un levier décisionnel intelligent pour la supervision proactive des infrastructures télécoms.

Face à la digitalisation croissante des systèmes d'information, les applications génèrent quotidiennement des volumes massifs de logs techniques. La supervision traditionnelle, basée sur des dashboards descriptifs et une approche réactive, montre ses limites face à la complexité croissante des systèmes et l'augmentation continue des volumes de données.

**Telecom Log Intelligence** propose une solution innovante de supervision intelligente qui :
- Exploite des volumes importants de logs applicatifs (7.2M+ logs)
- Détecte proactivement les anomalies en temps réel
- Identifie automatiquement les causes racines des incidents
- Prédit l'impact et la durée des incidents
- Recommande des actions de remédiation
- Réduit les incidents avant qu'ils n'impactent les utilisateurs finaux

## 🏗️ Architecture du Système
┌─────────────────────────────────────────────────────────────────┐
│ TELECOM LOG INTELLIGENCE │
├─────────────────────────────────────────────────────────────────┤
│ │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ Ingestion │────▶│ Batch │────▶│ AI │ │
│ │ des Logs │ │ Pipeline │ │ Orchestrator │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ │
│ │ │ │ │
│ ▼ ▼ ▼ │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ Realtime │ │ MongoDB │ │ Engines │ │
│ │ Simulator │────▶│ Intelligence│◀───│ (RCA, AI) │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ │
│ │ │ │
│ ▼ ▼ │
│ ┌──────────────┐ ┌──────────────┐ │
│ │ Dashboard │ │ Alerts │ │
│ │ (REST API) │ │ (Email) │ │
│ └──────────────┘ └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘

text

## 🚀 Fonctionnalités Principales

### 1. **Détection d'Anomalies**
- Détection d'anomalies basée sur l'embedding de logs (sentence-transformers)
- Isolation Forest pour la détection de points aberrants
- Identification de 71,393 anomalies sur 7.2M logs

### 2. **Root Cause Analysis (RCA)**
- Inférence causale automatique
- Détection des cascades d'incidents multi-plateformes
- Identification des causes racines (fail, retry, error, timeout...)

### 3. **Prédiction d'Impact et de Durée**
- Estimation de l'impact client (HIGH/MEDIUM/LOW)
- Prédiction du temps de résolution (8-90 minutes)
- Évaluation du risque de propagation

### 4. **Auto-Remédiation**
- Recommandations d'actions automatiques
- Ajustement dynamique des actions selon le contexte

### 5. **Supervision Temps Réel**
- Simulation de flux de logs en temps réel
- Traitement par batch de 20 logs
- Alertes email automatiques (SMTP)

### 6. **Dashboard API REST**
- Vue d'ensemble des incidents
- Analyse des anomalies
- Visualisation de la timeline
- Heatmap par plateforme
- Historique complet des incidents

## 🛠️ Stack Technique

| Composant | Technologie |
|-----------|------------|
| **Langage** | Python 3.14 |
| **IA/ML** | Sentence-Transformers, Isolation Forest, Scikit-learn |
| **Base de Données** | MongoDB |
| **API** | Flask (RESTful) |
| **Traitement** | Pandas, NumPy |
| **Email** | SMTP (Gmail) |

## 📊 Structure du Projet
telecom-log-intelligence/
├── ai/ # Moteurs IA
│ ├── orchestrator/ # Orchestrateur principal
│ ├── engine/ # Moteurs (RCA, anomalies, propagation)
│ ├── decisioning/ # Estimation impact/durée
│ ├── notification/ # Alertes email
│ └── prediction/ # Prédictions (évolution, similarité)
├── pipeline/ # Pipelines batch & temps réel
├── realtime/ # Simulateur de flux temps réel
├── ingestion/ # Parsing et normalisation des logs
├── dashboard/ # API REST (Flask)
├── database/ # Client MongoDB
├── services/ # Services métier
├── ml/ # Modèles ML
│ ├── models/ # Modèles entraînés
│ ├── training/ # Entraînement des modèles
│ └── evaluation/ # Métriques d'évaluation
├── data/ # Données (exclues du Git)
├── notebooks/ # Jupyter notebooks d'analyse
├── config/ # Configuration
├── docker/ # Fichiers Docker
├── docs/ # Documentation
├── tests/ # Tests unitaires
├── .env # Variables d'environnement
├── .gitignore # Fichiers ignorés par Git
├── main.py # Point d'entrée principal
└── requirements.txt # Dépendances Python

text

## 📦 Installation

### Prérequis
- Python 3.14+
- MongoDB (local ou distant)
- Git LFS (optionnel pour les modèles)

### Étapes d'installation

```bash
# 1. Cloner le repository
git clone https://github.com/cherniamine/telecom-log-intelligence.git
cd telecom-log-intelligence

# 2. Créer l'environnement virtuel
python -m venv venv
source venv/bin/activate  # Linux/Mac
.\venv\Scripts\activate   # Windows

# 3. Installer les dépendances
pip install -r requirements.txt

# 4. Configurer les variables d'environnement
# Créer et éditer le fichier .env avec vos configurations
# Exemple de contenu .env:
# MONGODB_URI=mongodb://localhost:27017/
# EMAIL_SENDER=your_email@gmail.com
# EMAIL_PASSWORD=your_app_password

# 5. Lancer MongoDB (assurez-vous qu'il est démarré)
mongod --dbpath /path/to/data

# 6. Initialiser la base de données (optionnel)
python -c "from database.mongodb_client import get_db; get_db()"
🏃 Exécution
1. Pipeline Batch (analyse historique)
bash
python -m pipeline.batch_pipeline
Analyse 7.2M logs historiques

Détection des anomalies, clustering, RCA

Génération du rapport d'incident

2. Orchestrateur AI (analyse complète)
bash
python -m ai.orchestrator.telecom_ai_orchestrator
Impact estimation

Duration prediction

Auto-remediation

Similar incident search

3. Simulation Temps Réel
bash
# Terminal 1: Simulateur de flux
python -m realtime.log_stream_simulator

# Terminal 2: Pipeline temps réel
python -m pipeline.realtime_pipeline
4. Dashboard API
bash
python -m dashboard.dashboard_api
Accès API: http://localhost:5000

📡 Endpoints API
Endpoint	Description
GET /dashboard/overview	Vue d'ensemble du système
GET /dashboard/anomalies	Liste des anomalies détectées
GET /dashboard/rca	Analyse des causes racines
GET /dashboard/timeline	Timeline des incidents
GET /dashboard/heatmap	Distribution des anomalies par plateforme
GET /dashboard/impact	Estimation d'impact
GET /dashboard/duration	Prédiction de durée
GET /dashboard/intelligence	Intelligence synthétique de l'incident
GET /dashboard/evolution	Prédiction d'évolution
GET /dashboard/remediation	Actions de remédiation
GET /dashboard/similar-incidents	Incidents similaires
GET /dashboard/alerts	Flux d'alertes
GET /dashboard/incidents	Incidents actifs
GET /dashboard/incidents/history	Historique des incidents
GET /dashboard/predictions	Prédictions globales
GET /dashboard/system-status	Statut du système
GET /dashboard/email-alerts	Suivi des alertes email
Exemple d'appel API
bash
curl -X GET http://localhost:5000/dashboard/overview
📊 Résultats et Performances
Métriques Clés
Volume traité: 7,224,549 logs

Anomalies détectées: 71,393 (~1%)

Clusters identifiés: 78

Liens causals découverts: 8

Plateformes supervisées: MMG, SMSC, SMPPS, DMC

Exemple de Résultat
text
═══════════════════════════════════════════════════════════
INCIDENT DETECTED
═══════════════════════════════════════════════════════════
Severity: CRITICAL
Anomalies: 71,393
Propagation: MMG → SMSC → SMPPS → DMC
Root Causes: fail (2,925,539), retry (212,017), error (204,353)
Impact: HIGH customer impact
Predicted Resolution: 90 minutes
Recommendations:
  - Investigate failing telecom components
  - Increase SMSC queue capacity
  - Throttle retry storms
═══════════════════════════════════════════════════════════
🔧 Configuration
Variables d'environnement (.env)
bash
# MongoDB
MONGODB_URI=mongodb://localhost:27017/
MONGODB_DATABASE=telecom_logs

# Email (Gmail)
EMAIL_SENDER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_RECIPIENTS=recipient1@gmail.com,recipient2@gmail.com

# API
API_HOST=0.0.0.0
API_PORT=5000
API_DEBUG=False

# ML Models
MODELS_PATH=ml/models/
CACHE_PATH=data/cache/
🧪 Tests
bash
# Exécuter tous les tests
pytest tests/

# Exécuter un test spécifique
pytest tests/test_anomaly_engine.py

# Avec couverture
pytest --cov=. tests/
📈 Perspectives d'Évolution
Intégration continue avec CI/CD

Tableau de bord Angular pour visualisation avancée

LLM Copilot pour l'explication des logs

Digital Twin pour simulation de propagation

GNN (Graph Neural Networks) pour modélisation des dépendances télécoms

Détection en temps réel avec WebSockets

API REST avec authentification JWT

🤝 Contribution
Ce projet a été développé dans le cadre académique. Les contributions sont les bienvenues pour les améliorations futures.

👤 Auteur
Mohamed Amine Cherni
Projet de Fin d'Études - Master en Data Science & Intelligence Artificielle


📝 Licence
Ce projet est développé dans le cadre académique du PFE. Tous droits réservés.

Note: Les données (logs, embeddings, modèles) ne sont pas incluses dans le repository Git. Contactez l'auteur pour accéder aux données d'entraînement.

📞 Contact
Pour toute question concernant ce projet, veuillez contacter :

Email: chernimohamedamine551@gmail.com

GitHub: @cherniamine

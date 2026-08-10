const EXACT_TRANSLATIONS: Record<string, string> = {
  CRITICAL: 'Critique',
  HIGH: 'Eleve',
  MAJOR: 'Majeur',
  MEDIUM: 'Moyen',
  LOW: 'Faible',
  VERY_HIGH: 'Tres elevee',
  VERY_LOW: 'Tres faible',
  OPEN: 'Ouvert',
  open: 'Ouvert',
  NEW: 'Nouveau',
  new: 'Nouveau',
  WAITING_HUMAN_VALIDATION: 'En attente de validation humaine',
  RESOLVED: 'Resolue',
  resolved: 'Resolue',
  CLOSED: 'Cloture',
  closed: 'Cloture',
  INCIDENT: 'Incident',
  PLATFORM: 'Plateforme',
  UNSTABLE: 'Instable',
  STABLE: 'Stable',
  UNKNOWN: 'Inconnu',
  INCONNU: 'Inconnu',
  INCONNUE: 'Inconnue',
  fail: 'echec',
  retry: 'nouvelle tentative',
  error: 'erreur',
  timeout: 'delai depasse',
  refused: 'refuse',
  'queue full': 'file saturee',
  disconnect: 'deconnexion',
  drop: 'coupure',
  'connection failed': 'echec de connexion',
  high_anomaly_volume: 'volume eleve d anomalies',
  wide_cluster_spread: 'dispersion large des clusters',
  multi_platform_cascade: 'cascade multi-plateforme',
  critical_severity: 'severite critique',
  critical_root_cause_keyword: 'mot-cle critique de cause racine',
  historical: 'historique',
  incidents: 'incidents',
  incident_intelligence: 'intelligence incident',
};

const PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Issue detected on platform /gi, 'Probleme detecte sur la plateforme '],
  [/Incident cascade detected:/gi, 'Cascade d incident detectee :'],
  [/Likely trigger:/gi, 'Declencheur probable :'],
  [/Causal relations discovered:/gi, 'relations causales detectees :'],
  [
    /Perform manual investigation - No automated actions available/gi,
    'Effectuer une investigation manuelle - aucune action automatisee disponible',
  ],
  [/Investigate failing telecom components/gi, 'Examiner les composants telecom en echec'],
  [
    /Check SMPP session timeout configuration/gi,
    'Verifier la configuration de delai d expiration des sessions SMPP',
  ],
  [/Increase SMSC queue capacity/gi, 'Augmenter la capacite de la file SMSC'],
  [
    /Analyze retry storm amplification/gi,
    'Analyser l amplification des tempetes de nouvelle tentative',
  ],
  [/Inspect unstable network connections/gi, 'Inspecter la stabilite des connexions reseau'],
  [
    /Check authentication or routing rejection/gi,
    'Verifier les rejets d authentification ou de routage',
  ],
  [/Restart SMPP sessions/gi, 'Redemarrer les sessions SMPP'],
  [
    /Check authentication routing policies/gi,
    'Verifier les politiques d authentification et de routage',
  ],
  [/Inspect network connectivity stability/gi, 'Inspecter la stabilite de la connectivite reseau'],
  [
    /Validate TCP connectivity and session setup/gi,
    'Valider la connectivite TCP et l etablissement des sessions',
  ],
  [/Restart failing telecom connectors/gi, 'Redemarrer les connecteurs telecom en echec'],
  [
    /Throttle retry storms and review backoff/gi,
    'Limiter les tempetes de nouvelle tentative et revoir le backoff',
  ],
  [
    /Inspect application error logs and service health/gi,
    'Inspecter les logs d erreur applicative et l etat des services',
  ],
  [/Check packet loss and transport drops/gi, 'Verifier les pertes de paquets et les coupures de transport'],
  [/Validate MMG queue status/gi, 'Verifier l etat de la file MMG'],
  [/Inspect SMSC throughput and queue depth/gi, 'Inspecter le debit SMSC et la profondeur de file'],
  [/Verify SMPP session handling/gi, 'Verifier la gestion des sessions SMPP'],
  [/Check DMC routing configuration/gi, 'Verifier la configuration de routage DMC'],
  [/Trigger emergency telecom escalation workflow/gi, 'Declencher le workflow d escalade telecom d urgence'],
  [/Large anomaly volume detected/gi, 'Volume eleve d anomalies detecte'],
  [/Multi-platform cascade propagation/gi, 'Propagation en cascade multi-plateforme'],
  [/Strong causal dependencies between metrics/gi, 'Dependances causales fortes entre les metriques'],
  [/Critical keyword detected:/gi, 'Mot-cle critique detecte :'],
];

const TOKEN_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bVERY_HIGH\b/g, 'Tres elevee'],
  [/\bVERY_LOW\b/g, 'Tres faible'],
  [/\bCRITICAL\b/g, 'Critique'],
  [/\bHIGH\b/g, 'Eleve'],
  [/\bMAJOR\b/g, 'Majeur'],
  [/\bMEDIUM\b/g, 'Moyen'],
  [/\bLOW\b/g, 'Faible'],
  [/\bUNSTABLE\b/g, 'Instable'],
  [/\bSTABLE\b/g, 'Stable'],
  [/\bOPEN\b/g, 'Ouvert'],
  [/\bNEW\b/g, 'Nouveau'],
  [/\bRESOLVED\b/g, 'Resolue'],
  [/\bCLOSED\b/g, 'Cloture'],
  [/\bWAITING_HUMAN_VALIDATION\b/g, 'En attente de validation humaine'],
  [/\bopen\b/g, 'Ouvert'],
  [/\bnew\b/g, 'Nouveau'],
  [/\bresolved\b/g, 'Resolue'],
  [/\bclosed\b/g, 'Cloture'],
  [/\bfail\b/g, 'echec'],
  [/\bretry\b/g, 'nouvelle tentative'],
  [/\berror\b/g, 'erreur'],
  [/\btimeout\b/g, 'delai depasse'],
  [/\brefused\b/g, 'refuse'],
  [/queue full/g, 'file saturee'],
  [/\bdisconnect\b/g, 'deconnexion'],
  [/\bdrop\b/g, 'coupure'],
  [/connection failed/g, 'echec de connexion'],
];

export function translateDashboardText(value: string | null | undefined, fallback = 'Inconnu'): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const direct = EXACT_TRANSLATIONS[value];

  if (direct) {
    return direct;
  }

  let text = String(value).trim();

  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  for (const [pattern, replacement] of TOKEN_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  return text;
}

export function translateSourceCollection(value: string | null | undefined): string {
  if (!value) {
    return 'historique';
  }

  return EXACT_TRANSLATIONS[value] ?? translateDashboardText(value, 'historique');
}

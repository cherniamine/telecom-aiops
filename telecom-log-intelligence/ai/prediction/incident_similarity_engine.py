from datetime import datetime

from database.mongodb_client import MongoDBClient


class IncidentSimilarityEngine:

    def __init__(self):
        self.mongo = MongoDBClient()
        self.db = self.mongo.get_database()

    def find_similar_incidents(
        self,
        propagation_path,
        severity,
        root_causes,
        dry_run=False,
    ):

        keywords = self._normalize_root_causes(root_causes)
        path_tokens = self._normalize_path(propagation_path)
        path_subset = path_tokens[:2] if len(path_tokens) >= 2 else path_tokens[:1]

        incidents_matches = self._search_collection(
            collection_name="incidents",
            severity=severity,
            path_subset=path_subset,
            limit=3,
        )

        intelligence_matches = self._search_collection(
            collection_name="incident_intelligence",
            severity=severity,
            path_subset=path_subset,
            limit=3,
        )

        matched_incidents = self._dedupe_matches(
            incidents_matches + intelligence_matches
        )[:3]

        response = {
            "timestamp": datetime.utcnow(),
            "matches_found": len(matched_incidents),
            "matched_incidents": matched_incidents,
            "searched_keywords": keywords[:3],
            "searched_propagation_path": path_subset,
            "severity": severity,
        }

        if not dry_run:
            self.db.similar_incidents.insert_one(response)

        return response

    def _search_collection(
        self,
        collection_name,
        severity,
        path_subset,
        limit=3,
    ):
        collection = self.db[collection_name]
        query = self._build_query(collection_name, severity, path_subset)
        documents = list(
            collection.find(query).sort([("timestamp", -1), ("_id", -1)]).limit(limit)
        )

        return [
            self._annotate_document(document, collection_name)
            for document in documents
        ]

    def _build_query(self, collection_name, severity, path_subset):
        severity_clauses = [
            {"severity.label": severity},
            {"severity_label": severity},
            {"incident_intelligence.severity_label": severity},
        ]

        if collection_name == "incident_intelligence":
            path_clauses = [
                {"timeline": {"$all": path_subset}},
                {"affected_platforms": {"$all": path_subset}},
            ]
        else:
            path_clauses = [
                {"telecom_dependency_analysis.propagation_path": {"$all": path_subset}},
                {"incident_intelligence.timeline": {"$all": path_subset}},
                {"timeline.timeline": {"$all": path_subset}},
            ]

        if path_subset:
            return {
                "$and": [
                    {"$or": severity_clauses},
                    {"$or": path_clauses},
                ]
            }

        return {"$or": severity_clauses}

    def _annotate_document(self, document, source_collection):
        annotated = dict(document)
        annotated["_source_collection"] = source_collection
        return annotated

    def _dedupe_matches(self, matches):
        deduped = []
        seen = set()

        for match in matches:
            key = str(match.get("_id") or match.get("summary") or match)

            if key in seen:
                continue

            seen.add(key)
            deduped.append(match)

        return deduped

    def _normalize_root_causes(self, root_causes):
        if isinstance(root_causes, dict):
            root_causes = root_causes.get("root_causes", [])

        keywords = []

        for item in root_causes or []:
            if isinstance(item, (list, tuple)) and item:
                keyword = item[0]
            else:
                keyword = item

            if keyword is None:
                continue

            text = str(keyword).strip().lower()

            if text:
                keywords.append(text)

        return list(dict.fromkeys(keywords))

    def _normalize_path(self, propagation_path):
        normalized = []

        for platform in propagation_path or []:
            text = str(platform).strip().upper()

            if text:
                normalized.append(text)

        return normalized

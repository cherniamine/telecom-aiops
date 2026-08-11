from database.mongodb_client import MongoDBClient

# Créer une instance du client
client = MongoDBClient()

# Récupérer une collection
collection = client.get_collection("dmc_logs")

# Afficher les collections disponibles
print("\n📊 Collections disponibles :")
collections = client.db.list_collection_names()
for coll in collections:
    print(f"  • {coll}")

# Fermer la connexion
client.close()
print("\n✅ Test terminé")
# test_faiss_structure.py
import sys
sys.path.insert(0, '.')

from similarity.faiss_similarity_engine import FaissSimilarityEngine

print("=== TEST STRUCTURE FAISS ===\n")

# Initialiser l'engine
engine = FaissSimilarityEngine()
print("✓ Engine initialisé")

# Charger l'index
try:
    engine._ensure_index_loaded()
    print("✓ Index chargé avec succès\n")
except Exception as e:
    print(f"✗ Erreur chargement: {e}")
    sys.exit(1)

# Examiner l'index
idx = engine.index
print(f"Type de l'index principal: {type(idx)}")
print(f"Nom: {type(idx).__name__}")

# Vérifier les attributs disponibles
print(f"\nAttributs disponibles sur index principal:")
print([attr for attr in dir(idx) if not attr.startswith('_')][:10])

# Chercher sub_index ou index
if hasattr(idx, 'sub_index'):
    print(f"\n✓ sub_index trouvé!")
    sub = idx.sub_index
    print(f"  Type de sub_index: {type(sub)}")
    print(f"  Nom: {type(sub).__name__}")
    
    # Vérifier nprobe sur sub_index
    if hasattr(sub, 'nprobe'):
        print(f"  ✓ sub_index a nprobe = {sub.nprobe}")
    else:
        print(f"  ✗ sub_index n'a PAS d'attribut nprobe")
        
        # Chercher plus profondément
        if hasattr(sub, 'index'):
            sub2 = sub.index
            print(f"    → sub_index.index: {type(sub2).__name__}")
            if hasattr(sub2, 'nprobe'):
                print(f"    ✓ nprobe trouvé = {sub2.nprobe}")
        
        elif hasattr(sub, 'sub_index'):
            sub2 = sub.sub_index
            print(f"    → sub_index.sub_index: {type(sub2).__name__}")
            if hasattr(sub2, 'nprobe'):
                print(f"    ✓ nprobe trouvé = {sub2.nprobe}")

elif hasattr(idx, 'index'):
    print(f"\n✓ index trouvé!")
    sub = idx.index
    print(f"  Type: {type(sub)}")
    if hasattr(sub, 'nprobe'):
        print(f"  ✓ nprobe = {sub.nprobe}")

# Lister tous les attributs de l'index interne
print(f"\n📋 Tous les attributs de l'index:")
if hasattr(idx, 'sub_index'):
    attrs = [attr for attr in dir(idx.sub_index) if not attr.startswith('_')]
    print(f"  sub_index: {attrs[:15]}")
elif hasattr(idx, 'index'):
    attrs = [attr for attr in dir(idx.index) if not attr.startswith('_')]
    print(f"  index: {attrs[:15]}")

print("\n=== FIN TEST ===")
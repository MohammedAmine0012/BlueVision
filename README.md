# AquaGuard Dakhla — Prototype de démo (Hackathon)

Plateforme d'intelligence côtière : « météo des risques marins » pour anticiper les efflorescences
algales nuisibles (HAB) à 72 h autour de Dakhla.

```
aquaguard/
├── frontend/   React (Vite) + TailwindCSS + Leaflet  → le tableau de bord
├── backend/    FastAPI  → moteur de données (scénario simulé déterministe)
└── ai_poc/     PyTorch U-Net → preuve de concept vision par ordinateur
```

## 1. Lancer la démo (2 terminaux)

**Backend (Python 3.10+)**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --port 8000
# Docs interactives : http://localhost:8000/docs
```

**Frontend (Node 18+)**
```bash
cd frontend
npm install
npm run dev
# Ouvrir http://localhost:5173
```

> **Anti-crash :** si l'API n'est pas lancée, le front bascule automatiquement sur
> `frontend/public/mock_bundle.json` (badge « Données locales » en haut à droite).
> Si le Wi-Fi de la salle tombe, choisissez le fond **vectoriel hors-ligne** (3ᵉ bouton du sélecteur de fond) :
> la carte reste complète sans aucune tuile internet.

## 2. Raccourcis clavier (pour un enregistrement fluide)

| Touche | Action |
|---|---|
| `D` | **Démo guidée** : lecture 0 → 72 h (~21 s), la caméra suit chaque zone qui passe au rouge (`Échap` pour arrêter) |
| `Espace` | Lecture / pause de la prévision 0 → 72 h (~14 s) |
| `1` `2` `3` `4` | Sauter à Aujourd'hui / +24 h / +48 h / +72 h |
| `←` `→` | ± 3 h |
| `M` / `I` | Onglet Carte / onglet Vision IA |

## 3. Le scénario de démo (déterministe)

Un bloom né dans la zone d'upwelling au large dérive vers le sud-est avec les courants, puis
entre dans la lagune par la passe sud avec la marée montante :

| Zone | Secteur | Passe en rouge à |
|---|---|---|
| Cages piscicoles Atlantique | Aquaculture | +57 h |
| Zone aquacole de Boutalha | Aquaculture | +60 h |
| Station de dessalement | Eau | +63 h |
| Baie kitesurf | Tourisme | jaune à +72 h |
| Port Dakhla Atlantique | Logistique | reste vert (témoin) |

Le scénario se règle dans `backend/engine.py` (fonction `risk_field`). Après modification :
`python backend/export_mock.py` pour régénérer le fichier hors-ligne du front.

## 4. Preuve de concept IA (U-Net)

```bash
cd ai_poc
pip install torch numpy scipy pillow
python train_unet.py --steps 900        # ~5-10 min sur CPU
```
Produit dans `ai_poc/outputs/` (et copie dans `frontend/public/ai/` pour l'onglet « Vision IA ») :
`showcase_triptych.png` (image | masque | superposition), `metrics.json` (IoU, Dice…), `unet_hab.pt`.

**Données d'entraînement :** scènes multispectrales *synthétiques* (bandes Sentinel-2 B2/B3/B4/B8)
avec nuages, reflets, panaches turbides et côte désertique comme pièges. C'est une démonstration de
la méthode, pas un modèle validé sur données terrain — dites-le honnêtement au jury, c'est un atout
(« la chaîne est prête, il manque les données labellisées que nous construirons avec l'INRH/ONSSA »).

**Sur une vraie image satellite :**
1. Copernicus Browser → https://browser.dataspace.copernicus.eu → Sentinel-2 L2A, zone de Dakhla,
   choisir une date avec bloom visible (eaux vert-brun), exporter en *True color* PNG (et B08 si possible).
2. ```bash
   python segment_real.py --rgb dakhla_s2.png --finetune
   ```
   Le réseau est adapté à la scène réelle par pseudo-étiquettes spectrales (indice vert/bleu sur les
   pixels d'eau), puis sort `dakhla_s2_triptych.png`. Copiez les images dans `frontend/public/ai/`
   sous les noms `showcase_raw.png` / `showcase_mask.png` / `showcase_overlay.png` pour les afficher dans le dashboard.

## 5. API

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/bundle` | tout le scénario (zones, côte, 25 grilles 3-horaires, KPIs) |
| GET | `/api/forecast?hour=48` | scores et alertes par zone à un horizon |
| GET | `/api/zones/{id}?hour=60` | détail d'une zone |
| POST | `/api/alerts/{id}` | simule l'envoi SMS / WhatsApp / e-mail |

Sources de données visées en production : Copernicus Sentinel-2/3 (ESA), courants CMEMS,
bouées et prélèvements locaux. Trait de côte : Natural Earth 1:10m (domaine public).

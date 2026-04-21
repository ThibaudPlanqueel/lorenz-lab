# Lorenz Lab

Petit labo web sur trois systèmes dynamiques chaotiques (Lorenz, Rössler, Chua).
Le front TypeScript anime les trajectoires côté client, une mini-API Python
calcule des métriques d'analyse (stats, pics spectraux, exposant de Lyapunov),
et deux graphs Plotly légers rendent les résultats lisibles d'un coup d'œil.
Chaque bloc de résultats est accompagné d'une petite lecture commentée
qui explique ce qu'on voit — le but est de rendre le chaos _lisible_,
pas juste calculé.

Sert aussi de **vitrine d'architecture** : abstractions-first des deux côtés
(classe abstraite `DynamicalSystem` en TS, `TrajectoryAnalyzer` ABC en Python),
conteneurisé, testé, CI.

![CI](https://github.com/thibaudplanqueel/lorenz-lab/actions/workflows/ci.yml/badge.svg)

---

## Démo live

**→ [thibaudplanqueel.github.io/lorenz-lab](https://thibaudplanqueel.github.io/lorenz-lab/)**

L'animation Canvas, le choix des systèmes, les formules KaTeX et la structure
générale tournent côté client. Le bouton _Analyser_ est désactivé sur la démo
en ligne (pas de backend Python sur GitHub Pages) — pour l'activer, voir
_Démarrage complet_ ci-dessous.

---

## Démarrage complet (avec analyse)

```bash
make up
```

Puis ouvrir [http://localhost:8080](http://localhost:8080).

Le frontend est servi par nginx qui proxifie `/api/*` vers le service Python.

```bash
make down    # arrêter
make logs    # suivre les logs
make test    # lancer frontend + api tests
```

---

## Architecture

```
.
├── frontend/               # TypeScript + Canvas, servi par nginx
│   ├── src/
│   │   ├── index.html
│   │   ├── main.ts
│   │   ├── systems/
│   │   │   ├── DynamicalSystem.ts     ← classe abstraite (contrat + RK4)
│   │   │   ├── LorenzSystem.ts
│   │   │   ├── RosslerSystem.ts
│   │   │   ├── ChuaSystem.ts
│   │   │   └── SystemFactory.ts
│   │   ├── rendering/
│   │   │   ├── AttractorSketch.ts     ← renderer canvas générique
│   │   │   ├── ResultVisualizer.ts    ← graphs Plotly (thème crème/ambre)
│   │   │   └── ResultInterpreter.ts   ← traduit chiffres → phrases
│   │   └── api/
│   │       └── AnalysisClient.ts      ← wrapper HTTP typé
│   ├── tests/
│   │   ├── LorenzSystem.test.ts
│   │   └── rk4.test.ts                ← conservation d'énergie harmonique
│   ├── Dockerfile                     ← multi-stage node + nginx
│   └── nginx.conf
│
├── api/                    # FastAPI + NumPy + SciPy
│   ├── src/
│   │   ├── main.py                    ← routes /health, /systems, /analyze
│   │   ├── schemas.py                 ← Pydantic
│   │   └── analysis/
│   │       └── analyzers.py           ← ABC + 3 implémentations + composite
│   ├── tests/
│   │   └── test_analyzers.py          ← signaux synthétiques
│   └── Dockerfile
│
├── .github/workflows/ci.yml           ← frontend + api + docker build
├── docker-compose.yml
├── Makefile
└── README.md
```

### Côté TypeScript

Une classe abstraite `DynamicalSystem` définit le contrat et implémente RK4
une seule fois. Chaque système concret n'a qu'à fournir sa dérivée et ses
`ViewHints` (projection, centre, échelle). Le renderer lit ces hints pour
s'adapter automatiquement.

Ajouter un quatrième système, c'est ~30 lignes : une nouvelle sous-classe
et une entrée dans la factory.

### Côté Python

Même philosophie. Une ABC `TrajectoryAnalyzer` avec trois implémentations :

- `StatsAnalyzer` — moyenne, écart-type, min/max par axe
- `SpectralAnalyzer` — FFT + détection de pics sur la composante x
- `LyapunovAnalyzer` — estimation de l'exposant maximal par Rosenstein (1993)

Un `CompositeAnalyzer` applique la composition pattern : n'importe quelle
combinaison d'analyseurs peut être exécutée en une seule passe.

---

## Endpoints

| Méthode | Route      | Description                                      |
| ------- | ---------- | ------------------------------------------------ |
| `GET`   | `/health`  | Vérification de vie du service                   |
| `GET`   | `/systems` | Liste des systèmes supportés et leurs paramètres |
| `POST`  | `/analyze` | Analyse une trajectoire (points + dt)            |

Exemple de requête :

```bash
curl -X POST http://localhost:8080/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "points": [{"x":0.1, "y":0, "z":0}, ...],
    "dt": 0.008
  }'
```

---

## Stack

**Frontend** : TypeScript 5.5 · Plotly.js basic · Vitest · nginx alpine
**Backend** : Python 3.12 · FastAPI · Pydantic · NumPy · SciPy · pytest · ruff
**Infra** : Docker multi-stage · docker-compose · GitHub Actions

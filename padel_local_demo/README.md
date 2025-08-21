# Padel Tournois — Demo locale
Ouvrez `index.html` dans votre navigateur (double-clic). Les données sont stockées en LocalStorage.
Fonctions :
- gestion des joueurs et des paires (avec têtes de série),
- création de tournois + inscriptions de paires,
- création de matchs entre paires inscrites,
- scoring live complet (15/30/40, tie-break, super tie-break) avec Undo,
- export/import JSON, reset, et données de démo.

Astuce: si votre navigateur limite l'accès aux fichiers, lancez un mini-serveur local:
- Python: `python -m http.server 8000` puis ouvrez http://localhost:8000
